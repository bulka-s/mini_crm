import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createBuilding, updateBuilding } from '../api/buildings'
import type { Building, BuildingNetwork } from '../types/computer'
import { CloseIcon, PlusIcon, TrashIcon } from './Icons'

interface BuildingFormProps {
  building?: Building | null
  onClose: () => void
  onSaved: (building: Building) => void
}

function BuildingForm({ building, onClose, onSaved }: BuildingFormProps) {
  const [name, setName] = useState(building?.name ?? '')
  const [address, setAddress] = useState(building?.address ?? '')
  const [networks, setNetworks] = useState<BuildingNetwork[]>(() => building?.networks ?? [])
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

  function addPresetNetwork(presetName: string) {
    setNetworks((items) => [...items, { name: presetName, cidr: '' }])
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const cleanedNetworks = networks
        .map((network) => ({
          ...network,
          name: network.name.trim(),
          cidr: network.cidr.trim(),
        }))
        .filter((network) => network.name !== '' || network.cidr !== '')

      const payload = {
        name: name.trim(),
        address: address.trim(),
        networks: cleanedNetworks,
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
    <div className="overlay-enter fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose}>
      <div
        className="panel-enter absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {building ? 'Редактировать здание' : 'Новое здание'}
          </h2>
          <button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}>
            <CloseIcon size={18} />
          </button>
        </div>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {error && (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Название *
              <input
                required
                autoFocus
                className="field mt-1"
                placeholder="Например, Главный корпус"
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
                <h3 className="text-sm font-semibold text-slate-800">Сети и маски (необязательно)</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Укажите подсеть в формате CIDR, например <code className="font-mono">10.110.1.0/24</code>, чтобы
                  подбирать свободные IP-адреса.
                </p>
              </div>
              {networks.length > 0 && (
                <div className="space-y-2">
                  {networks.map((network, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                      <input
                        className="field min-w-0 text-sm"
                        aria-label="Название сети"
                        placeholder="Название"
                        value={network.name}
                        onChange={(event) =>
                          setNetworks((items) =>
                            items.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                          )
                        }
                      />
                      <input
                        className="field min-w-0 font-mono text-sm"
                        aria-label="Адрес сети и маска"
                        placeholder="10.110.1.0/24"
                        value={network.cidr}
                        onChange={(event) =>
                          setNetworks((items) =>
                            items.map((item, i) => (i === index ? { ...item, cidr: event.target.value } : item)),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        aria-label="Удалить сеть"
                        title="Удалить сеть"
                        onClick={() => setNetworks((items) => items.filter((_, i) => i !== index))}
                      >
                        <TrashIcon size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => addPresetNetwork('')}
                >
                  <PlusIcon size={14} />
                  Добавить сеть
                </button>
                {!networks.some((n) => n.name.toLowerCase() === 'локальная') && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => addPresetNetwork('Локальная')}
                  >
                    + Локальная
                  </button>
                )}
                {!networks.some((n) => n.name.toLowerCase() === 'интернет') && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => addPresetNetwork('Интернет')}
                  >
                    + Интернет
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 border-t border-slate-200 p-4">
            <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BuildingForm
