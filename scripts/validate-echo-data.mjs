import { readFileSync } from 'node:fs'

const echoMaster = JSON.parse(readFileSync(new URL('../src/data/echoes.json', import.meta.url)))
const sonataMaster = JSON.parse(
  readFileSync(new URL('../src/data/sonataEffects.json', import.meta.url)),
)

const errors = []

function validateMetadata(label, master) {
  if (master.schemaVersion !== 1) errors.push(`${label}: schemaVersion が1ではありません`)
  if (!/^\d+\.\d+$/.test(master.gameVersion)) {
    errors.push(`${label}: gameVersion の形式が正しくありません`)
  }
  if (!Array.isArray(master.entries) || master.entries.length !== master.expectedEntryCount) {
    errors.push(
      `${label}: entries は ${master.expectedEntryCount} 件である必要があります（実際: ${master.entries?.length ?? 0}）`,
    )
  }
  if (
    !Array.isArray(master.sourceUrls) ||
    master.sourceUrls.some((url) => typeof url !== 'string' || !url.startsWith('https://'))
  ) {
    errors.push(`${label}: sourceUrls はHTTPS URLの配列である必要があります`)
  }
}

function findDuplicates(values) {
  const seen = new Set()
  return [...new Set(values.filter((value) => (seen.has(value) ? true : !seen.add(value))))]
}

validateMetadata('音骸', echoMaster)
validateMetadata('ハーモニー', sonataMaster)

const sonataIds = new Set(sonataMaster.entries.map((entry) => entry.id))
const echoIds = echoMaster.entries.map((entry) => entry.id)
const echoSourceIds = echoMaster.entries.map((entry) => entry.sourceId)
const echoNames = echoMaster.entries.map((entry) => entry.name)

for (const [label, values] of [
  ['音骸ID', echoIds],
  ['音骸調査元ID', echoSourceIds],
  ['音骸名', echoNames],
  ['ハーモニーID', sonataMaster.entries.map((entry) => entry.id)],
  ['ハーモニー名', sonataMaster.entries.map((entry) => entry.name)],
]) {
  const duplicates = findDuplicates(values)
  if (duplicates.length > 0) errors.push(`${label}が重複しています: ${duplicates.join(', ')}`)
}

const referencedSonataIds = new Set()
for (const echo of echoMaster.entries) {
  if (![1, 3, 4].includes(echo.cost)) errors.push(`${echo.id}: COSTが不正です`)
  if (!['standard', 'nightmare', 'resonant', 'resonant-nightmare'].includes(echo.variant)) {
    errors.push(`${echo.id}: variantが不正です`)
  }
  if (!Array.isArray(echo.sonataIds) || echo.sonataIds.length === 0) {
    errors.push(`${echo.id}: ハーモニーが未登録です`)
  }
  for (const sonataId of echo.sonataIds) {
    referencedSonataIds.add(sonataId)
    if (!sonataIds.has(sonataId)) errors.push(`${echo.id}: 未登録の${sonataId}を参照しています`)
  }
}

for (const sonata of sonataMaster.entries) {
  if (!referencedSonataIds.has(sonata.id)) {
    errors.push(`${sonata.id}: 対応する音骸がありません`)
  }
  if (!Array.isArray(sonata.effects) || sonata.effects.length === 0) {
    errors.push(`${sonata.id}: セット効果がありません`)
    continue
  }
  for (const effect of sonata.effects) {
    if (![1, 2, 3, 5].includes(effect.pieces) || !effect.description?.trim()) {
      errors.push(`${sonata.id}: セット効果の形式が正しくありません`)
    }
  }
}

if (echoMaster.gameVersion !== sonataMaster.gameVersion) {
  errors.push('音骸とハーモニーの対象ゲームバージョンが一致していません')
}

if (errors.length > 0) {
  console.error(`音骸マスターの検証に失敗しました:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

const costCounts = echoMaster.entries.reduce((counts, entry) => {
  const key = `COST${entry.cost}`
  counts[key] = (counts[key] ?? 0) + 1
  return counts
}, {})
console.log(
  `音骸マスター: ${echoMaster.entries.length}種 / ハーモニー: ${sonataMaster.entries.length}種 / ` +
    Object.entries(costCounts)
      .map(([cost, count]) => `${cost} ${count}種`)
      .join(' / '),
)
