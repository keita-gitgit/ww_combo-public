import { useMemo, useRef, useState, type CSSProperties } from 'react'
import Avatar from '../components/Avatar'
import { ECHO_BY_ID, ECHOES, SONATA_BY_ID, normalizeEchoOcrText } from '../echoData'
import { recognizeEchoScreenshot } from '../echoScreenshotOcr'
import {
  ECHO_SCORE_FORMULA_VERSION,
  ECHO_SCORE_PROFILES,
  ECHO_SUBSTAT_DEFINITIONS,
  calculateCharacterEchoScore,
  calculateEchoLoadoutTotal,
  calculateEchoScore,
  formatEchoStatName,
  formatEchoStatValue,
  getCharacterEchoScoreWeights,
  getEchoMainStatRule,
  getEchoScoreRank,
} from '../echoScoring'
import type {
  AppData,
  EchoCost,
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
  cost: EchoCost | ''
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

interface OcrFeedback {
  kind: 'progress' | 'success' | 'warning' | 'error'
  message: string
  progress?: number
  notices?: string[]
}

const SLOT_POSITIONS = [1, 2, 3, 4, 5] as const
const MAX_ECHO_SCREENSHOT_BYTES = 20 * 1024 * 1024

function makeBlankSubstats(): DraftSubstat[] {
  return Array.from({ length: 5 }, () => ({ id: '', value: '' }))
}

function makeBlankSlot(position: SlotDraft['position']): SlotDraft {
  return {
    id: newId(),
    position,
    cost: '',
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
        cost: ECHO_BY_ID.get(slot.echoId)?.cost ?? '',
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
    slot.cost ||
      slot.echoId ||
      slot.sonataId ||
      slot.mainStatId ||
      slot.substats.some((stat) => stat.id || stat.value !== ''),
  )
}

function isCompleteSlot(slot: SlotDraft): boolean {
  return Boolean(
    slot.cost &&
      slot.echoId &&
      slot.sonataId &&
      slot.mainStatId &&
      validDraftSubstats(slot.substats).length === 5,
  )
}

function getSlotScore(
  slot: SlotDraft,
  profile: EchoScoreProfile,
  characterName?: string,
): number {
  if (characterName && getCharacterEchoScoreWeights(characterName)) {
    return calculateCharacterEchoScore(validDraftSubstats(slot.substats), characterName)
      .total
  }
  return calculateEchoScore(validDraftSubstats(slot.substats), profile)
}

function getLoadoutTotal(
  slots: SlotDraft[],
  profile: EchoScoreProfile,
  characterName?: string,
): number {
  return calculateEchoLoadoutTotal(
    slots.map((slot) => getSlotScore(slot, profile, characterName)),
  )
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

function getSavedTotalCost(slots: ReadonlyArray<Pick<EchoLoadoutSlot, 'echoId'>>) {
  return slots.reduce((total, slot) => total + (ECHO_BY_ID.get(slot.echoId)?.cost ?? 0), 0)
}

function getDraftTotalCost(slots: readonly SlotDraft[]) {
  return slots.reduce(
    (total, slot) => total + (slot.cost || ECHO_BY_ID.get(slot.echoId)?.cost || 0),
    0,
  )
}

function formatEchoScore(score: number): string {
  const rounded = Math.round(score * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export default function EchoScorePage({ data, setData }: Props) {
  const records = data.echoLoadouts ?? []
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<LoadoutDraft>(makeDraft)
  const [activeSlotIndex, setActiveSlotIndex] = useState(0)
  const [echoQuery, setEchoQuery] = useState('')
  const [showEchoResults, setShowEchoResults] = useState(false)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrFeedback, setOcrFeedback] = useState<OcrFeedback>()
  const ocrInputRef = useRef<HTMLInputElement>(null)

  const activeSlot = draft.slots[activeSlotIndex]
  const selectedEcho = ECHO_BY_ID.get(activeSlot.echoId)
  const mainStatRule = selectedEcho ? getEchoMainStatRule(selectedEcho.cost) : undefined
  const selectedCharacter = data.characters.find(
    (character) => character.id === draft.characterId,
  )
  const selectedWeights = getCharacterEchoScoreWeights(selectedCharacter?.name)
  const activeSubstats = validDraftSubstats(activeSlot.substats)
  const activeBreakdown = selectedCharacter && selectedWeights
    ? calculateCharacterEchoScore(activeSubstats, selectedCharacter.name)
    : undefined
  const activeScore = getSlotScore(
    activeSlot,
    draft.scoreProfile,
    selectedCharacter?.name,
  )
  const activeRank = getEchoScoreRank(
    activeScore,
    selectedWeights ? ECHO_SCORE_FORMULA_VERSION : 'generic-v1',
  )
  const completedSlots = draft.slots.filter(isCompleteSlot)
  const totalScore = getLoadoutTotal(
    draft.slots,
    draft.scoreProfile,
    selectedCharacter?.name,
  )
  const totalCost = getDraftTotalCost(draft.slots)
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
    if (!activeSlot.cost) return []
    const normalized = normalizeEchoOcrText(echoQuery)
    const echoesForCost = ECHOES.filter((echo) => echo.cost === activeSlot.cost)
    const candidates = normalized
      ? echoesForCost.filter((echo) =>
          [echo.name, ...(echo.aliases ?? [])].some((name) =>
            normalizeEchoOcrText(name).includes(normalized),
          ),
        )
      : [...echoesForCost].sort((a, b) => b.sourceId - a.sourceId)
    return candidates.slice(0, normalized ? 12 : 8)
  }, [activeSlot.cost, echoQuery])

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
    setOcrFeedback(undefined)
  }

  const beginCreate = () => {
    setDraft(makeDraft())
    setActiveSlotIndex(0)
    setEchoQuery('')
    setShowEchoResults(false)
    setOcrFeedback(undefined)
    setEditing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const beginEdit = (record: SavedEchoLoadout) => {
    const nextDraft = draftFromRecord(record)
    setDraft(nextDraft)
    setActiveSlotIndex(0)
    setEchoQuery(ECHO_BY_ID.get(nextDraft.slots[0].echoId)?.name ?? '')
    setShowEchoResults(false)
    setOcrFeedback(undefined)
    setEditing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeEditor = () => {
    setEditing(false)
    setDraft(makeDraft())
    setActiveSlotIndex(0)
    setEchoQuery('')
    setShowEchoResults(false)
    setOcrFeedback(undefined)
  }

  const selectEcho = (echoId: string) => {
    const echo = ECHO_BY_ID.get(echoId)
    if (!echo) return
    updateActiveSlot({
      cost: echo.cost,
      echoId,
      sonataId: echo.sonataIds[0] ?? '',
      mainStatId: '',
    })
    setEchoQuery(echo.name)
    setShowEchoResults(false)
  }

  const selectCost = (cost: EchoCost | '') => {
    const keepEcho = Boolean(selectedEcho && selectedEcho.cost === cost)
    updateActiveSlot({
      cost,
      echoId: keepEcho ? activeSlot.echoId : '',
      sonataId: keepEcho ? activeSlot.sonataId : '',
      mainStatId: keepEcho ? activeSlot.mainStatId : '',
    })
    if (!keepEcho) setEchoQuery('')
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
    setOcrFeedback(undefined)
  }

  const importScreenshot = async (file?: File) => {
    if (ocrInputRef.current) ocrInputRef.current.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setOcrFeedback({
        kind: 'error',
        message: 'JPEG・PNG・WebPの画像を選択してください。',
      })
      return
    }
    if (file.size > MAX_ECHO_SCREENSHOT_BYTES) {
      setOcrFeedback({
        kind: 'error',
        message: '画像は20MB以下にしてください。',
      })
      return
    }
    if (
      hasSlotData(activeSlot) &&
      !confirm(`音骸${activeSlot.position}の入力を読み取り結果で置き換えますか？`)
    ) {
      return
    }

    setOcrBusy(true)
    setShowEchoResults(false)
    setOcrFeedback({
      kind: 'progress',
      message: '画像を準備中',
      progress: 0,
    })
    try {
      const result = await recognizeEchoScreenshot(file, ({ message, progress }) => {
        setOcrFeedback({
          kind: 'progress',
          message,
          progress,
        })
      })
      const recognizedEcho = ECHO_BY_ID.get(result.echoId)
      const cost = result.cost || recognizedEcho?.cost || ''
      const substats: DraftSubstat[] = [
        ...result.substats.map((stat) => ({ id: stat.id, value: stat.value })),
        ...makeBlankSubstats(),
      ].slice(0, 5)
      setActiveSlot({
        ...activeSlot,
        cost,
        echoId: recognizedEcho?.id ?? '',
        sonataId:
          recognizedEcho && recognizedEcho.sonataIds.includes(result.sonataId)
            ? result.sonataId
            : recognizedEcho?.sonataIds[0] ?? '',
        mainStatId: result.mainStatId,
        substats,
      })
      setEchoQuery(recognizedEcho?.name ?? '')
      const recognizedFields = [
        recognizedEcho ? '音骸名' : '',
        cost ? 'コスト' : '',
        result.mainStatId ? 'メイン' : '',
        result.substats.length > 0 ? `サブ${result.substats.length}件` : '',
      ].filter(Boolean)
      setOcrFeedback({
        kind: result.notices.length > 0 ? 'warning' : 'success',
        message:
          recognizedFields.length > 0
            ? `${recognizedFields.join('・')}を入力しました。内容を確認してください。`
            : '読み取り結果を入力できませんでした。',
        notices: result.notices,
      })
    } catch (error) {
      console.error(error)
      setOcrFeedback({
        kind: 'error',
        message:
          '画像を読み取れませんでした。ゲーム内の音骸詳細画面をそのまま選択してください。',
      })
    } finally {
      setOcrBusy(false)
    }
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
      const score = getSlotScore(slot, draft.scoreProfile, selectedCharacter?.name)
      return {
        id: slot.id,
        position: slot.position,
        echoId: slot.echoId,
        sonataId: slot.sonataId,
        mainStatId: slot.mainStatId as EchoStatId,
        substats: validDraftSubstats(slot.substats),
        score,
        rank: getEchoScoreRank(
          score,
          selectedWeights ? ECHO_SCORE_FORMULA_VERSION : 'generic-v1',
        ),
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
      formulaVersion: selectedWeights ? ECHO_SCORE_FORMULA_VERSION : 'generic-v1',
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
              const cost = getSavedTotalCost(record.slots)
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
                        コスト {cost}/12 ・ {record.slots.length}枠入力
                      </span>
                      <small>
                        {summary.length > 0
                          ? summary.map((item) => `${item.name} ×${item.count}`).join(' / ')
                          : 'ハーモニー未設定'}
                      </small>
                    </span>
                    <span className="echo-score-badge">
                      <span>TOTAL</span>
                      <strong>{formatEchoScore(record.totalScore)}</strong>
                    </span>
                  </button>
                  <div className="echo-record-substats echo-record-pieces">
                    {[...record.slots]
                      .sort((a, b) => a.position - b.position)
                      .map((slot) => {
                        const echo = ECHO_BY_ID.get(slot.echoId)
                        return (
                          <span key={slot.id}>
                            {slot.position}. C{echo?.cost ?? '?'}{' '}
                            {formatEchoScore(slot.score)}
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

        {selectedWeights ? (
          <div className="echo-field">
            <span>評価方式</span>
            <div className="echo-character-score-mode">
              <strong>キャラ別評価</strong>
              <small>{selectedCharacter?.name}の主力ステータスを反映</small>
            </div>
          </div>
        ) : (
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
        )}
      </section>

      {selectedWeights && (
        <section className="echo-weight-summary" aria-label="キャラ別の評価係数">
          <span>評価係数</span>
          <div>
            {Object.entries(selectedWeights.substats).map(([statId, weight]) => (
              <small key={statId}>
                {formatEchoStatName(statId as EchoStatId)} ×{weight}
              </small>
            ))}
          </div>
          <p>表示のないステータスは0点。スコアはサブステータスのみで計算します。</p>
        </section>
      )}

      <section className="card echo-loadout-overview">
        <div className="echo-loadout-totals">
          <span>
            <small>合計スコア</small>
            <strong>{formatEchoScore(totalScore)}</strong>
          </span>
          <span className={totalCost > 12 ? 'over' : ''}>
            <small>合計コスト</small>
            <strong>{totalCost}/12</strong>
          </span>
        </div>

        <div className="echo-slot-tabs" role="tablist" aria-label="音骸の装備枠">
          {draft.slots.map((slot, index) => {
            const echo = ECHO_BY_ID.get(slot.echoId)
            const slotScore = getSlotScore(
              slot,
              draft.scoreProfile,
              selectedCharacter?.name,
            )
            return (
              <button
                key={slot.id}
                role="tab"
                className={`${index === activeSlotIndex ? 'active' : ''} ${
                  isCompleteSlot(slot) ? 'complete' : ''
                }`}
                aria-selected={index === activeSlotIndex}
                disabled={ocrBusy}
                onClick={() => switchSlot(index)}
              >
                <span>{slot.position}</span>
                <small>
                  {slot.cost ? `C${slot.cost}` : echo ? `C${echo.cost}` : '未設定'}
                </small>
                {isCompleteSlot(slot) && <b>{formatEchoScore(slotScore)}</b>}
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
          <div className="echo-slot-title">
            <h3>
              音骸 {activeSlot.position}
              {activeSlot.position === 1 && <small> メイン</small>}
            </h3>
            <select
              className="echo-cost-select"
              value={activeSlot.cost}
              onChange={(event) =>
                selectCost(
                  event.target.value === '' ? '' : (Number(event.target.value) as EchoCost),
                )
              }
              aria-label={`音骸${activeSlot.position}のコスト`}
            >
              <option value="">コスト</option>
              <option value="1">C1</option>
              <option value="3">C3</option>
              <option value="4">C4</option>
            </select>
          </div>
          {hasSlotData(activeSlot) && (
            <button className="echo-clear-slot" onClick={clearSlot}>
              入力を消去
            </button>
          )}
        </div>

        <div className="echo-ocr-import">
          <input
            ref={ocrInputRef}
            className="echo-ocr-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => void importScreenshot(event.target.files?.[0])}
          />
          <button
            className="echo-ocr-button"
            disabled={ocrBusy}
            onClick={() => ocrInputRef.current?.click()}
          >
            <svg
              className="echo-ocr-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5V20h14v-5.5" />
            </svg>
            <span>
              <strong>
                {ocrBusy ? 'スクリーンショットを解析中' : 'スクリーンショットから入力'}
              </strong>
              <small>音骸名・ハーモニー・ステータスを端末内で読み取ります</small>
            </span>
          </button>
          {ocrFeedback && (
            <div
              className="echo-ocr-feedback"
              data-kind={ocrFeedback.kind}
              role="status"
              aria-live="polite"
            >
              {ocrFeedback.kind === 'progress' && (
                <span
                  className="echo-ocr-progress"
                  style={{ '--ocr-progress': ocrFeedback.progress ?? 0 } as CSSProperties}
                />
              )}
              <p>{ocrFeedback.message}</p>
              {ocrFeedback.notices && ocrFeedback.notices.length > 0 && (
                <ul>
                  {ocrFeedback.notices.map((notice) => (
                    <li key={notice}>{notice}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <small className="echo-ocr-privacy">
            画像はこの端末内で処理され、保存・送信されません
          </small>
        </div>

        <div className="echo-field">
          <label htmlFor="echo-name-search">音骸</label>
          <div className="echo-search">
            <input
              id="echo-name-search"
              value={echoQuery}
              placeholder={
                activeSlot.cost ? `C${activeSlot.cost}の音骸名で検索` : '先にコストを選択'
              }
              autoComplete="off"
              disabled={!activeSlot.cost}
              onFocus={() => activeSlot.cost && setShowEchoResults(true)}
              onBlur={() => window.setTimeout(() => setShowEchoResults(false), 120)}
              onChange={(event) => {
                setEchoQuery(event.target.value)
                setShowEchoResults(true)
                updateActiveSlot({ echoId: '', sonataId: '', mainStatId: '' })
              }}
            />
            {showEchoResults && activeSlot.cost && (
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
                      <small>コスト {echo.cost}</small>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {selectedEcho && (
          <div className="echo-selection-summary">
            <span className="echo-cost-mark">コスト {selectedEcho.cost}</span>
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
            const contribution = activeBreakdown?.contributions.find(
              (candidate) => candidate.id === stat.id,
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
                {stat.id && selectedWeights && (
                  <small
                    className={`echo-substat-contribution ${
                      contribution?.weight ? '' : 'zero'
                    }`}
                  >
                    評価 ×{contribution?.weight ?? 0}
                    {stat.value !== '' && ` → ${contribution?.score ?? 0}点`}
                  </small>
                )}
              </div>
            )
          })}
        </div>

        <div className="echo-slot-score">
          <span>音骸{activeSlot.position}のスコア</span>
          <span className="echo-slot-score-value">
            <strong>
              {activeSubstats.length > 0 ? formatEchoScore(activeScore) : '—'}
            </strong>
            <b>{activeSubstats.length > 0 ? activeRank : '—'}</b>
          </span>
          {activeBreakdown && activeSubstats.length > 0 && (
            <small>
              サブステータス合計 {formatEchoScore(activeBreakdown.substatScore)}
            </small>
          )}
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
          <strong>
            {completedSlots.length > 0 ? formatEchoScore(totalScore) : '—'}
          </strong>
        </div>
        <p>
          {selectedWeights
            ? 'キャラごとの適性に合わせ、メインと全サブステータスへ個別の係数を適用'
            : `各枠の「クリ率×2 ＋ クリダメ ＋ ${
                selectedProfile?.label ?? '攻撃'
              }」を合計`}
        </p>
      </section>

      {hasIncompleteSlot && (
        <p className="echo-save-warning">
          入力途中の枠があります。音骸・ハーモニー・メイン・サブを設定してください。
        </p>
      )}
      {totalCost > 12 && (
        <p className="echo-save-warning">合計コストが12を超えています。</p>
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
