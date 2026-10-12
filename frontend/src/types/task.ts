export type TaskStatus = 'new' | 'in_progress' | 'waiting' | 'done' | 'cancelled'

export interface Task {
  id: number
  title: string
  description: string
  assignee: string
  building_id: number | null
  building_name: string
  computer_id: number | null
  computer_hostname: string
  computer_ip: string
  computer_full_name: string
  status: TaskStatus
  status_label: string
  due_date: string
  created_at: string
}

export type TaskFormData = {
  title: string
  description: string
  assignee: string
  building_id: number | null
  computer_id: number | null
  status: TaskStatus
  due_date: string
}

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'new', label: 'Новая' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'waiting', label: 'Ожидание' },
  { value: 'done', label: 'Выполнена' },
  { value: 'cancelled', label: 'Отменена' },
]

export const emptyTaskForm: TaskFormData = {
  title: '',
  description: '',
  assignee: '',
  building_id: null,
  computer_id: null,
  status: 'new',
  due_date: '',
}

export function toTaskFormData(task: Task): TaskFormData {
  return {
    title: task.title,
    description: task.description,
    assignee: task.assignee,
    building_id: task.building_id,
    computer_id: task.computer_id,
    status: task.status,
    due_date: task.due_date,
  }
}
