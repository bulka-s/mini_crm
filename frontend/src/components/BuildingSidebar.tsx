import type { ReactNode } from 'react'
import type { Building, BuildingFilter, BuildingsOverview } from '../types/computer'

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
  count,
  onClick,
  actions,
}: {
  active: boolean
  title: string
  subtitle?: string
  count: number
  onClick: () => void
  actions?: ReactNode
}) {
  return (
    <div className={`flex items-center gap-2 px-2 ${active ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
      <button
        type="button"
        className={`min-w-0 flex-1 border-l-2 px-3 py-2.5 text-left ${
          active ? 'border-slate-700' : 'border-transparent'
        }`}
        onClick={onClick}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{title}</p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
      </button>
      {actions && (
        <div className="flex shrink-0 gap-1">
          {actions}
        </div>
      )}
      <span className="w-7 shrink-0 text-right text-xs tabular-nums text-slate-400">{count}</span>
    </div>
  )
}

function BuildingSidebar({ overview, selected, onSelect, onAdd, onEdit, onDelete }: BuildingSidebarProps) {
  return (
    <aside className="building-sidebar flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">Здания</h2>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
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
        {overview.items.map((building) => (
          <SidebarButton
            key={building.id}
            active={selected === building.id}
            title={building.name}
            subtitle={building.address}
            count={building.computers_count}
            onClick={() => onSelect(building.id)}
            actions={
              <>
                <button
                  type="button"
                  className="bg-white px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                  onClick={(event) => {
                    event.stopPropagation()
                    onEdit(building)
                  }}
                >
                  Изм.
                </button>
                <button
                  type="button"
                  className="bg-white px-1.5 py-0.5 text-[11px] text-rose-600 hover:bg-rose-50"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(building)
                  }}
                >
                  Уд.
                </button>
              </>
            }
          />
        ))}
      </div>

      <div className="border-t border-slate-200 p-3">
        <button type="button" className="btn btn-primary w-full" onClick={onAdd}>
          Добавить здание
        </button>
      </div>
    </aside>
  )
}

export default BuildingSidebar
