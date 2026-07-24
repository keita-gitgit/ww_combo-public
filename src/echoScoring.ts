import { ECHO_MAIN_STAT_RULES, ECHO_STAT_BY_ID, ECHO_STAT_DEFINITIONS } from './data/echoStats'
import type {
  EchoCost,
  EchoMainStatRule,
  EchoScoreProfile,
  EchoScoreRank,
  EchoScoreStat,
  EchoStatDefinition,
  EchoStatId,
} from './types'

export const ECHO_SCORE_FORMULA_VERSION = 'generic-v1' as const

export const ECHO_SCORE_PROFILES: ReadonlyArray<{
  id: EchoScoreProfile
  label: string
  statId: EchoStatId
}> = [
  { id: 'attack', label: '攻撃', statId: 'attackPercent' },
  { id: 'hp', label: 'HP', statId: 'hpPercent' },
  { id: 'defense', label: '防御', statId: 'defensePercent' },
  { id: 'energy', label: '共鳴効率', statId: 'energyRegen' },
]

export const ECHO_SUBSTAT_DEFINITIONS: readonly EchoStatDefinition[] =
  ECHO_STAT_DEFINITIONS.filter((stat) => stat.substatValues.length > 0)

export function getEchoMainStatRule(cost: EchoCost): EchoMainStatRule {
  const rule = ECHO_MAIN_STAT_RULES.find((candidate) => candidate.cost === cost)
  if (!rule) throw new Error(`COST${cost}のメインステータス設定がありません`)
  return rule
}

export function formatEchoStatName(id: EchoStatId): string {
  const stat = ECHO_STAT_BY_ID.get(id)
  if (!stat) return id
  if (stat.unit === 'percent' && ['hpPercent', 'attackPercent', 'defensePercent'].includes(id)) {
    return `${stat.name}%`
  }
  return stat.name
}

export function formatEchoStatValue(id: EchoStatId, value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${
    ECHO_STAT_BY_ID.get(id)?.unit === 'percent' ? '%' : ''
  }`
}

export function calculateEchoScore(
  substats: readonly EchoScoreStat[],
  profile: EchoScoreProfile,
): number {
  const values = new Map(substats.map((stat) => [stat.id, stat.value]))
  const profileStatId =
    ECHO_SCORE_PROFILES.find((candidate) => candidate.id === profile)?.statId ??
    'attackPercent'
  const score =
    (values.get('critRate') ?? 0) * 2 +
    (values.get('critDamage') ?? 0) +
    (values.get(profileStatId) ?? 0)
  return Math.round(score * 10) / 10
}

export function getEchoScoreRank(score: number): EchoScoreRank {
  if (score >= 48) return 'SS'
  if (score >= 42) return 'S'
  if (score >= 36) return 'A'
  if (score >= 28) return 'B'
  if (score >= 20) return 'C'
  return 'D'
}

export function calculateEchoLoadoutTotal(scores: readonly number[]): number {
  return Math.round(scores.reduce((total, score) => total + score, 0) * 10) / 10
}
