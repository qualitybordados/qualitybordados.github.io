#!/usr/bin/env node
import { cleanDocs, publishDocs, verifyDocs, versionBust, release, devPublishWatch } from './tasks.mjs'

const [, , rawCommand, ...rawArgs] = process.argv

const command = rawCommand ?? ''

function parseOptions(args) {
  const flags = new Set(args)
  return {
    allowStale: flags.has('--allow-stale'),
  }
}

async function main() {
  try {
    switch (command) {
      case 'clean':
        await cleanDocs()
        break
      case 'publish-docs':
        await publishDocs()
        break
      case 'verify-docs': {
        const options = parseOptions(rawArgs)
        await verifyDocs(options)
        break
      }
      case 'version-bust':
        await versionBust()
        break
      case 'release':
        await release()
        break
      case 'dev-publish-watch':
        await devPublishWatch()
        break
      default:
        console.error(`Comando no reconocido: ${command}`)
        console.error('Usa uno de: clean, publish-docs, verify-docs, version-bust, release, dev-publish-watch')
        process.exitCode = 1
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

await main()
