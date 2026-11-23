import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createBuilding, updateBuilding } from '../api/buildings'
import type { Building } from '../types/computer'
import type { BuildingNetwork } from '../types/computer'

interface BuildingFormProps {
  building?: Building | null
  onClose: () => void
  onSaved: (building: Building) => void
}

function BuildingForm({ building, onClose, onSaved }: BuildingFormProps) {
  const [name, setName] = useState(building?.name ?? '')
  const [address, setAddress] = useState(building?.address ?? '')
  const [networks, setNetworks] = useState<BuildingNetwork[]>(building?.networks ?? [
    { name: 'Локальная', cidr: '' },
    { name: 'Интернет', cidr: '' },
  ])
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        networks: networks.filter((network) => network.name.trim() || network.cidr.trim()),
      }
      const saved = building
        ? await updateBuilding(building.id, payload)
        : await createBuilding(payload)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить здание')
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
          <h2 className="text-lg font-semibold">{building ? 'Редактировать здание' : 'Новое здание'}</h2>
          <button type="button" className="px-2 text-2xl text-slate-400 hover:text-slate-800" onClick={onClose}>
            ×
          </button>
        </div>
        <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {error && (
              <p className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Название
              <input
                required
                className="field mt-1"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Адрес
              <input
                className="field mt-1"
                value={address}
                placeholder="ул. Ленина, 1"
                onChange={(event) => setAddress(event.target.value)}
              />
            </label>
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Сети и маски</h3>
                <p className="mt-1 text-xs text-slate-500">Введите сеть с маской в формате CIDR, например 10.110.1.0/24. Если пока не знаете адрес, удалите эту строку и добавьте позже.</p>
              </div>
              {networks.map((network, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input className="field min-w-0" aria-label="Название сети" placeholder="Название" value={network.name}
                    onChange={(event) => setNetworks((items) => items.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} />
                  <input className="field min-w-0 font-mono" aria-label="Адрес сети и маска" placeholder="10.110.1.0/24" value={network.cidr}
                    onChange={(event) => setNetworks((items) => items.map((item, i) => i === index ? { ...item, cidr: event.target.value } : item))} />
                  <button type="button" className="btn btn-ghost px-2" aria-label="Удалить сеть" onClick={() => setNetworks((items) => items.filter((_, i) => i !== index))}>×</button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost" onClick={() => setNetworks((items) => [...items, { name: '', cidr: '' }])}>Добавить сеть</button>
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

export default BuildingForm
