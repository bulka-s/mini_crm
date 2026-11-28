import { displayValue } from '../lib/format'
import type { TaskStatus } from '../types/task'
import { TASK_STATUSES } from '../types/task'

const styles: Record<string, string> = {
  'В работе': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Ремонт': 'bg-amber-50 text-amber-800 border-amber-200',
  'На складе': 'bg-slate-100 text-slate-700 border-slate-200',
  'Резерв': 'bg-sky-50 text-sky-800 border-sky-200',
  'Списан': 'bg-rose-50 text-rose-800 border-rose-200',
}

const taskStyles: Record<TaskStatus, string> = {
  new: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-sky-50 text-sky-800 border-sky-200',
  waiting: 'bg-amber-50 text-amber-800 border-amber-200',
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
}

interface StatusBadgeProps {
  status: string
}

function StatusBadge({ status }: StatusBadgeProps) {
  const value = status.trim()
  if (!value) {
    return <span className="text-slate-400">—</span>
  }

  const color = styles[value] ?? 'bg-slate-100 text-slate-700 border-slate-200'
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${color}`}>
      {displayValue(value)}
    </span>
  )
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const label = TASK_STATUSES.find((item) => item.value === status)?.label ?? status
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium ${taskStyles[status]}`}>
      {label}
    </span>
  )
}

export default StatusBadge
