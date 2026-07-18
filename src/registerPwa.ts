const UPDATE_INTERVAL_MS = 60 * 60 * 1000

/**
 * 本番ビルドだけService Workerを登録する。
 * 新版が有効になったときは1度だけ再読み込みし、表示中のアプリも自動更新する。
 */
export function registerPwa(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  let hasController = Boolean(navigator.serviceWorker.controller)
  let reloading = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hasController) {
      hasController = true
      return
    }
    if (reloading) return
    reloading = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.href)
    const serviceWorkerUrl = new URL('sw.js', baseUrl)

    navigator.serviceWorker
      .register(serviceWorkerUrl, {
        scope: baseUrl.pathname,
        updateViaCache: 'none',
      })
      .then((registration) => {
        const checkForUpdate = () => registration.update().catch(() => undefined)

        checkForUpdate()
        window.setInterval(checkForUpdate, UPDATE_INTERVAL_MS)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate()
        })
      })
      .catch((error) => {
        console.error('オフライン機能の初期化に失敗しました', error)
      })
  })
}
