import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createBuilding, updateBuilding } from '../api/buildings'
import type { Building } from '../types/computer'

interface BuildingFormProps {
  building?: Building | null
  onClose: () => void
  onSaved: (building: Building) => void
}

function BuildingForm({ building, onClose, onSaved }: BuildingFormProps) {
  const [name, setName] = useState(building?.name ?? '')
  const [address, setAddress] = useState(building?.address ?? '')
  const [showFullName, setShowFullName] = useState(building?.show_full_name ?? false)
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
        show_full_name: showFullName,
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
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showFullName}
                onChange={(event) => setShowFullName(event.target.checked)}
              />
              Показывать ФИО
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

export default BuildingForm
