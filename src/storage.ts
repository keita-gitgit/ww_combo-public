import type {
  ActionKind,
  AppTheme,
  AppData,
  Character,
  CharacterAction,
  Combo,
  ComboCardTone,
  ComboAction,
  ComboStep,
  EchoLoadoutSlot,
  EchoScoreFormulaVersion,
  EchoScoreProfile,
  EchoScoreRank,
  EchoScoreStat,
  EchoStatId,
  Party,
  SavedEchoLoadout,
  SavedEchoScore,
} from './types'
import { makeSeedData, syncRoster, DEFAULT_BUTTON_MAP } from './seed'
import {
  ECHO_SCORE_FORMULA_VERSION,
  calculateCharacterEchoScore,
  calculateEchoLoadoutTotal,
  calculateEchoScore,
  getCharacterEchoScoreWeights,
  getEchoScoreRank,
} from './echoScoring'

const STORAGE_KEY = 'ww_combo_data_v1'
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024

const MAX_CHARACTERS = 1_000
const MAX_ACTIONS_PER_CHARACTER = 1_000
const MAX_PARTIES = 2_000
const MAX_COMBOS = 5_000
const MAX_ECHO_SCORES = 5_000
const MAX_ECHO_LOADOUTS = 5_000
const MAX_STEPS_PER_COMBO = 10_000
const MAX_ACTIONS_PER_STEP = 1_000
const MAX_REFERENCE_URLS = 20
const MAX_REFERENCE_URL_LENGTH = 2_048
const MAX_BUTTON_MAP_ENTRIES = 1_000
const ACTION_KINDS = new Set<ActionKind>([
  'normal',
  'skill',
  'liberation',
  'forte',
  'echo',
  'concerto',
  'move',
  'special',
])
const APP_THEMES = new Set<AppTheme>(['dark', 'light', 'cream'])
const COMBO_CARD_TONES = new Set<ComboCardTone>([
  '焦熱',
  '凝縮',
  '電導',
  '気動',
  '回折',
  '消滅',
])
const ECHO_SCORE_PROFILES = new Set<EchoScoreProfile>(['attack', 'hp', 'defense', 'energy'])
const ECHO_SCORE_RANKS = new Set<EchoScoreRank>(['SS', 'S', 'A', 'B', 'C', 'D'])
const ECHO_SCORE_FORMULA_VERSIONS = new Set<EchoScoreFormulaVersion>([
  'generic-v1',
  'character-v2',
  'character-v3',
  'character-v4',
])
const ECHO_STAT_IDS = new Set<EchoStatId>([
  'hp',
  'hpPercent',
  'attack',
  'attackPercent',
  'defense',
  'defensePercent',
  'critRate',
  'critDamage',
  'healingBonus',
  'energyRegen',
  'glacioDamage',
  'fusionDamage',
  'electroDamage',
  'aeroDamage',
  'spectroDamage',
  'havocDamage',
  'basicAttackDamage',
  'heavyAttackDamage',
  'resonanceSkillDamage',
  'resonanceLiberationDamage',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean'
}

function isOptionalTheme(value: unknown): value is AppTheme | undefined {
  return value === undefined || (typeof value === 'string' && APP_THEMES.has(value as AppTheme))
}

function isOptionalCardTone(value: unknown): value is ComboCardTone | undefined {
  return (
    value === undefined ||
    (typeof value === 'string' && COMBO_CARD_TONES.has(value as ComboCardTone))
  )
}

function isOptionalCommandScale(value: unknown): value is number | undefined {
  return (
    value === undefined ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 0.6 && value <= 1.2)
  )
}

function isStringArray(value: unknown, maxLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxLength &&
    value.every((item) => typeof item === 'string')
  )
}

function isCharacterAction(value: unknown): value is CharacterAction {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.kind === 'string' &&
    ACTION_KINDS.has(value.kind as ActionKind) &&
    isOptionalString(value.officialName) &&
    isOptionalString(value.button)
  )
}

function isCharacter(value: unknown): value is Character {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isOptionalString(value.element) &&
    isOptionalString(value.weapon) &&
    (value.rarity === undefined || value.rarity === 4 || value.rarity === 5) &&
    isOptionalString(value.image) &&
    Array.isArray(value.actions) &&
    value.actions.length <= MAX_ACTIONS_PER_CHARACTER &&
    value.actions.every(isCharacterAction)
  )
}

function isParty(value: unknown): value is Party {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isStringArray(value.memberIds, 3)
  )
}

function isComboAction(value: unknown): value is ComboAction {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.actionId === 'string' &&
    isOptionalBoolean(value.natural) &&
    isOptionalBoolean(value.simultaneous) &&
    isOptionalString(value.button) &&
    isOptionalString(value.note)
  )
}

function isComboStep(value: unknown): value is ComboStep {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.characterId === 'string' &&
    Array.isArray(value.actions) &&
    value.actions.length <= MAX_ACTIONS_PER_STEP &&
    value.actions.every(isComboAction) &&
    isOptionalString(value.note)
  )
}

function isCombo(value: unknown): value is Combo {
  if (!isRecord(value)) return false
  const referenceUrls = value.referenceUrls
  return (
    typeof value.id === 'string' &&
    typeof value.partyId === 'string' &&
    typeof value.title === 'string' &&
    isOptionalBoolean(value.favorite) &&
    isOptionalCardTone(value.cardTone) &&
    isOptionalCommandScale(value.commandScale) &&
    isOptionalString(value.repeatFromStepId) &&
    isOptionalString(value.memo) &&
    (referenceUrls === undefined ||
      (isStringArray(referenceUrls, MAX_REFERENCE_URLS) &&
        referenceUrls.every((url) => {
          if (url.length > MAX_REFERENCE_URL_LENGTH) return false
          try {
            const parsed = new URL(url)
            return parsed.protocol === 'http:' || parsed.protocol === 'https:'
          } catch {
            return false
          }
        }))) &&
    Array.isArray(value.steps) &&
    value.steps.length <= MAX_STEPS_PER_COMBO &&
    value.steps.every(isComboStep) &&
    typeof value.updatedAt === 'string'
  )
}

function isEchoScore(value: unknown): value is SavedEchoScore {
  if (!isRecord(value)) return false
  if (
    typeof value.id !== 'string' ||
    typeof value.characterId !== 'string' ||
    typeof value.echoId !== 'string' ||
    typeof value.sonataId !== 'string' ||
    typeof value.scoreProfile !== 'string' ||
    !ECHO_SCORE_PROFILES.has(value.scoreProfile as EchoScoreProfile) ||
    typeof value.mainStatId !== 'string' ||
    !ECHO_STAT_IDS.has(value.mainStatId as EchoStatId) ||
    !Array.isArray(value.substats) ||
    value.substats.length === 0 ||
    value.substats.length > 5 ||
    typeof value.score !== 'number' ||
    !Number.isFinite(value.score) ||
    value.score < 0 ||
    value.score > 1_000 ||
    typeof value.rank !== 'string' ||
    !ECHO_SCORE_RANKS.has(value.rank as EchoScoreRank) ||
    value.formulaVersion !== 'generic-v1' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return false
  }

  const statIds = new Set<string>()
  const substats: EchoScoreStat[] = []
  for (const stat of value.substats) {
    if (
      !isRecord(stat) ||
      typeof stat.id !== 'string' ||
      !ECHO_STAT_IDS.has(stat.id as EchoStatId) ||
      statIds.has(stat.id) ||
      typeof stat.value !== 'number' ||
      !Number.isFinite(stat.value) ||
      stat.value < 0 ||
      stat.value > 10_000
    ) {
      return false
    }
    statIds.add(stat.id)
    substats.push({ id: stat.id as EchoStatId, value: stat.value })
  }
  const expectedScore = calculateEchoScore(
    substats,
    value.scoreProfile as EchoScoreProfile,
  )
  return (
    value.score === expectedScore &&
    value.rank === getEchoScoreRank(expectedScore, 'generic-v1')
  )
}

function isEchoLoadoutSlot(value: unknown): value is EchoLoadoutSlot {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.position !== 'number' ||
    ![1, 2, 3, 4, 5].includes(value.position) ||
    typeof value.echoId !== 'string' ||
    typeof value.sonataId !== 'string' ||
    typeof value.mainStatId !== 'string' ||
    !ECHO_STAT_IDS.has(value.mainStatId as EchoStatId) ||
    !Array.isArray(value.substats) ||
    value.substats.length === 0 ||
    value.substats.length > 5 ||
    typeof value.score !== 'number' ||
    !Number.isFinite(value.score) ||
    value.score < 0 ||
    value.score > 1_000 ||
    typeof value.rank !== 'string' ||
    !ECHO_SCORE_RANKS.has(value.rank as EchoScoreRank)
  ) {
    return false
  }

  const statIds = new Set<string>()
  for (const stat of value.substats) {
    if (
      !isRecord(stat) ||
      typeof stat.id !== 'string' ||
      !ECHO_STAT_IDS.has(stat.id as EchoStatId) ||
      statIds.has(stat.id) ||
      typeof stat.value !== 'number' ||
      !Number.isFinite(stat.value) ||
      stat.value < 0 ||
      stat.value > 10_000
    ) {
      return false
    }
    statIds.add(stat.id)
  }

  return true
}

function isEchoLoadout(value: unknown): value is SavedEchoLoadout {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.characterId !== 'string' ||
    typeof value.scoreProfile !== 'string' ||
    !ECHO_SCORE_PROFILES.has(value.scoreProfile as EchoScoreProfile) ||
    !Array.isArray(value.slots) ||
    value.slots.length === 0 ||
    value.slots.length > 5 ||
    !value.slots.every(isEchoLoadoutSlot) ||
    typeof value.totalScore !== 'number' ||
    !Number.isFinite(value.totalScore) ||
    value.totalScore < 0 ||
    value.totalScore > 5_000 ||
    typeof value.formulaVersion !== 'string' ||
    !ECHO_SCORE_FORMULA_VERSIONS.has(
      value.formulaVersion as EchoScoreFormulaVersion,
    ) ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return false
  }

  const slotIds = new Set(value.slots.map((slot) => slot.id))
  const slotPositions = new Set(value.slots.map((slot) => slot.position))
  if (slotIds.size !== value.slots.length || slotPositions.size !== value.slots.length) return false
  const profile = value.scoreProfile as EchoScoreProfile
  const slotsAreConsistent =
    value.formulaVersion !== 'generic-v1' ||
    value.slots.every((slot) => {
      const expectedScore = calculateEchoScore(slot.substats, profile)
      return (
        slot.score === expectedScore &&
        slot.rank === getEchoScoreRank(expectedScore, 'generic-v1')
      )
    })
  return (
    slotsAreConsistent &&
    value.totalScore === calculateEchoLoadoutTotal(value.slots.map((slot) => slot.score))
  )
}

function isButtonMap(value: unknown): value is Record<string, string> | undefined {
  if (value === undefined) return true
  if (!isRecord(value)) return false
  const entries = Object.entries(value)
  return (
    entries.length <= MAX_BUTTON_MAP_ENTRIES &&
    entries.every(([, button]) => typeof button === 'string')
  )
}

function isAppData(value: unknown): value is AppData {
  if (!isRecord(value) || value.version !== 1) return false
  return (
    isOptionalTheme(value.theme) &&
    Array.isArray(value.characters) &&
    value.characters.length <= MAX_CHARACTERS &&
    value.characters.every(isCharacter) &&
    Array.isArray(value.parties) &&
    value.parties.length <= MAX_PARTIES &&
    value.parties.every(isParty) &&
    Array.isArray(value.combos) &&
    value.combos.length <= MAX_COMBOS &&
    value.combos.every(isCombo) &&
    (value.echoScores === undefined ||
      (Array.isArray(value.echoScores) &&
        value.echoScores.length <= MAX_ECHO_SCORES &&
        value.echoScores.every(isEchoScore))) &&
    (value.echoLoadouts === undefined ||
      (Array.isArray(value.echoLoadouts) &&
        value.echoLoadouts.length <= MAX_ECHO_LOADOUTS &&
        value.echoLoadouts.every(isEchoLoadout))) &&
    isButtonMap(value.buttonMap)
  )
}

function migrateEchoScores(data: AppData): AppData {
  const legacyRecords = data.echoScores ?? []
  if (legacyRecords.length === 0) {
    if (data.echoScores !== undefined || data.echoLoadouts === undefined) {
      return { ...data, echoLoadouts: data.echoLoadouts ?? [], echoScores: undefined }
    }
    return data
  }

  const existing = data.echoLoadouts ?? []
  const existingIds = new Set(existing.map((loadout) => loadout.id))
  const migrated: SavedEchoLoadout[] = legacyRecords
    .filter((record) => !existingIds.has(record.id))
    .map((record) => ({
      id: record.id,
      characterId: record.characterId,
      scoreProfile: record.scoreProfile,
      slots: [
        {
          id: `${record.id}-slot-1`,
          position: 1,
          echoId: record.echoId,
          sonataId: record.sonataId,
          mainStatId: record.mainStatId,
          substats: record.substats,
          score: record.score,
          rank: record.rank,
        },
      ],
      totalScore: record.score,
      formulaVersion: record.formulaVersion,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }))

  return {
    ...data,
    echoLoadouts: [...existing, ...migrated],
    echoScores: undefined,
  }
}

function migrateEchoScoringFormula(data: AppData): AppData {
  const records = data.echoLoadouts ?? []
  if (records.length === 0) return data

  const characterNames = new Map(
    data.characters.map((character) => [character.id, character.name]),
  )
  let changed = false
  const echoLoadouts = records.map((record) => {
    const characterName = characterNames.get(record.characterId)
    if (!characterName || !getCharacterEchoScoreWeights(characterName)) return record

    const slots = record.slots.map((slot) => {
      const score = calculateCharacterEchoScore(slot.substats, characterName).total
      return {
        ...slot,
        score,
        rank: getEchoScoreRank(score, ECHO_SCORE_FORMULA_VERSION),
      }
    })
    const totalScore = calculateEchoLoadoutTotal(slots.map((slot) => slot.score))
    if (
      record.formulaVersion !== ECHO_SCORE_FORMULA_VERSION ||
      record.totalScore !== totalScore ||
      slots.some(
        (slot, index) =>
          slot.score !== record.slots[index].score ||
          slot.rank !== record.slots[index].rank,
      )
    ) {
      changed = true
    }
    return {
      ...record,
      slots,
      totalScore,
      formulaVersion: ECHO_SCORE_FORMULA_VERSION,
    }
  })

  return changed ? { ...data, echoLoadouts } : data
}

function migrateButtonMap(buttonMap?: Record<string, string>): Record<string, string> {
  const current = buttonMap ?? {}
  return {
    ...current,
    通常攻撃: current.通常攻撃 ?? current.通常1 ?? DEFAULT_BUTTON_MAP.通常攻撃,
    共鳴スキル: current.共鳴スキル ?? current.スキル ?? DEFAULT_BUTTON_MAP.共鳴スキル,
    重撃: current.重撃 ?? DEFAULT_BUTTON_MAP.重撃,
    空中攻撃: current.空中攻撃 ?? current.空中 ?? DEFAULT_BUTTON_MAP.空中攻撃,
    共鳴解放: current.共鳴解放 ?? current.解放 ?? DEFAULT_BUTTON_MAP.共鳴解放,
    協和破壊: current.協和破壊 ?? DEFAULT_BUTTON_MAP.協和破壊,
    音骸: current.音骸 ?? DEFAULT_BUTTON_MAP.音骸,
    変奏: current.変奏 ?? DEFAULT_BUTTON_MAP.変奏,
    終奏: current.終奏 ?? DEFAULT_BUTTON_MAP.終奏,
    回避: current.回避 ?? DEFAULT_BUTTON_MAP.回避,
    ジャンプ: current.ジャンプ ?? DEFAULT_BUTTON_MAP.ジャンプ,
    落下攻撃: current.落下攻撃 ?? current.落下 ?? DEFAULT_BUTTON_MAP.落下攻撃,
  }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      // 公式キャラ一覧・基本技・ボタン対応表を保存済みデータに反映してから返す
      if (isAppData(parsed)) {
        return migrateEchoScoringFormula(
          migrateEchoScores(
            syncRoster({ ...parsed, buttonMap: migrateButtonMap(parsed.buttonMap) }),
          ),
        )
      }
    }
  } catch (e) {
    console.error('localStorage の読み込みに失敗しました', e)
  }
  return makeSeedData()
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    // プライベートブラウズや埋め込み環境では保存できないことがあるが、アプリは動かし続ける
    console.error('localStorage への保存に失敗しました', e)
  }
}

export function exportData(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `ww-combo-backup-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function parseImportedData(text: string): AppData {
  if (text.length > MAX_IMPORT_BYTES) {
    throw new Error('バックアップファイルは5MB以下にしてください')
  }
  const parsed: unknown = JSON.parse(text)
  if (!isAppData(parsed)) {
    throw new Error('バックアップファイルの形式が正しくありません')
  }
  return migrateEchoScoringFormula(
    migrateEchoScores(
      syncRoster({ ...parsed, buttonMap: migrateButtonMap(parsed.buttonMap) }),
    ),
  )
}
