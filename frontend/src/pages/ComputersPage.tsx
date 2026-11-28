import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { deleteBuilding, getAvailableIPs, getBuildings } from '../api/buildings'
import { deleteComputer, exportComputers, getComputers, importComputers } from '../api/computers'
import BuildingForm from '../components/BuildingForm'
import BuildingSidebar from '../components/BuildingSidebar'
import ComputerDetails from '../components/ComputerDetails'
import ComputerForm from '../components/ComputerForm'
import ComputersTable from '../components/ComputersTable'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  CloseIcon,
  ColumnsIcon,
  DownloadIcon,
  EditIcon,
  NetworkIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
} from '../components/Icons'
import NetworkTabs from '../components/NetworkTabs'
import type { NetworkFilter } from '../components/NetworkTabs'
import { computerLabel, sortComputers } from '../lib/format'
import type { Building, BuildingFilter, BuildingsOverview, Computer, SortKey } from '../types/computer'

const emptyOverview: BuildingsOverview = { items: [], unassigned: 0, total: 0 }

const defaultColumns = ['ip_address', 'hostname', 'mac_address', 'phone', 'department_name', 'operating_system']

const columnOptions: [SortKey, string][] = [
  ['ip_address', 'IP-адрес'],
  ['hostname', 'Устройство'],
  ['building_name', 'Здание'],
  ['full_name', 'ФИО'],
  ['mac_address', 'MAC-адрес'],
  ['phone', 'Телефон'],
  ['department_name', 'Отдел'],
  ['operating_system', 'ОС'],
]

const deviceTypeFilters: { value: string; label: string }[] = [
  { value: 'all', label: 'Все типы' },
  { value: 'computer', label: 'Компьютеры' },
  { value: 'printer', label: 'Принтеры' },
  { value: 'phone', label: 'Телефоны' },
  { value: 'gateway', label: 'Шлюзы' },
  { value: 'other', label: 'Другое' },
]

function ComputersPage() {
  const [computers, setComputers] = useState<Computer[]>([])
  const [overview, setOverview] = useState<BuildingsOverview>(emptyOverview)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('all')
  const [buildingFilter, setBuildingFilter] = useState<BuildingFilter>('all')
  const [network, setNetwork] = useState<NetworkFilter>('all')
  const [showComputerForm, setShowComputerForm] = useState(false)
  const [initialIPAddress, setInitialIPAddress] = useState('')
  const [initialBuildingId, setInitialBuildingId] = useState<number | null>(null)
  const [showFreeAddresses, setShowFreeAddresses] = useState(false)
  const [freeIPQuery, setFreeIPQuery] = useState('')
  const [freeAddressRows, setFreeAddressRows] = useState<
    { buildingId: number; buildingName: string; networkName: string; cidr: string; ip: string }[]
  >([])
  const [freeAddressTruncated, setFreeAddressTruncated] = useState(false)
  const [loadingFreeAddresses, setLoadingFreeAddresses] = useState(false)
  const [editingComputer, setEditingComputer] = useState<Computer | null>(null)
  const [showBuildingForm, setShowBuildingForm] = useState(false)
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null)
  const [selected, setSelected] = useState<Computer | null>(null)
  const [pendingDeleteComputer, setPendingDeleteComputer] = useState<Computer | null>(null)
  const [pendingDeleteBuilding, setPendingDeleteBuilding] = useState<Building | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('ip_address')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mchs-device-columns') || 'null')
      if (Array.isArray(saved) && saved.length > 0) return saved
      return defaultColumns
    } catch {
      return defaultColumns
    }
  })
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const columnMenuRef = useRef<HTMLDivElement>(null)
  const toastTimerRef = useRef<number | null>(null)
  const firstSearch = useRef(true)
  const lastSearch = useRef(search)

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('mchs-device-columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!showColumnMenu) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!columnMenuRef.current?.contains(event.target as Node)) setShowColumnMenu(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowColumnMenu(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [showColumnMenu])

  const loadBuildings = useCallback(async () => {
    try {
      setOverview(await getBuildings())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить здания')
    }
  }, [])

  const loadComputers = useCallback(async (term: string, building: BuildingFilter) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getComputers({ search: term, buildingId: building })
      setComputers(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить устройства'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadBuildings()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadBuildings])

  useEffect(() => {
    const searchChanged = lastSearch.current !== search
    lastSearch.current = search
    const delay = searchChanged && !firstSearch.current ? 250 : 0
    firstSearch.current = false
    const timeout = window.setTimeout(() => {
      void loadComputers(search.trim(), buildingFilter)
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [search, buildingFilter, loadComputers])

  const typeFilteredComputers = useMemo(() => {
    if (deviceTypeFilter === 'all') return computers
    if (deviceTypeFilter === 'other') {
      return computers.filter(
        (item) => !['computer', 'printer', 'phone', 'gateway'].includes(item.device_type || 'computer'),
      )
    }
    return computers.filter((item) => (item.device_type || 'computer') === deviceTypeFilter)
  }, [computers, deviceTypeFilter])

  const counts = useMemo<Record<NetworkFilter, number>>(
    () => ({
      all: typeFilteredComputers.length,
      local: typeFilteredComputers.filter((item) => item.network === 'local').length,
      external: typeFilteredComputers.filter((item) => item.network === 'external').length,
      other: typeFilteredComputers.filter((item) => item.network === 'other').length,
    }),
    [typeFilteredComputers],
  )

  const visibleComputers = useMemo(() => {
    const filtered =
      network === 'all'
        ? typeFilteredComputers
        : typeFilteredComputers.filter((item) => item.network === network)
    return sortComputers(filtered, sortKey, sortDir)
  }, [typeFilteredComputers, network, sortDir, sortKey])

  const groups = useMemo(
    () => [
      ...visibleComputers
        .reduce((map, item) => {
          const title = item.network_label || 'Другие адреса'
          const group = map.get(title) ?? { key: title, title, items: [] as Computer[] }
          group.items.push(item)
          map.set(title, group)
          return map
        }, new Map<string, { key: string; title: string; items: Computer[] }>())
        .values(),
    ],
    [visibleComputers],
  )

  const selectedBuilding =
    typeof buildingFilter === 'number'
      ? overview.items.find((item) => item.id === buildingFilter)
      : undefined

  const filteredFreeAddressRows = useMemo(() => {
    const q = freeIPQuery.trim().toLowerCase()
    if (!q) return freeAddressRows
    return freeAddressRows.filter(
      (row) =>
        row.ip.includes(q) ||
        row.networkName.toLowerCase().includes(q) ||
        row.buildingName.toLowerCase().includes(q),
    )
  }, [freeAddressRows, freeIPQuery])

  const freeAddressGroups = useMemo(() => {
    const grouped = new Map<string, { key: string; title: string; cidr: string; items: typeof freeAddressRows }>()
    for (const row of filteredFreeAddressRows) {
      const title = selectedBuilding ? row.networkName : `${row.buildingName} · ${row.networkName}`
      const key = `${row.buildingId}-${row.networkName}`
      const group = grouped.get(key) ?? { key, title, cidr: row.cidr, items: [] }
      group.items.push(row)
      grouped.set(key, group)
    }
    return [...grouped.values()]
  }, [filteredFreeAddressRows, selectedBuilding])

  const currentBuilding = useMemo(() => {
    if (buildingFilter === 'all') {
      return { name: 'Все здания', address: 'Общий реестр устройств', count: overview.total }
    }
    if (buildingFilter === 'none') {
      return { name: 'Без здания', address: 'Устройства без назначения', count: overview.unassigned }
    }
    return {
      name: selectedBuilding?.name ?? 'Здание',
      address: selectedBuilding?.address ?? '',
      count: selectedBuilding?.computers_count ?? visibleComputers.length,
    }
  }, [buildingFilter, overview, selectedBuilding, visibleComputers.length])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadComputers(search.trim(), buildingFilter)
  }

  function openCreateComputer() {
    setEditingComputer(null)
    setInitialIPAddress('')
    setInitialBuildingId(typeof buildingFilter === 'number' ? buildingFilter : null)
    setShowComputerForm(true)
  }

  function openCreateComputerWithIP(ip: string, buildingId: number) {
    setEditingComputer(null)
    setInitialIPAddress(ip)
    setInitialBuildingId(buildingId)
    setShowComputerForm(true)
  }

  function openEditComputer(computer: Computer) {
    setSelected(null)
    setEditingComputer(computer)
    setShowComputerForm(true)
  }

  async function refreshAll() {
    await Promise.all([loadComputers(search.trim(), buildingFilter), loadBuildings()])
  }

  async function handleComputerSaved(saved: Computer) {
    const wasEdit = Boolean(editingComputer)
    setShowComputerForm(false)
    setShowFreeAddresses(false)
    setEditingComputer(null)
    await refreshAll()
    setSelected(saved)
    showToast(wasEdit ? 'Устройство обновлено' : 'Устройство добавлено')
  }

  async function handleBuildingSaved(saved: Building) {
    const wasEdit = Boolean(editingBuilding)
    setShowBuildingForm(false)
    setEditingBuilding(null)
    await loadBuildings()
    setBuildingFilter(saved.id)
    setShowFreeAddresses(false)
    showToast(wasEdit ? 'Здание обновлено' : 'Здание добавлено')
  }

  async function toggleFreeAddresses() {
    if (showFreeAddresses) {
      setShowFreeAddresses(false)
      setFreeIPQuery('')
      return
    }
    const targetBuildings = selectedBuilding
      ? [selectedBuilding]
      : buildingFilter === 'all'
        ? overview.items
        : []
    if (targetBuildings.length === 0) return
    setShowFreeAddresses(true)
    setLoadingFreeAddresses(true)
    try {
      const configured = targetBuildings.flatMap((building) =>
        building.networks
          .filter((item) => item.cidr && item.id)
          .map((item) => ({ building, network: item })),
      )
      if (configured.length === 0) {
        setFreeAddressRows([])
        setFreeAddressTruncated(false)
        return
      }
      const lists = await Promise.all(
        configured.map(async ({ building, network: netItem }) => ({
          building,
          network: netItem,
          result: await getAvailableIPs(netItem.id as number),
        })),
      )
      setFreeAddressRows(
        lists.flatMap(({ building, network: netItem, result }) =>
          result.items.map((ip) => ({
            buildingId: building.id,
            buildingName: building.name,
            networkName: netItem.name,
            cidr: netItem.cidr,
            ip,
          })),
        ),
      )
      setFreeAddressTruncated(lists.some(({ result }) => result.truncated))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить свободные адреса')
      setShowFreeAddresses(false)
    } finally {
      setLoadingFreeAddresses(false)
    }
  }

  async function handleDeleteComputer() {
    if (!pendingDeleteComputer) return
    try {
      await deleteComputer(pendingDeleteComputer.id)
      if (selected?.id === pendingDeleteComputer.id) setSelected(null)
      setPendingDeleteComputer(null)
      await refreshAll()
      showToast('Устройство удалено')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить запись')
      setPendingDeleteComputer(null)
    }
  }

  async function handleDeleteBuilding() {
    if (!pendingDeleteBuilding) return
    try {
      const nextFilter: BuildingFilter =
        buildingFilter === pendingDeleteBuilding.id ? 'all' : buildingFilter
      await deleteBuilding(pendingDeleteBuilding.id)
      setShowFreeAddresses(false)
      setBuildingFilter(nextFilter)
      setPendingDeleteBuilding(null)
      await Promise.all([loadComputers(search.trim(), nextFilter), loadBuildings()])
      showToast('Здание удалено')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить здание')
      setPendingDeleteBuilding(null)
    }
  }

  async function handleExport() {
    try {
      await exportComputers({
        search: search.trim(),
        buildingId: buildingFilter,
        network,
      })
      showToast('Файл computers.csv скачан')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось экспортировать данные')
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const result = await importComputers(file)
      const extra = result.errors.length ? ` Примеры ошибок: ${result.errors.slice(0, 3).join('; ')}` : ''
      setNotice(`Импорт завершён: добавлено ${result.created}, пропущено ${result.skipped}.${extra}`)
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось импортировать файл')
    }
  }

  function handleCopy(label: string, value: string) {
    showToast(`Скопировано (${label}): ${value}`)
  }

  const groupedView = network === 'all'
  const canShowFreeAddresses = selectedBuilding
    ? selectedBuilding.networks.some((item) => item.cidr)
    : buildingFilter === 'all' &&
      overview.items.some((building) => building.networks.some((item) => item.cidr))

  return (
    <div className="workspace-layout flex min-h-0 flex-1">
      <BuildingSidebar
        overview={overview}
        selected={buildingFilter}
        onSelect={(value) => {
          setBuildingFilter(value)
          setShowFreeAddresses(false)
          setFreeIPQuery('')
        }}
        onAdd={() => {
          setEditingBuilding(null)
          setShowBuildingForm(true)
        }}
        onEdit={(building) => {
          setEditingBuilding(building)
          setShowBuildingForm(true)
        }}
        onDelete={setPendingDeleteBuilding}
      />

      <main className="workspace-main min-w-0 flex-1 overflow-auto p-4 md:p-6">
        <section className="surface-card overflow-visible">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-slate-900">{currentBuilding.name}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
                  {currentBuilding.count}
                </span>
                {selectedBuilding && (
                  <button
                    type="button"
                    className="icon-btn"
                    title="Настроить здание и подсети"
                    aria-label="Редактировать здание"
                    onClick={() => {
                      setEditingBuilding(selectedBuilding)
                      setShowBuildingForm(true)
                    }}
                  >
                    <EditIcon size={14} />
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {currentBuilding.address || 'Адрес не указан'}
              </p>
              {selectedBuilding && selectedBuilding.networks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedBuilding.networks.map((netItem) => (
                    <span
                      key={netItem.id ?? netItem.name}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                    >
                      <span className="font-medium">{netItem.name}</span>
                      <span className="font-mono text-[11px] text-slate-400">{netItem.cidr}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canShowFreeAddresses && (
                <button
                  type="button"
                  className={`btn ${showFreeAddresses ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => void toggleFreeAddresses()}
                >
                  <NetworkIcon size={15} />
                  {showFreeAddresses ? 'Скрыть свободные IP' : 'Свободные IP'}
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={openCreateComputer}>
                <PlusIcon size={15} />
                Добавить устройство
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                title="Импорт из CSV"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon size={15} />
                <span className="hidden sm:inline">Импорт</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                title="Экспорт в CSV"
                onClick={() => void handleExport()}
              >
                <DownloadIcon size={15} />
                <span className="hidden sm:inline">Экспорт</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => void handleImport(event)}
              />
            </div>
          </div>

          <form className="flex flex-col gap-2.5 px-5 py-3.5 md:flex-row md:items-center" onSubmit={handleSearchSubmit}>
            <div className="relative min-w-0 flex-1">
              <SearchIcon
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                placeholder="Поиск по IP, MAC, имени, ФИО, отделу, типу или зданию… (Ctrl+K)"
                className="field pl-9 pr-8"
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
                  onClick={() => setSearch('')}
                  aria-label="Очистить поиск"
                >
                  <CloseIcon size={14} />
                </button>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <select
                aria-label="Фильтр по типу устройства"
                className="field w-auto min-w-[140px]"
                value={deviceTypeFilter}
                onChange={(event) => setDeviceTypeFilter(event.target.value)}
              >
                {deviceTypeFilters.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div ref={columnMenuRef} className="relative z-30">
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-label="Настроить столбцы таблицы"
                  title="Колонки таблицы"
                  onClick={() => setShowColumnMenu((open) => !open)}
                >
                  <ColumnsIcon size={15} />
                  <span className="hidden sm:inline">Колонки</span>
                </button>
                {showColumnMenu && (
                  <div className="surface-card absolute right-0 top-full z-50 mt-1.5 w-56 p-3 shadow-lg">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-600">Колонки таблицы</p>
                      <button
                        type="button"
                        className="text-xs text-sky-700 hover:underline"
                        onClick={() => setVisibleColumns(defaultColumns)}
                      >
                        Сбросить
                      </button>
                    </div>
                    {columnOptions.map(([key, label]) => {
                      const checked = visibleColumns.includes(key)
                      const disabled = checked && visibleColumns.length === 1
                      return (
                        <label
                          key={key}
                          className={`flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-700 ${
                            disabled ? 'opacity-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={checked}
                            onChange={(event) =>
                              setVisibleColumns((current) =>
                                event.target.checked
                                  ? [...current, key]
                                  : current.filter((item) => item !== key),
                              )
                            }
                          />
                          {label}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-primary">
                Найти
              </button>
            </div>
          </form>

          <NetworkTabs value={network} counts={counts} onChange={setNetwork} />
        </section>

        {error && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <button type="button" className="icon-btn shrink-0" aria-label="Скрыть ошибку" onClick={() => setError(null)}>
              <CloseIcon size={15} />
            </button>
          </div>
        )}
        {notice && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span>{notice}</span>
            <button type="button" className="icon-btn shrink-0" aria-label="Скрыть уведомление" onClick={() => setNotice(null)}>
              <CloseIcon size={15} />
            </button>
          </div>
        )}

        {showFreeAddresses && (
          <section className="surface-card mt-4 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-sky-50/60 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">Свободные IP-адреса</h3>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
                  {loadingFreeAddresses ? '…' : filteredFreeAddressRows.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!loadingFreeAddresses && freeAddressRows.length > 0 && (
                  <input
                    type="text"
                    className="field w-44 py-1 text-xs font-mono"
                    placeholder="Фильтр IP, напр. .45"
                    value={freeIPQuery}
                    onChange={(event) => setFreeIPQuery(event.target.value)}
                  />
                )}
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Скрыть свободные IP"
                  onClick={() => {
                    setShowFreeAddresses(false)
                    setFreeIPQuery('')
                  }}
                >
                  <CloseIcon size={15} />
                </button>
              </div>
            </div>
            {loadingFreeAddresses ? (
              <p className="p-5 text-center text-sm text-slate-500">Загружаю адреса подсетей…</p>
            ) : filteredFreeAddressRows.length === 0 ? (
              <p className="p-5 text-center text-sm text-slate-500">
                {freeAddressRows.length === 0 ? 'Свободных адресов не найдено.' : 'Нет совпадений по фильтру.'}
              </p>
            ) : (
              <div className="max-h-72 overflow-auto">
                {freeAddressGroups.map((group) => (
                  <div key={group.key}>
                    <div className="sticky top-0 flex items-center justify-between border-y border-slate-100 bg-slate-50 px-4 py-1.5 text-xs font-medium text-slate-600">
                      <span>
                        {group.title}{' '}
                        <span className="ml-1 font-mono text-[11px] text-slate-400">{group.cidr}</span>
                      </span>
                      <span className="tabular-nums text-slate-400">{group.items.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-3">
                      {group.items.map((row) => (
                        <button
                          key={`${row.buildingId}-${row.networkName}-${row.ip}`}
                          type="button"
                          title={`${row.cidr} · Нажмите, чтобы добавить устройство с этим IP`}
                          className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 font-mono text-xs text-sky-900 transition-colors hover:bg-sky-100"
                          onClick={() => openCreateComputerWithIP(row.ip, row.buildingId)}
                        >
                          {row.ip}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {freeAddressTruncated && (
                  <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                    В некоторых сетях отображены первые 4096 свободных адресов.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        <section className="mt-4">
          {loading && computers.length === 0 && !error ? (
            <div className="surface-card px-6 py-16 text-center text-sm text-slate-500">Загрузка…</div>
          ) : computers.length === 0 && error ? (
            <div className="surface-card px-6 py-10 text-center text-sm text-slate-500">
              Не удалось получить список устройств.
            </div>
          ) : visibleComputers.length === 0 ? (
            <div className="surface-card px-6 py-14 text-center">
              <p className="text-base font-semibold text-slate-800">
                {search.trim()
                  ? `Ничего не найдено по запросу «${search.trim()}»`
                  : deviceTypeFilter !== 'all'
                    ? 'Нет устройств выбранного типа'
                    : network !== 'all'
                      ? 'В этой сети пока нет устройств'
                      : 'Устройства ещё не добавлены'}
              </p>
              <p className="mt-1.5 text-sm text-slate-500">
                Добавьте устройство или измените фильтры поиска.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                {(search.trim() || deviceTypeFilter !== 'all' || network !== 'all') && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setSearch('')
                      setDeviceTypeFilter('all')
                      setNetwork('all')
                    }}
                  >
                    Сбросить фильтры
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={openCreateComputer}>
                  <PlusIcon size={15} />
                  Добавить устройство
                </button>
              </div>
            </div>
          ) : groupedView ? (
            <div className="space-y-4">
              {groups
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.key} className="surface-card overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
                      <h3 className="text-sm font-semibold text-slate-800">{group.title}</h3>
                      <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
                        {group.items.length}
                      </span>
                    </div>
                    <ComputersTable
                      computers={group.items}
                      visibleColumns={visibleColumns}
                      selectedId={selected?.id}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                      onSelect={setSelected}
                      onEdit={openEditComputer}
                      onDelete={setPendingDeleteComputer}
                      onCopy={handleCopy}
                    />
                  </div>
                ))}
            </div>
          ) : (
            <div className="surface-card overflow-hidden">
              <ComputersTable
                computers={visibleComputers}
                visibleColumns={visibleColumns}
                selectedId={selected?.id}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                onSelect={setSelected}
                onEdit={openEditComputer}
                onDelete={setPendingDeleteComputer}
                onCopy={handleCopy}
              />
            </div>
          )}
        </section>
      </main>

      {selected && !showComputerForm && (
        <ComputerDetails
          computer={selected}
          onClose={() => setSelected(null)}
          onEdit={() => openEditComputer(selected)}
          onDelete={() => setPendingDeleteComputer(selected)}
          onCopy={handleCopy}
        />
      )}

      {showComputerForm && (
        <ComputerForm
          key={editingComputer?.id ?? `new-${initialBuildingId ?? 'none'}-${initialIPAddress}`}
          computer={editingComputer}
          buildings={overview.items}
          defaultBuildingId={initialBuildingId}
          defaultIPAddress={initialIPAddress}
          onClose={() => setShowComputerForm(false)}
          onSaved={(saved) => void handleComputerSaved(saved)}
        />
      )}

      {showBuildingForm && (
        <BuildingForm
          key={editingBuilding?.id ?? 'new-building'}
          building={editingBuilding}
          onClose={() => setShowBuildingForm(false)}
          onSaved={(saved) => void handleBuildingSaved(saved)}
        />
      )}

      {pendingDeleteComputer && (
        <ConfirmDialog
          title="Удалить устройство?"
          message={`Запись «${computerLabel(pendingDeleteComputer)}» будет удалена без возможности восстановления.`}
          onCancel={() => setPendingDeleteComputer(null)}
          onConfirm={() => void handleDeleteComputer()}
        />
      )}

      {pendingDeleteBuilding && (
        <ConfirmDialog
          title="Удалить здание?"
          message={`Здание «${pendingDeleteBuilding.name}» будет удалено. Устройства останутся в списке без здания.`}
          onCancel={() => setPendingDeleteBuilding(null)}
          onConfirm={() => void handleDeleteBuilding()}
        />
      )}

      {toast && (
        <div
          role="status"
          className="toast-enter fixed bottom-5 right-5 z-[70] rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  )
}

export default ComputersPage
