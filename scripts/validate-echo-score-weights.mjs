import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const result = await build({
  stdin: {
    contents: `
      export {
        CHARACTER_ECHO_SCORE_ACTION_DAMAGE_STAT,
        CHARACTER_ECHO_SCORE_WEIGHTS,
        ECHO_SCORE_ACTION_DAMAGE_WEIGHT,
        ECHO_SCORE_FLAT_STAT_WEIGHT,
      } from './src/data/echoScoreWeights.ts'
      export { calculateCharacterEchoScore } from './src/echoScoring.ts'
      export { ROSTER } from './src/characterData.ts'
    `,
    loader: 'ts',
    resolveDir: projectRoot,
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const bundledSource = result.outputFiles[0].text
const scoreData = await import(
  `data:text/javascript;base64,${Buffer.from(bundledSource).toString('base64')}`
)

const {
  CHARACTER_ECHO_SCORE_ACTION_DAMAGE_STAT: actionDamageByCharacter,
  CHARACTER_ECHO_SCORE_WEIGHTS: weightsByCharacter,
  ECHO_SCORE_ACTION_DAMAGE_WEIGHT: actionDamageWeight,
  ECHO_SCORE_FLAT_STAT_WEIGHT: flatStatWeight,
  calculateCharacterEchoScore,
  ROSTER: roster,
} = scoreData

const errors = []
const rosterNames = new Set(roster.map((character) => character.name))
const weightNames = new Set(Object.keys(weightsByCharacter))
const mappingNames = new Set(Object.keys(actionDamageByCharacter))
const actionDamageStatIds = new Set([
  'basicAttackDamage',
  'heavyAttackDamage',
  'resonanceSkillDamage',
  'resonanceLiberationDamage',
])
const flatStatIds = new Set(['attack', 'hp', 'defense'])

for (const name of rosterNames) {
  if (!weightNames.has(name)) errors.push(`${name}: キャラ別係数がありません`)
  if (!mappingNames.has(name)) errors.push(`${name}: ダメージアップ種別が未判定です`)
}
for (const name of weightNames) {
  if (!rosterNames.has(name)) errors.push(`${name}: キャラクターマスタに存在しません`)
}
for (const name of mappingNames) {
  if (!rosterNames.has(name)) errors.push(`${name}: ダメージアップ判定だけが存在します`)
}

for (const [characterName, weights] of Object.entries(weightsByCharacter)) {
  if ('energyRegen' in weights.substats) {
    errors.push(`${characterName}: 共鳴効率がサブステータス係数に含まれています`)
  }
  for (const [cost, mainStats] of Object.entries(weights.mainStats)) {
    if ('energyRegen' in mainStats) {
      errors.push(`${characterName}: COST${cost}のメインステータス係数に共鳴効率が含まれています`)
    }
  }

  const selectedActionDamage = actionDamageByCharacter[characterName]
  const scoredActionDamage = Object.entries(weights.substats).filter(([statId]) =>
    actionDamageStatIds.has(statId),
  )
  if (scoredActionDamage.length > 1) {
    errors.push(`${characterName}: ダメージアップが複数採点されています`)
  }
  if (selectedActionDamage === null && scoredActionDamage.length !== 0) {
    errors.push(`${characterName}: 対象なしですがダメージアップが採点されています`)
  }
  if (
    selectedActionDamage !== null &&
    (scoredActionDamage.length !== 1 ||
      scoredActionDamage[0][0] !== selectedActionDamage ||
      scoredActionDamage[0][1] !== actionDamageWeight)
  ) {
    errors.push(`${characterName}: 選択したダメージアップが×${actionDamageWeight}ではありません`)
  }

  const scoredFlatStats = Object.entries(weights.substats).filter(([statId]) =>
    flatStatIds.has(statId),
  )
  if (scoredFlatStats.length !== 1) {
    errors.push(`${characterName}: 参照する実数値ステータスは1種類である必要があります`)
  }
  for (const [statId, weight] of Object.entries(weights.substats)) {
    if (flatStatIds.has(statId) && weight !== flatStatWeight) {
      errors.push(`${characterName}: ${statId}の実数値係数が÷10ではありません`)
    }
  }
}

if (flatStatWeight !== 0.1) errors.push('実数値の係数は0.1である必要があります')
if (actionDamageWeight !== 0.7) {
  errors.push('ダメージアップの係数は0.7である必要があります')
}

const formulaCheck = calculateCharacterEchoScore(
  [
    { id: 'attack', value: 60 },
    { id: 'energyRegen', value: 12.4 },
    { id: 'resonanceSkillDamage', value: 10.1 },
    { id: 'resonanceLiberationDamage', value: 10.1 },
  ],
  '漂泊者（回折）',
)
const formulaContributions = Object.fromEntries(
  formulaCheck.contributions.map((contribution) => [
    contribution.id,
    contribution.score,
  ]),
)
if (formulaContributions.attack !== 6) {
  errors.push('攻撃力実数60が6点として計算されていません')
}
if (formulaContributions.energyRegen !== 0) {
  errors.push('共鳴効率が0点になっていません')
}
if (formulaContributions.resonanceSkillDamage !== 7.07) {
  errors.push('採用ダメージアップ10.1%が7.07点として計算されていません')
}
if (formulaContributions.resonanceLiberationDamage !== 0) {
  errors.push('非採用のダメージアップが0点になっていません')
}

if (errors.length > 0) {
  console.error(`音骸スコア係数の検証に失敗しました:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

const selectedCount = Object.values(actionDamageByCharacter).filter(Boolean).length
console.log(
  `音骸スコア係数: ${weightNames.size}キャラ / ダメージアップ ${selectedCount}キャラ` +
    `（対象なし ${weightNames.size - selectedCount}キャラ） / 実数値 ÷10 / 共鳴効率 0点`,
)
