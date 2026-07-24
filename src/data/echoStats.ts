import type { EchoMainStatRule, EchoStatDefinition, EchoStatId } from '../types'

const STANDARD_PERCENT_ROLLS = [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6]

export const ECHO_STAT_DEFINITIONS: readonly EchoStatDefinition[] = [
  {
    id: 'hp',
    name: 'HP',
    unit: 'flat',
    aliases: ['HP', 'HP実数', 'HP固定値'],
    substatValues: [320, 360, 390, 430, 470, 510, 540, 580],
  },
  {
    id: 'hpPercent',
    name: 'HP',
    unit: 'percent',
    aliases: ['HP', 'HP%', 'HP％'],
    substatValues: STANDARD_PERCENT_ROLLS,
  },
  {
    id: 'attack',
    name: '攻撃力',
    unit: 'flat',
    aliases: ['攻撃力', '攻撃力実数', '攻撃力固定値'],
    substatValues: [30, 40, 50, 60],
  },
  {
    id: 'attackPercent',
    name: '攻撃力',
    unit: 'percent',
    aliases: ['攻撃力', '攻撃力%', '攻撃力％'],
    substatValues: STANDARD_PERCENT_ROLLS,
  },
  {
    id: 'defense',
    name: '防御力',
    unit: 'flat',
    aliases: ['防御力', '防御力実数', '防御力固定値'],
    substatValues: [40, 50, 60, 70],
  },
  {
    id: 'defensePercent',
    name: '防御力',
    unit: 'percent',
    aliases: ['防御力', '防御力%', '防御力％'],
    substatValues: [8.1, 9.0, 10.0, 10.9, 11.8, 12.8, 13.8, 14.7],
  },
  {
    id: 'critRate',
    name: 'クリティカル率',
    unit: 'percent',
    aliases: ['クリティカル', 'クリティカル率', 'クリ率'],
    substatValues: [6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5],
  },
  {
    id: 'critDamage',
    name: 'クリティカルダメージ',
    unit: 'percent',
    aliases: ['クリティカルダメージ', 'クリダメ'],
    substatValues: [12.6, 13.8, 15.0, 16.2, 17.4, 18.6, 19.8, 21.0],
  },
  {
    id: 'healingBonus',
    name: 'HP回復効果アップ',
    unit: 'percent',
    aliases: ['HP回復効果アップ', '回復効果アップ', '回復効果'],
    substatValues: [],
  },
  {
    id: 'energyRegen',
    name: '共鳴効率',
    unit: 'percent',
    aliases: ['共鳴効率', 'エネルギー回復効率'],
    substatValues: [6.8, 7.6, 8.4, 9.2, 10.0, 10.8, 11.6, 12.4],
  },
  {
    id: 'glacioDamage',
    name: '凝縮ダメージアップ',
    unit: 'percent',
    aliases: ['凝縮ダメージアップ', '凝縮ダメージ'],
    substatValues: [],
  },
  {
    id: 'fusionDamage',
    name: '焦熱ダメージアップ',
    unit: 'percent',
    aliases: ['焦熱ダメージアップ', '焦熱ダメージ'],
    substatValues: [],
  },
  {
    id: 'electroDamage',
    name: '電導ダメージアップ',
    unit: 'percent',
    aliases: ['電導ダメージアップ', '電導ダメージ'],
    substatValues: [],
  },
  {
    id: 'aeroDamage',
    name: '気動ダメージアップ',
    unit: 'percent',
    aliases: ['気動ダメージアップ', '気動ダメージ'],
    substatValues: [],
  },
  {
    id: 'spectroDamage',
    name: '回折ダメージアップ',
    unit: 'percent',
    aliases: ['回折ダメージアップ', '回折ダメージ'],
    substatValues: [],
  },
  {
    id: 'havocDamage',
    name: '消滅ダメージアップ',
    unit: 'percent',
    aliases: ['消滅ダメージアップ', '消滅ダメージ'],
    substatValues: [],
  },
  {
    id: 'basicAttackDamage',
    name: '通常攻撃ダメージアップ',
    unit: 'percent',
    aliases: ['通常攻撃ダメージアップ', '通常攻撃ダメージ'],
    substatValues: STANDARD_PERCENT_ROLLS,
  },
  {
    id: 'heavyAttackDamage',
    name: '重撃ダメージアップ',
    unit: 'percent',
    aliases: ['重撃ダメージアップ', '重撃ダメージ'],
    substatValues: STANDARD_PERCENT_ROLLS,
  },
  {
    id: 'resonanceSkillDamage',
    name: '共鳴スキルダメージアップ',
    unit: 'percent',
    aliases: ['共鳴スキルダメージアップ', '共鳴スキルダメージ'],
    substatValues: STANDARD_PERCENT_ROLLS,
  },
  {
    id: 'resonanceLiberationDamage',
    name: '共鳴解放ダメージアップ',
    unit: 'percent',
    aliases: ['共鳴解放ダメージアップ', '共鳴解放ダメージ'],
    substatValues: STANDARD_PERCENT_ROLLS,
  },
]

export const ECHO_MAIN_STAT_RULES: readonly EchoMainStatRule[] = [
  {
    cost: 1,
    fixedStat: { id: 'hp', valueAtFiveStarLevel25: 2280 },
    primaryStats: [
      { id: 'hpPercent', valueAtFiveStarLevel25: 22.8 },
      { id: 'attackPercent', valueAtFiveStarLevel25: 18.0 },
      { id: 'defensePercent', valueAtFiveStarLevel25: 18.0 },
    ],
  },
  {
    cost: 3,
    fixedStat: { id: 'attack', valueAtFiveStarLevel25: 100 },
    primaryStats: [
      { id: 'hpPercent', valueAtFiveStarLevel25: 30.0 },
      { id: 'attackPercent', valueAtFiveStarLevel25: 30.0 },
      { id: 'defensePercent', valueAtFiveStarLevel25: 38.0 },
      { id: 'energyRegen', valueAtFiveStarLevel25: 32.0 },
      { id: 'glacioDamage', valueAtFiveStarLevel25: 30.0 },
      { id: 'fusionDamage', valueAtFiveStarLevel25: 30.0 },
      { id: 'electroDamage', valueAtFiveStarLevel25: 30.0 },
      { id: 'aeroDamage', valueAtFiveStarLevel25: 30.0 },
      { id: 'spectroDamage', valueAtFiveStarLevel25: 30.0 },
      { id: 'havocDamage', valueAtFiveStarLevel25: 30.0 },
    ],
  },
  {
    cost: 4,
    fixedStat: { id: 'attack', valueAtFiveStarLevel25: 150 },
    primaryStats: [
      { id: 'hpPercent', valueAtFiveStarLevel25: 33.0 },
      { id: 'attackPercent', valueAtFiveStarLevel25: 33.0 },
      { id: 'defensePercent', valueAtFiveStarLevel25: 41.5 },
      { id: 'critRate', valueAtFiveStarLevel25: 22.0 },
      { id: 'critDamage', valueAtFiveStarLevel25: 44.0 },
      { id: 'healingBonus', valueAtFiveStarLevel25: 26.4 },
    ],
  },
]

export const ECHO_STAT_BY_ID = new Map<EchoStatId, EchoStatDefinition>(
  ECHO_STAT_DEFINITIONS.map((stat) => [stat.id, stat]),
)

