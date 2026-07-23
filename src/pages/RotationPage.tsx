import { Fragment, useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  FormEvent as ReactFormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import type { AppData, Character, Combo, ComboAction, ComboStep } from '../types'
import { newId } from '../types'
import { resolveButtonForAction } from '../seed'
import Avatar from '../components/Avatar'

interface Props {
  data: AppData
  setData: (d: AppData) => void
}

const LONG_PRESS_MS = 450
const SORT_CLICK_GUARD_MS = 500

let sortClickGuardUntil = 0

function guardClicksAfterSort() {
  sortClickGuardUntil = Date.now() + SORT_CLICK_GUARD_MS
}

function isSortClickGuarded(): boolean {
  return Date.now() < sortClickGuardUntil
}

function moveItemTo<T extends { id: string }>(items: T[], sourceId: string, targetId: string): T[] {
  const sourceIndex = items.findIndex((item) => item.id === sourceId)
  const targetIndex = items.findIndex((item) => item.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return items
  const next = [...items]
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, moved)
  return next
}

function useLongPressSort({
  id,
  group,
  onMove,
  onSortStart,
}: {
  id: string
  group: string
  onMove: (sourceId: string, targetId: string) => void
  onSortStart?: () => void
}) {
  const [sorting, setSorting] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPoint = useRef<{ x: number; y: number } | null>(null)
  const pointerId = useRef<number | null>(null)
  const surface = useRef<HTMLElement | null>(null)
  const sortingRef = useRef(false)
  const suppressClickRef = useRef(false)
  const targetId = useRef(id)
  const targetElement = useRef<HTMLElement | null>(null)

  const clearPressTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const clearTarget = () => {
    targetElement.current?.classList.remove('sort-drop-target')
    targetElement.current = null
  }

  const reset = () => {
    clearPressTimer()
    clearTarget()
    document.body.classList.remove('sorting-active')
    startPoint.current = null
    pointerId.current = null
    surface.current = null
    sortingRef.current = false
    targetId.current = id
    setDragOffset({ x: 0, y: 0 })
    setSorting(false)
  }

  useEffect(
    () => () => {
      clearPressTimer()
      if (suppressTimer.current) clearTimeout(suppressTimer.current)
      clearTarget()
      document.body.classList.remove('sorting-active')
    },
    [],
  )

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (!target.closest('[data-sort-handle]') || target.closest('[data-sort-ignore]')) return
    if (target.closest('[data-sort-id]') !== event.currentTarget) return

    clearPressTimer()
    startPoint.current = { x: event.clientX, y: event.clientY }
    pointerId.current = event.pointerId
    surface.current = event.currentTarget
    targetId.current = id
    timer.current = setTimeout(() => {
      sortingRef.current = true
      suppressClickRef.current = true
      setDragOffset({ x: 0, y: 0 })
      setSorting(true)
      document.body.classList.add('sorting-active')
      onSortStart?.()
      if (pointerId.current !== null && surface.current) {
        try {
          surface.current.setPointerCapture(pointerId.current)
        } catch {
          // ポインターが離れた直後なら取得できないため、そのまま終了処理に任せる
        }
      }
      navigator.vibrate?.(12)
    }, LONG_PRESS_MS)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>): boolean => {
    const start = startPoint.current
    if (!start) return false

    if (!sortingRef.current) {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) clearPressTimer()
      return false
    }

    event.preventDefault()
    event.stopPropagation()
    setDragOffset({ x: event.clientX - start.x, y: event.clientY - start.y })

    const edge = 72
    if (event.clientY < edge) window.scrollBy(0, -12)
    else if (event.clientY > window.innerHeight - edge) window.scrollBy(0, 12)

    const candidate = document
      .elementsFromPoint(event.clientX, event.clientY)
      .map((element) => element.closest<HTMLElement>('[data-sort-id]'))
      .find(
        (element, index, elements) =>
          element !== null &&
          elements.indexOf(element) === index &&
          element.dataset.sortGroup === group &&
          element.dataset.sortId !== id,
      )
    const nextTargetId = candidate?.dataset.sortId ?? id
    targetId.current = nextTargetId
    if (candidate !== targetElement.current) {
      clearTarget()
      if (candidate) {
        candidate.classList.add('sort-drop-target')
        targetElement.current = candidate
      }
    }
    return true
  }

  const finish = (event: ReactPointerEvent<HTMLElement>, commit = true): boolean => {
    if (!startPoint.current) return false
    clearPressTimer()
    const wasSorting = sortingRef.current
    const destination = targetId.current

    if (pointerId.current !== null && event.currentTarget.hasPointerCapture(pointerId.current)) {
      event.currentTarget.releasePointerCapture(pointerId.current)
    }

    if (wasSorting) {
      event.preventDefault()
      event.stopPropagation()
      guardClicksAfterSort()
      reset()
      if (commit && destination !== id) onMove(id, destination)
      if (suppressTimer.current) clearTimeout(suppressTimer.current)
      suppressTimer.current = setTimeout(() => {
        suppressClickRef.current = false
      }, 120)
    } else {
      startPoint.current = null
      pointerId.current = null
      surface.current = null
    }
    return wasSorting
  }

  const consumeClick = (): boolean => {
    if (!suppressClickRef.current) return false
    suppressClickRef.current = false
    return true
  }

  const preventContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-sort-handle]')) event.preventDefault()
  }

  return {
    sorting,
    dragOffset,
    handlePointerDown,
    handlePointerMove,
    finish,
    consumeClick,
    preventContextMenu,
  }
}

function SortableItem({
  id,
  group,
  onMove,
  onSortStart,
  className = '',
  children,
}: {
  id: string
  group: string
  onMove: (sourceId: string, targetId: string) => void
  onSortStart?: () => void
  className?: string
  children: ReactNode
}) {
  const sort = useLongPressSort({ id, group, onMove, onSortStart })
  return (
    <div
      className={`sortable-item ${sort.sorting ? 'sorting' : ''} ${className}`}
      data-sort-id={id}
      data-sort-group={group}
      style={
        sort.sorting
          ? ({
              transform: `translate3d(${sort.dragOffset.x}px, ${sort.dragOffset.y - 5}px, 0) scale(1.025)`,
            } satisfies CSSProperties)
          : undefined
      }
      onPointerDown={sort.handlePointerDown}
      onPointerMove={sort.handlePointerMove}
      onPointerUp={(event) => sort.finish(event)}
      onPointerCancel={(event) => sort.finish(event, false)}
      onContextMenu={sort.preventContextMenu}
      onClickCapture={(event) => {
        if (!sort.consumeClick() && !isSortClickGuarded()) return
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      {children}
    </div>
  )
}

// 「作成」→ キャラを選ぶ → そのままローテーション記録、まで1タブで完結するページ。
// パーティは裏方のデータとして自動作成・再利用し、画面には独立した管理項目を出さない
export default function RotationPage({ data, setData }: Props) {
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)

  const combo = data.combos.find((c) => c.id === selectedComboId)

  const updateCombo = (c: Combo) => {
    const next = { ...c, updatedAt: new Date().toISOString() }
    setData({ ...data, combos: data.combos.map((x) => (x.id === c.id ? next : x)) })
  }

  const deleteCombo = (id: string) => {
    if (!confirm('このローテーションを削除しますか？')) return
    setData({ ...data, combos: data.combos.filter((x) => x.id !== id) })
    setOpenSwipeId(null)
    setSelectedComboId(null)
  }

  const reorderCombo = (sourceId: string, targetId: string) => {
    const combos = moveItemTo(data.combos, sourceId, targetId)
    if (combos !== data.combos) setData({ ...data, combos })
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
        <button className="empty empty-action" onClick={() => setCreating(true)}>
          保存したローテーションはありません
          <span className="empty-action-label">作成する</span>
        </button>
      )}
      {data.combos.map((c) => {
        const party = data.parties.find((p) => p.id === c.partyId)
        const members = (party?.memberIds ?? [])
          .map((id) => data.characters.find((x) => x.id === id))
          .filter((character): character is Character => Boolean(character))
        return (
          <SwipeableComboCard
            key={c.id}
            combo={c}
            members={members}
            open={openSwipeId === c.id}
            onOpen={() => {
              setOpenSwipeId(null)
              setSelectedComboId(c.id)
            }}
            onSwipeOpen={() => setOpenSwipeId(c.id)}
            onSwipeClose={() => setOpenSwipeId(null)}
            onDelete={() => deleteCombo(c.id)}
            onReorder={reorderCombo}
          />
        )
      })}
    </div>
  )
}

const SWIPE_REVEAL_PX = 88

function SwipeableComboCard({
  combo,
  members,
  open,
  onOpen,
  onSwipeOpen,
  onSwipeClose,
  onDelete,
  onReorder,
}: {
  combo: Combo
  members: Character[]
  open: boolean
  onOpen: () => void
  onSwipeOpen: () => void
  onSwipeClose: () => void
  onDelete: () => void
  onReorder: (sourceId: string, targetId: string) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const startX = useRef<number | null>(null)
  const dragOffsetRef = useRef(0)
  const moved = useRef(false)
  const sort = useLongPressSort({
    id: combo.id,
    group: 'combos',
    onMove: onReorder,
    onSortStart: () => {
      startX.current = null
      dragOffsetRef.current = 0
      moved.current = true
      setDragOffset(0)
      setDragging(false)
      onSwipeClose()
    },
  })

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    sort.handlePointerDown(event)
    const initialOffset = open ? -SWIPE_REVEAL_PX : 0
    startX.current = event.clientX
    dragOffsetRef.current = initialOffset
    moved.current = false
    setDragOffset(initialOffset)
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (sort.handlePointerMove(event)) return
    if (startX.current === null) return
    const baseOffset = open ? -SWIPE_REVEAL_PX : 0
    const delta = event.clientX - startX.current
    if (Math.abs(delta) > 8) moved.current = true
    const nextOffset = Math.max(-SWIPE_REVEAL_PX, Math.min(0, baseOffset + delta))
    dragOffsetRef.current = nextOffset
    setDragOffset(nextOffset)
  }

  const finishSwipe = (event: ReactPointerEvent<HTMLButtonElement>, commitSort = true) => {
    if (sort.finish(event, commitSort)) {
      startX.current = null
      setDragging(false)
      moved.current = true
      return
    }
    if (startX.current === null) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    startX.current = null
    setDragging(false)
    if (dragOffsetRef.current <= -SWIPE_REVEAL_PX / 2) onSwipeOpen()
    else onSwipeClose()
  }

  const visualOffset = dragging ? dragOffset : open ? -SWIPE_REVEAL_PX : 0

  const cardTransform = sort.sorting
    ? `translate3d(${sort.dragOffset.x}px, ${sort.dragOffset.y - 5}px, 0) scale(1.025)`
    : `translateX(${visualOffset}px)`

  return (
    <div className={`swipe-row ${open ? 'open' : ''} ${sort.sorting ? 'sorting' : ''}`}>
      <button
        className="swipe-delete"
        data-sort-ignore
        onClick={onDelete}
        aria-label={`${combo.title}を削除`}
      >
        削除
      </button>
      <button
        className={`card row-card with-avatar swipe-card ${dragging ? 'dragging' : ''} ${sort.sorting ? 'sorting' : ''}`}
        data-sort-id={combo.id}
        data-sort-group="combos"
        data-sort-handle
        style={{ transform: cardTransform }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishSwipe}
        onPointerCancel={(event) => finishSwipe(event, false)}
        onContextMenu={sort.preventContextMenu}
        onClick={(event) => {
          if (sort.consumeClick() || isSortClickGuarded() || moved.current) {
            moved.current = false
            event.preventDefault()
            return
          }
          if (open) onSwipeClose()
          else onOpen()
        }}
        aria-label={combo.title}
      >
        <span className="avatar-stack">
          {members.map((member) => (
            <Avatar key={member.id} character={member} size={40} />
          ))}
        </span>
        <span className="row-card-text">
          <span className="card-title">{combo.title}</span>
          <span className="card-sub">
            {members.map((member) => member.name).join(' / ')} ・ {combo.steps.length}行
          </span>
        </span>
        <span className="drag-grip" data-sort-handle aria-hidden="true">
          ⠿
        </span>
      </button>
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
  const [element, setElement] = useState('')
  const [weapon, setWeapon] = useState('')

  const elements = [
    ...new Set(
      characters.flatMap((character) => (character.element ? [character.element] : [])),
    ),
  ]
  const weapons = [
    ...new Set(characters.flatMap((character) => (character.weapon ? [character.weapon] : []))),
  ]
  const filteredCharacters = characters.filter(
    (character) =>
      (!query || character.name.includes(query.trim())) &&
      (!element || character.element === element) &&
      (!weapon || character.weapon === weapon),
  )

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
        placeholder="🔍 キャラ名で絞り込み"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="picker-filters">
        <label className="picker-filter">
          <span>属性</span>
          <select
            aria-label="属性"
            value={element}
            onChange={(event) => setElement(event.target.value)}
          >
            <option value="">すべて</option>
            {elements.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="picker-filter">
          <span>武器種</span>
          <select
            aria-label="武器種"
            value={weapon}
            onChange={(event) => setWeapon(event.target.value)}
          >
            <option value="">すべて</option>
            {weapons.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="chip-grid">
        {filteredCharacters.length === 0 && (
          <p className="filter-empty">条件に合うキャラがいません</p>
        )}
        {filteredCharacters.map((c) => {
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

  const reorderStep = (sourceId: string, targetId: string) => {
    const steps = moveItemTo(combo.steps, sourceId, targetId)
    if (steps !== combo.steps) onChange({ ...combo, steps })
  }

  const appendAction = (step: ComboStep, actionId: string) => {
    setStep({ ...step, actions: [...step.actions, { id: newId(), actionId }] })
  }

  const chooseAction = (step: ComboStep, actionId: string) => {
    if (!activeActionId) {
      appendAction(step, actionId)
      return
    }
    setStep({
      ...step,
      actions: step.actions.map((action) =>
        action.id === activeActionId ? { ...action, actionId } : action,
      ),
    })
    setActiveActionId(null)
  }

  const reorderAction = (step: ComboStep, sourceId: string, targetId: string) => {
    const actions = moveItemTo(step.actions, sourceId, targetId)
    if (actions !== step.actions) setStep({ ...step, actions })
  }

  const addCustomAction = (ch: Character) => {
    const name = prompt(`${ch.name}の技名`)?.trim()
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
        {(combo.referenceUrls?.length ?? 0) > 0 && (
          <ReferenceLinks urls={combo.referenceUrls ?? []} />
        )}
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
          <SortableItem
            key={s.id}
            id={s.id}
            group={`steps-${combo.id}`}
            onMove={reorderStep}
            onSortStart={() => {
              setActiveStepId(null)
              setActiveActionId(null)
            }}
            className="step-sortable"
          >
            <div className={`card step-card ${active ? 'active' : ''}`}>
              <div className="step-head">
                <button
                  className={`step-char ${slotClass(s.characterId)}`}
                  data-sort-handle
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
                      {active
                        ? '技パレットを表示中'
                        : `${s.actions.length}アクション`}
                    </span>
                  </span>
                </button>
                <span className="drag-grip step-drag-grip" data-sort-handle aria-hidden="true">
                  ⠿
                </span>
                <span className="step-tools" data-sort-ignore>
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
                {s.actions.length === 0 && <span className="hint">技なし</span>}
                {s.actions.map((a, i) => (
                  <SortableItem
                    key={a.id}
                    id={a.id}
                    group={`actions-${s.id}`}
                    onMove={(sourceId, targetId) => reorderAction(s, sourceId, targetId)}
                    onSortStart={() => setActiveActionId(null)}
                    className="action-sortable"
                  >
                    {i > 0 && <span className="view-sep">→</span>}
                    <button
                      className={`action-chip ${activeActionId === a.id ? 'editing' : ''}`}
                      data-sort-handle
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveStepId(s.id)
                        setActiveActionId(activeActionId === a.id ? null : a.id)
                      }}
                    >
                      <ActionText action={a} character={ch} buttonMap={buttonMap} />
                    </button>
                  </SortableItem>
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

              {active && ch && (
                <div className="palette">
                  <div className="palette-heading">
                    <span>技パレット</span>
                    <span className="live-state">{activeActionId ? '差し替え' : '追加'}</span>
                  </div>
                  {organizing && (
                    <div className="hint organize-hint">技名の編集・削除</div>
                  )}
                  {ch.actions.map((a) =>
                    organizing ? (
                      <button
                        key={a.id}
                        className="chip organize"
                        onClick={() => {
                          const v = prompt('技名', a.name)
                          if (v === null) return
                          if (v.trim() === '') onDeleteCharacterAction(ch.id, a.id)
                          else onRenameCharacterAction(ch.id, a.id, v.trim())
                        }}
                      >
                        ✎ {a.name}
                      </button>
                    ) : (
                      <button key={a.id} className="chip" onClick={() => chooseAction(s, a.id)}>
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
                      onClick={() => {
                        setOrganizing(!organizing)
                        setActiveActionId(null)
                      }}
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
          </SortableItem>
        )
      })}

      <div className="card add-step-card">
        <div className="hint">行を追加</div>
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

      <ReferenceLinksEditor
        urls={combo.referenceUrls ?? []}
        onChange={(referenceUrls) =>
          onChange({
            ...combo,
            referenceUrls: referenceUrls.length > 0 ? referenceUrls : undefined,
          })
        }
      />
    </div>
  )
}

function normalizeReferenceUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.href
  } catch {
    return null
  }
}

function referenceSource(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    if (hostname === 'youtu.be' || hostname.endsWith('youtube.com')) return 'YouTube'
    if (hostname === 'x.com' || hostname.endsWith('twitter.com')) return 'X / Twitter'
    return hostname
  } catch {
    return '参考リンク'
  }
}

function ReferenceLinks({ urls }: { urls: string[] }) {
  return (
    <section className="card reference-card reference-card-view">
      <div className="reference-heading">
        <span className="page-kicker">参考動画</span>
        <span className="reference-count">{urls.length}件</span>
      </div>
      <div className="reference-list">
        {urls.map((url) => (
          <a
            key={url}
            className="reference-link"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="reference-source">{referenceSource(url)}</span>
            <span className="reference-url">{url}</span>
            <span className="reference-open" aria-hidden="true">
              ↗
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}

function ReferenceLinksEditor({
  urls,
  onChange,
}: {
  urls: string[]
  onChange: (urls: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  const add = (event: ReactFormEvent) => {
    event.preventDefault()
    const normalized = normalizeReferenceUrl(draft)
    if (!normalized) {
      alert('YouTubeやXなどの有効なURLを入力してください')
      return
    }
    if (urls.includes(normalized)) {
      alert('同じURLがすでに登録されています')
      return
    }
    if (urls.length >= 20) {
      alert('参考動画は20件まで登録できます')
      return
    }
    onChange([...urls, normalized])
    setDraft('')
  }

  return (
    <section className="card reference-card">
      <div className="reference-heading">
        <div>
          <span className="page-kicker">参考動画</span>
          <p className="reference-description">YouTubeやXなど、参考にした動画のURL</p>
        </div>
        {urls.length > 0 && <span className="reference-count">{urls.length}件</span>}
      </div>

      {urls.length === 0 ? (
        <p className="reference-empty">参考動画なし</p>
      ) : (
        <div className="reference-list">
          {urls.map((url) => (
            <div key={url} className="reference-edit-row">
              <a
                className="reference-link"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="reference-source">{referenceSource(url)}</span>
                <span className="reference-url">{url}</span>
                <span className="reference-open" aria-hidden="true">
                  ↗
                </span>
              </a>
              <button
                className="icon-btn reference-remove"
                onClick={() => onChange(urls.filter((item) => item !== url))}
                aria-label={`${referenceSource(url)}の参考URLを削除`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <form className="reference-add" onSubmit={add}>
        <input
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          maxLength={2048}
          placeholder="https://youtube.com/..."
          aria-label="参考動画のURL"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="primary" type="submit" disabled={!draft.trim()}>
          追加
        </button>
      </form>
    </section>
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
          placeholder="この技のポイント"
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
