import type { Character } from '../types'

interface Props {
  character?: Character
  size?: number
}

// 単一HTML版（Artifactプレビュー等）ではビルド時に画像がdata URIとして
// window.__CHAR_IMG__ に注入される。通常ビルドでは public/chars/ から読む。
declare global {
  interface Window {
    __CHAR_IMG__?: Record<string, string>
  }
}

function imageSrc(fileName: string): string {
  return window.__CHAR_IMG__?.[fileName] ?? `${import.meta.env.BASE_URL}chars/${fileName}`
}

export default function Avatar({ character, size = 36 }: Props) {
  if (!character?.image) {
    return (
      <span
        className="avatar avatar-fallback"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        {character?.name?.slice(0, 1) ?? '?'}
      </span>
    )
  }
  return (
    <img
      className={`avatar ${character.rarity === 5 ? 'r5' : 'r4'}`}
      src={imageSrc(character.image)}
      alt={character.name}
      width={size}
      height={size}
      loading="lazy"
    />
  )
}
