// ── Types ──────────────────────────────────────────────

export interface UserRow {
  id: string
  email: string
  password_hash: string
  role: 'admin' | 'user'
  disabled: number
  created_at: string
}

export interface JwtPayload {
  sub: string       // user ID
  role: 'admin' | 'user'
  iat: number       // issued at (epoch seconds)
  exp: number       // expires at (epoch seconds)
}

// ── Crypto Utilities ──────────────────────────────────

const ENCODER = new TextEncoder()
const DECODER = new TextDecoder()

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function bytesToBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const binary = atob(s)
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)))
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytesToArrayBuffer(data)))
}

// ── Password Hashing (PBKDF2) ─────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', ENCODER.encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: bytesToArrayBuffer(salt), iterations: 100_000, hash: 'SHA-256' },
    key, 256
  )
  // Format: base64url(salt):base64url(hash)
  return `${bytesToBase64url(salt)}:${bytesToBase64url(new Uint8Array(hash))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':')
  const salt = base64urlToBytes(saltB64)
  const key = await crypto.subtle.importKey('raw', ENCODER.encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: bytesToArrayBuffer(salt), iterations: 100_000, hash: 'SHA-256' },
    key, 256
  )
  return bytesToBase64url(new Uint8Array(hash)) === hashB64
}

// ── JWT (HMAC-SHA256) ─────────────────────────────────

async function getJwtSecret(kv: KVNamespace): Promise<string> {
  let secret = await kv.get('jwt_secret')
  if (!secret) {
    const key = await crypto.subtle.generateKey(
      { name: 'HMAC', hash: 'SHA-256' }, true, ['sign', 'verify']
    ) as CryptoKey
    const raw = await crypto.subtle.exportKey('raw', key) as ArrayBuffer
    secret = bytesToBase64url(new Uint8Array(raw))
    await kv.put('jwt_secret', secret)
  }
  return secret
}

export async function signToken(kv: KVNamespace, payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const full: JwtPayload = { ...payload, iat: now, exp: now + 14 * 86400 }
  const header = bytesToBase64url(ENCODER.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = bytesToBase64url(ENCODER.encode(JSON.stringify(full)))
  const signingInput = ENCODER.encode(`${header}.${body}`)

  const secret = await getJwtSecret(kv)
  const key = await crypto.subtle.importKey('raw', bytesToArrayBuffer(base64urlToBytes(secret)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, bytesToArrayBuffer(signingInput))

  return `${header}.${body}.${bytesToBase64url(new Uint8Array(sig))}`
}

export async function verifyToken(kv: KVNamespace, token: string): Promise<JwtPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, body, sig] = parts
  const signingInput = ENCODER.encode(`${header}.${body}`)

  const secret = await getJwtSecret(kv)
  const key = await crypto.subtle.importKey('raw', bytesToArrayBuffer(base64urlToBytes(secret)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const sigBytes = base64urlToBytes(sig)
  const valid = await crypto.subtle.verify('HMAC', key, bytesToArrayBuffer(sigBytes), bytesToArrayBuffer(signingInput))
  if (!valid) return null

  const payload = JSON.parse(DECODER.decode(base64urlToBytes(body))) as JwtPayload
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

// ── Extract Bearer Token ──────────────────────────────

export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

function extractCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('Cookie')
  if (!cookie) return null

  for (const part of cookie.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (rawName === name) return decodeURIComponent(rawValue.join('='))
  }
  return null
}

// ── Auth Middleware ───────────────────────────────────


function extractQueryToken(request: Request): string | null {
  try {
    const url = new URL(request.url)
    return url.searchParams.get('token')
  } catch {
    return null
  }
}

export async function requireAuth(kv: KVNamespace, request: Request): Promise<JwtPayload | null> {
  const token = extractBearerToken(request) || extractCookie(request, 'yestion_token') || extractQueryToken(request)
  if (!token) return null
  return verifyToken(kv, token)
}

export async function requireAdmin(kv: KVNamespace, request: Request): Promise<JwtPayload | null> {
  const payload = await requireAuth(kv, request)
  if (!payload || payload.role !== 'admin') return null
  return payload
}

// ── User Operations ───────────────────────────────────

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase()).first<UserRow>()
}

export async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()
}

export async function listUsers(db: D1Database): Promise<UserRow[]> {
  const result = await db.prepare(
    'SELECT id, email, role, disabled, created_at FROM users ORDER BY created_at DESC'
  ).all<UserRow>()
  return result.results || []
}

export async function createUser(
  db: D1Database, email: string, password: string, role: 'admin' | 'user' = 'user'
): Promise<UserRow> {
  const id = 'usr_' + crypto.randomUUID().slice(0, 8)
  const hash = await hashPassword(password)
  const normalizedEmail = email.toLowerCase()
  await db.prepare(
    'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).bind(id, normalizedEmail, hash, role).run()
  return (await getUserById(db, id))!
}

// ── Invite Code Operations ────────────────────────────

export async function generateInviteCode(
  db: D1Database, createdBy: string, remainingUses: number = 1, expiresAt?: string
): Promise<string> {
  const code = 'inv_' + crypto.randomUUID()
  await db.prepare(
    'INSERT INTO invite_codes (code, created_by, remaining_uses, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(code, createdBy, remainingUses, expiresAt || null).run()
  return code
}

export async function consumeInviteCode(db: D1Database, code: string): Promise<boolean> {
  const row = await db.prepare(
    'SELECT * FROM invite_codes WHERE code = ?'
  ).bind(code).first<{ code: string; remaining_uses: number; expires_at: string | null }>()

  if (!row) return false
  if (row.remaining_uses <= 0) return false
  if (row.expires_at && new Date(row.expires_at) < new Date()) return false

  if (row.remaining_uses === 1) {
    await db.prepare('DELETE FROM invite_codes WHERE code = ?').bind(code).run()
  } else {
    await db.prepare(
      'UPDATE invite_codes SET remaining_uses = remaining_uses - 1 WHERE code = ?'
    ).bind(code).run()
  }
  return true
}

// ── Admin Seed (first deploy) ─────────────────────────

export async function seedAdminIfNeeded(db: D1Database, env: any): Promise<void> {
  const count = await db.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>()
  if (count && count.c > 0) return

    const email: string = (env.INIT_ADMIN_EMAIL as string) || 'reza@clozapine.bid'
  const password: string = (env.INIT_ADMIN_PASSWORD as string) || 'change-me'

  await createUser(db, email, password, 'admin')
  console.log(`[seed] Admin created: ${email}`)
}
