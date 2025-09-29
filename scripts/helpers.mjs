import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs/promises'

export const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

export const paths = {
  root: (...segments) => path.join(rootDir, ...segments),
  docs: (...segments) => path.join(rootDir, 'docs', ...segments),
  dist: (...segments) => path.join(rootDir, 'dist', ...segments),
  meta: () => path.join(rootDir, '.docs-build-meta.json'),
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch (error) {
    return false
  }
}

export async function readJson(jsonPath, fallback = null) {
  if (!(await pathExists(jsonPath))) {
    return fallback
  }

  const raw = await fs.readFile(jsonPath, 'utf8')
  return JSON.parse(raw)
}

export async function writeJson(jsonPath, data) {
  const json = `${JSON.stringify(data, null, 2)}\n`
  await fs.writeFile(jsonPath, json, 'utf8')
}

export function formatStamp(date = new Date()) {
  const pad = (value) => value.toString().padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}${month}${day}-${hours}${minutes}`
}

export function runCommand(command, args = [], options = {}) {
  const { cwd = rootDir, env = process.env, stdio = 'inherit' } = options

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio,
      shell: process.platform === 'win32',
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
      }
    })
  })
}

export function spawnCommand(command, args = [], options = {}) {
  const { cwd = rootDir, env = process.env, stdio = 'inherit' } = options

  return spawn(command, args, {
    cwd,
    env,
    stdio,
    shell: process.platform === 'win32',
  })
}

export async function ensureNoJekyll() {
  await ensureDir(paths.docs())
  const noJekyllPath = paths.docs('.nojekyll')
  await fs.writeFile(noJekyllPath, '', 'utf8')
}

export async function safeUnlink(targetPath) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true })
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

export const fsAsync = fs
