import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { createTask, updateTask } from '../api/tasks'
import type { Building, Computer } from '../types/computer'
import type { Task, TaskFormData, TaskStatus } from '../types/task'
import { TASK_STATUSES, emptyTaskForm, toTaskFormData } from '../types/task'
import { computerLabel } from '../lib/format'

interface TaskFormProps {
  task?: Task | null
  buildings: Building[]
  computers: Computer[]
  onClose: () => void
  onSaved: (task: Task) => void
}

function TaskForm({ task, buildings, computers, onClose, onSaved }: TaskFormProps) {
  const [formData, setFormData] = useState<TaskFormData>(() =>
    task ? toTaskFormData(task) : emptyTaskForm,
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const availableComputers = useMemo(() => {
    if (!formData.building_id) return computers
    return computers.filter((item) => item.building_id === formData.building_id)
  }, [computers, formData.building_id])

  function updateField<K extends keyof TaskFormData>(name: K, value: TaskFormData[K]) {
    setFormData((current) => {
      const next = { ...current, [name]: value }
      if (name === 'building_id' && next.computer_id) {
        const computer = computers.find((item) => item.id === next.computer_id)
        if (computer && computer.building_id !== next.building_id) {
          next.computer_id = null
        }
      }
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const saved = task ? await updateTask(task.id, formData) : await createTask(formData)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить задачу')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay-enter fixed inset-0 z-50 bg-slate-900/30" onClick={onClose}>
      <div
        className="panel-enter absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold">{task ? 'Редактировать задачу' : 'Новая задача'}</h2>
          <button type="button" className="px-2 text-2xl text-slate-400 hover:text-slate-800" onClick={onClose}>
            ×
          </button>
        </div>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {error && (
              <p className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Название
              <input
                required
                className="field mt-1"
                value={formData.title}
                onChange={(event) => updateField('title', event.target.value)}
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Описание
              <textarea
                rows={4}
                className="field mt-1"
                value={formData.description}
                onChange={(event) => updateField('description', event.target.value)}
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Исполнитель
              <input
                className="field mt-1"
                value={formData.assignee}
                onChange={(event) => updateField('assignee', event.target.value)}
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Статус
              <select
                className="field mt-1"
                value={formData.status}
                onChange={(event) => updateField('status', event.target.value as TaskStatus)}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Срок
              <input
                type="date"
                className="field mt-1"
                value={formData.due_date}
                onChange={(event) => updateField('due_date', event.target.value)}
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Здание
              <select
                className="field mt-1"
                value={formData.building_id ?? ''}
                onChange={(event) =>
                  updateField('building_id', event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">Не указано</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Компьютер
              <select
                className="field mt-1"
                value={formData.computer_id ?? ''}
                onChange={(event) =>
                  updateField('computer_id', event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">Не указан</option>
                {availableComputers.map((computer) => (
                  <option key={computer.id} value={computer.id}>
                    {computerLabel(computer)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="border-t border-slate-200 p-4">
            <button type="submit" disabled={saving} className="btn btn-primary w-full">
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TaskForm
