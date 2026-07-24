import { useMemo, useState } from 'react'
import Avatar from '../components/Avatar'
import { ECHO_BY_ID, ECHOES, SONATA_BY_ID, normalizeEchoOcrText } from '../echoData'
import {
  ECHO_SCORE_FORMULA_VERSION,
  ECHO_SCORE_PROFILES,
  ECHO_SUBSTAT_DEFINITIONS,
  calculateEchoScore,
  formatEchoStatName,
  formatEchoStatValue,
  getEchoMainStatRule,
  getEchoScoreRank,
} from '../echoScoring'
import type {
  AppData,
  EchoScoreProfile,
  EchoScoreStat,
  EchoStatId,
  SavedEchoScore,
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

interface ScoreDraft {
  id?: string
  characterId: string
  echoId: string
  sonataId: string
  scoreProfile: EchoScoreProfile
  mainStatId: EchoStatId | ''
  substats: DraftSubstat[]
}

function makeDraft(): ScoreDraft {
  return {
    characterId: '',
    echoId: '',
    sonataId: '',
    scoreProfile: 'attack',
    mainStatId: '',
    substats: [{ id: '', value: '' }],
  }
}

function draftFromRecord(record: SavedEchoScore): ScoreDraft {
  return {
    id: record.id,
    characterId: record.characterId,
    echoId: record.echoId,
    sonataId: record.sonataId,
    scoreProfile: record.scoreProfile,
    mainStatId: record.mainStatId,
    substats:
      record.substats.length > 0
        ? record.substats.map((stat) => ({ id: stat.id, value: stat.value }))
        : [{ id: '', value: '' }],
  }
}

function validDraftSubstats(substats: DraftSubstat[]): EchoScoreStat[] {
  return substats.flatMap((stat) =>
    stat.id && stat.value !== '' ? [{ id: stat.id, value: stat.value }] : [],
  )
}

export default function EchoScorePage({ data, setData }: Props) {
  const records = data.echoScores ?? []
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ScoreDraft>(makeDraft)
  const [echoQuery, setEchoQuery] = useState('')
  const [showEchoResults, setShowEchoResults] = useState(false)

  const selectedEcho = ECHO_BY_ID.get(draft.echoId)
  const mainStatRule = selectedEcho ? getEchoMainStatRule(selectedEcho.cost) : undefined
  const selectedCharacter = data.characters.find(
    (character) => character.id === draft.characterId,
  )
  const substats = validDraftSubstats(draft.substats)
  const score = calculateEchoScore(substats, draft.scoreProfile)
  const rank = getEchoScoreRank(score)
  const selectedProfile = ECHO_SCORE_PROFILES.find(
    (profile) => profile.id === draft.scoreProfile,
  )

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

  const beginCreate = () => {
    setDraft(makeDraft())
    setEchoQuery('')
    setShowEchoResults(false)
    setEditing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const beginEdit = (record: SavedEchoScore) => {
    setDraft(draftFromRecord(record))
    setEchoQuery(ECHO_BY_ID.get(record.echoId)?.name ?? '')
    setShowEchoResults(false)
    setEditing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeEditor = () => {
    setEditing(false)
    setDraft(makeDraft())
    setEchoQuery('')
    setShowEchoResults(false)
  }

  const selectEcho = (echoId: string) => {
    const echo = ECHO_BY_ID.get(echoId)
    if (!echo) return
    setDraft((current) => ({
      ...current,
      echoId,
      sonataId: echo.sonataIds[0] ?? '',
      mainStatId: '',
    }))
    setEchoQuery(echo.name)
    setShowEchoResults(false)
  }

  const updateSubstat = (index: number, next: Partial<DraftSubstat>) => {
    setDraft((current) => ({
      ...current,
      substats: current.substats.map((stat, statIndex) =>
        statIndex === index ? { ...stat, ...next } : stat,
      ),
    }))
  }

  const removeSubstat = (index: number) => {
    setDraft((current) => ({
      ...current,
      substats:
        current.substats.length === 1
          ? [{ id: '', value: '' }]
          : current.substats.filter((_, statIndex) => statIndex !== index),
    }))
  }

  const save = () => {
    if (
      !draft.characterId ||
      !selectedEcho ||
      !draft.sonataId ||
      !draft.mainStatId ||
      substats.length === 0
    ) {
      return
    }

    const now = new Date().toISOString()
    const previous = records.find((record) => record.id === draft.id)
    const record: SavedEchoScore = {
      id: draft.id ?? newId(),
      characterId: draft.characterId,
      echoId: selectedEcho.id,
      sonataId: draft.sonataId,
      scoreProfile: draft.scoreProfile,
      mainStatId: draft.mainStatId,
      substats,
      score,
      rank,
      formulaVersion: ECHO_SCORE_FORMULA_VERSION,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    }

    setData({
      ...data,
      echoScores: [record, ...records.filter((candidate) => candidate.id !== record.id)],
    })
    closeEditor()
  }

  const removeRecord = (record: SavedEchoScore) => {
    const echoName = ECHO_BY_ID.get(record.echoId)?.name ?? 'この音骸'
    if (!confirm(`${echoName}の記録を削除しますか？`)) return
    setData({ ...data, echoScores: records.filter((candidate) => candidate.id !== record.id) })
  }

  if (!editing) {
    return (
      <div className="page echo-score-page">
        <header className="page-header">
          <div className="page-heading">
            <span className="page-kicker">厳選の記録</span>
            <h1>音骸スコア</h1>
          </div>
          <button className="primary" onClick={beginCreate}>
            ＋ 記録
          </button>
        </header>

        {records.length === 0 ? (
          <button className="empty empty-action" onClick={beginCreate}>
            <span className="empty-action-label">＋ 音骸を記録</span>
            <span>入力したステータスを端末内に保存できます</span>
          </button>
        ) : (
          <div className="echo-record-list">
            {records.map((record) => {
              const character = data.characters.find(
                (candidate) => candidate.id === record.characterId,
              )
              const echo = ECHO_BY_ID.get(record.echoId)
              const sonata = SONATA_BY_ID.get(record.sonataId)
              return (
                <div key={record.id} className="card echo-record-card">
                  <button className="echo-record-open" onClick={() => beginEdit(record)}>
                    <span className="echo-record-avatar">
                      <Avatar character={character} size={46} />
                      <span className="echo-record-cost">C{echo?.cost ?? '?'}</span>
                    </span>
                    <span className="echo-record-copy">
                      <strong>{echo?.name ?? '未登録の音骸'}</strong>
                      <span>{character?.name ?? '未登録のキャラ'}</span>
                      <small>
                        {formatEchoStatName(record.mainStatId)} ・ {sonata?.name ?? 'セット不明'}
                      </small>
                    </span>
                    <span className="echo-score-badge" data-rank={record.rank}>
                      <span>{record.rank}</span>
                      <strong>{record.score.toFixed(1)}</strong>
                    </span>
                  </button>
                  <div className="echo-record-substats">
                    {record.substats.map((stat) => (
                      <span key={stat.id}>
                        {formatEchoStatName(stat.id)} {formatEchoStatValue(stat.id, stat.value)}
                      </span>
                    ))}
                  </div>
                  <button
                    className="icon-btn echo-record-delete"
                    onClick={() => removeRecord(record)}
                    aria-label={`${echo?.name ?? '音骸'}を削除`}
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
    Boolean(selectedEcho) &&
    Boolean(draft.sonataId) &&
    Boolean(draft.mainStatId) &&
    substats.length > 0

  return (
    <div className="page echo-score-page">
      <header className="page-header">
        <button onClick={closeEditor}>← 戻る</button>
        <div className="page-heading echo-editor-heading">
          <span className="page-kicker">{draft.id ? '記録を編集' : '新しい記録'}</span>
          <h1>音骸を採点</h1>
        </div>
      </header>

      <section className="card echo-form-section">
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
                setDraft((current) => ({
                  ...current,
                  echoId: '',
                  sonataId: '',
                  mainStatId: '',
                }))
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
                      aria-selected={echo.id === draft.echoId}
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
              value={draft.sonataId}
              onChange={(event) =>
                setDraft((current) => ({ ...current, sonataId: event.target.value }))
              }
            >
              {selectedEcho.sonataIds.map((sonataId) => (
                <option key={sonataId} value={sonataId}>
                  {SONATA_BY_ID.get(sonataId)?.name ?? sonataId}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section className="card echo-form-section">
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

        <label className="echo-field">
          <span>メインステータス</span>
          <select
            value={draft.mainStatId}
            disabled={!mainStatRule}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                mainStatId: event.target.value as EchoStatId | '',
              }))
            }
          >
            <option value="">選択してください</option>
            {mainStatRule?.primaryStats.map((stat) => (
              <option key={stat.id} value={stat.id}>
                {formatEchoStatName(stat.id)} {formatEchoStatValue(stat.id, stat.valueAtFiveStarLevel25)}
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
      </section>

      <section className="card echo-form-section">
        <div className="echo-section-title">
          <h3>サブステータス</h3>
          <span>{substats.length}/5</span>
        </div>
        <div className="echo-substat-list">
          {draft.substats.map((stat, index) => {
            const definition = stat.id
              ? ECHO_SUBSTAT_DEFINITIONS.find((candidate) => candidate.id === stat.id)
              : undefined
            const usedIds = new Set(
              draft.substats
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
                  <option value="">種類を選択</option>
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
                  onClick={() => removeSubstat(index)}
                  aria-label={`サブステータス${index + 1}を削除`}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
        {draft.substats.length < 5 && (
          <button
            className="echo-add-substat"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                substats: [...current.substats, { id: '', value: '' }],
              }))
            }
          >
            ＋ サブステータス
          </button>
        )}
      </section>

      <section className="echo-score-result" data-rank={substats.length > 0 ? rank : undefined}>
        <div className="echo-score-result-character">
          <Avatar character={selectedCharacter} size={50} />
          <span>
            <small>{selectedCharacter?.name ?? 'キャラ未選択'}</small>
            <strong>{selectedEcho?.name ?? '音骸未選択'}</strong>
          </span>
        </div>
        <div className="echo-score-result-value">
          <span>{substats.length > 0 ? rank : '—'}</span>
          <strong>{substats.length > 0 ? score.toFixed(1) : '—'}</strong>
        </div>
        <p>
          クリ率×2 ＋ クリダメ ＋ {selectedProfile?.label ?? '攻撃'}
        </p>
      </section>

      <button className="primary echo-save-button" disabled={!canSave} onClick={save}>
        {draft.id ? '変更を保存' : 'この音骸を保存'}
      </button>
    </div>
  )
}
