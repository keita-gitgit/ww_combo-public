// アクション種別。表示色やグルーピングに使う
export type ActionKind =
  | 'normal' // 通常攻撃・重撃
  | 'skill' // 共鳴スキル
  | 'liberation' // 共鳴解放
  | 'forte' // 共鳴回路系（強化通常・強化スキルなど）
  | 'echo' // 音骸スキル
  | 'concerto' // 変奏・終奏
  | 'move' // 回避・ジャンプ・落下など
  | 'special' // キャラ固有技

export type AppTheme = 'dark' | 'light' | 'cream'

export type ComboCardTone = '焦熱' | '凝縮' | '電導' | '気動' | '回折' | '消滅'

export type EchoCost = 1 | 3 | 4

export type EchoVariant = 'standard' | 'nightmare' | 'resonant' | 'resonant-nightmare'

export type EchoStatUnit = 'flat' | 'percent'

export type EchoScoreProfile = 'attack' | 'hp' | 'defense' | 'energy'

export type EchoScoreRank = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'

export type EchoScoreFormulaVersion =
  | 'generic-v1'
  | 'character-v2'
  | 'character-v3'
  | 'character-v4'

export type EchoStatId =
  | 'hp'
  | 'hpPercent'
  | 'attack'
  | 'attackPercent'
  | 'defense'
  | 'defensePercent'
  | 'critRate'
  | 'critDamage'
  | 'healingBonus'
  | 'energyRegen'
  | 'glacioDamage'
  | 'fusionDamage'
  | 'electroDamage'
  | 'aeroDamage'
  | 'spectroDamage'
  | 'havocDamage'
  | 'basicAttackDamage'
  | 'heavyAttackDamage'
  | 'resonanceSkillDamage'
  | 'resonanceLiberationDamage'

export interface EchoMasterEntry {
  id: string
  /** 調査元一覧で使用されている番号。照合用で、保存データの参照には id を使う */
  sourceId: number
  name: string
  cost: EchoCost
  sonataIds: string[]
  variant: EchoVariant
  /** 読み仮名付き表記など、OCR時に同一音骸として扱う名前 */
  aliases?: string[]
}

export interface SonataSetEffect {
  pieces: 1 | 2 | 3 | 5
  description: string
}

export interface SonataEffect {
  id: string
  name: string
  introducedIn: string
  effects: SonataSetEffect[]
}

export interface EchoStatDefinition {
  id: EchoStatId
  name: string
  unit: EchoStatUnit
  /** OCRで同一ステータスとして扱う画面表記 */
  aliases: string[]
  /** サブステータスに出現する値。空配列ならサブステータスには出現しない */
  substatValues: number[]
}

export interface EchoMainStatRule {
  cost: EchoCost
  fixedStat: {
    id: EchoStatId
    valueAtFiveStarLevel25: number
  }
  primaryStats: Array<{
    id: EchoStatId
    valueAtFiveStarLevel25: number
  }>
}

export interface EchoScoreStat {
  id: EchoStatId
  value: number
}

export interface SavedEchoScore {
  id: string
  characterId: string
  echoId: string
  sonataId: string
  scoreProfile: EchoScoreProfile
  mainStatId: EchoStatId
  substats: EchoScoreStat[]
  score: number
  rank: EchoScoreRank
  /** 計算式を変更しても元データを再計算できるよう、使用した式を記録する */
  formulaVersion: EchoScoreFormulaVersion
  createdAt: string
  updatedAt: string
}

export interface EchoLoadoutSlot {
  id: string
  position: 1 | 2 | 3 | 4 | 5
  echoId: string
  sonataId: string
  mainStatId: EchoStatId
  substats: EchoScoreStat[]
  score: number
  rank: EchoScoreRank
}

export interface SavedEchoLoadout {
  id: string
  characterId: string
  scoreProfile: EchoScoreProfile
  /** 入力済みの装備枠。新規保存は5枠、旧1音骸記録の移行直後のみ1〜4枠を許容する */
  slots: EchoLoadoutSlot[]
  /** 5枠それぞれのサブステータススコア合計 */
  totalScore: number
  formulaVersion: EchoScoreFormulaVersion
  createdAt: string
  updatedAt: string
}

export interface CharacterAction {
  id: string
  name: string
  kind: ActionKind
  /** 省略前の公式技名。ユーザーが付けた名前とは別に保持する */
  officialName?: string
  /** ボタン表記（例: "R2", "L2+□"）。空なら非表示 */
  button?: string
}

export interface Character {
  id: string
  name: string
  element?: string
  weapon?: string
  rarity?: 4 | 5
  /** public/chars/ 内のアイコンファイル名（例: "head_41.png"） */
  image?: string
  actions: CharacterAction[]
}

export interface Party {
  id: string
  name: string
  /** メンバーのキャラID（最大3人） */
  memberIds: string[]
}

// コンボ内の1つの技
export interface ComboAction {
  id: string
  /** キャラのアクションID */
  actionId: string
  /** @deprecated 旧データ互換のため残置。UIからは設定できない */
  natural?: boolean
  /** @deprecated 旧データ互換のため残置。UIからは設定できない */
  simultaneous?: boolean
  /** ボタン表記の上書き */
  button?: string
  /** この技のポイント（注意書き） */
  note?: string
}

// コンボの1行 = 「キャラ名: 技 / 技 / 技」
export interface ComboStep {
  id: string
  characterId: string
  actions: ComboAction[]
  /** 行の注意書き（※〜） */
  note?: string
}

export interface Combo {
  id: string
  partyId: string
  title: string
  /** 一覧で絞り込むためのお気に入り */
  favorite?: boolean
  /** 一覧カードへ付ける属性色 */
  cardTone?: ComboCardTone
  /** 技名・コマンド閲覧画面の表示倍率（0.6〜1.2） */
  commandScale?: number
  /** 2ローテ目以降の開始行。未設定なら先頭から全体を繰り返す */
  repeatFromStepId?: string
  memo?: string
  /** 参考にした動画・投稿のURL（最大20件） */
  referenceUrls?: string[]
  steps: ComboStep[]
  updatedAt: string
}

export interface AppData {
  version: 1
  /** 端末で使用する配色 */
  theme?: AppTheme
  characters: Character[]
  parties: Party[]
  combos: Combo[]
  /** キャラごとの5枠音骸セット。画像は保存せず、入力値だけを保持する */
  echoLoadouts?: SavedEchoLoadout[]
  /** @deprecated 旧版の音骸1個単位の記録。読み込み時に echoLoadouts へ移行する */
  echoScores?: SavedEchoScore[]
  /** 技名 → PS5ボタン表記の対応表（設定画面で編集可能） */
  buttonMap?: Record<string, string>
}

export const ACTION_KIND_LABELS: Record<ActionKind, string> = {
  normal: '通常',
  skill: 'スキル',
  liberation: '解放',
  forte: '強化',
  echo: '音骸',
  concerto: '変奏/終奏',
  move: '移動',
  special: '固有',
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
