import { Fragment, useState } from 'react'
import type { AppData, Character, Combo, ComboAction, ComboStep } from '../types'
import { newId } from '../types'
import { resolveButtonForAction } from '../seed'
import Avatar from '../components/Avatar'

interface Props {
  data: AppData
  setData: (d: AppData) => void
}

// 「作成」→ キャラを選ぶ → そのままローテーション記録、まで1タブで完結するページ。
// パーティは裏方のデータとして自動作成・再利用し、画面には独立した管理項目を出さない
export default function RotationPage({ data, setData }: Props) {
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const combo = data.combos.find((c) => c.id === selectedComboId)

  const updateCombo = (c: Combo) => {
    const next = { ...c, updatedAt: new Date().toISOString() }
    setData({ ...data, combos: data.combos.map((x) => (x.id === c.id ? next : x)) })
  }

  const deleteCombo = (id: string) => {
    if (!confirm('このローテーションを削除しますか？')) return
    setData({ ...data, combos: data.combos.filter((x) => x.id !== id) })
    setSelectedComboId(null)
  }

  // キャラ選択からローテーション作成まで（同じ編成のパーティがあれば再利用）
  const createComboWithMembers = (memberIds: string[]) => {
    const sorted = [...memberIds].sort().join(',')
    let party = data.parties.find((p) => [...p.memberIds].sort().join(',') === sorted)
    const parties = [...data.parties]
    if (!party) {
      const names = memberIds
        .map((id) => data.characters.find((c) => c.id === id)?.name ?? '?')
        .join('・')
      party = { id: newId(), name: names, memberIds }
      parties.push(party)
    }
    const c: Combo = {
      id: newId(),
      partyId: party.id,
      title: '新しいローテーション',
      steps: [],
      updatedAt: new Date().toISOString(),
    }
    setData({ ...data, parties, combos: [...data.combos, c] })
    setCreating(false)
    setSelectedComboId(c.id)
  }

  // キャラに固有技を追加（コンボ編集の技パレットから使う）
  const addCharacterAction = (characterId: string, name: string) => {
    setData({
      ...data,
      characters: data.characters.map((c) =>
        c.id === characterId
          ? { ...c, actions: [...c.actions, { id: newId(), name, kind: 'special' as const }] }
          : c,
      ),
    })
  }

  const renameCharacterAction = (characterId: string, actionId: string, name: string) => {
    setData({
      ...data,
      characters: data.characters.map((c) =>
        c.id === characterId
          ? { ...c, actions: c.actions.map((a) => (a.id === actionId ? { ...a, name } : a)) }
          : c,
      ),
    })
  }

  const deleteCharacterAction = (characterId: string, actionId: string) => {
    const used = data.combos.some((c) =>
      c.steps.some(
        (s) => s.characterId === characterId && s.actions.some((a) => a.actionId === actionId),
      ),
    )
    if (used) {
      alert('この技はローテーションで使用中のため削除できません')
      return
    }
    setData({
      ...data,
      characters: data.characters.map((c) =>
        c.id === characterId
          ? { ...c, actions: c.actions.filter((a) => a.id !== actionId) }
          : c,
      ),
    })
  }

  if (combo) {
    return (
      <ComboEditor
        data={data}
        combo={combo}
        onChange={updateCombo}
        onBack={() => setSelectedComboId(null)}
        onDelete={() => deleteCombo(combo.id)}
        onAddCharacterAction={addCharacterAction}
        onRenameCharacterAction={renameCharacterAction}
        onDeleteCharacterAction={deleteCharacterAction}
      />
    )
  }

  if (creating) {
    return (
      <MemberPicker
        characters={data.characters}
        onCancel={() => setCreating(false)}
        onSubmit={createComboWithMembers}
      />
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-heading">
          <span className="page-kicker">保存済みの記録</span>
          <h1>ローテーション</h1>
        </div>
        <button className="primary" onClick={() => setCreating(true)}>
          ＋ 作成
        </button>
      </header>

      {data.combos.length === 0 && (
        <p className="empty">
          「＋ 作成」からキャラを選んで、ローテーションの記録を始めましょう
        </p>
      )}
      {data.combos.map((c) => {
        const party = data.parties.find((p) => p.id === c.partyId)
        return (
          <button
            key={c.id}
            className="card row-card with-avatar"
            onClick={() => setSelectedComboId(c.id)}
          >
            <span className="avatar-stack">
              {(party?.memberIds ?? []).map((id) => (
                <Avatar key={id} character={data.characters.find((x) => x.id === id)} size={40} />
              ))}
            </span>
            <span className="row-card-text">
              <span className="card-title">{c.title}</span>
              <span className="card-sub">
                {(party?.memberIds ?? [])
                  .map((id) => data.characters.find((x) => x.id === id)?.name ?? '?')
                  .join(' / ')}{' '}
                ・ {c.steps.length}行
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------- キャラ選択（作成フローの最初のステップ） ----------------

function MemberPicker({
  characters,
  onCancel,
  onSubmit,
}: {
  characters: Character[]
  onCancel: () => void
  onSubmit: (memberIds: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id))
    } else if (selected.length < 3) {
      setSelected([...selected, id])
    } else {
      alert('パーティは3人までです')
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <button onClick={onCancel}>← 戻る</button>
        <button
          className="primary"
          disabled={selected.length === 0}
          onClick={() => onSubmit(selected)}
        >
          この編成で作成 →
        </button>
      </header>
      <span className="page-kicker">メンバー選択</span>
      <h1 className="picker-title">キャラを選ぶ（{selected.length}/3）</h1>
      <div className="member-preview">
        {[0, 1, 2].map((i) => {
          const c = characters.find((x) => x.id === selected[i])
          return (
            <span key={i} className="member-preview-item">
              {c ? (
                <>
                  <Avatar character={c} size={52} />
                  <span>{c.name}</span>
                </>
              ) : (
                <>
                  <span className="avatar avatar-fallback empty-slot">{i + 1}</span>
                  <span>未選択</span>
                </>
              )}
            </span>
          )
        })}
      </div>
      <input
        className="search-input"
        placeholder="🔍 キャラ名・属性・武器で絞り込み"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="chip-grid">
        {characters
          .filter(
            (c) =>
              !query ||
              c.name.includes(query) ||
              (c.element ?? '').includes(query) ||
              (c.weapon ?? '').includes(query),
          )
          .map((c) => {
            const idx = selected.indexOf(c.id)
            return (
              <button
                key={c.id}
                className={`chip with-avatar ${idx >= 0 ? 'selected' : ''}`}
                onClick={() => toggle(c.id)}
              >
                <Avatar character={c} size={26} />
                {idx >= 0 ? `${idx + 1}. ` : ''}
                {c.name}
              </button>
            )
          })}
      </div>
    </div>
  )
}

// ---------------- コンボ編集・閲覧 ----------------

function ComboEditor({
  data,
  combo,
  onChange,
  onBack,
  onDelete,
  onAddCharacterAction,
  onRenameCharacterAction,
  onDeleteCharacterAction,
}: {
  data: AppData
  combo: Combo
  onChange: (c: Combo) => void
  onBack: () => void
  onDelete: () => void
  onAddCharacterAction: (characterId: string, name: string) => void
  onRenameCharacterAction: (characterId: string, actionId: string, name: string) => void
  onDeleteCharacterAction: (characterId: string, actionId: string) => void
}) {
  const [mode, setMode] = useState<'edit' | 'view' | 'command'>('edit')
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const [organizing, setOrganizing] = useState(false)

  const party = data.parties.find((p) => p.id === combo.partyId)
  const members = (party?.memberIds ?? [])
    .map((id) => data.characters.find((c) => c.id === id))
    .filter((c): c is Character => !!c)

  const charOf = (id: string) => data.characters.find((c) => c.id === id)
  const slotClass = (charId: string) =>
    `slot-${Math.max(0, party?.memberIds.indexOf(charId) ?? 0) % 3}`
  const buttonMap = data.buttonMap ?? {}

  const setStep = (s: ComboStep) => {
    onChange({ ...combo, steps: combo.steps.map((x) => (x.id === s.id ? s : x)) })
  }

  const addStep = (characterId: string) => {
    const s: ComboStep = { id: newId(), characterId, actions: [] }
    onChange({ ...combo, steps: [...combo.steps, s] })
    setActiveStepId(s.id)
    setActiveActionId(null)
  }

  const removeStep = (id: string) => {
    onChange({ ...combo, steps: combo.steps.filter((x) => x.id !== id) })
    if (activeStepId === id) setActiveStepId(null)
  }

  const moveStep = (id: string, dir: -1 | 1) => {
    const i = combo.steps.findIndex((x) => x.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= combo.steps.length) return
    const steps = [...combo.steps]
    ;[steps[i], steps[j]] = [steps[j], steps[i]]
    onChange({ ...combo, steps })
  }

  const appendAction = (step: ComboStep, actionId: string) => {
    setStep({ ...step, actions: [...step.actions, { id: newId(), actionId }] })
  }

  const addCustomAction = (ch: Character) => {
    const name = prompt(`${ch.name} の技の名前（例: ハサミ1、チェンソー）`)?.trim()
    if (name) onAddCharacterAction(ch.id, name)
  }

  // 技のボタン表記を解決する（優先順: キャラ技の設定 > 共通対応表）
  const buttonOf = (a: ComboAction, ch?: Character) => {
    const def = ch?.actions.find((x) => x.id === a.actionId)
    return def?.button ?? (def ? resolveButtonForAction(def.name, buttonMap) : undefined)
  }

  // ---- 閲覧モード：手書きノート風の大きな表示 / コマンドモード（ボタンのみ） ----
  if (mode !== 'edit') {
    const command = mode === 'command'
    return (
      <div className="page">
        <header className="page-header">
          <button onClick={() => setMode('edit')}>✏️ 編集</button>
          <button
            className={command ? 'primary' : ''}
            onClick={() => setMode(command ? 'view' : 'command')}
          >
            {command ? '技名表示' : '🎮 コマンド'}
          </button>
          <button onClick={onBack}>一覧へ</button>
        </header>
        <h1 className="view-title">{combo.title}</h1>
        <div className="view-steps">
          {combo.steps.map((s) => {
            const ch = charOf(s.characterId)
            // ポイント: 行のポイント + 技ごとのポイント
            const points = [
              ...(s.note ? [s.note] : []),
              ...s.actions
                .filter((a) => a.note)
                .map((a) => {
                  const name = ch?.actions.find((x) => x.id === a.actionId)?.name ?? '?'
                  return `${name}: ${a.note}`
                }),
            ]
            return (
              <div key={s.id} className="view-step">
                <div className="view-line">
                  <span className={`view-char ${slotClass(s.characterId)}`}>
                    <Avatar character={ch} size={32} />
                    {ch?.name}
                  </span>
                  {command ? (
                    <span className="view-actions command-seq">
                      {s.actions.map((a, i) => (
                        <span key={a.id} className="cmd-pair">
                          {i > 0 && <span className="cmd-arrow">→</span>}
                          <span className="cmd-btn">
                            {buttonOf(a, ch) ??
                              ch?.actions.find((x) => x.id === a.actionId)?.name ??
                              '?'}
                          </span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="view-actions">
                      {s.actions.map((a, i) => (
                        <Fragment key={a.id}>
                          {i > 0 && <span className="view-sep"> / </span>}
                          <ActionText action={a} character={ch} buttonMap={buttonMap} />
                        </Fragment>
                      ))}
                    </span>
                  )}
                </div>
                {!command && points.length > 0 && (
                  <div className="view-points">
                    {points.map((p, i) => (
                      <div key={i} className="view-note">
                        ※ {p}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ---- 編集モード ----
  return (
    <div className="page">
      <header className="page-header">
        <button onClick={onBack}>← 一覧</button>
        <button className="primary" onClick={() => setMode('view')}>
          閲覧モード
        </button>
      </header>
      <section className="editor-intro">
        <span className="page-kicker">ローテーション編集</span>
        <input
          className="title-input wide"
          aria-label="ローテーション名"
          value={combo.title}
          onChange={(e) => onChange({ ...combo, title: e.target.value })}
        />
      </section>

      {combo.steps.map((s, si) => {
        const ch = charOf(s.characterId)
        const active = activeStepId === s.id
        return (
          <div key={s.id} className={`card step-card ${active ? 'active' : ''}`}>
            <div className="step-head">
              <button
                className={`step-char ${slotClass(s.characterId)}`}
                onClick={() => {
                  setActiveStepId(active ? null : s.id)
                  setActiveActionId(null)
                }}
                aria-expanded={active}
              >
                <Avatar character={ch} size={34} />
                <span className="step-char-copy">
                  <span className="step-char-name">{ch?.name}</span>
                  <span className="step-meta">
                    ステップ {si + 1}・
                    {active ? '技パレットを表示中' : `${s.actions.length}アクション`}
                  </span>
                </span>
              </button>
              <span className="step-tools">
                <button
                  className="icon-btn"
                  onClick={() => moveStep(s.id, -1)}
                  disabled={si === 0}
                  aria-label="上へ移動"
                >
                  ↑
                </button>
                <button
                  className="icon-btn"
                  onClick={() => moveStep(s.id, 1)}
                  disabled={si === combo.steps.length - 1}
                  aria-label="下へ移動"
                >
                  ↓
                </button>
                <button className="icon-btn" onClick={() => removeStep(s.id)} aria-label="削除">
                  ×
                </button>
              </span>
            </div>

            <div className="step-actions">
              {s.actions.length === 0 && <span className="hint">技をタップして追加 →</span>}
              {s.actions.map((a, i) => (
                <Fragment key={a.id}>
                  {i > 0 && <span className="view-sep">→</span>}
                  <button
                    className={`action-chip ${activeActionId === a.id ? 'editing' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveStepId(s.id)
                      setActiveActionId(activeActionId === a.id ? null : a.id)
                    }}
                  >
                    <ActionText action={a} character={ch} buttonMap={buttonMap} />
                  </button>
                </Fragment>
              ))}
            </div>

            {active && activeActionId && (
              <ActionDetailEditor
                step={s}
                actionId={activeActionId}
                onChange={setStep}
                onClose={() => setActiveActionId(null)}
              />
            )}

            {active && !activeActionId && ch && (
              <div className="palette">
                <div className="palette-heading">
                  <span>技をタップして追加</span>
                  <span className="live-state">編集中</span>
                </div>
                {organizing && (
                  <div className="hint organize-hint">
                    技をタップして名前を変更（空にすると削除）
                  </div>
                )}
                {ch.actions.map((a) =>
                  organizing ? (
                    <button
                      key={a.id}
                      className="chip organize"
                      onClick={() => {
                        const v = prompt('技名を編集（空にすると削除）', a.name)
                        if (v === null) return
                        if (v.trim() === '') onDeleteCharacterAction(ch.id, a.id)
                        else onRenameCharacterAction(ch.id, a.id, v.trim())
                      }}
                    >
                      ✎ {a.name}
                    </button>
                  ) : (
                    <button key={a.id} className="chip" onClick={() => appendAction(s, a.id)}>
                      {a.name}
                      {(a.button ?? resolveButtonForAction(a.name, buttonMap)) && (
                        <span className="btn-label">
                          {a.button ?? resolveButtonForAction(a.name, buttonMap)}
                        </span>
                      )}
                    </button>
                  ),
                )}
                <div className="palette-utilities">
                  <button className="chip add-chip" onClick={() => addCustomAction(ch)}>
                    ＋ 技を追加
                  </button>
                  <button
                    className={`chip add-chip ${organizing ? 'selected' : ''}`}
                    onClick={() => setOrganizing(!organizing)}
                  >
                    {organizing ? '完了' : '技の整理'}
                  </button>
                </div>
              </div>
            )}

            {active && (
              <input
                className="memo-input"
                placeholder="この行のポイント（※〜）"
                value={s.note ?? ''}
                onChange={(e) => setStep({ ...s, note: e.target.value })}
              />
            )}
          </div>
        )
      })}

      <div className="card add-step-card">
        <div className="hint">行を追加：キャラを選択</div>
        <div className="chip-grid">
          {members.map((c) => (
            <button
              key={c.id}
              className={`chip big with-avatar ${slotClass(c.id)}`}
              onClick={() => addStep(c.id)}
            >
              <Avatar character={c} size={34} />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="editor-foot">
        <span />
        <button className="danger" onClick={onDelete}>
          ローテーションを削除
        </button>
      </div>
    </div>
  )
}

function ActionText({
  action,
  character,
  buttonMap,
}: {
  action: ComboAction
  character?: Character
  buttonMap: Record<string, string>
}) {
  const def = character?.actions.find((x) => x.id === action.actionId)
  // 優先順: キャラ技の設定 > 共通ボタン対応表
  const button = def?.button ?? (def ? resolveButtonForAction(def.name, buttonMap) : undefined)
  return (
    <span>
      {def?.name ?? '?'}
      {button && <span className="btn-label">[{button}]</span>}
      {action.note && <span className="note-mark">※</span>}
    </span>
  )
}

function ActionDetailEditor({
  step,
  actionId,
  onChange,
  onClose,
}: {
  step: ComboStep
  actionId: string
  onChange: (s: ComboStep) => void
  onClose: () => void
}) {
  const action = step.actions.find((a) => a.id === actionId)
  if (!action) return null

  const set = (a: ComboAction) => {
    onChange({ ...step, actions: step.actions.map((x) => (x.id === a.id ? a : x)) })
  }
  const remove = () => {
    onChange({ ...step, actions: step.actions.filter((x) => x.id !== actionId) })
    onClose()
  }

  return (
    <div className="detail-editor">
      <div className="detail-row">
        <input
          placeholder="この技のポイント（例: 自然発生、敵に当てる）"
          value={action.note ?? ''}
          onChange={(e) => set({ ...action, note: e.target.value })}
        />
      </div>
      <div className="detail-row">
        <button className="danger" onClick={remove}>
          この技を削除
        </button>
        <button className="primary" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  )
}
