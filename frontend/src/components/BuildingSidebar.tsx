import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Building, BuildingFilter, BuildingsOverview } from '../types/computer'
import { BuildingIcon, CloseIcon, EditIcon, PlusIcon, SearchIcon, TrashIcon } from './Icons'

interface BuildingSidebarProps {
  overview: BuildingsOverview
  selected: BuildingFilter
  onSelect: (value: BuildingFilter) => void
  onAdd: () => void
  onEdit: (building: Building) => void
  onDelete: (building: Building) => void
}

function SidebarButton({
  active,
  title,
  subtitle,
  meta,
  count,
  onClick,
  actions,
}: {
  active: boolean
  title: string
  subtitle?: string
  meta?: string
  count: number
  onClick: () => void
  actions?: ReactNode
}) {
  return (
    <div
      className={`group relative flex items-center gap-1.5 px-2 py-0.5 transition-colors ${
        active ? 'bg-slate-100' : 'hover:bg-slate-50'
      }`}
    >
      <button
        type="button"
        className={`min-w-0 flex-1 rounded-md border-l-2 px-2.5 py-2 text-left transition-colors ${
          active ? 'border-slate-700' : 'border-transparent'
        }`}
        onClick={onClick}
      >
        <div className="min-w-0">
          <p className={`truncate text-sm ${active ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-slate-500" title={subtitle}>
              {subtitle}
            </p>
          )}
          {meta && (
            <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400" title={meta}>
              {meta}
            </p>
          )}
        </div>
      </button>
      {actions && (
        <div
          className={`flex shrink-0 items-center gap-0.5 transition-opacity ${
            active ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'
          }`}
        >
          {actions}
        </div>
      )}
      <span className="min-w-6 shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-center text-[11px] font-medium tabular-nums text-slate-500">
        {count}
      </span>
    </div>
  )
}

function BuildingSidebar({ overview, selected, onSelect, onAdd, onEdit, onDelete }: BuildingSidebarProps) {
  const [query, setQuery] = useState('')

  const trimmedQuery = query.trim().toLowerCase()

  const filteredBuildings = useMemo(() => {
    if (!trimmedQuery) return overview.items
    return overview.items.filter((building) => {
      if (building.name.toLowerCase().includes(trimmedQuery)) return true
      if (building.address.toLowerCase().includes(trimmedQuery)) return true
      return building.networks.some(
        (n) =>
          n.name.toLowerCase().includes(trimmedQuery) ||
          n.cidr.toLowerCase().includes(trimmedQuery),
      )
    })
  }, [overview.items, trimmedQuery])

  return (
    <aside className="building-sidebar flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BuildingIcon size={15} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Здания</h2>
          </div>
          <span className="text-xs tabular-nums text-slate-400">
            {trimmedQuery ? `${filteredBuildings.length} из ${overview.items.length}` : overview.items.length}
          </span>
        </div>
        <div className="relative mt-2.5">
          <SearchIcon
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск здания, адреса или сети..."
            aria-label="Поиск по зданиям"
            className="field py-1.5 pl-8 pr-7 text-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Очистить поиск зданий"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
            >
              <CloseIcon size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1.5">
        {!trimmedQuery && (
          <>
            <SidebarButton
              active={selected === 'all'}
              title="Все здания"
              count={overview.total}
              onClick={() => onSelect('all')}
            />
            {overview.unassigned > 0 && (
              <SidebarButton
                active={selected === 'none'}
                title="Без здания"
                subtitle="Не назначены"
                count={overview.unassigned}
                onClick={() => onSelect('none')}
              />
            )}
            {overview.items.length > 0 && <div className="my-1.5 border-t border-slate-100" />}
          </>
        )}

        {filteredBuildings.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs font-medium text-slate-600">
              {trimmedQuery ? 'Здания не найдены' : 'Здания ещё не добавлены'}
            </p>
            {trimmedQuery && (
              <button
                type="button"
                className="mt-2 text-xs text-sky-700 hover:underline"
                onClick={() => setQuery('')}
              >
                Сбросить поиск
              </button>
            )}
          </div>
        ) : (
          filteredBuildings.map((building) => {
            const cidrs = building.networks
              .map((n) => n.cidr)
              .filter(Boolean)
              .join(', ')
            return (
              <SidebarButton
                key={building.id}
                active={selected === building.id}
                title={building.name}
                subtitle={building.address || undefined}
                meta={trimmedQuery && cidrs ? cidrs : undefined}
                count={building.computers_count}
                onClick={() => onSelect(building.id)}
                actions={
                  <>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Редактировать здание"
                      aria-label={`Редактировать здание ${building.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onEdit(building)
                      }}
                    >
                      <EditIcon size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      title="Удалить здание"
                      aria-label={`Удалить здание ${building.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onDelete(building)
                      }}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </>
                }
              />
            )
          })
        )}
      </div>

      <div className="border-t border-slate-200 p-3">
        <button type="button" className="btn btn-primary w-full" onClick={onAdd}>
          <PlusIcon size={15} />
          Добавить здание
        </button>
      </div>
    </aside>
  )
}

export default BuildingSidebar
