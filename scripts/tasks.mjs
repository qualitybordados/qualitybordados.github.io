import path from 'path'
import {
  fsAsync as fs,
  ensureDir,
  ensureNoJekyll,
  formatStamp,
  pathExists,
  paths,
  readJson,
  runCommand,
  safeUnlink,
  writeJson,
  rootDir,
  spawnCommand,
} from './helpers.mjs'

const SITE_URL = 'https://qualitybordados.github.io'
const MAIN_JS_REGEX = /^main\.[a-z0-9]+\.js$/i
const MAIN_SRC_REGEX = /src=["']\/?assets\/(main\.[A-Za-z0-9]+\.js)["']/
const CSS_REGEX = /^index\.[a-z0-9]+\.css$/i
const CSS_HREF_REGEX = /assets\/(index\.[A-Za-z0-9]+\.css)/

function stampToDate(stamp) {
  if (!stamp) {
    return null
  }

  const [datePart, timePart] = stamp.split('-')
  if (!datePart || !timePart) {
    return null
  }

  const year = Number(datePart.slice(0, 4))
  const month = Number(datePart.slice(4, 6)) - 1
  const day = Number(datePart.slice(6, 8))
  const hours = Number(timePart.slice(0, 2))
  const minutes = Number(timePart.slice(2, 4))

  if ([year, month, day, hours, minutes].some(Number.isNaN)) {
    return null
  }

  return new Date(year, month, day, hours, minutes)
}

function ensureFutureStamp(candidate, reference) {
  if (!reference) {
    return candidate
  }

  if (candidate > reference) {
    return candidate
  }

  const parsed = stampToDate(reference) ?? new Date()
  parsed.setMinutes(parsed.getMinutes() + 1)
  return formatStamp(parsed)
}

function logSuccess(prefix, mainFile, dataBuild) {
  const stampInfo = dataBuild ?? 'sin-data-build'
  console.log(`${prefix} main: ${mainFile} | ${SITE_URL} @ ${stampInfo}`)
}

export async function cleanDocs() {
  await safeUnlink(paths.docs())
  await ensureDir(paths.docs())
  await ensureNoJekyll()
  console.log('🧹 docs/ limpio y .nojekyll regenerado')
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\]/g, '\\$&')
}

async function rewriteCssReference(filePath, cssReference) {
  if (!(await pathExists(filePath))) {
    return
  }

  const html = await fs.readFile(filePath, 'utf8')
  const updatedHtml = html.replace(/assets\/main\.css/g, cssReference)
  if (updatedHtml !== html) {
    await fs.writeFile(filePath, updatedHtml, 'utf8')
  }
}

async function rewriteMainScriptReference(filePath, mainReference) {
  if (!(await pathExists(filePath))) {
    return
  }

  const html = await fs.readFile(filePath, 'utf8')
  const escapedMain = escapeRegExp(mainReference)
  const regex = new RegExp(`src=(["'])\\/?${escapedMain}`, 'g')
  const updatedHtml = html.replace(regex, `src=$1${mainReference}`)

  if (updatedHtml !== html) {
    await fs.writeFile(filePath, updatedHtml, 'utf8')
  }
}

export async function publishDocs() {
  const distPath = paths.dist()
  if (!(await pathExists(distPath))) {
    throw new Error('dist/ no existe. Ejecuta "npm run build" antes de publicar.')
  }

  const mainBundle = await getMainBundleFromDist()
  const cssBundle = await getCssBundleFromDist()
  const cssReference = `assets/${cssBundle}`
  const mainReference = `assets/${mainBundle}`

  await rewriteCssReference(paths.dist('index.html'), cssReference)
  await rewriteMainScriptReference(paths.dist('index.html'), mainReference)

  await safeUnlink(paths.docs())
  await ensureDir(paths.docs())
  await fs.cp(distPath, paths.docs(), { recursive: true })
  await ensureNoJekyll()
  await rewriteCssReference(paths.docs('index.html'), cssReference)
  await rewriteMainScriptReference(paths.docs('index.html'), mainReference)
  console.log('📤 docs/ sincronizado con dist/')
}

function getHtmlMatch(html, regex, notFoundMessage) {
  const match = html.match(regex)
  if (!match) {
    throw new Error(notFoundMessage)
  }
  return match[1]
}

async function readHtml(filePath) {
  return fs.readFile(filePath, 'utf8')
}

async function getMainBundleFromDist() {
  const assetsDir = paths.dist('assets')
  if (!(await pathExists(assetsDir))) {
    throw new Error('dist/assets no existe. Ejecuta "npm run build".')
  }

  const entries = await fs.readdir(assetsDir)
  const mainBundles = entries.filter((entry) => MAIN_JS_REGEX.test(entry))
  if (!mainBundles.length) {
    throw new Error('dist/assets/main.*.js no existe. Ejecuta "npm run build".')
  }

  return mainBundles.sort().pop()
}

async function getCssBundleFromDist() {
  const assetsDir = paths.dist('assets')
  const entries = await fs.readdir(assetsDir)
  const cssBundles = entries.filter((entry) => CSS_REGEX.test(entry))
  if (!cssBundles.length) {
    throw new Error('dist/assets/index.*.css no existe. Asegura que Vite genere CSS hashado.')
  }

  return cssBundles.sort().pop()
}

function extractDataBuild(html) {
  const match = html.match(/data-build=["']([^"']+)["']/)
  return match ? match[1] : null
}

async function assertDocsAssetExists(relativePath) {
  const assetPath = paths.docs(relativePath)
  if (!(await pathExists(assetPath))) {
    throw new Error(`docs/${relativePath} no existe. Ejecuta "npm run publish:docs".`)
  }
}

export async function verifyDocs(options = {}) {
  const { allowStale = false } = options

  const indexPath = paths.docs('index.html')
  if (!(await pathExists(indexPath))) {
    throw new Error('docs/index.html no existe. Ejecuta "npm run publish:docs".')
  }

  const noJekyllPath = paths.docs('.nojekyll')
  if (!(await pathExists(noJekyllPath))) {
    throw new Error('docs/.nojekyll no existe. Ejecuta "npm run clean".')
  }

  const mainBundle = await getMainBundleFromDist()
  const cssBundle = await getCssBundleFromDist()

  const html = await readHtml(indexPath)
  const referencedMain = getHtmlMatch(
    html,
    MAIN_SRC_REGEX,
    'docs/index.html no referencia assets/main.[hash].js. Ejecuta "npm run release" y commitea docs/.'
  )

  if (referencedMain !== mainBundle) {
    throw new Error(
      `docs/index.html referencia ${referencedMain}, pero dist/assets contiene ${mainBundle}. Ejecuta "npm run release" y commitea docs/.`
    )
  }

  const referencedCss = getHtmlMatch(
    html,
    CSS_HREF_REGEX,
    'docs/index.html no referencia assets/index.[hash].css. Ejecuta "npm run release" y commitea docs/.'
  )

  if (referencedCss !== cssBundle) {
    throw new Error(
      `docs/index.html referencia ${referencedCss}, pero dist/assets contiene ${cssBundle}. Ejecuta "npm run release" y commitea docs/.`
    )
  }

  await assertDocsAssetExists(path.join('assets', referencedMain))
  await assertDocsAssetExists(path.join('assets', referencedCss))

  const dataBuild = extractDataBuild(html)
  if (!allowStale) {
    if (!dataBuild) {
      throw new Error('docs/index.html no contiene data-build. Ejecuta "npm run version:bust".')
    }

    const meta = (await readJson(paths.meta())) ?? {}
    const { current: currentStamp, previous: previousStamp } = meta

    if (!currentStamp) {
      throw new Error('No se encontró .docs-build-meta.json. Ejecuta "npm run version:bust".')
    }

    if (dataBuild !== currentStamp) {
      throw new Error('El data-build de docs/index.html no coincide con .docs-build-meta.json.')
    }

    if (previousStamp && previousStamp === currentStamp) {
      throw new Error('El data-build no cambió respecto a la ejecución anterior.')
    }
  }

  logSuccess('✅ Verificación', referencedMain, dataBuild ?? '(pendiente)')
  console.log(`🌐 ${SITE_URL} @ ${dataBuild ?? 'pendiente'}`)

  return {
    mainJsFile: referencedMain,
    cssFile: referencedCss,
    dataBuild,
    indexPath,
  }
}

function applyDataBuild(html, stamp) {
  const htmlTagRegex = /<html([^>]*)>/i
  const match = html.match(htmlTagRegex)
  if (!match) {
    throw new Error('No se encontró la etiqueta <html> en docs/index.html.')
  }

  const attributes = match[1]
  const cleanedAttributes = attributes.replace(/\sdata-build=["'][^"']*["']/i, '')
  const spacing = cleanedAttributes.trim().length ? ` ${cleanedAttributes.trim()}` : ''
  return html.replace(htmlTagRegex, `<html${spacing} data-build="${stamp}">`)
}

async function updateServiceWorker(stamp) {
  const candidates = [
    'src/service-worker.ts',
    'src/service-worker.js',
    'src/serviceWorker.ts',
    'src/serviceWorker.js',
    'src/sw.ts',
    'src/sw.js',
    'public/service-worker.ts',
    'public/service-worker.js',
    'public/sw.ts',
    'public/sw.js',
  ]

  const updated = []

  for (const relative of candidates) {
    const absolute = paths.root(relative)
    if (!(await pathExists(absolute))) {
      continue
    }

    const content = await fs.readFile(absolute, 'utf8')
    if (!content.includes('APP_VERSION')) {
      continue
    }

    const replaced = content.replace(/APP_VERSION\s*=\s*(["'`])([^"'`]+)\1/g, (_full, quote) => {
      return `APP_VERSION = ${quote}${stamp}${quote}`
    })

    if (replaced !== content) {
      await fs.writeFile(absolute, replaced, 'utf8')
      updated.push(relative)
    }
  }

  return updated
}

export async function versionBust() {
  const indexPath = paths.docs('index.html')
  if (!(await pathExists(indexPath))) {
    throw new Error('docs/index.html no existe. Ejecuta "npm run publish:docs" antes de version:bust.')
  }

  const html = await readHtml(indexPath)
  const mainMatch = html.match(MAIN_SRC_REGEX)
  if (!mainMatch) {
    throw new Error('No se pudo determinar el bundle principal en docs/index.html para version:bust.')
  }

  const referencedMain = mainMatch[1]

  const meta = (await readJson(paths.meta())) ?? {}
  const stampCandidate = formatStamp()
  const stamp = ensureFutureStamp(stampCandidate, meta.current)

  const updatedHtml = applyDataBuild(html, stamp)
  await fs.writeFile(indexPath, updatedHtml, 'utf8')

  const updatedMeta = {
    previous: meta.current ?? meta.previous ?? null,
    current: stamp,
    main: referencedMain,
    updatedAt: new Date().toISOString(),
  }

  await writeJson(paths.meta(), updatedMeta)

  const serviceWorkers = await updateServiceWorker(stamp)

  console.log(`🏷️ data-build actualizado a ${stamp}`)
  if (serviceWorkers.length) {
    console.log(`⚙️  APP_VERSION actualizado en: ${serviceWorkers.join(', ')}`)
  }

  return {
    dataBuild: stamp,
    mainJsFile: referencedMain,
    serviceWorkers,
  }
}

export async function release() {
  console.log('🚀 Ejecutando pipeline release')
  await cleanDocs()
  await runCommand('npm', ['run', 'build'])
  await publishDocs()
  await verifyDocs({ allowStale: true })
  const bustInfo = await versionBust()
  const verification = await verifyDocs()

  console.log(`📁 docs/: ${path.relative(rootDir, paths.docs()) || 'docs'}`)
  console.log(`🧩 main bundle: ${verification.mainJsFile}`)
  console.log(`🏷️ data-build: ${verification.dataBuild}`)
  console.log(`🌐 ${SITE_URL} @ ${verification.dataBuild}`)

  return {
    ...verification,
    serviceWorkers: bustInfo.serviceWorkers,
  }
}

export async function devPublishWatch() {
  const chokidarModule = await import('chokidar')
  const chokidar = chokidarModule.watch ? chokidarModule : chokidarModule.default

  const dev = spawnCommand('npm', ['run', 'dev'], { stdio: 'inherit' })

  let running = false
  let queued = false
  let watcher

  async function syncDocs(reason) {
    if (running) {
      queued = true
      return
    }

    running = true
    console.log(`🔄 Re-sync docs/ (${reason})`)
    try {
      await runCommand('npm', ['run', 'build'])
      await publishDocs()
    } catch (error) {
      console.error('❌ Error al sincronizar docs/:', error.message)
    } finally {
      running = false
      if (queued) {
        queued = false
        await syncDocs('cambios adicionales')
      }
    }
  }

  await syncDocs('inicio')

  watcher = chokidar.watch(paths.root('src/**/*.{ts,tsx,js,jsx,css,scss,sass,less,pcss}'), {
    ignoreInitial: true,
  })

  watcher.on('all', (event, filePath) => {
    console.log(`👀 Cambio detectado (${event}): ${path.relative(rootDir, filePath)}`)
    void syncDocs('cambio en src/')
  })

  const shutdown = async (signal = 'SIGTERM') => {
    if (watcher) {
      await watcher.close()
    }
    if (!dev.killed) {
      dev.kill(signal)
    }
  }

  const handleSignal = (signal) => {
    shutdown(signal)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('❌ Error al cerrar procesos:', error)
        process.exit(1)
      })
  }

  process.on('SIGINT', () => handleSignal('SIGINT'))
  process.on('SIGTERM', () => handleSignal('SIGTERM'))

  await new Promise((resolve, reject) => {
    dev.on('exit', async (code) => {
      try {
        if (watcher) {
          await watcher.close()
        }
      } catch (error) {
        console.error('❌ Error al cerrar watcher:', error)
      }

      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`npm run dev finalizó con código ${code}`))
      }
    })

    dev.on('error', reject)
  })
}
