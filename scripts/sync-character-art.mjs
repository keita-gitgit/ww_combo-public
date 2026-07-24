import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

const normalizeName = (value) =>
  value
    .normalize('NFKC')
    .replace(/[・･·\s()[\]（）「」『』【】]/g, '')
    .replace(/漂泊者男性|漂泊者女性/g, '漂泊者')
    .toLocaleLowerCase('ja-JP')

const decodeHtml = (value) =>
  value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: { 'user-agent': 'ww-combo-character-art-sync/1.0' },
  })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.text()
}

const listHtml = await fetchText('https://wuthering.gg/ja/characters')
const slugs = [
  ...new Set(
    [...listHtml.matchAll(/href="\/ja\/characters\/([^"#?]+)"/g)].map(
      (match) => match[1],
    ),
  ),
]

const pages = []
for (let index = 0; index < slugs.length; index += 6) {
  const chunk = slugs.slice(index, index + 6)
  const results = await Promise.all(
    chunk.map(async (slug) => {
      const html = await fetchText(`https://wuthering.gg/ja/characters/${slug}`)
      const title =
        html.match(/<title>(.*?)\s+ビルドと情報/)?.[1] ??
        html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1] ??
        slug
      const artPath = html.match(
        /\/images\/iconrolepile\/([^"'?&]+\.png)/i,
      )?.[0]
      return {
        slug,
        name: decodeHtml(title.replace(/<[^>]+>/g, '')),
        artPath,
      }
    }),
  )
  pages.push(...results)
}

const pageByName = new Map(
  pages
    .filter((page) => page.artPath)
    .map((page) => [normalizeName(page.name), page]),
)
const slugOverrides = {
  '秧秧・玄翎': 'yangyang-xuanling',
  ルシラー: 'lucilla',
  ルーシー: 'lucy',
  レベッカ: 'rebecca',
  緋雪: 'hiyuki',
  シグリカ: 'sigrika',
  仇遠: 'qiuyuan',
  ショアキーパー: 'shorekeeper',
  釉瑚: 'youhu',
}
const outputDir = path.join(projectRoot, 'public/character-art')
await mkdir(outputDir, { recursive: true })

const downloadedIcons = new Set()
const missing = []
for (const character of roster) {
  if (downloadedIcons.has(character.icon)) continue
  let page = pageByName.get(normalizeName(character.name))
  const overrideSlug = slugOverrides[character.name]
  if (!page?.artPath && overrideSlug) {
    const html = await fetchText(`https://wuthering.gg/ja/characters/${overrideSlug}`)
    page = {
      slug: overrideSlug,
      name: character.name,
      artPath: html.match(/\/images\/iconrolepile\/([^"'?&]+\.png)/i)?.[0],
    }
  }
  if (!page?.artPath) {
    missing.push(character.name)
    continue
  }
  let response = await fetch(
    `https://wuthering.gg/_ipx/q_70&s_400x552${page.artPath}`,
    {
      headers: { 'user-agent': 'ww-combo-character-art-sync/1.0' },
    },
  )
  if (!response.ok) {
    response = await fetch(`https://wuthering.gg${page.artPath}`, {
      headers: { 'user-agent': 'ww-combo-character-art-sync/1.0' },
    })
  }
  if (!response.ok) {
    missing.push(character.name)
    continue
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('image/png')) {
    throw new Error(`${character.name}: PNGではありません (${contentType})`)
  }
  await writeFile(
    path.join(outputDir, `art_${character.icon}.png`),
    Buffer.from(await response.arrayBuffer()),
  )
  downloadedIcons.add(character.icon)
  console.log(`${character.name}: ${page.artPath}`)
}

if (missing.length > 0) {
  throw new Error(`立ち絵を取得できませんでした: ${missing.join('、')}`)
}

console.log(`キャラクター立ち絵: ${downloadedIcons.size}件`)
