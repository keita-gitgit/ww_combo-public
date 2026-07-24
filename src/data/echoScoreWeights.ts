import type { EchoCost, EchoStatId } from '../types'

export interface CharacterEchoScoreWeights {
  substats: Partial<Record<EchoStatId, number>>
  mainStats: Record<EchoCost, Partial<Record<EchoStatId, number>>>
}

/**
 * GameWith「音骸スコアチェッカー」のキャラ別評価係数。
 * 2026-07-24取得。アプリをオフラインで使えるよう静的データとして保持する。
 */
const BASE_CHARACTER_ECHO_SCORE_WEIGHTS = {
  "漂泊者（回折）": { substats: {"critRate":2,"critDamage":1,"resonanceLiberationDamage":0.5,"resonanceSkillDamage":1,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":0.5,"spectroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "鑑心": { substats: {"critRate":2,"critDamage":1,"heavyAttackDamage":0.5,"resonanceLiberationDamage":1,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1,"aeroDamage":1}, 3: {"attackPercent":0.5,"aeroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1,"aeroDamage":1} } },
  "凌陽": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":1,"resonanceSkillDamage":0.5,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":0.5,"glacioDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "カカロ": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.25,"resonanceLiberationDamage":0.75,"resonanceSkillDamage":0.25,"energyRegen":0.75,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":0.5,"electroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "忌炎": { substats: {"critRate":2,"critDamage":1,"heavyAttackDamage":1,"resonanceSkillDamage":0.25,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1,"aeroDamage":1}, 3: {"attackPercent":0.5,"aeroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1,"aeroDamage":1} } },
  "吟霖": { substats: {"critRate":1.75,"critDamage":1,"resonanceLiberationDamage":0.75,"resonanceSkillDamage":0.75,"energyRegen":0.75,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":0.5,"electroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "ヴェリーナ": { substats: {"critRate":1,"critDamage":0.5,"energyRegen":2.5,"attackPercent":2,"attack":0.2}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":0.5}, 4: {"attackPercent":0.5,"healingBonus":1} } },
  "アンコ": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.75,"resonanceSkillDamage":0.25,"energyRegen":1,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":0.5,"fusionDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "淵武": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":1,"resonanceSkillDamage":1,"defensePercent":1.25,"defense":0.05}, mainStats: { 1: {"defensePercent":1}, 3: {"defensePercent":0.5,"electroDamage":1}, 4: {"critRate":1,"critDamage":1,"defensePercent":0.1} } },
  "丹瑾": { substats: {"critRate":2,"critDamage":1,"heavyAttackDamage":1,"resonanceLiberationDamage":0.25,"resonanceSkillDamage":0.75,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":0.5,"havocDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "散華": { substats: {"critRate":2,"critDamage":1,"heavyAttackDamage":0.25,"resonanceLiberationDamage":0.5,"resonanceSkillDamage":0.75,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":0.5,"glacioDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "モルトフィー": { substats: {"critRate":2,"critDamage":1,"resonanceLiberationDamage":0.75,"energyRegen":1.25,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":0.5,"fusionDamage":0.5}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "桃祈": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.75,"resonanceLiberationDamage":0.75,"energyRegen":0.75,"defensePercent":1,"defense":0.05}, mainStats: { 1: {"defensePercent":1}, 3: {"energyRegen":1,"defensePercent":0.5,"havocDamage":1}, 4: {"critRate":1,"critDamage":1,"defensePercent":0.1} } },
  "アールト": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.75,"resonanceSkillDamage":0.75,"energyRegen":0.25,"attackPercent":1,"attack":0.05,"hpPercent":0.5}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":0.5,"aeroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "白芷": { substats: {"critRate":0.5,"critDamage":0.25,"energyRegen":2.25,"hpPercent":3,"hp":0.025}, mainStats: { 1: {"hpPercent":1}, 3: {"energyRegen":1,"hpPercent":1}, 4: {"hpPercent":0.5,"healingBonus":1} } },
  "秧秧": { substats: {"critRate":2,"critDamage":1,"heavyAttackDamage":0.25,"resonanceLiberationDamage":0.5,"resonanceSkillDamage":0.25,"energyRegen":1,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":0.5,"aeroDamage":0.5}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "熾霞": { substats: {"critRate":2,"critDamage":1,"resonanceLiberationDamage":0.75,"resonanceSkillDamage":1,"energyRegen":0.25,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":0.5,"fusionDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "漂泊者（消滅）": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.75,"resonanceLiberationDamage":0.75,"resonanceSkillDamage":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":0.5,"havocDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "今汐": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.25,"resonanceLiberationDamage":0.25,"resonanceSkillDamage":1,"energyRegen":0.25,"attackPercent":1.25,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":1,"spectroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "長離": { substats: {"critRate":2,"critDamage":1,"resonanceLiberationDamage":0.75,"resonanceSkillDamage":0.75,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":1,"fusionDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "折枝": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.75,"resonanceSkillDamage":0.5,"energyRegen":0.75,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":0.5,"glacioDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "相里要": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.25,"resonanceLiberationDamage":1,"resonanceSkillDamage":0.25,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":0.5,"electroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.1} } },
  "ショアキーパー": { substats: {"critRate":1,"critDamage":1.5,"resonanceLiberationDamage":0.75,"resonanceSkillDamage":0.25,"energyRegen":1.25,"hpPercent":1,"hp":0.025}, mainStats: { 1: {"hpPercent":1}, 3: {"energyRegen":1,"hpPercent":0.5}, 4: {"critDamage":1,"hpPercent":0.75,"healingBonus":0.75} } },
  "釉瑚": { substats: {"critRate":2,"critDamage":1,"resonanceSkillDamage":1,"energyRegen":1,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":0.5,"attackPercent":1,"glacioDamage":0.5}, 4: {"critRate":0.5,"critDamage":0.5,"attackPercent":0.5,"healingBonus":1} } },
  "ツバキ": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":1,"resonanceLiberationDamage":0.25,"energyRegen":0.25,"attackPercent":1.25,"attack":0.075}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":1,"havocDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1,"havocDamage":1} } },
  "灯灯": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":1,"resonanceLiberationDamage":0.25,"resonanceSkillDamage":0.25,"energyRegen":0.25,"attackPercent":1,"attack":0.075}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":1,"electroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "カルロッタ": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.25,"heavyAttackDamage":0.25,"resonanceSkillDamage":1,"energyRegen":0.25,"attackPercent":1.25,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":1,"glacioDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "ロココ": { substats: {"critRate":2,"critDamage":1,"heavyAttackDamage":1,"resonanceSkillDamage":0.25,"energyRegen":0.5,"attackPercent":1.25,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":1,"havocDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "フィービー": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.125,"heavyAttackDamage":0.75,"resonanceLiberationDamage":0.5,"resonanceSkillDamage":0.125,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":1,"spectroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "ブラント": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.75,"resonanceLiberationDamage":0.25,"energyRegen":1,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"fusionDamage":0.5,"spectroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "カンタレラ": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":1,"resonanceLiberationDamage":0.125,"resonanceSkillDamage":0.125,"energyRegen":0.75,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"havocDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "漂泊者（気動）": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.25,"resonanceLiberationDamage":0.25,"resonanceSkillDamage":1,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"aeroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "ザンニー": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.125,"heavyAttackDamage":0.75,"resonanceLiberationDamage":0.5,"resonanceSkillDamage":0.125,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":1,"spectroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "シャコンヌ": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.1,"heavyAttackDamage":0.75,"resonanceLiberationDamage":0.5,"resonanceSkillDamage":0.1,"energyRegen":0.55,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"aeroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "カルテジア": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.5,"heavyAttackDamage":0.25,"resonanceLiberationDamage":0.5,"resonanceSkillDamage":0.25,"energyRegen":0.5,"hpPercent":1.44,"hp":0.015}, mainStats: { 1: {"hpPercent":1}, 3: {"hpPercent":1,"aeroDamage":1}, 4: {"critRate":1,"critDamage":1,"hpPercent":1} } },
  "ルパ": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.1,"heavyAttackDamage":0.1,"resonanceLiberationDamage":0.75,"resonanceSkillDamage":0.5,"energyRegen":0.55,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"fusionDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "フローヴァ": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.25,"heavyAttackDamage":0.25,"resonanceSkillDamage":1.25,"attackPercent":1.25,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"havocDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "オーガスタ": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.25,"heavyAttackDamage":1,"resonanceSkillDamage":0.25,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"electroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "ユーノ": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.25,"resonanceLiberationDamage":1,"resonanceSkillDamage":0.25,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":0.5,"attackPercent":0.75,"aeroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":0.5} } },
  "ガルブレーナ": { substats: {"critRate":2,"critDamage":1,"heavyAttackDamage":1,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"fusionDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "仇遠": { substats: {"critRate":2,"critDamage":1,"heavyAttackDamage":1,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"aeroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "千咲": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":0.25,"heavyAttackDamage":0.25,"resonanceLiberationDamage":1,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":1,"havocDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "卜霊": { substats: {"critRate":0.75,"critDamage":0.5,"basicAttackDamage":0.25,"heavyAttackDamage":0.25,"resonanceLiberationDamage":0.25,"resonanceSkillDamage":0.25,"energyRegen":2,"attackPercent":1.5,"attack":0.2}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1,"healingBonus":1} } },
  "リンネー": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":1,"resonanceLiberationDamage":0.25,"resonanceSkillDamage":0.25,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"spectroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "モーニエ": { substats: {"critRate":0.5,"critDamage":0.6,"resonanceLiberationDamage":1.525,"energyRegen":2,"defensePercent":1.525,"defense":0.15}, mainStats: { 1: {"defensePercent":1}, 3: {"energyRegen":1,"fusionDamage":1}, 4: {"defensePercent":1,"healingBonus":1} } },
  "エイメス": { substats: {"critRate":2,"critDamage":1,"resonanceLiberationDamage":1,"energyRegen":1,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"fusionDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "リューク・ヘルセン": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":1.25,"energyRegen":0.5,"attackPercent":1.25,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"spectroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "シグリカ": { substats: {"critRate":2,"critDamage":1,"energyRegen":1,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"aeroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "緋雪": { substats: {"critRate":2,"critDamage":1,"resonanceLiberationDamage":1,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"glacioDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "ダーニャ": { substats: {"critRate":2,"critDamage":1,"resonanceLiberationDamage":1,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"fusionDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "レベッカ": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":1,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"electroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "ルーシー": { substats: {"critRate":2,"critDamage":1,"heavyAttackDamage":1,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"spectroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "ルシラー": { substats: {"critRate":2,"critDamage":1,"basicAttackDamage":1,"attackPercent":1.25,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":1,"glacioDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "秧秧・玄翎": { substats: {"critRate":2,"critDamage":1,"heavyAttackDamage":1,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"attackPercent":1,"havocDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
  "漂泊者（電導）": { substats: {"critRate":2,"critDamage":1,"resonanceLiberationDamage":0.5,"resonanceSkillDamage":1,"energyRegen":0.5,"attackPercent":1,"attack":0.05}, mainStats: { 1: {"attackPercent":1}, 3: {"energyRegen":1,"attackPercent":1,"electroDamage":1}, 4: {"critRate":1,"critDamage":1,"attackPercent":1} } },
} satisfies Readonly<Record<string, CharacterEchoScoreWeights>>

export type EchoActionDamageStatId =
  | 'basicAttackDamage'
  | 'heavyAttackDamage'
  | 'resonanceSkillDamage'
  | 'resonanceLiberationDamage'

export const ECHO_SCORE_FLAT_STAT_WEIGHT = 0.1
export const ECHO_SCORE_ACTION_DAMAGE_WEIGHT = 0.7

/**
 * キャラごとにスコアへ含める攻撃種別ダメージアップ。
 * GameWithのキャラ別評価で最も評価が高い1種類を採用し、同評価の場合は
 * 個別攻略ページのスキル優先度と主力攻撃区分で決定する。
 * 火力オプションを推奨していないサポーターはnullとする。
 */
export const CHARACTER_ECHO_SCORE_ACTION_DAMAGE_STAT = {
  '漂泊者（回折）': 'resonanceSkillDamage',
  鑑心: 'resonanceLiberationDamage',
  凌陽: 'basicAttackDamage',
  カカロ: 'resonanceLiberationDamage',
  忌炎: 'heavyAttackDamage',
  吟霖: 'resonanceSkillDamage',
  ヴェリーナ: null,
  アンコ: 'basicAttackDamage',
  淵武: 'resonanceSkillDamage',
  丹瑾: 'heavyAttackDamage',
  散華: 'resonanceSkillDamage',
  モルトフィー: 'resonanceLiberationDamage',
  桃祈: 'resonanceLiberationDamage',
  アールト: 'resonanceSkillDamage',
  白芷: null,
  秧秧: 'resonanceLiberationDamage',
  熾霞: 'resonanceSkillDamage',
  '漂泊者（消滅）': 'resonanceLiberationDamage',
  今汐: 'resonanceSkillDamage',
  長離: 'resonanceSkillDamage',
  折枝: 'basicAttackDamage',
  相里要: 'resonanceLiberationDamage',
  ショアキーパー: 'resonanceLiberationDamage',
  釉瑚: 'resonanceSkillDamage',
  ツバキ: 'basicAttackDamage',
  灯灯: 'basicAttackDamage',
  カルロッタ: 'resonanceSkillDamage',
  ロココ: 'heavyAttackDamage',
  フィービー: 'heavyAttackDamage',
  ブラント: 'basicAttackDamage',
  カンタレラ: 'basicAttackDamage',
  '漂泊者（気動）': 'resonanceSkillDamage',
  ザンニー: 'heavyAttackDamage',
  シャコンヌ: 'heavyAttackDamage',
  カルテジア: 'resonanceLiberationDamage',
  ルパ: 'resonanceLiberationDamage',
  フローヴァ: 'resonanceSkillDamage',
  オーガスタ: 'heavyAttackDamage',
  ユーノ: 'resonanceLiberationDamage',
  ガルブレーナ: 'heavyAttackDamage',
  仇遠: 'heavyAttackDamage',
  千咲: 'resonanceLiberationDamage',
  卜霊: null,
  リンネー: 'basicAttackDamage',
  モーニエ: 'resonanceLiberationDamage',
  エイメス: 'resonanceLiberationDamage',
  'リューク・ヘルセン': 'basicAttackDamage',
  シグリカ: null,
  緋雪: 'resonanceLiberationDamage',
  ダーニャ: 'resonanceLiberationDamage',
  レベッカ: 'basicAttackDamage',
  ルーシー: 'heavyAttackDamage',
  ルシラー: 'basicAttackDamage',
  '秧秧・玄翎': 'heavyAttackDamage',
  '漂泊者（電導）': 'resonanceSkillDamage',
} as const satisfies Readonly<
  Record<
    keyof typeof BASE_CHARACTER_ECHO_SCORE_WEIGHTS,
    EchoActionDamageStatId | null
  >
>

const ACTION_DAMAGE_STAT_IDS = new Set<EchoStatId>([
  'basicAttackDamage',
  'heavyAttackDamage',
  'resonanceSkillDamage',
  'resonanceLiberationDamage',
])
const FLAT_STAT_IDS = new Set<EchoStatId>(['attack', 'hp', 'defense'])
const EXCLUDED_SCORE_STAT_IDS = new Set<EchoStatId>(['energyRegen'])

function applyScoringPolicy(
  characterName: keyof typeof BASE_CHARACTER_ECHO_SCORE_WEIGHTS,
  source: CharacterEchoScoreWeights,
): CharacterEchoScoreWeights {
  const substats: Partial<Record<EchoStatId, number>> = {}
  for (const [statId, weight] of Object.entries(source.substats) as Array<
    [EchoStatId, number]
  >) {
    if (
      ACTION_DAMAGE_STAT_IDS.has(statId) ||
      EXCLUDED_SCORE_STAT_IDS.has(statId)
    ) {
      continue
    }
    substats[statId] = FLAT_STAT_IDS.has(statId)
      ? ECHO_SCORE_FLAT_STAT_WEIGHT
      : weight
  }

  const actionDamageStat = CHARACTER_ECHO_SCORE_ACTION_DAMAGE_STAT[characterName]
  if (actionDamageStat) {
    substats[actionDamageStat] = ECHO_SCORE_ACTION_DAMAGE_WEIGHT
  }

  const mainStats = Object.fromEntries(
    ([1, 3, 4] as const).map((cost) => [
      cost,
      Object.fromEntries(
        Object.entries(source.mainStats[cost]).filter(
          ([statId]) => !EXCLUDED_SCORE_STAT_IDS.has(statId as EchoStatId),
        ),
      ),
    ]),
  ) as CharacterEchoScoreWeights['mainStats']

  return {
    substats,
    mainStats,
  }
}

export const CHARACTER_ECHO_SCORE_WEIGHTS: Readonly<
  Record<string, CharacterEchoScoreWeights>
> = Object.fromEntries(
  Object.entries(BASE_CHARACTER_ECHO_SCORE_WEIGHTS).map(
    ([characterName, weights]) => [
      characterName,
      applyScoringPolicy(
        characterName as keyof typeof BASE_CHARACTER_ECHO_SCORE_WEIGHTS,
        weights,
      ),
    ],
  ),
)

export const ECHO_SCORE_WEIGHT_SOURCE = {
  title: 'GameWith 音骸スコアチェッカー',
  url: 'https://gamewith.jp/wutheringwaves/451843',
  retrievedAt: '2026-07-24',
} as const

export const ECHO_SCORE_ACTION_DAMAGE_TIE_BREAK_SOURCES = [
  'https://gamewith.jp/wutheringwaves/449659',
  'https://gamewith.jp/wutheringwaves/449655',
  'https://gamewith.jp/wutheringwaves/449652',
  'https://gamewith.jp/wutheringwaves/449650',
  'https://gamewith.jp/wutheringwaves/449644',
  'https://gamewith.jp/wutheringwaves/449647',
  'https://gamewith.jp/wutheringwaves/481518',
  'https://gamewith.jp/wutheringwaves/503941',
] as const

export const ECHO_SCORE_GLOBAL_EXCLUSIONS = [
  {
    statId: 'energyRegen',
    weight: 0,
    reason: '共鳴効率は全キャラの音骸スコアに含めないため',
    checkedAt: '2026-07-24',
  },
] as const
