import type { Computer, SortKey } from '../types/computer'

export function displayValue(value: string | undefined | null): string {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? '—' : trimmed
}

export function deviceTypeLabel(deviceType: string | undefined | null): string {
  switch (deviceType) {
    case 'printer':
      return 'Принтер'
    case 'phone':
      return 'Телефон'
    case 'gateway':
      return 'Шлюз'
    case 'computer':
    case '':
    case undefined:
    case null:
      return 'Компьютер'
    default:
      return 'Другое'
  }
}

export function computerLabel(computer: Computer): string {
  const host = computer.hostname.trim()
  if (host) return host
  if (computer.ip_address.trim()) return computer.ip_address.trim()
  return `${deviceTypeLabel(computer.device_type)} #${computer.id}`
}

export function compareIP(left: string, right: string): number {
  const a = ipParts(left)
  const b = ipParts(right)
  for (let index = 0; index < 4; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return left.localeCompare(right)
}

function ipParts(ip: string): number[] {
  const parts = ip.trim().split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return [999, 999, 999, 999]
  }
  return parts
}

export function sortComputers(computers: Computer[], sortKey: SortKey, sortDir: 'asc' | 'desc'): Computer[] {
  const next = [...computers]
  next.sort((left, right) => {
    const comparison =
      sortKey === 'ip_address'
        ? compareIP(left.ip_address, right.ip_address)
        : (left[sortKey] ?? '').localeCompare(right[sortKey] ?? '', 'ru')
    return sortDir === 'asc' ? comparison : -comparison
  })
  return next
}

export function formatDateRu(isoDate: string | undefined | null): string {
  if (!isoDate) return ''
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

export function isOverdue(isoDate: string | undefined | null): boolean {
  if (!isoDate) return false
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return isoDate < `${y}-${m}-${d}`
}
