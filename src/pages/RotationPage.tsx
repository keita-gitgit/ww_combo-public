import { Fragment, useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  FormEvent as ReactFormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import type {
  AppData,
  Character,
  Combo,
  ComboAction,
  ComboCardTone,
  ComboStep,
} from '../types'
import { newId } from '../types'
import { resolveButtonForAction } from '../seed'
import Avatar from '../components/Avatar'

interface Props {
  data: AppData
  setData: (d: AppData) => void
}

const LONG_PRESS_MS = 450
const SORT_CLICK_GUARD_MS = 500
const DISPLAY_SCALE_MIN = 0.6
const DISPLAY_SCALE_MAX = 1.2
const DISPLAY_SCALE_STEP = 0.1
const CARD_TONE_OPTIONS: Array<{ value: '' | ComboCardTone; label: string }> = [
  { value: '', label: '標準' },
  { value: '焦熱', label: '焦熱・赤' },
  { value: '凝縮', label: '凝縮・青' },
  { value: '電導', label: '電導・紫' },
  { value: '気動', label: '気動・緑' },
  { value: '回折', label: '回折・金' },
  { value: '消滅', label: '消滅・赤紫' },
]

let sortClickGuardUntil = 0

function guardClicksAfterSort() {
  sortClickGuardUntil = Date.now() + SORT_CLICK_GUARD_MS
}

function isSortClickGuarded(): boolean {
  return Date.now() < sortClickGuardUntil
}

function actionNoteNumber(actions: ComboAction[], actionId: string): number | undefined {
  let number = 0
  for (const action of actions) {
    if (!action.note) continue
    number += 1
    if (action.id === actionId) return number
  }
  return undefined
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

function EditIcon() {
  return (
    <svg className="label-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 14.8V17h2.2L16.7 6.5 13.5 3.3 3 13.8Z" />
      <path d="m11.9 4.9 3.2 3.2" />
    </svg>
  )
}

function CommandIcon() {
  return (
    <svg className="label-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6.4 7.2h7.2a4.4 4.4 0 0 1 4.1 5.9l-.8 2.1a1.8 1.8 0 0 1-3 .6l-1.4-1.5h-5l-1.4 1.5a1.8 1.8 0 0 1-3-.6l-.8-2.1a4.4 4.4 0 0 1 4.1-5.9Z" />
      <path d="M6.2 9.8v3M4.7 11.3h3M13.6 10.5h.1M15.2 12h.1" />
    </svg>
  )
}

function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg className="star-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path
        className={filled ? 'filled' : ''}
        d="m10 2.7 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.3-4.5 2.3.9-5-3.6-3.5 5-.7Z"
      />
    </svg>
  )
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
  const [openSwipe, setOpenSwipe] = useState<{
    id: string
    side: 'delete' | 'tone'
  } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  const combo = data.combos.find((c) => c.id === selectedComboId)

  const updateCombo = (c: Combo) => {
    const next = { ...c, updatedAt: new Date().toISOString() }
    setData({ ...data, combos: data.combos.map((x) => (x.id === c.id ? next : x)) })
  }

  const deleteCombo = (id: string) => {
    if (!confirm('このローテーションを削除しますか？')) return
    setData({ ...data, combos: data.combos.filter((x) => x.id !== id) })
    setOpenSwipe(null)
    setSelectedComboId(null)
  }

  const reorderCombo = (sourceId: string, targetId: string) => {
    const combos = moveItemTo(data.combos, sourceId, targetId)
    if (combos !== data.combos) setData({ ...data, combos })
  }

  const partyForMembers = (memberIds: string[]) => {
    let party = data.parties.find((p) => p.memberIds.join(',') === memberIds.join(','))
    const parties = [...data.parties]
    if (!party) {
      const names = memberIds
        .map((id) => data.characters.find((c) => c.id === id)?.name ?? '?')
        .join('・')
      party = { id: newId(), name: names, memberIds }
      parties.push(party)
    }
    return { party, parties }
  }

  // キャラ選択からローテーション作成まで（同じ並びの編成があれば再利用）
  const createComboWithMembers = (memberIds: string[]) => {
    const { party, parties } = partyForMembers(memberIds)
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

  const changeComboMembers = (comboId: string, memberIds: string[]) => {
    const target = data.combos.find((item) => item.id === comboId)
    if (!target) return
    const currentParty = data.parties.find((party) => party.id === target.partyId)
    const removedIds = (currentParty?.memberIds ?? []).filter((id) => !memberIds.includes(id))
    const removedInUse = removedIds.some((id) =>
      target.steps.some((step) => step.characterId === id),
    )
    if (
      removedInUse &&
      !confirm('編成から外すキャラの行はローテーション内に残ります。このまま変更しますか？')
    ) {
      return
    }
    const { party, parties } = partyForMembers(memberIds)
    setData({
      ...data,
      parties,
      combos: data.combos.map((item) =>
        item.id === comboId
          ? { ...item, partyId: party.id, updatedAt: new Date().toISOString() }
          : item,
      ),
    })
  }

  const duplicateCombo = (id: string) => {
    const source = data.combos.find((item) => item.id === id)
    if (!source) return
    const duplicate: Combo = {
      ...source,
      id: newId(),
      title: `${source.title}のコピー`,
      favorite: false,
      referenceUrls: source.referenceUrls ? [...source.referenceUrls] : undefined,
      steps: source.steps.map((step) => ({
        ...step,
        id: newId(),
        actions: step.actions.map((action) => ({ ...action, id: newId() })),
      })),
      updatedAt: new Date().toISOString(),
    }
    const sourceIndex = data.combos.findIndex((item) => item.id === id)
    const combos = [...data.combos]
    combos.splice(sourceIndex + 1, 0, duplicate)
    setData({ ...data, combos })
    setSelectedComboId(duplicate.id)
  }

  const toggleFavorite = (id: string) => {
    setData({
      ...data,
      combos: data.combos.map((item) =>
        item.id === id ? { ...item, favorite: !item.favorite } : item,
      ),
    })
  }

  const changeComboTone = (id: string, cardTone?: ComboCardTone) => {
    setData({
      ...data,
      combos: data.combos.map((item) =>
        item.id === id
          ? { ...item, cardTone, updatedAt: new Date().toISOString() }
          : item,
      ),
    })
    setOpenSwipe(null)
  }

  const reorderCharacterAction = (
    characterId: string,
    sourceId: string,
    targetId: string,
  ) => {
    setData({
      ...data,
      characters: data.characters.map((character) => {
        if (character.id !== characterId) return character
        const actions = moveItemTo(character.actions, sourceId, targetId)
        return actions === character.actions ? character : { ...character, actions }
      }),
    })
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
        onDuplicate={() => duplicateCombo(combo.id)}
        onChangeMembers={(memberIds) => changeComboMembers(combo.id, memberIds)}
        onAddCharacterAction={addCharacterAction}
        onRenameCharacterAction={renameCharacterAction}
        onDeleteCharacterAction={deleteCharacterAction}
        onReorderCharacterAction={reorderCharacterAction}
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

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('ja')
  const visibleCombos = data.combos.filter((item) => {
    if (favoritesOnly && !item.favorite) return false
    if (!normalizedQuery) return true
    const party = data.parties.find((candidate) => candidate.id === item.partyId)
    const memberNames = (party?.memberIds ?? [])
      .map((id) => data.characters.find((character) => character.id === id)?.name ?? '')
      .join(' ')
    return `${item.title} ${memberNames}`.toLocaleLowerCase('ja').includes(normalizedQuery)
  })

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
      {data.combos.length > 0 && (
        <div className="rotation-list-tools">
          <input
            className="rotation-search"
            type="search"
            placeholder="名前・キャラ名で検索"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <button
            className={`favorite-filter ${favoritesOnly ? 'active' : ''}`}
            onClick={() => setFavoritesOnly((current) => !current)}
            aria-pressed={favoritesOnly}
          >
            <StarIcon filled={favoritesOnly} />
            お気に入り
          </button>
        </div>
      )}
      {data.combos.length > 0 && visibleCombos.length === 0 && (
        <div className="empty filter-result-empty">条件に合うローテーションはありません</div>
      )}
      {visibleCombos.map((c) => {
        const party = data.parties.find((p) => p.id === c.partyId)
        const members = (party?.memberIds ?? [])
          .map((id) => data.characters.find((x) => x.id === id))
          .filter((character): character is Character => Boolean(character))
        return (
          <SwipeableComboCard
            key={c.id}
            combo={c}
            members={members}
            openSide={openSwipe?.id === c.id ? openSwipe.side : null}
            onOpen={() => {
              setOpenSwipe(null)
              setSelectedComboId(c.id)
            }}
            onSwipeOpen={(side) => setOpenSwipe({ id: c.id, side })}
            onSwipeClose={() => setOpenSwipe(null)}
            onDelete={() => deleteCombo(c.id)}
            onChangeTone={(cardTone) => changeComboTone(c.id, cardTone)}
            onToggleFavorite={() => toggleFavorite(c.id)}
            onReorder={reorderCombo}
          />
        )
      })}
    </div>
  )
}

const SWIPE_DELETE_REVEAL_PX = 88
const SWIPE_TONE_REVEAL_PX = 184

function SwipeableComboCard({
  combo,
  members,
  openSide,
  onOpen,
  onSwipeOpen,
  onSwipeClose,
  onDelete,
  onChangeTone,
  onToggleFavorite,
  onReorder,
}: {
  combo: Combo
  members: Character[]
  openSide: 'delete' | 'tone' | null
  onOpen: () => void
  onSwipeOpen: (side: 'delete' | 'tone') => void
  onSwipeClose: () => void
  onDelete: () => void
  onChangeTone: (cardTone?: ComboCardTone) => void
  onToggleFavorite: () => void
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

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('[data-card-action]')) return
    sort.handlePointerDown(event)
    const initialOffset =
      openSide === 'delete'
        ? -SWIPE_DELETE_REVEAL_PX
        : openSide === 'tone'
          ? SWIPE_TONE_REVEAL_PX
          : 0
    startX.current = event.clientX
    dragOffsetRef.current = initialOffset
    moved.current = false
    setDragOffset(initialOffset)
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (sort.handlePointerMove(event)) return
    if (startX.current === null) return
    const baseOffset =
      openSide === 'delete'
        ? -SWIPE_DELETE_REVEAL_PX
        : openSide === 'tone'
          ? SWIPE_TONE_REVEAL_PX
          : 0
    const delta = event.clientX - startX.current
    if (Math.abs(delta) > 8) moved.current = true
    const nextOffset = Math.max(
      -SWIPE_DELETE_REVEAL_PX,
      Math.min(SWIPE_TONE_REVEAL_PX, baseOffset + delta),
    )
    dragOffsetRef.current = nextOffset
    setDragOffset(nextOffset)
  }

  const finishSwipe = (event: ReactPointerEvent<HTMLDivElement>, commitSort = true) => {
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
    if (dragOffsetRef.current <= -SWIPE_DELETE_REVEAL_PX / 2) {
      onSwipeOpen('delete')
    } else if (dragOffsetRef.current >= SWIPE_TONE_REVEAL_PX / 2) {
      onSwipeOpen('tone')
    } else {
      onSwipeClose()
    }
  }

  const visualOffset = dragging
    ? dragOffset
    : openSide === 'delete'
      ? -SWIPE_DELETE_REVEAL_PX
      : openSide === 'tone'
        ? SWIPE_TONE_REVEAL_PX
        : 0

  const cardTransform = sort.sorting
    ? `translate3d(${sort.dragOffset.x}px, ${sort.dragOffset.y - 5}px, 0) scale(1.025)`
    : `translateX(${visualOffset}px)`
  const showTonePanel = openSide === 'tone' || (dragging && dragOffset > 0)

  return (
    <div
      className={`swipe-row ${openSide ? `open-${openSide}` : ''} ${sort.sorting ? 'sorting' : ''}`}
    >
      {showTonePanel && (
        <div className="swipe-tone-panel" data-sort-ignore aria-label="カード色">
          {CARD_TONE_OPTIONS.map((option) => (
            <button
              key={option.value || 'default'}
              className={`swipe-tone-option ${(combo.cardTone ?? '') === option.value ? 'active' : ''}`}
              data-card-action
              data-card-tone={option.value || undefined}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onChangeTone(option.value || undefined)}
              aria-label={`カード色を${option.label}に変更`}
              aria-pressed={(combo.cardTone ?? '') === option.value}
            >
              <span aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <button
        className="swipe-delete"
        data-sort-ignore
        onClick={onDelete}
        aria-label={`${combo.title}を削除`}
      >
        削除
      </button>
      <div
        className={`card row-card with-avatar swipe-card ${dragging ? 'dragging' : ''} ${sort.sorting ? 'sorting' : ''}`}
        data-sort-id={combo.id}
        data-sort-group="combos"
        data-card-tone={combo.cardTone}
        style={{ transform: cardTransform }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishSwipe}
        onPointerCancel={(event) => finishSwipe(event, false)}
        onContextMenu={sort.preventContextMenu}
      >
        <button
          className="swipe-card-main"
          data-sort-handle
          onClick={(event) => {
            if (sort.consumeClick() || isSortClickGuarded() || moved.current) {
              moved.current = false
              event.preventDefault()
              return
            }
            if (openSide) onSwipeClose()
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
        </button>
        <button
          className={`favorite-button ${combo.favorite ? 'active' : ''}`}
          data-card-action
          data-sort-ignore
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite()
          }}
          aria-label={combo.favorite ? 'お気に入りから外す' : 'お気に入りに追加'}
          aria-pressed={Boolean(combo.favorite)}
        >
          <StarIcon filled={Boolean(combo.favorite)} />
        </button>
        <span className="drag-grip" data-sort-handle aria-hidden="true">
          ⠿
        </span>
      </div>
    </div>
  )
}

// ---------------- キャラ選択（作成フローの最初のステップ） ----------------

function MemberPicker({
  characters,
  onCancel,
  onSubmit,
  initialSelected = [],
  title = 'キャラを選ぶ',
  submitLabel = 'この編成で作成',
}: {
  characters: Character[]
  onCancel: () => void
  onSubmit: (memberIds: string[]) => void
  initialSelected?: string[]
  title?: string
  submitLabel?: string
}) {
  const [selected, setSelected] = useState<string[]>(() => initialSelected.slice(0, 3))
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
          {submitLabel} →
        </button>
      </header>
      <span className="page-kicker">メンバー選択</span>
      <h1 className="picker-title">
        {title}（{selected.length}/3）
      </h1>
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
  onDuplicate,
  onChangeMembers,
  onAddCharacterAction,
  onRenameCharacterAction,
  onDeleteCharacterAction,
  onReorderCharacterAction,
}: {
  data: AppData
  combo: Combo
  onChange: (c: Combo) => void
  onBack: () => void
  onDelete: () => void
  onDuplicate: () => void
  onChangeMembers: (memberIds: string[]) => void
  onAddCharacterAction: (characterId: string, name: string) => void
  onRenameCharacterAction: (characterId: string, actionId: string, name: string) => void
  onDeleteCharacterAction: (characterId: string, actionId: string) => void
  onReorderCharacterAction: (
    characterId: string,
    sourceId: string,
    targetId: string,
  ) => void
}) {
  const [mode, setMode] = useState<'edit' | 'view' | 'command'>('edit')
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const [organizing, setOrganizing] = useState(false)
  const [changingMembers, setChangingMembers] = useState(false)

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

  const duplicateStep = (id: string) => {
    const sourceIndex = combo.steps.findIndex((step) => step.id === id)
    if (sourceIndex < 0) return
    const source = combo.steps[sourceIndex]
    const duplicate: ComboStep = {
      ...source,
      id: newId(),
      actions: source.actions.map((action) => ({ ...action, id: newId() })),
    }
    const steps = [...combo.steps]
    steps.splice(sourceIndex + 1, 0, duplicate)
    onChange({ ...combo, steps })
    setActiveStepId(duplicate.id)
    setActiveActionId(null)
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

  const displayScale = combo.commandScale ?? 1
  const changeDisplayScale = (delta: number) => {
    const next = Math.min(
      DISPLAY_SCALE_MAX,
      Math.max(DISPLAY_SCALE_MIN, Math.round((displayScale + delta) * 10) / 10),
    )
    onChange({
      ...combo,
      commandScale: next === 1 ? undefined : next,
    })
  }

  if (changingMembers) {
    return (
      <MemberPicker
        characters={data.characters}
        initialSelected={party?.memberIds ?? []}
        title="編成を変更"
        submitLabel="この編成に変更"
        onCancel={() => setChangingMembers(false)}
        onSubmit={(memberIds) => {
          onChangeMembers(memberIds)
          setChangingMembers(false)
        }}
      />
    )
  }

  // ---- 閲覧モード：手書きノート風の大きな表示 / コマンドモード（ボタンのみ） ----
  if (mode !== 'edit') {
    const command = mode === 'command'
    return (
      <div className="page">
        <header className="page-header view-page-header">
          <button onClick={onBack}>一覧へ</button>
          <button onClick={() => setMode('edit')}>
            <EditIcon />
            編集
          </button>
        </header>
        <div className="display-mode-control" role="group" aria-label="表示方法">
          <button
            className={!command ? 'active' : ''}
            onClick={() => setMode('view')}
            aria-pressed={!command}
          >
            技名
          </button>
          <button
            className={command ? 'active' : ''}
            onClick={() => setMode('command')}
            aria-pressed={command}
          >
            <CommandIcon />
            コマンド
          </button>
        </div>
        <div className="display-size-control" role="group" aria-label="表示サイズ">
          <button
            onClick={() => changeDisplayScale(-DISPLAY_SCALE_STEP)}
            disabled={displayScale <= DISPLAY_SCALE_MIN}
            aria-label="表示を小さくする"
          >
            −
          </button>
          <output aria-live="polite">{Math.round(displayScale * 100)}%</output>
          <button
            onClick={() => changeDisplayScale(DISPLAY_SCALE_STEP)}
            disabled={displayScale >= DISPLAY_SCALE_MAX}
            aria-label="表示を大きくする"
          >
            ＋
          </button>
        </div>
        <div
          className="display-content"
          style={{ '--display-scale': displayScale } as CSSProperties}
        >
          <h1 className="view-title">{combo.title}</h1>
          <div className="view-steps">
            {combo.steps.map((s) => {
              const ch = charOf(s.characterId)
              const numberedActionNotes = s.actions
                .filter((action) => action.note)
                .map((action, index) => {
                  const name = ch?.actions.find((item) => item.id === action.actionId)?.name ?? '?'
                  return {
                    id: action.id,
                    number: index + 1,
                    text: `${name}: ${action.note}`,
                  }
                })
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
                            <ActionText
                              action={a}
                              character={ch}
                              buttonMap={buttonMap}
                              noteNumber={actionNoteNumber(s.actions, a.id)}
                            />
                          </Fragment>
                        ))}
                      </span>
                    )}
                  </div>
                  {!command && (Boolean(s.note) || numberedActionNotes.length > 0) && (
                    <div className="view-points">
                      {s.note && (
                        <div className="view-note">
                          <span className="note-reference">※</span> {s.note}
                        </div>
                      )}
                      {numberedActionNotes.map((point) => (
                        <div key={point.id} className="view-note">
                          <span className="note-reference">
                            ※<sup>{point.number}</sup>
                          </span>{' '}
                          {point.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        {combo.memo && (
          <section className="card combo-memo-card combo-memo-view">
            <span className="page-kicker">メモ</span>
            <p>{combo.memo}</p>
          </section>
        )}
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
        <span className="page-header-actions">
          <button onClick={() => setChangingMembers(true)}>編成</button>
          <button className="primary" onClick={() => setMode('view')}>
            表示
          </button>
        </span>
      </header>
      <section className="editor-intro">
        <span className="page-kicker">ローテーション編集</span>
        <input
          className="title-input wide"
          aria-label="ローテーション名"
          value={combo.title}
          onChange={(e) => onChange({ ...combo, title: e.target.value })}
        />
        <label className="combo-tone-field">
          <span>一覧カードの色</span>
          <select
            aria-label="ローテーションカードの色"
            value={combo.cardTone ?? ''}
            onChange={(event) => {
              const cardTone = event.target.value as '' | ComboCardTone
              onChange({ ...combo, cardTone: cardTone || undefined })
            }}
          >
            {CARD_TONE_OPTIONS.map((option) => (
              <option key={option.value || 'default'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span
            className="combo-tone-swatch"
            data-card-tone={combo.cardTone}
            aria-hidden="true"
          />
        </label>
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
                    onClick={() => duplicateStep(s.id)}
                    aria-label="この行を複製"
                  >
                    ⧉
                  </button>
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
                      <ActionText
                        action={a}
                        character={ch}
                        buttonMap={buttonMap}
                        noteNumber={actionNoteNumber(s.actions, a.id)}
                      />
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
                  {ch.actions.map((a) => (
                    <SortableItem
                      key={a.id}
                      id={a.id}
                      group={`palette-${ch.id}`}
                      onMove={(sourceId, targetId) =>
                        onReorderCharacterAction(ch.id, sourceId, targetId)
                      }
                      onSortStart={() => setActiveActionId(null)}
                      className="palette-action-sortable"
                    >
                      {organizing ? (
                        <button
                          className="chip organize"
                          data-sort-handle
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
                        <button
                          className="chip"
                          data-sort-handle
                          onClick={() => chooseAction(s, a.id)}
                        >
                          {a.name}
                          {(a.button ?? resolveButtonForAction(a.name, buttonMap)) && (
                            <span className="btn-label">
                              {a.button ?? resolveButtonForAction(a.name, buttonMap)}
                            </span>
                          )}
                        </button>
                      )}
                    </SortableItem>
                  ))}
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
        <button onClick={onDuplicate}>ローテーションを複製</button>
        <button className="danger" onClick={onDelete}>
          ローテーションを削除
        </button>
      </div>

      <section className="card combo-memo-card">
        <span className="page-kicker">メモ</span>
        <textarea
          className="combo-memo-input"
          aria-label="ローテーションのメモ"
          placeholder="ローテーションや音骸などのメモ"
          maxLength={10000}
          value={combo.memo ?? ''}
          onChange={(event) =>
            onChange({
              ...combo,
              memo: event.target.value || undefined,
            })
          }
        />
      </section>

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
  noteNumber,
}: {
  action: ComboAction
  character?: Character
  buttonMap: Record<string, string>
  noteNumber?: number
}) {
  const def = character?.actions.find((x) => x.id === action.actionId)
  // 優先順: キャラ技の設定 > 共通ボタン対応表
  const button = def?.button ?? (def ? resolveButtonForAction(def.name, buttonMap) : undefined)
  return (
    <span>
      {def?.name ?? '?'}
      {button && <span className="btn-label">[{button}]</span>}
      {action.note && (
        <span className="note-mark">
          ※{noteNumber && <sup>{noteNumber}</sup>}
        </span>
      )}
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
