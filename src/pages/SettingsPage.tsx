import { useRef } from 'react'
import type { AppData } from '../types'
import { exportData, MAX_IMPORT_BYTES, parseImportedData } from '../storage'
import { makeSeedData, DEFAULT_BUTTON_MAP } from '../seed'
import type { AppTheme } from '../types'

interface Props {
  data: AppData
  setData: (d: AppData) => void
}

const BUTTON_GROUPS = [
  { label: 'フェイスボタン', values: ['□', '△', '○', '×'] },
  { label: 'ショルダーボタン', values: ['L1', 'L2', 'R1', 'R2'] },
  { label: 'その他のボタン', values: ['L3', 'R3', '十字キー', 'タッチパッド', 'OPTIONS', 'CREATE'] },
  { label: '入力条件', values: ['空中で', '長押し'] },
] as const

const CUSTOM_BUTTON_VALUE = '__custom__'
const THEME_OPTIONS: Array<{ id: AppTheme; label: string; description: string }> = [
  { id: 'dark', label: 'ダーク', description: '墨色' },
  { id: 'light', label: 'ライト', description: '白' },
  { id: 'cream', label: 'クリーム', description: '生成り' },
]

function normalizeButtonParts(parts: string[]): string[] {
  const unique = parts.filter((part, index) => part && parts.indexOf(part) === index)
  const prefix = unique.includes('空中で') ? ['空中で'] : []
  const suffix = unique.includes('長押し') ? ['長押し'] : []
  const buttons = unique.filter((part) => part !== '空中で' && part !== '長押し')
  return [...prefix, ...buttons, ...suffix]
}

function parseButtonSetting(value: string): string[] {
  let notation = value.trim()
  if (!notation) return []

  const parts: string[] = []
  if (notation.startsWith('空中で')) {
    parts.push('空中で')
    notation = notation.slice('空中で'.length)
  }

  const longPress = notation.endsWith('長押し')
  if (longPress) notation = notation.slice(0, -'長押し'.length)

  parts.push(...notation.split('+').map((part) => part.trim()).filter(Boolean))
  if (longPress) parts.push('長押し')
  return normalizeButtonParts(parts)
}

function formatButtonSetting(parts: string[]): string {
  const normalized = normalizeButtonParts(parts)
  const prefix = normalized.includes('空中で') ? '空中で' : ''
  const suffix = normalized.includes('長押し') ? '長押し' : ''
  const buttons = normalized.filter((part) => part !== '空中で' && part !== '長押し')
  return `${prefix}${buttons.join('+')}${suffix}`
}

function connectorBefore(parts: string[], index: number): string {
  if (index === 0 || parts[index] === '長押し' || parts[index - 1] === '空中で') return ''
  return '+'
}

function ButtonBinding({
  actionName,
  value,
  onChange,
}: {
  actionName: string
  value: string
  onChange: (value: string) => void
}) {
  const parts = parseButtonSetting(value)

  const addPart = (selected: string) => {
    let part = selected
    if (selected === CUSTOM_BUTTON_VALUE) {
      part = prompt('ボタン表記')?.trim() ?? ''
    }
    if (!part) return
    onChange(formatButtonSetting([...parts, ...parseButtonSetting(part)]))
  }

  const removePart = (index: number) => {
    onChange(formatButtonSetting(parts.filter((_, partIndex) => partIndex !== index)))
  }

  return (
    <div className="button-binding">
      <div className="button-parts" aria-label={`${actionName}の現在の設定: ${value || '未設定'}`}>
        {parts.length === 0 && <span className="button-binding-empty">未設定</span>}
        {parts.map((part, index) => (
          <span key={`${part}-${index}`} className="button-part-group">
            {connectorBefore(parts, index) && (
              <span className="button-part-connector" aria-hidden="true">
                +
              </span>
            )}
            <button
              className="button-part"
              onClick={() => removePart(index)}
              aria-label={`${actionName}から${part}を外す`}
            >
              {part}
              <span className="button-part-remove" aria-hidden="true">
                ×
              </span>
            </button>
          </span>
        ))}
      </div>
      <select
        className="button-add-select"
        value=""
        onChange={(event) => addPart(event.target.value)}
        aria-label={`${actionName}にボタンを追加`}
      >
        <option value="">＋ 追加</option>
        {BUTTON_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.values.map((part) => (
              <option key={part} value={part} disabled={parts.includes(part)}>
                {part}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={CUSTOM_BUTTON_VALUE}>自由入力…</option>
      </select>
    </div>
  )
}

export default function SettingsPage({ data, setData }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const buttonMap = data.buttonMap ?? {}

  const setButton = (name: string, value: string) => {
    setData({ ...data, buttonMap: { ...buttonMap, [name]: value } })
  }

  const resetButtons = () => {
    if (!confirm('ボタン設定をPS5のデフォルト配置に戻しますか？')) return
    setData({ ...data, buttonMap: { ...DEFAULT_BUTTON_MAP } })
  }

  const onImportFile = async (file: File) => {
    try {
      if (file.size > MAX_IMPORT_BYTES) {
        throw new Error('バックアップファイルは5MB以下にしてください')
      }
      const text = await file.text()
      const imported = parseImportedData(text)
      if (!confirm('現在のデータをインポートしたデータで置き換えます。よろしいですか？')) return
      setData(imported)
      alert('インポートしました')
    } catch (e) {
      alert(`インポートに失敗しました: ${e instanceof Error ? e.message : e}`)
    }
  }

  const reset = () => {
    if (!confirm('すべてのデータを初期状態（サンプルデータ）に戻します。よろしいですか？')) return
    setData(makeSeedData())
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-heading">
          <span className="page-kicker">端末とデータ</span>
          <h1>設定</h1>
        </div>
      </header>

      <div className="card appearance-card">
        <h3>外観</h3>
        <div className="theme-options" role="group" aria-label="配色">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={`theme-option ${(data.theme ?? 'dark') === option.id ? 'active' : ''}`}
              onClick={() => setData({ ...data, theme: option.id })}
              aria-pressed={(data.theme ?? 'dark') === option.id}
            >
              <span className={`theme-swatch ${option.id}`} aria-hidden="true" />
              <span className="theme-option-copy">
                <span>{option.label}</span>
                <small>{option.description}</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>PS5ボタン設定</h3>
        {Object.keys(DEFAULT_BUTTON_MAP).map((name) => (
          <div key={name} className="button-map-row">
            <span className="button-map-name">{name}</span>
            <ButtonBinding
              actionName={name}
              value={buttonMap[name] ?? ''}
              onChange={(value) => setButton(name, value)}
            />
          </div>
        ))}
        <div className="editor-foot">
          <span />
          <button onClick={resetButtons}>デフォルトに戻す</button>
        </div>
      </div>

      <div className="card">
        <h3>バックアップ</h3>
        <p className="hint">
          データはこの端末のブラウザ内にのみ保存されます。機種変更やバックアップにはエクスポートを使ってください。
        </p>
        <div className="field-row">
          <button className="primary" onClick={() => exportData(data)}>
            エクスポート（JSON）
          </button>
          <button onClick={() => fileRef.current?.click()}>インポート</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImportFile(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <div className="card">
        <h3>データ</h3>
        <p className="hint">
          キャラ {data.characters.length} 件 / パーティ {data.parties.length} 件 / ローテーション{' '}
          {data.combos.length} 件 / 音骸スコア {data.echoScores?.length ?? 0} 件
        </p>
        <button className="danger" onClick={reset}>
          初期データに戻す
        </button>
      </div>
    </div>
  )
}
