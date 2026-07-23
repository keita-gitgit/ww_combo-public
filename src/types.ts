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
