import { useEffect, useState } from 'react'
import type { AppData } from './types'
import { loadData, saveData } from './storage'
import RotationPage from './pages/RotationPage'
import SettingsPage from './pages/SettingsPage'

type Tab = 'rotation' | 'settings'

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'rotation', label: 'ローテーション', icon: '◎' },
  { id: 'settings', label: '設定', icon: '◇' },
]

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [tab, setTab] = useState<Tab>('rotation')

  useEffect(() => {
    saveData(data)
  }, [data])

  return (
    <div className="app">
      <main className="app-main">
        {tab === 'rotation' && <RotationPage data={data} setData={setData} />}
        {tab === 'settings' && <SettingsPage data={data} setData={setData} />}
      </main>
      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
