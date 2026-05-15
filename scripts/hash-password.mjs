#!/usr/bin/env node
/**
 * Erzeugt denselben Hash wie src/lib/auth.ts → hashPassword (PBKDF2-SHA256).
 * Für lokales Zurücksetzen, wenn kein Admin eingeloggt ist:
 *
 *   node scripts/hash-password.mjs "NeuesPasswort123"
 *
 * Dann mit wrangler auf die lokale D1 anwenden (Beispiel siehe README oder Ausgabe unten).
 */

const SALT_LENGTH = 16
const ITERATIONS = 100_000
const KEY_LENGTH = 32

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    KEY_LENGTH * 8
  )
  const hash = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${ITERATIONS}:${saltHex}:${hash}`
}

const pwd = process.argv[2]
if (!pwd || pwd.length < 6) {
  console.error('Usage: node scripts/hash-password.mjs "<password-min-6-chars>"')
  process.exit(1)
}

const hash = await hashPassword(pwd)
console.log(hash)
console.error('')
console.error(
  'Beispiel (lokale D1, E-Mail anpassen):',
)
console.error(
  `pnpm exec wrangler d1 execute camping-db --local --command "UPDATE users SET password_hash = '${hash}', password_reset_token = NULL, password_reset_expires = NULL, must_change_password = 0, updated_at = datetime('now') WHERE lower(email) = 'ihre@email.de'"`,
)
