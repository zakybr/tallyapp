import { safeStorage } from 'electron'
import type { Settings } from '@shared/domain'
import type { Repo } from './db/repo'

/*
  API keys are encrypted with the macOS keychain (safeStorage) before they
  touch SQLite, and the renderer only ever sees a masked value.
*/
const SECRET_KEYS = ['apiKey', 'placesApiKey'] as const
export const MASK_PREFIX = '••••'

function encrypt(v: string): string {
  if (!v) return ''
  if (!safeStorage.isEncryptionAvailable()) throw new Error('macOS keychain encryption is unavailable, so the key was not saved.')
  return 'enc:' + safeStorage.encryptString(v).toString('base64')
}

function decrypt(v: string): string {
  if (!v.startsWith('enc:')) return v
  try { return safeStorage.decryptString(Buffer.from(v.slice(4), 'base64')) } catch { return '' }
}

/* Settings with secrets decrypted. Main process only. */
export function realSettings(repo: Repo): Settings {
  const s = repo.getSettings()
  for (const k of SECRET_KEYS) s[k] = decrypt(s[k])
  return s
}

export function maskedSettings(repo: Repo): Settings {
  const s = realSettings(repo)
  for (const k of SECRET_KEYS) s[k] = s[k] ? `${MASK_PREFIX} ${s[k].slice(-4)}` : ''
  return s
}

export function saveSettingsSecure(repo: Repo, patch: Partial<Settings>): Settings {
  const next = { ...patch }
  for (const k of SECRET_KEYS) {
    if (k in next) {
      const v = (next[k] ?? '').trim()
      if (v.startsWith(MASK_PREFIX)) delete next[k]
      else next[k] = encrypt(v)
    }
  }
  repo.saveSettings(next)
  return maskedSettings(repo)
}
