import 'server-only'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'

export const COOKIE = 'creator_session'
export const SESSION_TTL = 60 * 60 * 24 * 7 // 7 days

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET
  if (!s || s.length < 16) throw new Error('ADMIN_SESSION_SECRET must be set (16+ characters)')
  return s
}

function sign(value: string) {
  return crypto.createHmac('sha256', secret()).update(value).digest('hex')
}

/** Cookie value: "<expiryUnixSeconds>.<hmac>" */
export function createSessionValue() {
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_TTL)
  return `${exp}.${sign(exp)}`
}

export function verifySessionValue(value?: string | null) {
  if (!value) return false
  const [exp, sig] = value.split('.')
  if (!exp || !sig) return false
  const expNum = Number(exp)
  if (!Number.isFinite(expNum) || expNum < Date.now() / 1000) return false
  const a = Buffer.from(sig)
  const b = Buffer.from(sign(exp))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function isAdmin() {
  const store = await cookies()
  return verifySessionValue(store.get(COOKIE)?.value)
}

/** Constant-time password comparison. */
export function checkPassword(input: string) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  const h = (s: string) => crypto.createHash('sha256').update(s).digest()
  return crypto.timingSafeEqual(h(input), h(expected))
}
