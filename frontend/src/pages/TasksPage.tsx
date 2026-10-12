import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { getBuildings } from '../api/buildings'
import { getComputers } from '../api/computers'
import { deleteTask, getTasks, updateTask } from '../api/tasks'
import ConfirmDialog from '../components/ConfirmDialog'
import TaskForm from '../components/TaskForm'
import { TaskStatusBadge } from '../components/StatusBadge'
import { displayValue } from '../lib/format'
import type { Building, BuildingFilter, BuildingsOverview, Computer } from '../types/computer'
import type { Task, TaskFormData, TaskStatus } from '../types/task'
import { TASK_STATUSES, toTaskFormData } from '../types/task'

const emptyOverview: BuildingsOverview = { items: [], unassigned: 0, total: 0 }

function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [computers, setComputers] = useState<Computer[]>([])
  const [overview, setOverview] = useState<BuildingsOverview>(emptyOverview)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<TaskStatus | 'all'>('all')
  const [buildingFilter, setBuildingFilter] = useState<BuildingFilter>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)
  const firstSearch = useRef(true)
  const lastSearch = useRef(search)

  const loadLists = useCallback(async () => {
    try {
      const [buildings, pcs] = await Promise.all([getBuildings(), getComputers()])
      setOverview(buildings)
      setComputers(pcs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить справочники')
    }
  }, [])

  const loadTasks = useCallback(async (term: string, building: BuildingFilter) => {
    setLoading(true)
    setError(null)
    try {
      setTasks(await getTasks({ search: term, buildingId: building }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить задачи')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadLists()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadLists])

  useEffect(() => {
    const searchChanged = lastSearch.current !== search
    lastSearch.current = search
    const delay = searchChanged && !firstSearch.current ? 300 : 0
    firstSearch.current = false
    const timeout = window.setTimeout(() => {
      void loadTasks(search.trim(), buildingFilter)
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [search, buildingFilter, loadTasks])

  const counts = useMemo(() => {
    const byStatus: Record<TaskStatus | 'all', number> = {
      all: tasks.length,
      new: 0,
      in_progress: 0,
      waiting: 0,
      done: 0,
      cancelled: 0,
    }
    for (const task of tasks) {
      byStatus[task.status] += 1
    }
    byStatus.all = tasks.length
    return byStatus
  }, [tasks])

  const visibleTasks = useMemo(
    () => (status === 'all' ? tasks : tasks.filter((task) => task.status === status)),
    [status, tasks],
  )

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadTasks(search.trim(), buildingFilter)
  }

  async function handleSaved() {
    setShowForm(false)
    setEditing(null)
    await loadTasks(search.trim(), buildingFilter)
  }

  async function handleStatusChange(task: Task, nextStatus: TaskStatus) {
    const payload: TaskFormData = { ...toTaskFormData(task), status: nextStatus }
    try {
      const saved = await updateTask(task.id, payload)
      setTasks((current) => current.map((item) => (item.id === saved.id ? saved : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить статус')
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return
    try {
      await deleteTask(pendingDelete.id)
      setPendingDelete(null)
      await loadTasks(search.trim(), buildingFilter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить задачу')
      setPendingDelete(null)
    }
  }

  const buildings: Building[] = overview.items

  return (
    <main className="min-h-0 flex-1 overflow-auto p-5">
      <section className="border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Задачи</h2>
            <p className="mt-1 text-sm text-slate-500">Рабочие задания и их статусы</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
          >
            Новая задача
          </button>
        </div>

        <form className="flex flex-col gap-3 px-5 py-4 md:flex-row" onSubmit={handleSearchSubmit}>
          <input
            type="search"
            value={search}
            placeholder="Поиск по названию, исполнителю, компьютеру..."
            className="field flex-1"
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="field md:w-56"
            value={typeof buildingFilter === 'number' ? String(buildingFilter) : buildingFilter}
            onChange={(event) => {
              const value = event.target.value
              if (value === 'all' || value === 'none') {
                setBuildingFilter(value)
                return
              }
              setBuildingFilter(Number(value))
            }}
          >
            <option value="all">Все здания</option>
            <option value="none">Без здания</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary">
            Найти
          </button>
        </form>

        <div className="flex flex-wrap gap-1 border-b border-slate-200">
          {[{ value: 'all' as const, label: 'Все' }, ...TASK_STATUSES].map((tab) => {
            const active = status === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                className={`relative px-4 py-2.5 text-sm ${
                  active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                }`}
                onClick={() => setStatus(tab.value)}
              >
                <span className="font-medium">{tab.label}</span>
                <span className="ml-2 text-xs text-slate-400">{counts[tab.value]}</span>
                <span
                  className={`absolute inset-x-3 -bottom-px h-0.5 origin-left bg-slate-700 transition-transform duration-150 ${
                    active ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </button>
            )
          })}
        </div>
      </section>

      {error && (
        <p className="mt-4 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      <section className="mt-4 border border-slate-200 bg-white">
        {loading && tasks.length === 0 && !error ? (
          <p className="px-6 py-16 text-center text-slate-500">Загрузка...</p>
        ) : visibleTasks.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-lg font-medium text-slate-800">
              {search.trim()
                ? `Ничего не найдено по запросу «${search.trim()}»`
                : status !== 'all'
                  ? 'Нет задач в этом статусе'
                  : 'Задач пока нет'}
            </p>
            <p className="mt-2 text-sm text-slate-500">Добавьте задание или смените фильтр.</p>
          </div>
        ) : (
          <ul>
            {visibleTasks.map((task) => (
              <li key={task.id} className="border-b border-slate-100 px-5 py-4 last:border-0">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-slate-900">{task.title}</h3>
                      <TaskStatusBadge status={task.status} />
                    </div>
                    {task.description && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      {task.assignee ? `Исполнитель: ${task.assignee}` : 'Исполнитель не указан'}
                      {' · '}
                      {task.due_date ? `срок ${task.due_date}` : 'срок не задан'}
                      {task.building_name ? ` · ${task.building_name}` : ''}
                      {task.computer_hostname || task.computer_ip
                        ? ` · ${displayValue(task.computer_hostname || task.computer_ip)}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="field py-1.5 text-sm"
                      value={task.status}
                      onChange={(event) => void handleStatusChange(task, event.target.value as TaskStatus)}
                    >
                      {TASK_STATUSES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setEditing(task)
                        setShowForm(true)
                      }}
                    >
                      Изменить
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => setPendingDelete(task)}>
                      Удалить
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showForm && (
        <TaskForm
          key={editing?.id ?? 'new-task'}
          task={editing}
          buildings={buildings}
          computers={computers}
          onClose={() => setShowForm(false)}
          onSaved={() => void handleSaved()}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Удалить задачу?"
          message={`Задача «${pendingDelete.title}» будет удалена.`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </main>
  )
}

export default TasksPage
