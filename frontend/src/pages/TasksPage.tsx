import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { getBuildings } from '../api/buildings'
import { getComputers } from '../api/computers'
import { deleteTask, getTasks, updateTask } from '../api/tasks'
import ConfirmDialog from '../components/ConfirmDialog'
import { CloseIcon, EditIcon, PlusIcon, SearchIcon, TrashIcon } from '../components/Icons'
import { TaskStatusBadge } from '../components/StatusBadge'
import TaskForm from '../components/TaskForm'
import { displayValue, formatDateRu, isOverdue } from '../lib/format'
import type { Building, BuildingFilter, BuildingsOverview, Computer } from '../types/computer'
import type { Task, TaskFormData, TaskStatus } from '../types/task'
import { toTaskFormData } from '../types/task'

const emptyOverview: BuildingsOverview = { items: [], unassigned: 0, total: 0 }

function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [computers, setComputers] = useState<Computer[]>([])
  const [overview, setOverview] = useState<BuildingsOverview>(emptyOverview)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'active' | 'done'>('active')
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
    const delay = searchChanged && !firstSearch.current ? 250 : 0
    firstSearch.current = false
    const timeout = window.setTimeout(() => {
      void loadTasks(search.trim(), buildingFilter)
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [search, buildingFilter, loadTasks])

  const counts = useMemo(
    () => ({
      active: tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled').length,
      done: tasks.filter((task) => task.status === 'done' || task.status === 'cancelled').length,
    }),
    [tasks],
  )

  const visibleTasks = useMemo(
    () =>
      status === 'done'
        ? tasks.filter((task) => task.status === 'done' || task.status === 'cancelled')
        : tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled'),
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
    <main className="workspace-main min-h-0 flex-1 overflow-auto p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <section className="surface-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Задачи</h2>
              <p className="mt-0.5 text-sm text-slate-500">Заметки о делах, которые нужно выполнить</p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditing(null)
                setShowForm(true)
              }}
            >
              <PlusIcon size={15} />
              Новая задача
            </button>
          </div>

          <form className="flex flex-col gap-2.5 px-5 py-3.5 md:flex-row md:items-center" onSubmit={handleSearchSubmit}>
            <div className="relative min-w-0 flex-1">
              <SearchIcon
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                placeholder="Поиск по названию, описанию, исполнителю, устройству…"
                className="field pl-9 pr-8"
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
                  onClick={() => setSearch('')}
                  aria-label="Очистить поиск"
                >
                  <CloseIcon size={14} />
                </button>
              )}
            </div>
            <select
              aria-label="Фильтр по зданию"
              className="field shrink-0 md:w-56"
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
            <button type="submit" className="btn btn-primary shrink-0">
              Найти
            </button>
          </form>

          <div className="flex flex-wrap gap-1 border-t border-slate-100 px-3">
            {[
              { value: 'active' as const, label: 'К выполнению' },
              { value: 'done' as const, label: 'Готово' },
            ].map((tab) => {
              const active = status === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors ${
                    active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  onClick={() => setStatus(tab.value)}
                >
                  <span className={active ? 'font-semibold' : 'font-medium'}>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                      active ? 'bg-slate-200/80 text-slate-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {counts[tab.value]}
                  </span>
                  <span
                    className={`absolute inset-x-2 bottom-0 h-0.5 origin-left rounded-full bg-slate-800 transition-transform duration-150 ${
                      active ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </button>
              )
            })}
          </div>
        </section>

        {error && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <button type="button" className="icon-btn shrink-0" aria-label="Скрыть ошибку" onClick={() => setError(null)}>
              <CloseIcon size={15} />
            </button>
          </div>
        )}

        <section className="surface-card mt-4 overflow-hidden">
          {loading && tasks.length === 0 && !error ? (
            <p className="px-6 py-16 text-center text-sm text-slate-500">Загрузка…</p>
          ) : visibleTasks.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-base font-semibold text-slate-800">
                {search.trim()
                  ? `Ничего не найдено по запросу «${search.trim()}»`
                  : status !== 'active'
                    ? 'Выполненных задач пока нет'
                    : 'Активных задач нет'}
              </p>
              <p className="mt-1.5 text-sm text-slate-500">Добавьте задачу или измените фильтры.</p>
            </div>
          ) : (
            <ul>
              {visibleTasks.map((task) => {
                const done = task.status === 'done'
                const overdue = !done && task.status !== 'cancelled' && isOverdue(task.due_date)
                return (
                  <li
                    key={task.id}
                    className="border-b border-slate-100 px-5 py-4 transition-colors last:border-0 hover:bg-slate-50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer rounded accent-slate-700"
                            aria-label={`Отметить задачу «${task.title}» выполненной`}
                            checked={done}
                            onChange={() => void handleStatusChange(task, done ? 'new' : 'done')}
                          />
                          <h3
                            className={`text-sm font-semibold ${
                              done ? 'text-slate-400 line-through' : 'text-slate-900'
                            }`}
                          >
                            {task.title}
                          </h3>
                          {task.status !== 'new' && <TaskStatusBadge status={task.status} />}
                          {overdue && (
                            <span className="inline-flex rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700">
                              Просрочено
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="mt-1.5 pl-6.5 whitespace-pre-wrap text-sm text-slate-600">
                            {task.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 pl-6.5 text-xs text-slate-500">
                          <span>{task.assignee ? `Исполнитель: ${task.assignee}` : 'Исполнитель не указан'}</span>
                          <span>·</span>
                          <span className={overdue ? 'font-medium text-rose-600' : undefined}>
                            {task.due_date ? `срок ${formatDateRu(task.due_date)}` : 'срок не задан'}
                          </span>
                          {task.building_name && (
                            <>
                              <span>·</span>
                              <span>{task.building_name}</span>
                            </>
                          )}
                          {(task.computer_hostname || task.computer_ip) && (
                            <>
                              <span>·</span>
                              <span className="font-mono">
                                {displayValue(task.computer_hostname || task.computer_ip)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 pl-6.5 sm:pl-0">
                        <button
                          type="button"
                          className="icon-btn"
                          title="Изменить задачу"
                          aria-label="Изменить задачу"
                          onClick={() => {
                            setEditing(task)
                            setShowForm(true)
                          }}
                        >
                          <EditIcon size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          title="Удалить задачу"
                          aria-label="Удалить задачу"
                          onClick={() => setPendingDelete(task)}
                        >
                          <TrashIcon size={15} />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

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
