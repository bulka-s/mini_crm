export type NetworkKind = 'local' | 'external' | 'other'

export type BuildingFilter = 'all' | 'none' | number

export type SortKey =
  | 'ip_address'
  | 'hostname'
  | 'full_name'
  | 'phone'
  | 'cabinet'
  | 'department_name'
  | 'pc_status'

export interface Computer {
  id: number
  ip_address: string
  hostname: string
  full_name: string
  phone: string
  cabinet: string
  department_name: string
  pc_status: string
  note: string
  building_id: number | null
  building_name: string
  building_address: string
  network: NetworkKind
  network_label: string
}

export type ComputerFormData = {
  ip_address: string
  hostname: string
  full_name: string
  phone: string
  cabinet: string
  department_name: string
  pc_status: string
  note: string
  building_id: number | null
}

export interface Building {
  id: number
  name: string
  address: string
  show_full_name: boolean
  computers_count: number
}

export interface BuildingsOverview {
  items: Building[]
  unassigned: number
  total: number
}

export interface ImportResult {
  created: number
  skipped: number
  errors: string[]
}

export const emptyComputerForm: ComputerFormData = {
  ip_address: '',
  hostname: '',
  full_name: '',
  phone: '',
  cabinet: '',
  department_name: '',
  pc_status: '',
  note: '',
  building_id: null,
}

export function toFormData(computer: Computer): ComputerFormData {
  return {
    ip_address: computer.ip_address,
    hostname: computer.hostname,
    full_name: computer.full_name,
    phone: computer.phone,
    cabinet: computer.cabinet,
    department_name: computer.department_name,
    pc_status: computer.pc_status,
    note: computer.note,
    building_id: computer.building_id,
  }
}

export const PC_STATUSES = [
  'В работе',
  'Ремонт',
  'На складе',
  'Резерв',
  'Списан',
] as const
