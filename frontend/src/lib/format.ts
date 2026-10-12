import type { Computer, SortKey } from '../types/computer'

export function displayValue(value: string | undefined | null): string {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? '—' : trimmed
}

export function computerLabel(computer: Computer): string {
  const name = computer.full_name.trim()
  const host = computer.hostname.trim()
  if (host && name) return `${host} · ${name}`
  return host || name || `Компьютер #${computer.id}`
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
        : left[sortKey].localeCompare(right[sortKey], 'ru')
    return sortDir === 'asc' ? comparison : -comparison
  })
  return next
}
