import { useMemo, useState } from 'react'
import Avatar from '../components/Avatar'
import { ECHO_BY_ID, ECHOES, SONATA_BY_ID, normalizeEchoOcrText } from '../echoData'
import {
  ECHO_SCORE_FORMULA_VERSION,
  ECHO_SCORE_PROFILES,
  ECHO_SUBSTAT_DEFINITIONS,
  calculateEchoLoadoutTotal,
  calculateEchoScore,
  formatEchoStatName,
  formatEchoStatValue,
  getEchoMainStatRule,
  getEchoScoreRank,
} from '../echoScoring'
import type {
  AppData,
  EchoLoadoutSlot,
  EchoScoreProfile,
  EchoScoreStat,
  EchoStatId,
  SavedEchoLoadout,
} from '../types'
import { newId } from '../types'

interface Props {
  data: AppData
  setData: (data: AppData) => void
}

interface DraftSubstat {
  id: EchoStatId | ''
  value: number | ''
}

interface SlotDraft {
  id: string
  position: 1 | 2 | 3 | 4 | 5
  echoId: string
  sonataId: string
  mainStatId: EchoStatId | ''
  substats: DraftSubstat[]
}

interface LoadoutDraft {
  id?: string
  characterId: string
  scoreProfile: EchoScoreProfile
  slots: SlotDraft[]
}

const SLOT_POSITIONS = [1, 2, 3, 4, 5] as const

function makeBlankSubstats(): DraftSubstat[] {
  return Array.from({ length: 5 }, () => ({ id: '', value: '' }))
}

function makeBlankSlot(position: SlotDraft['position']): SlotDraft {
  return {
    id: newId(),
    position,
    echoId: '',
    sonataId: '',
    mainStatId: '',
    substats: makeBlankSubstats(),
  }
}

function makeDraft(): LoadoutDraft {
  return {
    characterId: '',
    scoreProfile: 'attack',
    slots: SLOT_POSITIONS.map(makeBlankSlot),
  }
}

function draftFromRecord(record: SavedEchoLoadout): LoadoutDraft {
  return {
    id: record.id,
    characterId: record.characterId,
    scoreProfile: record.scoreProfile,
    slots: SLOT_POSITIONS.map((position) => {
      const slot = record.slots.find((candidate) => candidate.position === position)
      if (!slot) return makeBlankSlot(position)
      return {
        id: slot.id,
        position,
        echoId: slot.echoId,
        sonataId: slot.sonataId,
        mainStatId: slot.mainStatId,
        substats: [
          ...slot.substats.map((stat) => ({ id: stat.id, value: stat.value })),
          ...makeBlankSubstats(),
        ].slice(0, 5),
      }
    }),
  }
}

function validDraftSubstats(substats: DraftSubstat[]): EchoScoreStat[] {
  return substats.flatMap((stat) =>
    stat.id && stat.value !== '' ? [{ id: stat.id, value: stat.value }] : [],
  )
}

function hasSlotData(slot: SlotDraft): boolean {
  return Boolean(
    slot.echoId ||
      slot.sonataId ||
      slot.mainStatId ||
      slot.substats.some((stat) => stat.id || stat.value !== ''),
  )
}

function isCompleteSlot(slot: SlotDraft): boolean {
  return Boolean(
    slot.echoId &&
      slot.sonataId &&
      slot.mainStatId &&
      validDraftSubstats(slot.substats).length === 5,
  )
}

function getSlotScore(slot: SlotDraft, profile: EchoScoreProfile): number {
  return calculateEchoScore(validDraftSubstats(slot.substats), profile)
}

function getLoadoutTotal(slots: SlotDraft[], profile: EchoScoreProfile): number {
  return calculateEchoLoadoutTotal(slots.map((slot) => getSlotScore(slot, profile)))
}

function getSonataSummary(
  slots: ReadonlyArray<Pick<SlotDraft | EchoLoadoutSlot, 'echoId' | 'sonataId'>>,
) {
  const echoesBySonata = new Map<string, Set<string>>()
  slots.forEach((slot) => {
    if (!slot.echoId || !slot.sonataId) return
    const echoIds = echoesBySonata.get(slot.sonataId) ?? new Set<string>()
    echoIds.add(slot.echoId)
    echoesBySonata.set(slot.sonataId, echoIds)
  })
  return [...echoesBySonata.entries()]
    .map(([sonataId, echoIds]) => {
      const sonata = SONATA_BY_ID.get(sonataId)
      const count = echoIds.size
      const activePieces =
        sonata?.effects
          .filter((effect) => effect.pieces <= count)
          .map((effect) => effect.pieces)
          .sort((a, b) => a - b) ?? []
      return { sonataId, name: sonata?.name ?? sonataId, count, activePieces }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))
}

function getTotalCost(slots: ReadonlyArray<Pick<SlotDraft | EchoLoadoutSlot, 'echoId'>>) {
  return slots.reduce((total, slot) => total + (ECHO_BY_ID.get(slot.echoId)?.cost ?? 0), 0)
}

export default function EchoScorePage({ data, setData }: Props) {
  const records = data.echoLoadouts ?? []
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<LoadoutDraft>(makeDraft)
  const [activeSlotIndex, setActiveSlotIndex] = useState(0)
  const [echoQuery, setEchoQuery] = useState('')
  const [showEchoResults, setShowEchoResults] = useState(false)

  const activeSlot = draft.slots[activeSlotIndex]
  const selectedEcho = ECHO_BY_ID.get(activeSlot.echoId)
  const mainStatRule = selectedEcho ? getEchoMainStatRule(selectedEcho.cost) : undefined
  const selectedCharacter = data.characters.find(
    (character) => character.id === draft.characterId,
  )
  const activeSubstats = validDraftSubstats(activeSlot.substats)
  const activeScore = calculateEchoScore(activeSubstats, draft.scoreProfile)
  const activeRank = getEchoScoreRank(activeScore)
  const completedSlots = draft.slots.filter(isCompleteSlot)
  const totalScore = getLoadoutTotal(draft.slots, draft.scoreProfile)
  const totalCost = getTotalCost(draft.slots)
  const sonataSummary = getSonataSummary(draft.slots)
  const hasIncompleteSlot = draft.slots.some(
    (slot) => hasSlotData(slot) && !isCompleteSlot(slot),
  )
  const selectedProfile = ECHO_SCORE_PROFILES.find(
    (profile) => profile.id === draft.scoreProfile,
  )

  const seenEchoSonatas = new Set<string>()
  const hasDuplicateEchoSonata = draft.slots.some((slot) => {
    if (!slot.echoId || !slot.sonataId) return false
    const key = `${slot.echoId}:${slot.sonataId}`
    if (seenEchoSonatas.has(key)) return true
    seenEchoSonatas.add(key)
    return false
  })

  const echoResults = useMemo(() => {
    const normalized = normalizeEchoOcrText(echoQuery)
    const candidates = normalized
      ? ECHOES.filter((echo) =>
          [echo.name, ...(echo.aliases ?? [])].some((name) =>
            normalizeEchoOcrText(name).includes(normalized),
          ),
        )
      : [...ECHOES].sort((a, b) => b.sourceId - a.sourceId)
    return candidates.slice(0, normalized ? 12 : 8)
  }, [echoQuery])

  const setActiveSlot = (nextSlot: SlotDraft) => {
    setDraft((current) => ({
      ...current,
      slots: current.slots.map((slot, index) =>
        index === activeSlotIndex ? nextSlot : slot,
      ),
    }))
  }

  const updateActiveSlot = (next: Partial<SlotDraft>) => {
    setActiveSlot({ ...activeSlot, ...next })
  }

  const switchSlot = (index: number) => {
    const nextSlot = draft.slots[index]
    setActiveSlotIndex(index)
    setEchoQuery(ECHO_BY_ID.get(nextSlot.echoId)?.name ?? '')
    setShowEchoResults(false)
  }

  const beginCreate = () => {
    setDraft(makeDraft())
    setActiveSlotIndex(0)
    setEchoQuery('')
    setShowEchoResults(false)
    setEditing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const beginEdit = (record: SavedEchoLoadout) => {
    const nextDraft = draftFromRecord(record)
    setDraft(nextDraft)
    setActiveSlotIndex(0)
    setEchoQuery(ECHO_BY_ID.get(nextDraft.slots[0].echoId)?.name ?? '')
    setShowEchoResults(false)
    setEditing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeEditor = () => {
    setEditing(false)
    setDraft(makeDraft())
    setActiveSlotIndex(0)
    setEchoQuery('')
    setShowEchoResults(false)
  }

  const selectEcho = (echoId: string) => {
    const echo = ECHO_BY_ID.get(echoId)
    if (!echo) return
    updateActiveSlot({
      echoId,
      sonataId: echo.sonataIds[0] ?? '',
      mainStatId: '',
    })
    setEchoQuery(echo.name)
    setShowEchoResults(false)
  }

  const updateSubstat = (index: number, next: Partial<DraftSubstat>) => {
    updateActiveSlot({
      substats: activeSlot.substats.map((stat, statIndex) =>
        statIndex === index ? { ...stat, ...next } : stat,
      ),
    })
  }

  const clearSlot = () => {
    if (hasSlotData(activeSlot) && !confirm(`音骸${activeSlot.position}の入力を消去しますか？`)) {
      return
    }
    const blank = makeBlankSlot(activeSlot.position)
    setActiveSlot(blank)
    setEchoQuery('')
    setShowEchoResults(false)
  }

  const save = () => {
    if (
      !draft.characterId ||
      completedSlots.length === 0 ||
      hasIncompleteSlot ||
      totalCost > 12
    ) {
      return
    }

    const slots: EchoLoadoutSlot[] = completedSlots.map((slot) => {
      const score = getSlotScore(slot, draft.scoreProfile)
      return {
        id: slot.id,
        position: slot.position,
        echoId: slot.echoId,
        sonataId: slot.sonataId,
        mainStatId: slot.mainStatId as EchoStatId,
        substats: validDraftSubstats(slot.substats),
        score,
        rank: getEchoScoreRank(score),
      }
    })
    const now = new Date().toISOString()
    const previous = records.find((record) => record.id === draft.id)
    const record: SavedEchoLoadout = {
      id: draft.id ?? newId(),
      characterId: draft.characterId,
      scoreProfile: draft.scoreProfile,
      slots,
      totalScore: calculateEchoLoadoutTotal(slots.map((slot) => slot.score)),
      formulaVersion: ECHO_SCORE_FORMULA_VERSION,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    }

    setData({
      ...data,
      echoLoadouts: [record, ...records.filter((candidate) => candidate.id !== record.id)],
      echoScores: undefined,
    })
    closeEditor()
  }

  const removeRecord = (record: SavedEchoLoadout) => {
    const character = data.characters.find((candidate) => candidate.id === record.characterId)
    if (!confirm(`${character?.name ?? 'このキャラ'}の音骸セットを削除しますか？`)) return
    setData({
      ...data,
      echoLoadouts: records.filter((candidate) => candidate.id !== record.id),
    })
  }

  if (!editing) {
    return (
      <div className="page echo-score-page">
        <header className="page-header">
          <div className="page-heading">
            <span className="page-kicker">5枠の装備記録</span>
            <h1>音骸スコア</h1>
          </div>
          <button className="primary" onClick={beginCreate}>
            ＋ セット
          </button>
        </header>

        {records.length === 0 ? (
          <button className="empty empty-action" onClick={beginCreate}>
            <span className="empty-action-label">＋ 音骸セットを記録</span>
            <span>5つの音骸をまとめて採点・保存できます</span>
          </button>
        ) : (
          <div className="echo-record-list">
            {records.map((record) => {
              const character = data.characters.find(
                (candidate) => candidate.id === record.characterId,
              )
              const summary = getSonataSummary(record.slots)
              const cost = getTotalCost(record.slots)
              return (
                <div key={record.id} className="card echo-record-card">
                  <button className="echo-record-open" onClick={() => beginEdit(record)}>
                    <span className="echo-record-avatar">
                      <Avatar character={character} size={50} />
                      <span className="echo-record-cost">{record.slots.length}/5</span>
                    </span>
                    <span className="echo-record-copy">
                      <strong>{character?.name ?? '未登録のキャラ'}</strong>
                      <span>
                        COST {cost}/12 ・ {record.slots.length}枠入力
                      </span>
                      <small>
                        {summary.length > 0
                          ? summary.map((item) => `${item.name} ×${item.count}`).join(' / ')
                          : 'ハーモニー未設定'}
                      </small>
                    </span>
                    <span className="echo-score-badge">
                      <span>TOTAL</span>
                      <strong>{record.totalScore.toFixed(1)}</strong>
                    </span>
                  </button>
                  <div className="echo-record-substats echo-record-pieces">
                    {[...record.slots]
                      .sort((a, b) => a.position - b.position)
                      .map((slot) => {
                        const echo = ECHO_BY_ID.get(slot.echoId)
                        return (
                          <span key={slot.id}>
                            {slot.position}. C{echo?.cost ?? '?'} {slot.score.toFixed(1)}
                          </span>
                        )
                      })}
                  </div>
                  <button
                    className="icon-btn echo-record-delete"
                    onClick={() => removeRecord(record)}
                    aria-label={`${character?.name ?? '音骸セット'}を削除`}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const canSave =
    Boolean(draft.characterId) &&
    completedSlots.length > 0 &&
    !hasIncompleteSlot &&
    totalCost <= 12

  return (
    <div className="page echo-score-page">
      <header className="page-header">
        <button onClick={closeEditor}>← 戻る</button>
        <div className="page-heading echo-editor-heading">
          <span className="page-kicker">{draft.id ? 'セットを編集' : '新しいセット'}</span>
          <h1>5枠を採点</h1>
        </div>
      </header>

      <section className="card echo-form-section echo-loadout-basics">
        <label className="echo-field">
          <span>キャラ</span>
          <select
            value={draft.characterId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, characterId: event.target.value }))
            }
          >
            <option value="">選択してください</option>
            {data.characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
        </label>

        <div className="echo-field">
          <span>評価タイプ</span>
          <div className="echo-profile-options" role="group" aria-label="評価タイプ">
            {ECHO_SCORE_PROFILES.map((profile) => (
              <button
                key={profile.id}
                className={draft.scoreProfile === profile.id ? 'active' : ''}
                aria-pressed={draft.scoreProfile === profile.id}
                onClick={() =>
                  setDraft((current) => ({ ...current, scoreProfile: profile.id }))
                }
              >
                {profile.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card echo-loadout-overview">
        <div className="echo-loadout-totals">
          <span>
            <small>合計スコア</small>
            <strong>{totalScore.toFixed(1)}</strong>
          </span>
          <span className={totalCost > 12 ? 'over' : ''}>
            <small>合計COST</small>
            <strong>{totalCost}/12</strong>
          </span>
        </div>

        <div className="echo-slot-tabs" role="tablist" aria-label="音骸の装備枠">
          {draft.slots.map((slot, index) => {
            const echo = ECHO_BY_ID.get(slot.echoId)
            const slotScore = getSlotScore(slot, draft.scoreProfile)
            return (
              <button
                key={slot.id}
                role="tab"
                className={`${index === activeSlotIndex ? 'active' : ''} ${
                  isCompleteSlot(slot) ? 'complete' : ''
                }`}
                aria-selected={index === activeSlotIndex}
                onClick={() => switchSlot(index)}
              >
                <span>{slot.position}</span>
                <small>{echo ? `C${echo.cost}` : '未設定'}</small>
                {isCompleteSlot(slot) && <b>{slotScore.toFixed(1)}</b>}
              </button>
            )
          })}
        </div>

        {sonataSummary.length > 0 && (
          <div className="echo-sonata-summary">
            {sonataSummary.map((item) => (
              <span key={item.sonataId}>
                <strong>{item.name}</strong>
                <small>
                  ×{item.count}
                  {item.activePieces.length > 0
                    ? `・${item.activePieces.join('・')}セット発動`
                    : ''}
                </small>
              </span>
            ))}
          </div>
        )}
        {hasDuplicateEchoSonata && (
          <p className="echo-loadout-warning">
            同名音骸はハーモニーのセット数に重複加算していません。
          </p>
        )}
      </section>

      <section className="card echo-form-section echo-slot-editor">
        <div className="echo-section-title">
          <h3>
            音骸 {activeSlot.position}
            {activeSlot.position === 1 && <small> メイン</small>}
          </h3>
          {hasSlotData(activeSlot) && (
            <button className="echo-clear-slot" onClick={clearSlot}>
              入力を消去
            </button>
          )}
        </div>

        <div className="echo-field">
          <label htmlFor="echo-name-search">音骸</label>
          <div className="echo-search">
            <input
              id="echo-name-search"
              value={echoQuery}
              placeholder="音骸名で検索"
              autoComplete="off"
              onFocus={() => setShowEchoResults(true)}
              onBlur={() => window.setTimeout(() => setShowEchoResults(false), 120)}
              onChange={(event) => {
                setEchoQuery(event.target.value)
                setShowEchoResults(true)
                updateActiveSlot({ echoId: '', sonataId: '', mainStatId: '' })
              }}
            />
            {showEchoResults && (
              <div className="echo-search-results" role="listbox" aria-label="音骸の候補">
                {echoResults.length === 0 ? (
                  <span className="echo-search-empty">該当する音骸がありません</span>
                ) : (
                  echoResults.map((echo) => (
                    <button
                      key={echo.id}
                      role="option"
                      aria-selected={echo.id === activeSlot.echoId}
                      onClick={() => selectEcho(echo.id)}
                    >
                      <span>{echo.name}</span>
                      <small>COST {echo.cost}</small>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {selectedEcho && (
          <div className="echo-selection-summary">
            <span className="echo-cost-mark">COST {selectedEcho.cost}</span>
            <strong>{selectedEcho.name}</strong>
          </div>
        )}

        {selectedEcho && (
          <label className="echo-field">
            <span>ハーモニー</span>
            <select
              value={activeSlot.sonataId}
              onChange={(event) => updateActiveSlot({ sonataId: event.target.value })}
            >
              {selectedEcho.sonataIds.map((sonataId) => (
                <option key={sonataId} value={sonataId}>
                  {SONATA_BY_ID.get(sonataId)?.name ?? sonataId}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="echo-field">
          <span>メインステータス</span>
          <select
            value={activeSlot.mainStatId}
            disabled={!mainStatRule}
            onChange={(event) =>
              updateActiveSlot({
                mainStatId: event.target.value as EchoStatId | '',
              })
            }
          >
            <option value="">選択してください</option>
            {mainStatRule?.primaryStats.map((stat) => (
              <option key={stat.id} value={stat.id}>
                {formatEchoStatName(stat.id)}{' '}
                {formatEchoStatValue(stat.id, stat.valueAtFiveStarLevel25)}
              </option>
            ))}
          </select>
          {mainStatRule && (
            <small className="echo-fixed-stat">
              固定枠: {formatEchoStatName(mainStatRule.fixedStat.id)}{' '}
              {formatEchoStatValue(
                mainStatRule.fixedStat.id,
                mainStatRule.fixedStat.valueAtFiveStarLevel25,
              )}
            </small>
          )}
        </label>

        <div className="echo-section-title echo-substat-heading">
          <h3>サブステータス</h3>
          <span>{activeSubstats.length}/5</span>
        </div>
        <div className="echo-substat-list">
          {activeSlot.substats.map((stat, index) => {
            const definition = stat.id
              ? ECHO_SUBSTAT_DEFINITIONS.find((candidate) => candidate.id === stat.id)
              : undefined
            const usedIds = new Set(
              activeSlot.substats
                .filter((_, statIndex) => statIndex !== index)
                .map((candidate) => candidate.id)
                .filter(Boolean),
            )
            return (
              <div key={index} className="echo-substat-row">
                <select
                  value={stat.id}
                  aria-label={`サブステータス${index + 1}`}
                  onChange={(event) =>
                    updateSubstat(index, {
                      id: event.target.value as EchoStatId | '',
                      value: '',
                    })
                  }
                >
                  <option value="">サブ{index + 1}</option>
                  {ECHO_SUBSTAT_DEFINITIONS.map((candidate) => (
                    <option
                      key={candidate.id}
                      value={candidate.id}
                      disabled={usedIds.has(candidate.id)}
                    >
                      {formatEchoStatName(candidate.id)}
                    </option>
                  ))}
                </select>
                <select
                  value={stat.value}
                  disabled={!definition}
                  aria-label={`サブステータス${index + 1}の数値`}
                  onChange={(event) =>
                    updateSubstat(index, {
                      value: event.target.value === '' ? '' : Number(event.target.value),
                    })
                  }
                >
                  <option value="">数値</option>
                  {definition?.substatValues.map((value) => (
                    <option key={value} value={value}>
                      {formatEchoStatValue(definition.id, value)}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-btn"
                  onClick={() => updateSubstat(index, { id: '', value: '' })}
                  aria-label={`サブステータス${index + 1}を消去`}
                  disabled={!stat.id && stat.value === ''}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>

        <div className="echo-slot-score">
          <span>音骸{activeSlot.position}のスコア</span>
          <strong>{activeSubstats.length > 0 ? activeScore.toFixed(1) : '—'}</strong>
          <b>{activeSubstats.length > 0 ? activeRank : '—'}</b>
        </div>
      </section>

      <section className="echo-score-result">
        <div className="echo-score-result-character">
          <Avatar character={selectedCharacter} size={50} />
          <span>
            <small>{selectedCharacter?.name ?? 'キャラ未選択'}</small>
            <strong>{completedSlots.length}/5枠を入力</strong>
          </span>
        </div>
        <div className="echo-score-result-value">
          <span>TOTAL</span>
          <strong>{completedSlots.length > 0 ? totalScore.toFixed(1) : '—'}</strong>
        </div>
        <p>
          各枠の「クリ率×2 ＋ クリダメ ＋ {selectedProfile?.label ?? '攻撃'}」を合計
        </p>
      </section>

      {hasIncompleteSlot && (
        <p className="echo-save-warning">
          入力途中の枠があります。音骸・ハーモニー・メイン・サブを設定してください。
        </p>
      )}
      {totalCost > 12 && (
        <p className="echo-save-warning">合計COSTが12を超えています。</p>
      )}
      <button className="primary echo-save-button" disabled={!canSave} onClick={save}>
        {draft.id
          ? '変更を保存'
          : completedSlots.length === 5
            ? 'この5枠を保存'
            : `下書きを保存（${completedSlots.length}/5）`}
      </button>
    </div>
  )
}
