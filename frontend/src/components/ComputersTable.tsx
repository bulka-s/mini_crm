import { useState } from 'react'
import type { Computer, SortKey } from '../types/computer'
import { displayValue } from '../lib/format'

interface ComputersTableProps {
  computers: Computer[]
  selectedId?: number | null
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  visibleColumns: string[]
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
  visibleColumns,
  onSort,
  onSelect,
  onEdit,
  onDelete,
}: ComputersTableProps) {
  const columns: { key: SortKey; label: string }[] = [
    { key: 'ip_address', label: 'IP' },
    { key: 'hostname', label: 'Устройство' },
    { key: 'full_name', label: 'ФИО' },
    { key: 'mac_address', label: 'MAC-адрес' },
    { key: 'phone', label: 'Телефон' },
    { key: 'department_name', label: 'Отдел' },
    { key: 'operating_system', label: 'ОС' },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[940px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-600">
            {columns.filter((column) => visibleColumns.includes(column.key)).map((column) => {
              const active = sortKey === column.key
              return (
                <th key={column.key} className="px-4 py-3">
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
            <th className="px-4 py-3 text-xs font-semibold">Действия</th>
          </tr>
        </thead>
        <tbody>
          {computers.map((computer) => {
            const selected = selectedId === computer.id
            return (
              <tr
                key={computer.id}
                className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-cyan-50/40 ${
                  selected ? 'bg-cyan-50/60' : 'bg-white'
                }`}
                onClick={() => onSelect(computer)}
              >
                {visibleColumns.includes('ip_address') && <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[13px] text-slate-800"><CellCopy value={computer.ip_address} /></td>}
                {visibleColumns.includes('hostname') && <td className="px-4 py-2.5 font-medium text-slate-900">{computer.device_type === 'printer' ? 'Принтер' : computer.device_type === 'gateway' ? 'Шлюз' : computer.device_type === 'phone' ? 'Телефон' : computer.device_type === 'computer' ? displayValue(computer.hostname) : `Другое · ${displayValue(computer.hostname)}`}</td>}
                {visibleColumns.includes('full_name') && <td className="px-4 py-2.5 text-slate-700">{displayValue(computer.full_name)}</td>}
                {visibleColumns.includes('mac_address') && <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600"><CellCopy value={computer.mac_address} /></td>}
                {visibleColumns.includes('phone') && <td className="px-4 py-2.5 text-slate-700">{displayValue(computer.phone)}</td>}
                {visibleColumns.includes('department_name') && <td className="px-4 py-2.5 text-slate-700">{displayValue(computer.department_name)}</td>}
                {visibleColumns.includes('operating_system') && <td className="px-4 py-2.5 text-slate-700">{displayValue(computer.operating_system)}</td>}
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

function CellCopy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return <span className="inline-flex items-center gap-1.5">{displayValue(value)}{value && <button type="button" title="Копировать" aria-label={`Копировать ${value}`} className="text-slate-400 hover:text-slate-800" onClick={(event) => { event.stopPropagation(); void navigator.clipboard.writeText(value).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1200) }) }}>{copied ? '✓' : '⧉'}</button>}</span>
}

export default ComputersTable
