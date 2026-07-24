import {
  ECHO_BY_ID,
  SONATA_BY_ID,
  SONATA_ICON_BY_ID,
} from './echoData'
import {
  formatEchoStatName,
  formatEchoStatValue,
  getEchoMainStatRule,
} from './echoScoring'
import type {
  Character,
  EchoLoadoutSlot,
  EchoStatId,
  SavedEchoLoadout,
} from './types'

const EXPORT_WIDTH = 1600
const EXPORT_HEIGHT = 1000
const FONT_FAMILY =
  '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif'

const ELEMENT_ACCENTS: Record<
  string,
  { main: string; soft: string; deep: string }
> = {
  焦熱: { main: '#f08a73', soft: '#6f302c', deep: '#251117' },
  凝縮: { main: '#8bc9e8', soft: '#28546d', deep: '#0c1d2a' },
  電導: { main: '#aaa0ff', soft: '#4d438b', deep: '#17152b' },
  気動: { main: '#77d6bd', soft: '#286858', deep: '#0d241f' },
  回折: { main: '#efd37a', soft: '#6f5b25', deep: '#28210f' },
  消滅: { main: '#d17ba8', soft: '#6d3151', deep: '#28101f' },
}
const DEFAULT_ACCENT = {
  main: '#d6a85f',
  soft: '#66502c',
  deep: '#211a10',
}
const STAT_ORDER: EchoStatId[] = [
  'critRate',
  'critDamage',
  'attackPercent',
  'attack',
  'hpPercent',
  'hp',
  'defensePercent',
  'defense',
  'basicAttackDamage',
  'heavyAttackDamage',
  'resonanceSkillDamage',
  'resonanceLiberationDamage',
  'energyRegen',
]

interface AggregatedStat {
  id: EchoStatId
  value: number
  count: number
}

function publicAssetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.href).href
}

function getCharacterImageId(character?: Character): string | undefined {
  return character?.image?.match(/^head_(\d+)\.png$/)?.[1]
}

function getCharacterHeadUrl(character?: Character): string | undefined {
  if (!character?.image) return undefined
  return (
    window.__CHAR_IMG__?.[character.image] ??
    publicAssetUrl(`chars/${character.image}`)
  )
}

function getCharacterArtUrl(character?: Character): string | undefined {
  const imageId = getCharacterImageId(character)
  return imageId ? publicAssetUrl(`character-art/art_${imageId}.png`) : undefined
}

async function loadImage(source?: string): Promise<HTMLImageElement | undefined> {
  if (!source) return undefined
  return new Promise((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(undefined)
    image.src = source
  })
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.arcTo(x + width, y, x + width, y + height, safeRadius)
  context.arcTo(x + width, y + height, x, y + height, safeRadius)
  context.arcTo(x, y + height, x, y, safeRadius)
  context.arcTo(x, y, x + width, y, safeRadius)
  context.closePath()
}

function drawPanel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke: string,
  radius = 24,
) {
  roundedRectPath(context, x, y, width, height, radius)
  context.fillStyle = fill
  context.fill()
  context.strokeStyle = stroke
  context.lineWidth = 1.5
  context.stroke()
}

function setFont(
  context: CanvasRenderingContext2D,
  size: number,
  weight: number | string = 400,
) {
  context.font = `${weight} ${size}px ${FONT_FAMILY}`
}

function drawFittedText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  minSize = 13,
  weight: number | string = 600,
) {
  let currentSize = size
  setFont(context, currentSize, weight)
  while (currentSize > minSize && context.measureText(value).width > maxWidth) {
    currentSize -= 1
    setFont(context, currentSize, weight)
  }
  if (context.measureText(value).width <= maxWidth) {
    context.fillText(value, x, y)
    return
  }
  let trimmed = value
  while (
    trimmed.length > 1 &&
    context.measureText(`${trimmed}…`).width > maxWidth
  ) {
    trimmed = trimmed.slice(0, -1)
  }
  context.fillText(`${trimmed}…`, x, y)
}

function drawImageContain(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(width / sourceWidth, height / sourceHeight)
  const targetWidth = sourceWidth * scale
  const targetHeight = sourceHeight * scale
  context.drawImage(
    image,
    x + (width - targetWidth) / 2,
    y + (height - targetHeight) / 2,
    targetWidth,
    targetHeight,
  )
}

function formatScore(score: number): string {
  const rounded = Math.round(score * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function aggregateSubstats(slots: readonly EchoLoadoutSlot[]): AggregatedStat[] {
  const totals = new Map<EchoStatId, AggregatedStat>()
  slots.forEach((slot) => {
    slot.substats.forEach((stat) => {
      const current = totals.get(stat.id) ?? {
        id: stat.id,
        value: 0,
        count: 0,
      }
      current.value = Math.round((current.value + stat.value) * 10) / 10
      current.count += 1
      totals.set(stat.id, current)
    })
  })
  return [...totals.values()].sort((left, right) => {
    const leftIndex = STAT_ORDER.indexOf(left.id)
    const rightIndex = STAT_ORDER.indexOf(right.id)
    if (leftIndex !== rightIndex) {
      return (
        (leftIndex === -1 ? STAT_ORDER.length : leftIndex) -
        (rightIndex === -1 ? STAT_ORDER.length : rightIndex)
      )
    }
    return formatEchoStatName(left.id).localeCompare(
      formatEchoStatName(right.id),
      'ja',
    )
  })
}

function getSlotMainStats(slot: EchoLoadoutSlot) {
  const echo = ECHO_BY_ID.get(slot.echoId)
  if (!echo) return []
  const rule = getEchoMainStatRule(echo.cost)
  const primary = rule.primaryStats.find((stat) => stat.id === slot.mainStatId)
  return [
    primary
      ? {
          id: primary.id,
          value: primary.valueAtFiveStarLevel25,
          primary: true,
        }
      : undefined,
    {
      id: rule.fixedStat.id,
      value: rule.fixedStat.valueAtFiveStarLevel25,
      primary: false,
    },
  ].filter(Boolean) as Array<{
    id: EchoStatId
    value: number
    primary: boolean
  }>
}

function drawBackground(
  context: CanvasRenderingContext2D,
  accent: { main: string; soft: string; deep: string },
) {
  const base = context.createLinearGradient(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT)
  base.addColorStop(0, '#070b13')
  base.addColorStop(0.5, '#0a111d')
  base.addColorStop(1, accent.deep)
  context.fillStyle = base
  context.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT)

  const glow = context.createRadialGradient(330, 150, 10, 330, 150, 620)
  glow.addColorStop(0, `${accent.soft}cc`)
  glow.addColorStop(0.5, `${accent.soft}33`)
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, 980, 760)

  context.save()
  context.strokeStyle = `${accent.main}20`
  context.lineWidth = 1
  for (let radius = 130; radius <= 610; radius += 80) {
    context.beginPath()
    context.arc(175, 180, radius, -0.45, Math.PI * 1.26)
    context.stroke()
  }
  for (let index = 0; index < 28; index += 1) {
    const x = (index * 197 + 63) % EXPORT_WIDTH
    const y = (index * 113 + 41) % EXPORT_HEIGHT
    const radius = index % 4 === 0 ? 2.4 : 1.2
    context.fillStyle = index % 3 === 0 ? `${accent.main}70` : '#dce8f044'
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()

  const topLine = context.createLinearGradient(55, 0, 870, 0)
  topLine.addColorStop(0, accent.main)
  topLine.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = topLine
  context.fillRect(55, 28, 820, 2)
}

function drawCharacterArtwork(
  context: CanvasRenderingContext2D,
  art: HTMLImageElement | undefined,
  head: HTMLImageElement | undefined,
  accent: { main: string; soft: string; deep: string },
) {
  const image = art ?? head
  if (!image) return
  context.save()
  context.globalAlpha = art ? 0.76 : 0.26
  context.shadowColor = `${accent.main}55`
  context.shadowBlur = 54
  drawImageContain(
    context,
    image,
    image.naturalWidth,
    image.naturalHeight,
    -10,
    -16,
    565,
    545,
  )
  context.restore()

  const fade = context.createLinearGradient(0, 105, 650, 105)
  fade.addColorStop(0, 'rgba(7, 11, 19, 0.03)')
  fade.addColorStop(0.72, 'rgba(7, 11, 19, 0.48)')
  fade.addColorStop(1, 'rgba(7, 11, 19, 1)')
  context.fillStyle = fade
  context.fillRect(0, 0, 700, 500)

  const lowerFade = context.createLinearGradient(0, 300, 0, 520)
  lowerFade.addColorStop(0, 'rgba(7, 11, 19, 0)')
  lowerFade.addColorStop(1, 'rgba(7, 11, 19, 1)')
  context.fillStyle = lowerFade
  context.fillRect(0, 280, 650, 260)
}

function drawPill(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  accent: string,
) {
  setFont(context, 18, 650)
  const width = context.measureText(value).width + 30
  drawPanel(
    context,
    x,
    y,
    width,
    40,
    'rgba(10, 18, 29, 0.72)',
    `${accent}72`,
    20,
  )
  context.fillStyle = '#edf3f6'
  context.textBaseline = 'middle'
  context.fillText(value, x + 15, y + 21)
  context.textBaseline = 'alphabetic'
  return width
}

function drawCharacterSummary(
  context: CanvasRenderingContext2D,
  record: SavedEchoLoadout,
  character: Character | undefined,
  accent: { main: string; soft: string; deep: string },
) {
  const startX = 485
  context.fillStyle = `${accent.main}dd`
  setFont(context, 17, 700)
  context.fillText('ECHO SCORE ARCHIVE', startX, 70)

  context.fillStyle = '#f5f7f8'
  drawFittedText(
    context,
    character?.name ?? '未登録のキャラ',
    startX,
    132,
    470,
    46,
    28,
    750,
  )

  let pillX = startX
  const rarity = character?.rarity ? `${'★'.repeat(character.rarity)}` : 'RARITY —'
  pillX += drawPill(context, rarity, pillX, 157, accent.main) + 10
  if (character?.element) {
    pillX += drawPill(context, character.element, pillX, 157, accent.main) + 10
  }
  if (character?.weapon) {
    drawPill(context, character.weapon, pillX, 157, accent.main)
  }

  context.fillStyle = '#9caab6'
  setFont(context, 16, 650)
  context.fillText('TOTAL SCORE', startX, 243)
  context.fillStyle = accent.main
  setFont(context, 88, 750)
  context.fillText(formatScore(record.totalScore), startX, 328)

  const cost = record.slots.reduce(
    (total, slot) => total + (ECHO_BY_ID.get(slot.echoId)?.cost ?? 0),
    0,
  )
  context.fillStyle = '#cbd5db'
  setFont(context, 19, 550)
  context.fillText(
    `${record.slots.length}/5 枠  ·  コスト ${cost}/12  ·  サブステータス採点`,
    startX,
    365,
  )

  const sonataCounts = new Map<string, Set<string>>()
  record.slots.forEach((slot) => {
    if (!slot.sonataId || !slot.echoId) return
    const ids = sonataCounts.get(slot.sonataId) ?? new Set<string>()
    ids.add(slot.echoId)
    sonataCounts.set(slot.sonataId, ids)
  })
  const sonataText = [...sonataCounts]
    .map(([sonataId, echoIds]) => {
      const name = SONATA_BY_ID.get(sonataId)?.name ?? sonataId
      return `${name} ×${echoIds.size}`
    })
    .join('  /  ')
  context.fillStyle = '#93a1ad'
  drawFittedText(
    context,
    sonataText || 'ハーモニー未設定',
    startX,
    413,
    495,
    18,
    14,
    500,
  )

  context.strokeStyle = `${accent.main}5c`
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(startX, 437)
  context.lineTo(960, 437)
  context.stroke()
}

function drawStatsPanel(
  context: CanvasRenderingContext2D,
  stats: readonly AggregatedStat[],
  accent: { main: string; soft: string; deep: string },
) {
  const x = 1010
  const y = 55
  const width = 535
  const height = 390
  drawPanel(
    context,
    x,
    y,
    width,
    height,
    'rgba(12, 20, 32, 0.82)',
    `${accent.main}4d`,
    27,
  )

  context.fillStyle = '#f0f3f5'
  setFont(context, 22, 700)
  context.fillText('サブステータス合計', x + 28, y + 43)
  context.fillStyle = accent.main
  setFont(context, 14, 700)
  context.textAlign = 'right'
  context.fillText(`${stats.length} TYPES`, x + width - 28, y + 40)
  context.textAlign = 'left'

  context.strokeStyle = 'rgba(255,255,255,0.09)'
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(x + 28, y + 61)
  context.lineTo(x + width - 28, y + 61)
  context.stroke()

  if (stats.length === 0) {
    context.fillStyle = '#7f8b96'
    setFont(context, 18, 500)
    context.fillText('入力済みステータスはありません', x + 28, y + 112)
    return
  }

  const columnCount = stats.length > 7 ? 2 : 1
  const rows = Math.ceil(stats.length / columnCount)
  const columnWidth = (width - 66) / columnCount
  const rowHeight = Math.min(38, 292 / Math.max(rows, 1))
  stats.forEach((stat, index) => {
    const column = Math.floor(index / rows)
    const row = index % rows
    const rowX = x + 28 + column * (columnWidth + 10)
    const rowY = y + 91 + row * rowHeight

    context.fillStyle = row % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent'
    context.fillRect(rowX - 5, rowY - 22, columnWidth, rowHeight)

    context.fillStyle = '#b8c2ca'
    drawFittedText(
      context,
      formatEchoStatName(stat.id),
      rowX,
      rowY,
      columnWidth - 94,
      16,
      12,
      500,
    )
    context.fillStyle = '#f3f5f6'
    context.textAlign = 'right'
    setFont(context, 17, 650)
    context.fillText(
      formatEchoStatValue(stat.id, stat.value),
      rowX + columnWidth - 37,
      rowY,
    )
    context.fillStyle = '#778491'
    setFont(context, 13, 600)
    context.fillText(`×${stat.count}`, rowX + columnWidth - 5, rowY)
    context.textAlign = 'left'
  })
}

function drawEchoCard(
  context: CanvasRenderingContext2D,
  slot: EchoLoadoutSlot | undefined,
  position: number,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: { main: string; soft: string; deep: string },
  sonataIcon?: HTMLImageElement,
) {
  drawPanel(
    context,
    x,
    y,
    width,
    height,
    'rgba(13, 21, 33, 0.9)',
    slot ? `${accent.main}72` : 'rgba(255,255,255,0.12)',
    22,
  )

  if (!slot) {
    context.fillStyle = '#697683'
    setFont(context, 16, 700)
    context.fillText(`ECHO ${position}`, x + 20, y + 32)
    context.fillStyle = '#87929c'
    setFont(context, 21, 600)
    context.textAlign = 'center'
    context.fillText('未設定', x + width / 2, y + height / 2)
    context.textAlign = 'left'
    return
  }

  const echo = ECHO_BY_ID.get(slot.echoId)
  const sonata = SONATA_BY_ID.get(slot.sonataId)
  const mainStats = getSlotMainStats(slot)

  context.fillStyle = `${accent.main}dd`
  setFont(context, 14, 750)
  context.fillText(`ECHO ${position}  ·  COST ${echo?.cost ?? '—'}`, x + 18, y + 28)

  context.fillStyle = '#f4f6f7'
  drawFittedText(
    context,
    echo?.name ?? '未登録の音骸',
    x + 18,
    y + 61,
    width - 36,
    23,
    15,
    700,
  )

  context.fillStyle = '#8895a0'
  setFont(context, 13, 600)
  context.fillText('HARMONY', x + 18, y + 89)
  if (sonataIcon) {
    context.save()
    context.globalAlpha = 0.9
    context.drawImage(sonataIcon, x + 18, y + 99, 28, 28)
    context.restore()
  }
  context.fillStyle = '#c5ced4'
  drawFittedText(
    context,
    sonata?.name ?? slot.sonataId ?? '未設定',
    x + (sonataIcon ? 54 : 18),
    y + 120,
    width - (sonataIcon ? 72 : 36),
    15,
    11,
    550,
  )

  context.strokeStyle = 'rgba(255,255,255,0.09)'
  context.beginPath()
  context.moveTo(x + 18, y + 139)
  context.lineTo(x + width - 18, y + 139)
  context.stroke()

  mainStats.forEach((stat, index) => {
    const rowY = y + 168 + index * 28
    context.fillStyle = stat.primary ? accent.main : '#95a1aa'
    drawFittedText(
      context,
      stat.primary ? formatEchoStatName(stat.id) : `固定 ${formatEchoStatName(stat.id)}`,
      x + 18,
      rowY,
      width - 108,
      15,
      11,
      stat.primary ? 650 : 500,
    )
    context.textAlign = 'right'
    setFont(context, 15, stat.primary ? 700 : 550)
    context.fillText(
      formatEchoStatValue(stat.id, stat.value),
      x + width - 18,
      rowY,
    )
    context.textAlign = 'left'
  })

  context.strokeStyle = 'rgba(255,255,255,0.08)'
  context.beginPath()
  context.moveTo(x + 18, y + 219)
  context.lineTo(x + width - 18, y + 219)
  context.stroke()

  slot.substats.slice(0, 5).forEach((stat, index) => {
    const rowY = y + 247 + index * 30
    context.fillStyle = '#aeb8c0'
    drawFittedText(
      context,
      formatEchoStatName(stat.id),
      x + 18,
      rowY,
      width - 108,
      15,
      11,
      500,
    )
    context.fillStyle = '#eef1f3'
    context.textAlign = 'right'
    setFont(context, 15, 650)
    context.fillText(
      formatEchoStatValue(stat.id, stat.value),
      x + width - 18,
      rowY,
    )
    context.textAlign = 'left'
  })

  const footerY = y + height - 63
  const footer = context.createLinearGradient(x, footerY, x + width, footerY)
  footer.addColorStop(0, `${accent.soft}77`)
  footer.addColorStop(1, 'rgba(13, 21, 33, 0)')
  context.fillStyle = footer
  context.fillRect(x + 1, footerY, width - 2, 62)
  context.fillStyle = accent.main
  setFont(context, 37, 750)
  context.fillText(slot.rank, x + 18, footerY + 43)
  context.fillStyle = '#f6f7f8'
  context.textAlign = 'right'
  setFont(context, 28, 700)
  context.fillText(formatScore(slot.score), x + width - 18, footerY + 42)
  context.textAlign = 'left'
}

function drawFooter(
  context: CanvasRenderingContext2D,
  accent: { main: string; soft: string; deep: string },
) {
  context.fillStyle = `${accent.main}aa`
  context.fillRect(55, EXPORT_HEIGHT - 43, 28, 2)
  context.fillStyle = '#788692'
  setFont(context, 14, 650)
  context.fillText(
    '鳴潮コンボノート  ·  ECHO SCORE',
    94,
    EXPORT_HEIGHT - 36,
  )
  context.textAlign = 'right'
  context.fillStyle = '#65727e'
  setFont(context, 13, 500)
  context.fillText(
    'サブステータスのみで採点',
    EXPORT_WIDTH - 55,
    EXPORT_HEIGHT - 36,
  )
  context.textAlign = 'left'
}

export function getEchoShareImageFileName(
  character: Character | undefined,
): string {
  const safeName = (character?.name ?? '音骸セット').replace(
    /[\\/:*?"<>|]/g,
    '_',
  )
  const date = new Date()
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('')
  return `鳴潮_音骸スコア_${safeName}_${stamp}.png`
}

export async function createEchoShareImage(
  record: SavedEchoLoadout,
  character?: Character,
): Promise<Blob> {
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = EXPORT_WIDTH
  canvas.height = EXPORT_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('画像を作成できませんでした')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  const accent =
    ELEMENT_ACCENTS[character?.element ?? ''] ?? DEFAULT_ACCENT
  const uniqueSonataIds = [...new Set(record.slots.map((slot) => slot.sonataId))]
  const [art, head, sonataImages] = await Promise.all([
    loadImage(getCharacterArtUrl(character)),
    loadImage(getCharacterHeadUrl(character)),
    Promise.all(
      uniqueSonataIds.map(async (sonataId) => {
        const icon = SONATA_ICON_BY_ID.get(sonataId)
        return [
          sonataId,
          await loadImage(icon ? publicAssetUrl(icon.iconPath) : undefined),
        ] as const
      }),
    ),
  ])
  const sonataImageById = new Map(sonataImages)

  drawBackground(context, accent)
  drawCharacterArtwork(context, art, head, accent)
  drawCharacterSummary(context, record, character, accent)
  drawStatsPanel(context, aggregateSubstats(record.slots), accent)

  const cardX = 55
  const cardY = 485
  const cardGap = 15
  const cardWidth = (EXPORT_WIDTH - cardX * 2 - cardGap * 4) / 5
  const cardHeight = 448
  const slotByPosition = new Map(
    record.slots.map((slot) => [slot.position, slot]),
  )
  for (let position = 1; position <= 5; position += 1) {
    const slot = slotByPosition.get(position as EchoLoadoutSlot['position'])
    drawEchoCard(
      context,
      slot,
      position,
      cardX + (position - 1) * (cardWidth + cardGap),
      cardY,
      cardWidth,
      cardHeight,
      accent,
      slot ? sonataImageById.get(slot.sonataId) : undefined,
    )
  }
  drawFooter(context, accent)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNGへの変換に失敗しました'))
    }, 'image/png')
  })
}

export function downloadEchoShareImage(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export async function shareEchoShareImage(
  blob: Blob,
  fileName: string,
  character?: Character,
): Promise<boolean> {
  if (!navigator.share) return false
  const file = new File([blob], fileName, { type: 'image/png' })
  if (navigator.canShare && !navigator.canShare({ files: [file] })) return false
  await navigator.share({
    files: [file],
    title: `${character?.name ?? 'キャラ'}の音骸スコア`,
  })
  return true
}
