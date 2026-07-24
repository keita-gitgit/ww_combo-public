import { useEffect, useState } from 'react'
import type { AppData } from './types'
import { loadData, saveData } from './storage'
import RotationPage from './pages/RotationPage'
import SettingsPage from './pages/SettingsPage'
import EchoScorePage from './pages/EchoScorePage'

type Tab = 'rotation' | 'echo' | 'settings'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'rotation', label: 'ローテーション' },
  { id: 'echo', label: '音骸' },
  { id: 'settings', label: '設定' },
]

function TabIcon({ id }: { id: Tab }) {
  if (id === 'rotation') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7h10M7 12h10M7 17h7" />
        <circle cx="4" cy="7" r="1" />
        <circle cx="4" cy="12" r="1" />
        <circle cx="4" cy="17" r="1" />
      </svg>
    )
  }

  if (id === 'echo') {
    return <span className="echo-tab-symbol" aria-hidden="true" />
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.08-1l2-1.55-2-3.46-2.42.98a7.1 7.1 0 0 0-1.72-1L14.43 3h-4.01l-.35 2.97a7.1 7.1 0 0 0-1.72 1l-2.42-.98-2 3.46L5.93 11a7 7 0 0 0 0 2l-2 1.55 2 3.46 2.42-.98a7.1 7.1 0 0 0 1.72 1l.35 2.97h4.01l.35-2.97a7.1 7.1 0 0 0 1.72-1l2.42.98 2-3.46L18.92 13c.05-.33.08-.66.08-1Z" />
    </svg>
  )
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [tab, setTab] = useState<Tab>('rotation')
  const theme = data.theme ?? 'dark'

  useEffect(() => {
    saveData(data)
  }, [data])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const themeColor = theme === 'dark' ? '#101112' : theme === 'light' ? '#f5f6f7' : '#f4efe5'
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
      'content',
      themeColor,
    )
    document
      .querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')
      ?.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default')
  }, [theme])

  return (
    <div className="app" data-theme={theme}>
      <main className="app-main">
        {tab === 'rotation' && <RotationPage data={data} setData={setData} />}
        {tab === 'echo' && <EchoScorePage data={data} setData={setData} />}
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
            <span className="tab-icon">
              <TabIcon id={t.id} />
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
