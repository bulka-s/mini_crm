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
import NetworkTabs from '../components/NetworkTabs'
import type { NetworkFilter } from '../components/NetworkTabs'
import { computerLabel, sortComputers } from '../lib/format'
import type { Building, BuildingFilter, BuildingsOverview, Computer, SortKey } from '../types/computer'

const emptyOverview: BuildingsOverview = { items: [], unassigned: 0, total: 0 }

function ComputersPage() {
  const [computers, setComputers] = useState<Computer[]>([])
  const [overview, setOverview] = useState<BuildingsOverview>(emptyOverview)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [buildingFilter, setBuildingFilter] = useState<BuildingFilter>('all')
  const [network, setNetwork] = useState<NetworkFilter>('all')
  const [showComputerForm, setShowComputerForm] = useState(false)
  const [initialIPAddress, setInitialIPAddress] = useState('')
  const [initialBuildingId, setInitialBuildingId] = useState<number | null>(null)
  const [showFreeAddresses, setShowFreeAddresses] = useState(false)
  const [freeAddressRows, setFreeAddressRows] = useState<{ buildingId: number; buildingName: string; networkName: string; cidr: string; ip: string }[]>([])
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
  const defaultColumns = ['ip_address', 'hostname', 'mac_address', 'phone', 'department_name', 'operating_system']
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('mchs-device-columns') || 'null') ?? defaultColumns } catch { return defaultColumns }
  })
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const columnOptions = [
    ['ip_address', 'IP-адрес'], ['hostname', 'Устройство'], ['full_name', 'ФИО'],
    ['mac_address', 'MAC-адрес'], ['phone', 'Телефон'], ['department_name', 'Отдел'], ['operating_system', 'ОС'],
  ]
  const fileInputRef = useRef<HTMLInputElement>(null)
  const columnMenuRef = useRef<HTMLDivElement>(null)
  const firstSearch = useRef(true)
  const lastSearch = useRef(search)

  useEffect(() => { localStorage.setItem('mchs-device-columns', JSON.stringify(visibleColumns)) }, [visibleColumns])

  useEffect(() => {
    if (!showColumnMenu) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!columnMenuRef.current?.contains(event.target as Node)) setShowColumnMenu(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setShowColumnMenu(false) }
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
      const message = err instanceof Error ? err.message : 'Не удалось загрузить компьютеры'
      setError(`${message}. Запустите go run . и npm run dev.`)
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
    const delay = searchChanged && !firstSearch.current ? 300 : 0
    firstSearch.current = false
    const timeout = window.setTimeout(() => {
      void loadComputers(search.trim(), buildingFilter)
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [search, buildingFilter, loadComputers])

  const counts = useMemo<Record<NetworkFilter, number>>(
    () => ({
      all: computers.length,
      local: computers.filter((item) => item.network === 'local').length,
      external: computers.filter((item) => item.network === 'external').length,
      other: computers.filter((item) => item.network === 'other').length,
    }),
    [computers],
  )

  const visibleComputers = useMemo(() => {
    const filtered = network === 'all' ? computers : computers.filter((item) => item.network === network)
    return sortComputers(filtered, sortKey, sortDir)
  }, [computers, network, sortDir, sortKey])

  const groups = useMemo(
    () => [...visibleComputers.reduce((map, item) => {
      const title = item.network_label || 'Другие адреса'
      const group = map.get(title) ?? { key: title, title, items: [] as Computer[] }
      group.items.push(item)
      map.set(title, group)
      return map
    }, new Map<string, { key: string; title: string; items: Computer[] }>()).values()],
    [visibleComputers],
  )

  const selectedBuilding = typeof buildingFilter === 'number'
    ? overview.items.find((item) => item.id === buildingFilter)
    : undefined

  const freeAddressGroups = useMemo(() => {
    const grouped = new Map<string, { key: string; title: string; items: typeof freeAddressRows }>()
    for (const row of freeAddressRows) {
      const title = selectedBuilding ? row.networkName : `${row.buildingName} · ${row.networkName}`
      const key = `${row.buildingId}-${row.networkName}`
      const group = grouped.get(key) ?? { key, title, items: [] }
      group.items.push(row)
      grouped.set(key, group)
    }
    return [...grouped.values()]
  }, [freeAddressRows, selectedBuilding])

  const currentBuilding = useMemo(() => {
    if (buildingFilter === 'all') {
      return { name: 'Все здания', address: 'Общий реестр устройств', count: overview.total }
    }
    if (buildingFilter === 'none') {
      return { name: 'Без здания', address: 'Компьютеры без назначения', count: overview.unassigned }
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
    setShowComputerForm(false)
    setShowFreeAddresses(false)
    setEditingComputer(null)
    await refreshAll()
    setSelected(saved)
    setNotice(null)
  }

  async function handleBuildingSaved(saved: Building) {
    setShowBuildingForm(false)
    setEditingBuilding(null)
    await loadBuildings()
    setBuildingFilter(saved.id)
    setShowFreeAddresses(false)
    setNotice(null)
  }

  async function toggleFreeAddresses() {
    if (showFreeAddresses) { setShowFreeAddresses(false); return }
    const targetBuildings = selectedBuilding
      ? [selectedBuilding]
      : buildingFilter === 'all'
        ? overview.items
        : []
    if (targetBuildings.length === 0) return
    setShowFreeAddresses(true)
    setLoadingFreeAddresses(true)
    try {
      const configured = targetBuildings.flatMap((building) => building.networks
        .filter((item) => item.cidr && item.id)
        .map((network) => ({ building, network })))
      if (configured.length === 0) {
        setFreeAddressRows([])
        setFreeAddressTruncated(false)
      }
      const lists = await Promise.all(configured.map(async ({ building, network }) => ({
        building,
        network,
        result: await getAvailableIPs(network.id as number),
      })))
      setFreeAddressRows(lists.flatMap(({ building, network, result }) => result.items.map((ip) => ({ buildingId: building.id, buildingName: building.name, networkName: network.name, cidr: network.cidr, ip }))))
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

  const groupedView = network === 'all'
  const canShowFreeAddresses = selectedBuilding
    ? selectedBuilding.networks.some((item) => item.cidr)
    : buildingFilter === 'all' && overview.items.some((building) => building.networks.some((item) => item.cidr))
  return (
    <div className="workspace-layout flex min-h-0 flex-1">
      <BuildingSidebar
        overview={overview}
        selected={buildingFilter}
        onSelect={(value) => { setBuildingFilter(value); setShowFreeAddresses(false) }}
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

      <main className="workspace-main min-w-0 flex-1 overflow-auto p-5 md:p-7">
        <section className="surface-card overflow-visible">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{currentBuilding.name}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {currentBuilding.address || 'Адрес не указан'} · устройств: {currentBuilding.count}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canShowFreeAddresses && (
                <button type="button" className={`btn ${showFreeAddresses ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => void toggleFreeAddresses()}>
                  {showFreeAddresses ? 'Скрыть свободные IP' : 'Показать свободные IP'}
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={openCreateComputer}>
                Добавить устройство
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
                Импорт CSV
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => void handleExport()}>
                Экспорт CSV
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

          <form className="flex flex-col gap-3 px-5 py-4 md:flex-row" onSubmit={handleSearchSubmit}>
            <div className="relative flex-1">
              <input
                type="search"
                value={search}
                placeholder="Поиск по IP, MAC, имени устройства, отделу или зданию..."
                className="field pr-10"
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  onClick={() => setSearch('')}
                  aria-label="Очистить поиск"
                >
                  ×
                </button>
              )}
            </div>
            <div ref={columnMenuRef} className="relative z-30 flex shrink-0 gap-2">
              <button type="button" className="btn btn-ghost" aria-label="Настроить столбцы таблицы" title="Столбцы таблицы" onClick={() => setShowColumnMenu((open) => !open)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h16l-6.5 7.5v5l-3 1.5v-6.5L4 5z" /></svg></button>
              {showColumnMenu && <div className="absolute right-0 top-full z-50 mt-1 w-56 border border-slate-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold text-slate-600">Колонки таблицы</p>
                {columnOptions.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-slate-700"><input type="checkbox" checked={visibleColumns.includes(key)} onChange={(event) => setVisibleColumns((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))} />{label}</label>)}
              </div>}
              <button type="submit" className="btn btn-primary">Найти</button>
            </div>
          </form>

          <NetworkTabs value={network} counts={counts} onChange={setNetwork} />
        </section>

        {error && (
          <p className="mt-4 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}
        {notice && (
          <p className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>
        )}

        <section className="mt-4">
          {loading && computers.length === 0 && !error ? (
            <p className="border border-slate-200 bg-white px-6 py-16 text-center text-slate-500">Загрузка...</p>
          ) : computers.length === 0 && error ? (
            <p className="border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
              Не удалось получить список компьютеров.
            </p>
          ) : visibleComputers.length === 0 ? (
            <div className="border border-slate-200 bg-white px-6 py-16 text-center">
              <p className="text-lg font-medium text-slate-800">
                {search.trim()
                  ? `Ничего не найдено по запросу «${search.trim()}»`
                  : network !== 'all'
                    ? 'В этой сети пока нет компьютеров'
                    : 'Компьютеры ещё не добавлены'}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Добавьте рабочую станцию или выберите другое здание / сеть.
              </p>
            </div>
          ) : groupedView ? (
            <div className="space-y-4">
              {showFreeAddresses && <div className="surface-card overflow-hidden">
                <div className="border-b border-slate-100 bg-sky-50/60 px-4 py-2.5">
                  <h3 className="text-sm font-medium text-slate-800">Свободные IP <span className="ml-2 text-xs text-slate-500">{loadingFreeAddresses ? 'Загрузка…' : freeAddressRows.length}</span></h3>
                </div>
                {loadingFreeAddresses ? <p className="p-5 text-center text-sm text-slate-500">Загружаю адреса подсетей…</p> : freeAddressRows.length === 0 ? <p className="p-5 text-center text-sm text-slate-500">Свободных адресов не найдено.</p> : (
                  <div className="max-h-80 overflow-auto">
                    {freeAddressGroups.map((group) => <div key={group.key}>
                      <div className="sticky top-0 flex items-center justify-between border-y border-slate-100 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600"><span>{group.title}</span><span>{group.items.length}</span></div>
                      <div className="flex flex-wrap gap-2 p-3">{group.items.map((row) => <button key={`${row.buildingId}-${row.networkName}-${row.ip}`} type="button" title={`${row.cidr} · Добавить устройство`} className="rounded-md border border-sky-100 bg-sky-50 px-2.5 py-1.5 font-mono text-xs text-sky-900 hover:border-sky-300 hover:bg-sky-100" onClick={() => openCreateComputerWithIP(row.ip, row.buildingId)}>{row.ip}</button>)}</div>
                    </div>)}
                    {freeAddressTruncated && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">В некоторых сетях отображены первые 4096 свободных адресов.</p>}
                  </div>
                )}
              </div>}
              {groups
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.key} className="surface-card overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
                      <h3 className="text-sm font-medium text-slate-800">{group.title}</h3>
                      <span className="text-xs text-slate-400">{group.items.length}</span>
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
          title="Удалить компьютер?"
          message={`Запись «${computerLabel(pendingDeleteComputer)}» будет удалена.`}
          onCancel={() => setPendingDeleteComputer(null)}
          onConfirm={() => void handleDeleteComputer()}
        />
      )}

      {pendingDeleteBuilding && (
        <ConfirmDialog
          title="Удалить здание?"
          message={`Здание «${pendingDeleteBuilding.name}» будет удалено. Компьютеры останутся в списке без здания.`}
          onCancel={() => setPendingDeleteBuilding(null)}
          onConfirm={() => void handleDeleteBuilding()}
        />
      )}
    </div>
  )
}

export default ComputersPage
