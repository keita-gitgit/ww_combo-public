export interface DecodedBrowserImage {
  source: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}

function readAsDataUrl(source: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('画像データを読み込めませんでした'))
      }
    }
    reader.onerror = () => reject(new Error('画像データを読み込めませんでした'))
    reader.readAsDataURL(source)
  })
}

function loadDataUrl(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('画像形式を認識できませんでした'))
    image.src = source
  })
}

/**
 * ユーザーが選択した画像をCSPで許可済みの方法だけでデコードする。
 * createImageBitmapが使えない端末ではdata URLへフォールバックする。
 */
export async function decodeImageBlob(source: Blob): Promise<DecodedBrowserImage> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(source)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      }
    } catch {
      // Safariの一部バージョン・画像形式では失敗するためdata URLを試す。
    }
  }

  const image = await loadDataUrl(await readAsDataUrl(source))
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => {},
  }
}
