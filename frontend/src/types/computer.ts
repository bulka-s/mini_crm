export type NetworkKind = 'local' | 'external' | 'other'

export type BuildingFilter = 'all' | 'none' | number

export type SortKey =
  | 'ip_address'
  | 'hostname'
  | 'full_name'
  | 'mac_address'
  | 'phone'
  | 'department_name'
  | 'operating_system'

export interface Computer {
  id: number
  ip_address: string
  hostname: string
  full_name: string
  phone: string
  mac_address: string
  department_name: string
  device_type: 'computer' | 'printer' | 'phone' | string
  operating_system: string
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
  mac_address: string
  department_name: string
  device_type: 'computer' | 'printer' | 'phone' | string
  operating_system: string
  note: string
  building_id: number | null
}

export interface Building {
  id: number
  name: string
  address: string
  computers_count: number
  networks: BuildingNetwork[]
}

export interface BuildingNetwork {
  id?: number
  name: string
  cidr: string
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
  mac_address: '',
  department_name: '',
  device_type: 'computer',
  operating_system: '',
  note: '',
  building_id: null,
}

export function toFormData(computer: Computer): ComputerFormData {
  return {
    ip_address: computer.ip_address,
    hostname: computer.hostname,
    full_name: computer.full_name || '',
    phone: computer.phone,
    mac_address: computer.mac_address || '',
    department_name: computer.department_name,
    device_type: computer.device_type || 'computer',
    operating_system: computer.operating_system || '',
    note: computer.note,
    building_id: computer.building_id,
  }
}
