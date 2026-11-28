import { useState } from 'react'
import { copyToClipboard } from '../lib/clipboard'
import { deviceTypeLabel, displayValue } from '../lib/format'
import type { Computer, SortKey } from '../types/computer'
import { CheckIcon, CopyIcon, EditIcon, TrashIcon } from './Icons'

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
  onCopy?: (label: string, value: string) => void
}

const deviceBadgeClass: Record<string, string> = {
  printer: 'bg-sky-50 text-sky-800 border-sky-200',
  phone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  gateway: 'bg-amber-50 text-amber-800 border-amber-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
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
  onCopy,
}: ComputersTableProps) {
  const columns: { key: SortKey; label: string }[] = [
    { key: 'ip_address', label: 'IP-адрес' },
    { key: 'hostname', label: 'Устройство' },
    { key: 'building_name', label: 'Здание' },
    { key: 'full_name', label: 'ФИО' },
    { key: 'mac_address', label: 'MAC-адрес' },
    { key: 'phone', label: 'Телефон' },
    { key: 'department_name', label: 'Отдел' },
    { key: 'operating_system', label: 'ОС' },
  ]

  const activeColumns = columns.filter((column) => visibleColumns.includes(column.key))

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            {activeColumns.map((column) => {
              const active = sortKey === column.key
              return (
                <th key={column.key} className="whitespace-nowrap px-4 py-2.5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-900"
                    onClick={() => onSort(column.key)}
                  >
                    {column.label}
                    <span className={active ? 'text-slate-900' : 'text-slate-300'}>
                      {active && sortDir === 'desc' ? '↓' : '↑'}
                    </span>
                  </button>
                </th>
              )
            })}
            <th className="w-20 whitespace-nowrap px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
              Действия
            </th>
          </tr>
        </thead>
        <tbody>
          {computers.map((computer) => {
            const selected = selectedId === computer.id
            const showTypeBadge = computer.device_type && computer.device_type !== 'computer'
            return (
              <tr
                key={computer.id}
                className={`cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-cyan-50/40 ${
                  selected ? 'bg-cyan-50/60' : 'bg-white'
                }`}
                onClick={() => onSelect(computer)}
              >
                {visibleColumns.includes('ip_address') && (
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[13px] text-slate-800">
                    <CellCopy value={computer.ip_address} label="IP" onCopy={onCopy} />
                  </td>
                )}
                {visibleColumns.includes('hostname') && (
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-slate-900">
                        {computer.hostname.trim()
                          ? computer.hostname.trim()
                          : showTypeBadge
                            ? deviceTypeLabel(computer.device_type)
                            : '—'}
                      </span>
                      {showTypeBadge && computer.hostname.trim() && (
                        <span
                          className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none ${
                            deviceBadgeClass[computer.device_type] ?? deviceBadgeClass.other
                          }`}
                        >
                          {deviceTypeLabel(computer.device_type)}
                        </span>
                      )}
                    </div>
                  </td>
                )}
                {visibleColumns.includes('building_name') && (
                  <td className="px-4 py-2.5 text-slate-700">{displayValue(computer.building_name)}</td>
                )}
                {visibleColumns.includes('full_name') && (
                  <td className="px-4 py-2.5 text-slate-700">{displayValue(computer.full_name)}</td>
                )}
                {visibleColumns.includes('mac_address') && (
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600">
                    <CellCopy value={computer.mac_address} label="MAC" onCopy={onCopy} />
                  </td>
                )}
                {visibleColumns.includes('phone') && (
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{displayValue(computer.phone)}</td>
                )}
                {visibleColumns.includes('department_name') && (
                  <td className="px-4 py-2.5 text-slate-700">{displayValue(computer.department_name)}</td>
                )}
                {visibleColumns.includes('operating_system') && (
                  <td className="px-4 py-2.5 text-slate-700">{displayValue(computer.operating_system)}</td>
                )}
                <td className="whitespace-nowrap px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Редактировать"
                      aria-label="Редактировать устройство"
                      onClick={(event) => {
                        event.stopPropagation()
                        onEdit(computer)
                      }}
                    >
                      <EditIcon size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      title="Удалить"
                      aria-label="Удалить устройство"
                      onClick={(event) => {
                        event.stopPropagation()
                        onDelete(computer)
                      }}
                    >
                      <TrashIcon size={15} />
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

function CellCopy({
  value,
  label,
  onCopy,
}: {
  value: string
  label: string
  onCopy?: (label: string, value: string) => void
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const ok = await copyToClipboard(value)
    if (!ok) return
    setCopied(true)
    onCopy?.(label, value)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{displayValue(value)}</span>
      {value && (
        <button
          type="button"
          title={`Копировать ${label}`}
          aria-label={`Копировать ${value}`}
          className={`rounded p-0.5 transition-colors ${
            copied ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-800'
          }`}
          onClick={(event) => {
            event.stopPropagation()
            void handleCopy()
          }}
        >
          {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
        </button>
      )}
    </span>
  )
}

export default ComputersTable
