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
  Party,
} from './types'
import { makeSeedData, syncRoster, DEFAULT_BUTTON_MAP } from './seed'

const STORAGE_KEY = 'ww_combo_data_v1'
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024

const MAX_CHARACTERS = 1_000
const MAX_ACTIONS_PER_CHARACTER = 1_000
const MAX_PARTIES = 2_000
const MAX_COMBOS = 5_000
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
    isButtonMap(value.buttonMap)
  )
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
        return syncRoster({ ...parsed, buttonMap: migrateButtonMap(parsed.buttonMap) })
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
  return syncRoster({ ...parsed, buttonMap: migrateButtonMap(parsed.buttonMap) })
}
