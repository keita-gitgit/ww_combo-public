import { readFile, mkdir, writeFile } from 'node:fs/promises'

const master = JSON.parse(
  await readFile(new URL('../src/data/sonataIcons.json', import.meta.url), 'utf8'),
)
const outputDirectory = new URL('../public/sonatas/', import.meta.url)
const sourceBaseUrl = 'https://wuthering.gg/images/iconelement/'

await mkdir(outputDirectory, { recursive: true })

for (const entry of master.entries) {
  const response = await fetch(new URL(entry.sourceFileName, sourceBaseUrl))
  if (!response.ok) {
    throw new Error(`${entry.sonataId}: アイコン取得失敗（HTTP ${response.status}）`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (
    bytes.length < 24 ||
    bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
  ) {
    throw new Error(`${entry.sonataId}: 取得データがPNGではありません`)
  }
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (width < 50 || height < 50) {
    throw new Error(
      `${entry.sonataId}: アイコン解像度が不足しています（${width}x${height}）`,
    )
  }
  await writeFile(new URL(`${entry.sonataId}.png`, outputDirectory), bytes)
  console.log(`${entry.sonataId}: ${width}x${height}`)
}

console.log(`ハーモニーアイコン: ${master.entries.length}件を取得しました`)
