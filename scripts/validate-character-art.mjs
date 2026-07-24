import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const rosterSource = await readFile(
  path.join(projectRoot, 'src/characterData.ts'),
  'utf8',
)
const roster = [...rosterSource.matchAll(
  /\{\s*name:\s*'([^']+)'[\s\S]*?icon:\s*'(\d+)'\s*\}/g,
)].map((match) => ({ name: match[1], icon: match[2] }))
const uniqueByIcon = new Map(roster.map((character) => [character.icon, character]))
const missing = []

for (const [icon, character] of uniqueByIcon) {
  try {
    const filePath = path.join(
      projectRoot,
      `public/character-art/art_${icon}.png`,
    )
    await access(filePath)
    const image = await readFile(filePath)
    const isPng =
      image.length >= 24 &&
      image.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      )
    const width = isPng ? image.readUInt32BE(16) : 0
    const height = isPng ? image.readUInt32BE(20) : 0
    if (!isPng || width !== 400 || height !== 552) {
      missing.push(`${character.name}（画像形式不正）`)
    }
  } catch {
    missing.push(character.name)
  }
}

if (missing.length > 0) {
  console.error(`キャラクター立ち絵が不足しています: ${missing.join('、')}`)
  process.exit(1)
}

console.log(`キャラクター立ち絵: ${uniqueByIcon.size}件`)
