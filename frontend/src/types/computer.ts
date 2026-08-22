export interface Computer {
  id: number
  ip_address: string
  hostname: string
  last_name: string
  first_name: string 
  middle_name: string
  phone: string
  cabinet: string
  department_name: string
  pc_status: string
  note: string
}

export type ComputerFormData = Omit<Computer, "id">