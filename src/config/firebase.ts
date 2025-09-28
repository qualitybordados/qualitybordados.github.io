import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

type FirebaseConfigKey =
  | 'apiKey'
  | 'authDomain'
  | 'projectId'
  | 'storageBucket'
  | 'messagingSenderId'
  | 'appId'

const REQUIRED_CONFIG_KEYS: FirebaseConfigKey[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
]

const RUNTIME_CONFIG_KEY = '__QB_FIREBASE_CONFIG__'

const runtimeConfig =
  typeof globalThis !== 'undefined' &&
  typeof (globalThis as Record<string, unknown>)[RUNTIME_CONFIG_KEY] === 'object'
    ? ((globalThis as Record<string, unknown>)[RUNTIME_CONFIG_KEY] as Partial<FirebaseOptions>)
    : undefined

const sanitizeValue = (value: unknown): string | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined
  }

  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') {
    return undefined
  }

  return trimmed
}

const resolveConfigValue = (key: FirebaseConfigKey): string | undefined => {
  const envKey = `VITE_FIREBASE_${key.replace(/[A-Z]/g, (segment) => `_${segment}`).toUpperCase()}` as keyof ImportMetaEnv
  const envValue = sanitizeValue(import.meta.env[envKey])
  if (envValue) {
    return envValue
  }

  const runtimeValue = runtimeConfig?.[key]
  return sanitizeValue(runtimeValue)
}

const resolvedConfig: Partial<FirebaseOptions> = REQUIRED_CONFIG_KEYS.reduce<Partial<FirebaseOptions>>(
  (config, key) => {
    const value = resolveConfigValue(key)
    if (value) {
      config[key] = value
    }
    return config
  },
  {},
)

const missingKeys = REQUIRED_CONFIG_KEYS.filter((key) => !resolvedConfig[key])

if (missingKeys.length > 0) {
  const formattedKeys = missingKeys.join(', ')
  throw new Error(
    `Missing Firebase configuration for: ${formattedKeys}. ` +
      'Provide the values via VITE_FIREBASE_* environment variables or by defining window.__QB_FIREBASE_CONFIG__ before the app loads.',
  )
}

const firebaseConfig = resolvedConfig as FirebaseOptions

const firebaseApp = initializeApp(firebaseConfig)

export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)

export default firebaseApp
