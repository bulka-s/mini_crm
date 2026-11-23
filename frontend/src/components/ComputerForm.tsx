import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createComputer, updateComputer } from '../api/computers'
import { getAvailableIPs } from '../api/buildings'
import type { Building, Computer, ComputerFormData } from '../types/computer'
import { emptyComputerForm, toFormData } from '../types/computer'

interface ComputerFormProps {
  computer?: Computer | null
  buildings: Building[]
  defaultBuildingId?: number | null
  defaultIPAddress?: string
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

function ComputerForm({ computer, buildings, defaultBuildingId = null, defaultIPAddress = '', onClose, onSaved }: ComputerFormProps) {
  const isEdit = Boolean(computer)
  const [formData, setFormData] = useState<ComputerFormData>(() =>
    computer ? toFormData(computer) : { ...emptyComputerForm, building_id: defaultBuildingId, ip_address: defaultIPAddress },
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [networkId, setNetworkId] = useState<number | ''>(() => {
    const buildingId = computer?.building_id ?? defaultBuildingId
    return buildings.find((item) => item.id === buildingId)?.networks?.find((network) => network.cidr)?.id ?? ''
  })
  const [availableIPs, setAvailableIPs] = useState<string[]>([])
  const [ipsTruncated, setIPsTruncated] = useState(false)
  const [showAvailableIPs, setShowAvailableIPs] = useState(false)
  const [manualIP, setManualIP] = useState(!networkId)

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

  const selectedBuilding = buildings.find((item) => item.id === formData.building_id)
  const configuredNetworks = selectedBuilding?.networks?.filter((network) => network.cidr) ?? []

  useEffect(() => {
    if (!networkId) return
    let active = true
    void getAvailableIPs(networkId).then((result) => { if (active) { setAvailableIPs(result.items); setIPsTruncated(result.truncated) } }).catch(() => { if (active) { setAvailableIPs([]); setIPsTruncated(false) } })
    return () => { active = false }
  }, [networkId])

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
                      (() => {
                        const buildingId = event.target.value ? Number(event.target.value) : null
                        updateField('building_id', buildingId)
                        const nextNetworkId = buildings.find((item) => item.id === buildingId)?.networks?.find((network) => network.cidr)?.id ?? ''
                        setNetworkId(nextNetworkId)
                        setManualIP(!nextNetworkId)
                      })()
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
              {configuredNetworks.length > 0 && (
                <div className="sm:col-span-2">
                  <Field id="network_id" label="Сеть">
                    <select id="network_id" className="field" value={networkId} onChange={(event) => { setNetworkId(Number(event.target.value)); setManualIP(false) }}>
                      {configuredNetworks.map((network) => <option key={network.id} value={network.id}>{network.name} · {network.cidr}</option>)}
                    </select>
                  </Field>
                </div>
              )}
              <div className="sm:col-span-2">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-0 flex-1">
                    {configuredNetworks.length > 0 && !manualIP ? (
                      <Field id="ip_address" label="IP-адрес">
                        <select
                          id="ip_address"
                          className="field font-mono"
                          value={formData.ip_address}
                          onChange={(event) => {
                            if (event.target.value === '__manual__') { setManualIP(true); return }
                            updateField('ip_address', event.target.value)
                          }}
                        >
                          <option value="">Выберите свободный адрес</option>
                          {formData.ip_address && !availableIPs.includes(formData.ip_address) && (
                            <option value={formData.ip_address}>{formData.ip_address} · текущий адрес</option>
                          )}
                          {availableIPs.map((ip) => <option key={ip} value={ip}>{ip}</option>)}
                          <option value="__manual__">Ввести IP вручную…</option>
                        </select>
                      </Field>
                    ) : (
                      <Field id="ip_address" label="IP-адрес">
                        <input id="ip_address" className="field font-mono" value={formData.ip_address} placeholder="Например, 10.110.1.10" onChange={(event) => updateField('ip_address', event.target.value)} />
                      </Field>
                    )}
                  </div>
                  {configuredNetworks.length > 0 && (
                    <button type="button" className="btn btn-ghost" onClick={() => setShowAvailableIPs((shown) => !shown)}>
                      {showAvailableIPs ? 'Скрыть адреса' : 'Показать свободные адреса'}
                    </button>
                  )}
                  {manualIP && configuredNetworks.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => setManualIP(false)}>Выбрать из списка</button>}
                </div>
                {showAvailableIPs && (
                  <div className="mt-2 max-h-52 overflow-y-auto border border-slate-200 bg-slate-50 p-2">
                    {availableIPs.length === 0 ? <p className="p-2 text-sm text-slate-500">Свободных адресов нет или список ещё загружается.</p> : (
                      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                        {availableIPs.map((ip) => <button key={ip} type="button" className="rounded px-2 py-1 text-left font-mono text-sm text-slate-700 hover:bg-white" onClick={() => { updateField('ip_address', ip); setManualIP(false); setShowAvailableIPs(false) }}>{ip}</button>)}
                      </div>
                    )}
                    {ipsTruncated && <p className="mt-2 text-xs text-slate-500">Показаны первые 4096 свободных адресов; остальные можно ввести вручную.</p>}
                  </div>
                )}
                {configuredNetworks.length === 0 && formData.building_id && <p className="mt-1 text-xs text-slate-500">Для выбора свободного IP задайте сеть и маску в настройках здания.</p>}
              </div>
              <Field id="hostname" label="Имя компьютера">
                <input
                  id="hostname"
                  className="field"
                  value={formData.hostname}
                  placeholder="PC-CAB-12"
                  onChange={(event) => updateField('hostname', event.target.value)}
                />
              </Field>
              <Field id="mac_address" label="MAC-адрес">
                <input id="mac_address" className="field font-mono" value={formData.mac_address} placeholder="AA:BB:CC:DD:EE:FF" onChange={(event) => updateField('mac_address', event.target.value)} />
              </Field>
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
              <Field id="department_name" label="Отдел">
                <input
                  id="department_name"
                  className="field"
                  value={formData.department_name}
                  onChange={(event) => updateField('department_name', event.target.value)}
                />
              </Field>
              <Field id="device_type" label="Тип устройства">
                <select id="device_type" className="field" value={formData.device_type} onChange={(event) => updateField('device_type', event.target.value)}>
                  <option value="computer">Компьютер</option><option value="printer">Принтер</option><option value="gateway">Шлюз</option><option value="other">Другое</option>
                </select>
              </Field>
              {formData.device_type === 'computer' && <Field id="operating_system" label="Операционная система">
                <input id="operating_system" className="field" value={formData.operating_system} placeholder="Windows 11" onChange={(event) => updateField('operating_system', event.target.value)} />
              </Field>}
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
