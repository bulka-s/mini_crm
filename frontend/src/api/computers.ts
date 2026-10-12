import type { BuildingFilter, Computer, ComputerFormData, ImportResult, NetworkKind } from '../types/computer'
import { parseJSON, readErrorMessage } from './http'

interface ComputerQuery {
  search?: string
  buildingId?: BuildingFilter
  network?: NetworkKind | 'all'
}

function computersURL(path: string, query: ComputerQuery = {}): string {
  const params = new URLSearchParams()
  const search = query.search?.trim() ?? ''
  if (search) params.set('search', search)
  if (query.buildingId === 'none') params.set('building_id', '0')
  if (typeof query.buildingId === 'number') params.set('building_id', String(query.buildingId))
  if (query.network && query.network !== 'all') params.set('network', query.network)
  const suffix = params.toString()
  return suffix ? `${path}?${suffix}` : path
}

async function getComputers(query: ComputerQuery = {}): Promise<Computer[]> {
  const response = await fetch(computersURL('/computers', query))
  const computers = await parseJSON<Computer[] | null>(response, 'Ошибка загрузки компьютеров')
  return computers ?? []
}

async function createComputer(data: ComputerFormData): Promise<Computer> {
  const response = await fetch('/computers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return parseJSON<Computer>(response, 'Ошибка добавления записи')
}

async function updateComputer(id: number, data: ComputerFormData): Promise<Computer> {
  const response = await fetch(`/computers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return parseJSON<Computer>(response, 'Ошибка сохранения записи')
}

async function deleteComputer(id: number): Promise<void> {
  const response = await fetch(`/computers/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Ошибка удаления записи'))
  }
}

async function exportComputers(query: ComputerQuery = {}): Promise<void> {
  const response = await fetch(computersURL('/computers/export', query))
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Ошибка экспорта'))
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'computers.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function importComputers(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)

  const response = await fetch('/computers/import', {
    method: 'POST',
    body: form,
  })
  return parseJSON<ImportResult>(response, 'Ошибка импорта')
}

export {
  getComputers,
  createComputer,
  updateComputer,
  deleteComputer,
  exportComputers,
  importComputers,
}
