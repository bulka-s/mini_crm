import type { ReactNode } from 'react'
import type { Computer } from '../types/computer'
import { computerLabel, displayValue } from '../lib/format'

interface ComputerDetailsProps {
  computer: Computer
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-slate-100 py-3 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{children}</dd>
    </div>
  )
}

function ComputerDetails({ computer, onClose, onEdit, onDelete }: ComputerDetailsProps) {
  return (
    <div className="overlay-enter fixed inset-0 z-40 bg-slate-900/30" onClick={onClose}>
      <aside
        className="panel-enter absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">{computerLabel(computer)}</h2>
            <button type="button" className="px-2 text-2xl text-slate-400 hover:text-slate-800" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <dl className="flex-1 overflow-y-auto px-5 py-2">
          <DetailRow label="Здание">{displayValue(computer.building_name)}</DetailRow>
          <DetailRow label="Адрес">{displayValue(computer.building_address)}</DetailRow>
          <DetailRow label="IP-адрес">
            <span className="font-mono">{displayValue(computer.ip_address)}</span>
          </DetailRow>
          <DetailRow label="Сеть">{displayValue(computer.network_label)}</DetailRow>
          <DetailRow label="Тип устройства">{computer.device_type === 'printer' ? 'Принтер' : computer.device_type === 'gateway' ? 'Шлюз' : computer.device_type === 'phone' ? 'Телефон' : computer.device_type === 'computer' ? 'Компьютер' : 'Другое'}</DetailRow>
          <DetailRow label="Имя устройства">{displayValue(computer.hostname)}</DetailRow>
          <DetailRow label="ФИО">{displayValue(computer.full_name)}</DetailRow>
          {computer.device_type === 'computer' && <DetailRow label="ОС">{displayValue(computer.operating_system)}</DetailRow>}
          <DetailRow label="MAC-адрес"><span className="font-mono">{displayValue(computer.mac_address)}</span></DetailRow>
          <DetailRow label="Телефон">{displayValue(computer.phone)}</DetailRow>
          <DetailRow label="Отдел">{displayValue(computer.department_name)}</DetailRow>
          <DetailRow label="Примечание">
            <span className="whitespace-pre-wrap font-normal">{displayValue(computer.note)}</span>
          </DetailRow>
        </dl>

        <div className="flex gap-3 border-t border-slate-200 p-4">
          <button type="button" className="btn btn-primary flex-1" onClick={onEdit}>
            Изменить
          </button>
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            Удалить
          </button>
        </div>
      </aside>
    </div>
  )
}

export default ComputerDetails
