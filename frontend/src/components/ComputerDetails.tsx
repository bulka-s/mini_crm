import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { copyToClipboard } from '../lib/clipboard'
import { computerLabel, deviceTypeLabel, displayValue } from '../lib/format'
import type { Computer } from '../types/computer'
import { CheckIcon, CloseIcon, CopyIcon, EditIcon, TrashIcon } from './Icons'

interface ComputerDetailsProps {
  computer: Computer
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onCopy?: (label: string, value: string) => void
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[135px_1fr] gap-3 border-b border-slate-100 py-3 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-slate-900">{children}</dd>
    </div>
  )
}

function CopyableValue({
  value,
  label,
  mono,
  onCopy,
}: {
  value: string
  label: string
  mono?: boolean
  onCopy?: (label: string, value: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const trimmed = value.trim()

  async function handleCopy() {
    if (!trimmed) return
    const ok = await copyToClipboard(trimmed)
    if (!ok) return
    setCopied(true)
    onCopy?.(label, trimmed)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={mono ? 'font-mono' : undefined}>{displayValue(value)}</span>
      {trimmed && (
        <button
          type="button"
          className={`rounded p-0.5 transition-colors ${
            copied ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-800'
          }`}
          title={`Копировать ${label}`}
          aria-label={`Копировать ${trimmed}`}
          onClick={() => void handleCopy()}
        >
          {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
        </button>
      )}
    </span>
  )
}

function ComputerDetails({ computer, onClose, onEdit, onDelete, onCopy }: ComputerDetailsProps) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div className="overlay-enter fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose}>
      <aside
        className="panel-enter absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-slate-900">{computerLabel(computer)}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                  {deviceTypeLabel(computer.device_type)}
                </span>
                {computer.network_label && (
                  <span className="inline-flex rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs text-sky-800">
                    {computer.network_label}
                  </span>
                )}
              </div>
            </div>
            <button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}>
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        <dl className="flex-1 overflow-y-auto px-5 py-2">
          <DetailRow label="Здание">{displayValue(computer.building_name)}</DetailRow>
          <DetailRow label="Адрес">{displayValue(computer.building_address)}</DetailRow>
          <DetailRow label="IP-адрес">
            <CopyableValue value={computer.ip_address} label="IP" mono onCopy={onCopy} />
          </DetailRow>
          <DetailRow label="Имя устройства">
            <CopyableValue value={computer.hostname} label="имя" onCopy={onCopy} />
          </DetailRow>
          <DetailRow label="ФИО">{displayValue(computer.full_name)}</DetailRow>
          {(!computer.device_type || computer.device_type === 'computer') && (
            <DetailRow label="ОС">{displayValue(computer.operating_system)}</DetailRow>
          )}
          <DetailRow label="MAC-адрес">
            <CopyableValue value={computer.mac_address} label="MAC" mono onCopy={onCopy} />
          </DetailRow>
          <DetailRow label="Телефон">
            <CopyableValue value={computer.phone} label="телефон" onCopy={onCopy} />
          </DetailRow>
          <DetailRow label="Отдел">{displayValue(computer.department_name)}</DetailRow>
          <DetailRow label="Примечание">
            <span className="whitespace-pre-wrap font-normal text-slate-700">{displayValue(computer.note)}</span>
          </DetailRow>
        </dl>

        <div className="flex gap-2 border-t border-slate-200 p-4">
          <button type="button" className="btn btn-primary flex-1" onClick={onEdit}>
            <EditIcon size={15} />
            Изменить
          </button>
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            <TrashIcon size={15} />
            Удалить
          </button>
        </div>
      </aside>
    </div>
  )
}

export default ComputerDetails
