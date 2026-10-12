import type { BuildingFilter } from '../types/computer'
import type { Task, TaskFormData, TaskStatus } from '../types/task'
import { parseJSON, readErrorMessage } from './http'

interface TaskQuery {
  search?: string
  status?: TaskStatus | 'all'
  buildingId?: BuildingFilter
}

function tasksURL(path: string, query: TaskQuery = {}): string {
  const params = new URLSearchParams()
  const search = query.search?.trim() ?? ''
  if (search) params.set('search', search)
  if (query.buildingId === 'none') params.set('building_id', '0')
  if (typeof query.buildingId === 'number') params.set('building_id', String(query.buildingId))
  if (query.status && query.status !== 'all') params.set('status', query.status)
  const suffix = params.toString()
  return suffix ? `${path}?${suffix}` : path
}

async function getTasks(query: TaskQuery = {}): Promise<Task[]> {
  const response = await fetch(tasksURL('/tasks', query))
  const tasks = await parseJSON<Task[] | null>(response, 'Ошибка загрузки задач')
  return tasks ?? []
}

async function createTask(data: TaskFormData): Promise<Task> {
  const response = await fetch('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return parseJSON<Task>(response, 'Ошибка добавления задачи')
}

async function updateTask(id: number, data: TaskFormData): Promise<Task> {
  const response = await fetch(`/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return parseJSON<Task>(response, 'Ошибка сохранения задачи')
}

async function deleteTask(id: number): Promise<void> {
  const response = await fetch(`/tasks/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Ошибка удаления задачи'))
  }
}

export { getTasks, createTask, updateTask, deleteTask }
