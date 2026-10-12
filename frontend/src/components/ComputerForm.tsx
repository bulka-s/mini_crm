import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createComputer, updateComputer } from '../api/computers'
import type { Building, Computer, ComputerFormData } from '../types/computer'
import { PC_STATUSES, emptyComputerForm, toFormData } from '../types/computer'

interface ComputerFormProps {
  computer?: Computer | null
  buildings: Building[]
  defaultBuildingId?: number | null
  onClose: () => void
  onSaved: (computer: Computer) => void
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="mb-1 text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-slate-400">*</span>}
      </label>
      {children}
    </div>
  )
}

function ComputerForm({ computer, buildings, defaultBuildingId = null, onClose, onSaved }: ComputerFormProps) {
  const isEdit = Boolean(computer)
  const [formData, setFormData] = useState<ComputerFormData>(() =>
    computer ? toFormData(computer) : { ...emptyComputerForm, building_id: defaultBuildingId },
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

  function updateField<K extends keyof ComputerFormData>(name: K, value: ComputerFormData[K]) {
    setFormData((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const saved = computer
        ? await updateComputer(computer.id, formData)
        : await createComputer(formData)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить запись')
    } finally {
      setSaving(false)
    }
  }

  const statusOptions = PC_STATUSES.includes(formData.pc_status as (typeof PC_STATUSES)[number])
    ? [...PC_STATUSES]
    : formData.pc_status
      ? [formData.pc_status, ...PC_STATUSES]
      : [...PC_STATUSES]

  const selectedBuilding = buildings.find((item) => item.id === formData.building_id)
  const showFullName = Boolean(selectedBuilding?.show_full_name)

  return (
    <div className="overlay-enter fixed inset-0 z-50 bg-slate-900/30" onClick={onClose}>
      <div
        className="panel-enter absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? 'Редактировать компьютер' : 'Добавить компьютер'}
          </h2>
          <button type="button" className="px-2 text-2xl text-slate-400 hover:text-slate-800" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {error && (
              <p className="mb-4 border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field id="building_id" label="Здание">
                  <select
                    id="building_id"
                    className="field"
                    value={formData.building_id ?? ''}
                    onChange={(event) =>
                      updateField('building_id', event.target.value ? Number(event.target.value) : null)
                    }
                  >
                    <option value="">Без здания</option>
                    {buildings.map((building) => (
                      <option key={building.id} value={building.id}>
                        {building.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field id="ip_address" label="IP-адрес">
                <input
                  id="ip_address"
                  className="field"
                  value={formData.ip_address}
                  placeholder="10.110.1.10"
                  onChange={(event) => updateField('ip_address', event.target.value)}
                />
              </Field>
              <Field id="hostname" label="Имя компьютера">
                <input
                  id="hostname"
                  className="field"
                  value={formData.hostname}
                  placeholder="PC-CAB-12"
                  onChange={(event) => updateField('hostname', event.target.value)}
                />
              </Field>
              {showFullName && (
                <div className="sm:col-span-2">
                  <Field id="full_name" label="ФИО">
                    <input
                      id="full_name"
                      className="field"
                      value={formData.full_name}
                      placeholder="Иванов Пётр Сергеевич"
                      onChange={(event) => updateField('full_name', event.target.value)}
                    />
                  </Field>
                </div>
              )}
              <Field id="phone" label="Телефон">
                <input
                  id="phone"
                  type="tel"
                  className="field"
                  value={formData.phone}
                  placeholder="11-22"
                  onChange={(event) => updateField('phone', event.target.value)}
                />
              </Field>
              <Field id="cabinet" label="Кабинет">
                <input
                  id="cabinet"
                  className="field"
                  value={formData.cabinet}
                  onChange={(event) => updateField('cabinet', event.target.value)}
                />
              </Field>
              <Field id="department_name" label="Отдел">
                <input
                  id="department_name"
                  className="field"
                  value={formData.department_name}
                  onChange={(event) => updateField('department_name', event.target.value)}
                />
              </Field>
              <Field id="pc_status" label="Статус">
                <select
                  id="pc_status"
                  className="field"
                  value={formData.pc_status}
                  onChange={(event) => updateField('pc_status', event.target.value)}
                >
                  <option value="">Не указан</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field id="note" label="Примечание">
                  <textarea
                    id="note"
                    rows={4}
                    className="field"
                    value={formData.note}
                    onChange={(event) => updateField('note', event.target.value)}
                  />
                </Field>
              </div>
            </div>
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

export default ComputerForm
