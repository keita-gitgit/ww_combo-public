import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'

const distDirectory = new URL('../dist/', import.meta.url)
const templatePath = new URL('./sw-template.js', import.meta.url)

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const relativePath = `${prefix}${entry.name}`
    if (entry.isDirectory()) {
      files.push(...(await listFiles(new URL(`${entry.name}/`, directory), `${relativePath}/`)))
    } else if (relativePath !== 'sw.js') {
      files.push(relativePath)
    }
  }

  return files.sort()
}

const files = await listFiles(distDirectory)
const hash = createHash('sha256')

for (const file of files) {
  hash.update(file)
  hash.update(await readFile(new URL(file, distDirectory)))
}

const cacheName = `ww-combo-${hash.digest('hex').slice(0, 12)}`
const precacheUrls = ['./', ...files.map((file) => `./${file}`)]
const template = await readFile(templatePath, 'utf8')
const serviceWorker = template
  .replace('__CACHE_NAME__', cacheName)
  .replace('__PRECACHE_URLS__', JSON.stringify(precacheUrls, null, 2))

await writeFile(new URL('sw.js', distDirectory), serviceWorker)
console.log(`PWA cache: ${cacheName} (${precacheUrls.length} files)`)
