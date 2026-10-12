import type { NetworkKind } from '../types/computer'

export type NetworkFilter = NetworkKind | 'all'

interface NetworkTabsProps {
  value: NetworkFilter
  counts: Record<NetworkFilter, number>
  onChange: (value: NetworkFilter) => void
}

const tabs: { key: NetworkFilter; label: string; hint: string }[] = [
  { key: 'all', label: 'Все сети', hint: '' },
  { key: 'local', label: 'Локальная', hint: '10.110.X.X' },
  { key: 'external', label: 'Внешняя', hint: '192.168.X.X' },
  { key: 'other', label: 'Другие', hint: '' },
]

function NetworkTabs({ value, counts, onChange }: NetworkTabsProps) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map((tab) => {
        const active = value === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            className={`relative px-4 py-2.5 text-sm ${
              active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => onChange(tab.key)}
          >
            <span className="font-medium">{tab.label}</span>
            {tab.hint && <span className="ml-2 text-xs text-slate-400">{tab.hint}</span>}
            <span className="ml-2 text-xs text-slate-400">{counts[tab.key]}</span>
            <span
              className={`absolute inset-x-3 -bottom-px h-0.5 origin-left bg-slate-700 transition-transform duration-150 ${
                active ? 'scale-x-100' : 'scale-x-0'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}

export default NetworkTabs
