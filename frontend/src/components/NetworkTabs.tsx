import type { NetworkKind } from '../types/computer'

export type NetworkFilter = NetworkKind | 'all'

interface NetworkTabsProps {
  value: NetworkFilter
  counts: Record<NetworkFilter, number>
  onChange: (value: NetworkFilter) => void
}

const tabs: { key: NetworkFilter; label: string; hint: string }[] = [
  { key: 'all', label: 'Все сети', hint: '' },
  { key: 'local', label: 'Локальная', hint: '10.110.x.x' },
  { key: 'external', label: 'Интернет', hint: '192.168.x.x' },
  { key: 'other', label: 'Другие', hint: '' },
]

function NetworkTabs({ value, counts, onChange }: NetworkTabsProps) {
  return (
    <div className="flex flex-wrap gap-1 border-t border-slate-100 px-3">
      {tabs.map((tab) => {
        const active = value === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors ${
              active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => onChange(tab.key)}
          >
            <span className={active ? 'font-semibold' : 'font-medium'}>{tab.label}</span>
            {tab.hint && <span className="hidden font-mono text-[11px] text-slate-400 sm:inline">{tab.hint}</span>}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                active ? 'bg-slate-200/80 text-slate-800' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {counts[tab.key]}
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
  )
}

export default NetworkTabs
