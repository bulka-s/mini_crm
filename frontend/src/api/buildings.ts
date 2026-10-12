import type { Building, BuildingsOverview } from '../types/computer'
import { parseJSON, readErrorMessage } from './http'

type BuildingPayload = Pick<Building, 'name' | 'address' | 'show_full_name'>

async function getBuildings(): Promise<BuildingsOverview> {
  const response = await fetch('/buildings')
  return parseJSON<BuildingsOverview>(response, 'Ошибка загрузки зданий')
}

async function createBuilding(data: BuildingPayload): Promise<Building> {
  const response = await fetch('/buildings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return parseJSON<Building>(response, 'Ошибка добавления здания')
}

async function updateBuilding(id: number, data: BuildingPayload): Promise<Building> {
  const response = await fetch(`/buildings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return parseJSON<Building>(response, 'Ошибка сохранения здания')
}

async function deleteBuilding(id: number): Promise<void> {
  const response = await fetch(`/buildings/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Ошибка удаления здания'))
  }
}

export { getBuildings, createBuilding, updateBuilding, deleteBuilding }
