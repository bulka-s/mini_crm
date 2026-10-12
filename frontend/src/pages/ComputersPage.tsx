import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { deleteBuilding, getBuildings, updateBuilding } from '../api/buildings'
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
  const [editingComputer, setEditingComputer] = useState<Computer | null>(null)
  const [showBuildingForm, setShowBuildingForm] = useState(false)
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null)
  const [selected, setSelected] = useState<Computer | null>(null)
  const [pendingDeleteComputer, setPendingDeleteComputer] = useState<Computer | null>(null)
  const [pendingDeleteBuilding, setPendingDeleteBuilding] = useState<Building | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('ip_address')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const firstSearch = useRef(true)
  const lastSearch = useRef(search)

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
    () => [
      { key: 'local' as const, title: 'Локальная сеть 10.110.X.X', items: visibleComputers.filter((item) => item.network === 'local') },
      { key: 'external' as const, title: 'Внешняя сеть 192.168.X.X', items: visibleComputers.filter((item) => item.network === 'external') },
      { key: 'other' as const, title: 'Другие адреса', items: visibleComputers.filter((item) => item.network === 'other') },
    ],
    [visibleComputers],
  )

  const selectedBuilding = typeof buildingFilter === 'number'
    ? overview.items.find((item) => item.id === buildingFilter)
    : undefined
  const showFullName = Boolean(selectedBuilding?.show_full_name)

  const currentBuilding = useMemo(() => {
    if (buildingFilter === 'all') {
      return { name: 'Все здания', address: 'Сводный список рабочих станций', count: overview.total }
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
    setNotice(null)
  }

  async function toggleShowFullName() {
    if (!selectedBuilding) return
    try {
      const saved = await updateBuilding(selectedBuilding.id, {
        name: selectedBuilding.name,
        address: selectedBuilding.address,
        show_full_name: !selectedBuilding.show_full_name,
      })
      setOverview((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === saved.id ? saved : item)),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить отображение ФИО')
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
  const defaultBuildingId = typeof buildingFilter === 'number' ? buildingFilter : null
  const selectedShowFullName = selected
    ? Boolean(overview.items.find((item) => item.id === selected.building_id)?.show_full_name)
    : false

  return (
    <div className="flex min-h-0 flex-1">
      <BuildingSidebar
        overview={overview}
        selected={buildingFilter}
        onSelect={setBuildingFilter}
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

      <main className="min-w-0 flex-1 overflow-auto p-5">
        <section className="border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{currentBuilding.name}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {currentBuilding.address || 'Адрес не указан'} · компьютеров: {currentBuilding.count}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedBuilding && (
                <button type="button" className="btn btn-ghost" onClick={() => void toggleShowFullName()}>
                  {showFullName ? 'Скрыть ФИО' : 'Показывать ФИО'}
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={openCreateComputer}>
                Добавить компьютер
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
                placeholder={showFullName ? 'Поиск по ФИО, IP, кабинету, зданию...' : 'Поиск по IP, имени, кабинету, зданию...'}
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
            <button type="submit" className="btn btn-primary">
              Найти
            </button>
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
              {groups
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.key} className="overflow-hidden border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
                      <h3 className="text-sm font-medium text-slate-800">{group.title}</h3>
                      <span className="text-xs text-slate-400">{group.items.length}</span>
                    </div>
                    <ComputersTable
                      computers={group.items}
                      selectedId={selected?.id}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      showFullName={showFullName}
                      onSort={handleSort}
                      onSelect={setSelected}
                      onEdit={openEditComputer}
                      onDelete={setPendingDeleteComputer}
                    />
                  </div>
                ))}
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-200 bg-white">
              <ComputersTable
                computers={visibleComputers}
                selectedId={selected?.id}
                sortKey={sortKey}
                sortDir={sortDir}
                showFullName={showFullName}
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
          showFullName={selectedShowFullName}
          onClose={() => setSelected(null)}
          onEdit={() => openEditComputer(selected)}
          onDelete={() => setPendingDeleteComputer(selected)}
        />
      )}

      {showComputerForm && (
        <ComputerForm
          key={editingComputer?.id ?? `new-${defaultBuildingId ?? 'none'}`}
          computer={editingComputer}
          buildings={overview.items}
          defaultBuildingId={defaultBuildingId}
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
