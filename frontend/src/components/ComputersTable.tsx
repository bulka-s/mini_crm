import type { Computer, SortKey } from '../types/computer'
import { displayValue } from '../lib/format'
import StatusBadge from './StatusBadge'

interface ComputersTableProps {
  computers: Computer[]
  selectedId?: number | null
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  showFullName?: boolean
  onSort: (key: SortKey) => void
  onSelect: (computer: Computer) => void
  onEdit: (computer: Computer) => void
  onDelete: (computer: Computer) => void
}

function ComputersTable({
  computers,
  selectedId,
  sortKey,
  sortDir,
  showFullName = false,
  onSort,
  onSelect,
  onEdit,
  onDelete,
}: ComputersTableProps) {
  const columns: { key: SortKey; label: string }[] = [
    { key: 'ip_address', label: 'IP' },
    { key: 'hostname', label: 'Компьютер' },
    ...(showFullName ? [{ key: 'full_name' as const, label: 'ФИО' }] : []),
    { key: 'phone', label: 'Телефон' },
    { key: 'cabinet', label: 'Кабинет' },
    { key: 'department_name', label: 'Отдел' },
    { key: 'pc_status', label: 'Статус' },
  ]

  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-sm ${showFullName ? 'min-w-[920px]' : 'min-w-[780px]'}`}>
        <thead>
          <tr className="bg-slate-50 text-left text-slate-600">
            {columns.map((column) => {
              const active = sortKey === column.key
              return (
                <th key={column.key} className="px-4 py-2.5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium hover:text-slate-900"
                    onClick={() => onSort(column.key)}
                  >
                    {column.label}
                    <span className={active ? 'text-slate-700' : 'text-slate-300'}>
                      {active && sortDir === 'desc' ? '↓' : '↑'}
                    </span>
                  </button>
                </th>
              )
            })}
            <th className="px-4 py-2.5 text-xs font-medium">Действия</th>
          </tr>
        </thead>
        <tbody>
          {computers.map((computer) => {
            const selected = selectedId === computer.id
            return (
              <tr
                key={computer.id}
                className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                  selected ? 'bg-slate-50' : 'bg-white'
                }`}
                onClick={() => onSelect(computer)}
              >
                <td className="px-4 py-2.5 font-mono text-[13px] text-slate-800">
                  {displayValue(computer.ip_address)}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-900">{displayValue(computer.hostname)}</td>
                {showFullName && (
                  <td className="px-4 py-2.5 text-slate-800">{displayValue(computer.full_name)}</td>
                )}
                <td className="px-4 py-2.5 text-slate-700">{displayValue(computer.phone)}</td>
                <td className="px-4 py-2.5 text-slate-700">{displayValue(computer.cabinet)}</td>
                <td className="px-4 py-2.5 text-slate-700">{displayValue(computer.department_name)}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={computer.pc_status} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      onClick={(event) => {
                        event.stopPropagation()
                        onEdit(computer)
                      }}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                      onClick={(event) => {
                        event.stopPropagation()
                        onDelete(computer)
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default ComputersTable
