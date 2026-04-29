import { AutoRouter, IRequest, json, error } from 'itty-router'
import {
  requireAuth, signToken, getUserByEmail, getUserById, createUser,
  generateInviteCode, consumeInviteCode, listUsers, seedAdminIfNeeded, verifyPassword, extractBearerToken,
  UserRow, JwtPayload
} from './auth'
import * as docService from './docService'
import { uploadImage } from './mediaService'
import { getDocContent, getImageByKey } from './db'
import { getSignedUrl } from './r2sign'
import { createShareLink, getActiveShareLink, listShareLinks, disableShareLink } from './shareService'

export interface Env {
  DB: D1Database
  KV: KVNamespace
  R2: R2Bucket
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_ACCOUNT_ID: string
  R2_BUCKET: string
  INIT_ADMIN_EMAIL?: string
  INIT_ADMIN_PASSWORD?: string
}

const router = AutoRouter<IRequest, [Env]>({
  before: [
    async (request, env) => {
      // CORS
      const origin = request.headers.get('Origin') || '*'
      const corsHeaders = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
      }
      ;(request as any)._cors = corsHeaders

      // Seed admin on first request
      await seedAdminIfNeeded(env.DB, env)
    },
  ],
  finally: [
    (response, request) => {
      const cors = (request as any)._cors
      if (cors && response) {
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v as string))
      }
      return response
    },
  ],
})

// Auth middleware — injects JWT payload into request

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function newApiToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return `yes_${bytesToBase64url(bytes)}`
}

async function sha256Base64url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToBase64url(new Uint8Array(digest))
}

async function verifyApiToken(env: Env, rawToken: string): Promise<JwtPayload | null> {
  if (!rawToken.startsWith('yes_')) return null
  const tokenHash = await sha256Base64url(rawToken)
  const row = await env.DB.prepare(`
    SELECT u.id, u.role
    FROM api_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ? AND u.disabled = 0
  `).bind(tokenHash).first<{ id: string; role: 'admin' | 'user' }>()
  if (!row) return null
  const now = Math.floor(Date.now() / 1000)
  return { sub: row.id, role: row.role, iat: now, exp: now + 3600 }
}

async function authenticateRequest(env: Env, request: Request): Promise<JwtPayload | null> {
  const jwt = await requireAuth(env.KV, request)
  if (jwt) return jwt
  const bearer = extractBearerToken(request)
  if (!bearer) return null
  return verifyApiToken(env, bearer)
}

async function authMw(request: IRequest, env: Env): Promise<Response | undefined> {
  const payload = await authenticateRequest(env, request)
  if (!payload) return error(401, 'Unauthorized')
  ;(request as any).auth = payload
}

async function adminMw(request: IRequest, env: Env): Promise<Response | undefined> {
  const payload = await authenticateRequest(env, request)
  if (!payload || payload.role !== 'admin') return error(403, 'Admin required')
  ;(request as any).auth = payload
}


async function serveR2Object(env: Env, key: string, cacheControl = 'private, no-store'): Promise<Response> {
  const object = await env.R2.get(key)
  if (!object) return error(404, 'Object not found')
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Cache-Control', cacheControl)
  return new Response(object.body, { headers })
}

async function redirectToSignedR2Url(env: Env, key: string, expiresInSeconds = 600): Promise<Response> {
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ACCOUNT_ID || !env.R2_BUCKET) {
    return serveR2Object(env, key, 'private, max-age=600')
  }
  const signedUrl = await getSignedUrl(env, key, expiresInSeconds)
  return Response.redirect(signedUrl, 302)
}

// ── Public Auth Endpoints ─────────────────────────────

// POST /api/auth/login — email + password → JWT
router.post('/api/auth/login', async (request, env) => {
  const { email, password } = await request.json() as { email?: string; password?: string }
  if (!email || !password) return error(400, 'email and password required')

  const user = await getUserByEmail(env.DB, email)
  if (!user) return error(401, 'Invalid credentials')
  if (user.disabled) return error(403, 'Account disabled')

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) return error(401, 'Invalid credentials')

  const token = await signToken(env.KV, { sub: user.id, role: user.role })
  return json({ token, user: { id: user.id, email: user.email, role: user.role } })
})

// POST /api/auth/register — email + password + invite_code → create user
router.post('/api/auth/register', async (request, env) => {
  const { email, password, inviteCode } = await request.json() as {
    email?: string; password?: string; inviteCode?: string
  }
  if (!email || !password || !inviteCode) return error(400, 'email, password, and inviteCode required')
  if (password.length < 6) return error(400, 'Password must be at least 6 characters')

  // Validate invite code
  const valid = await consumeInviteCode(env.DB, inviteCode)
  if (!valid) return error(400, 'Invalid, expired, or used invite code')

  // Check duplicate email
  const existing = await getUserByEmail(env.DB, email)
  if (existing) return error(409, 'Email already registered')

  const user = await createUser(env.DB, email, password, 'user')
  const token = await signToken(env.KV, { sub: user.id, role: user.role })
  return json({ token, user: { id: user.id, email: user.email, role: user.role } }, { status: 201 })
})

// ── Admin Endpoints ───────────────────────────────────

// POST /api/auth/invite — generate invite code (admin only)
router.post('/api/auth/invite', adminMw, async (request, env) => {
  const auth = (request as any).auth
  const { remainingUses, expiresInHours } = await request.json() as {
    remainingUses?: number; expiresInHours?: number
  }

  const expiresAt = expiresInHours
    ? new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()
    : undefined

  const code = await generateInviteCode(env.DB, auth.sub, remainingUses || 1, expiresAt)
  return json({ code, remainingUses: remainingUses || 1, expiresAt: expiresAt || null }, { status: 201 })
})

// GET /api/admin/users — list all users (admin only)
router.get('/api/admin/users', adminMw, async (request, env) => {
  const users = await listUsers(env.DB)
  return json(users)
})


// GET /api/admin/invites — list active invite codes for admin UI
router.get('/api/admin/invites', adminMw, async (request, env) => {
  const result = await env.DB.prepare(`
    SELECT code, created_by, remaining_uses, expires_at, created_at
    FROM invite_codes
    WHERE remaining_uses > 0 AND (expires_at IS NULL OR expires_at > datetime('now'))
    ORDER BY created_at DESC
  `).all()
  return json(result.results || [])
})

// PATCH /api/admin/users/:id — disable/enable/change role (admin only)
router.patch('/api/admin/users/:id', adminMw, async (request, env) => {
  const auth = (request as any).auth
  const targetId = request.params.id

  // Can't modify yourself
  if (targetId === auth.sub) return error(400, 'Cannot modify your own account')

  const { disabled, role } = await request.json() as {
    disabled?: boolean; role?: 'admin' | 'user'
  }

  if (disabled !== undefined) {
    await env.DB.prepare('UPDATE users SET disabled = ? WHERE id = ?')
      .bind(disabled ? 1 : 0, targetId).run()
  }
  if (role) {
    if (!['admin', 'user'].includes(role)) return error(400, 'Invalid role')
    await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?')
      .bind(role, targetId).run()
  }

  const user = await env.DB.prepare(
    'SELECT id, email, role, disabled, created_at FROM users WHERE id = ?'
  ).bind(targetId).first<UserRow>()

  if (!user) return error(404, 'User not found')
  return json(user)
})

// DELETE /api/admin/users/:id — delete user (admin only)
router.delete('/api/admin/users/:id', adminMw, async (request, env) => {
  const auth = (request as any).auth
  const targetId = request.params.id
  if (targetId === auth.sub) return error(400, 'Cannot delete your own account')

  const result = await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run()
  if (!result.meta?.changes) return error(404, 'User not found')
  return json({ deleted: true })
})

// ── Doc Endpoints (auth required) ─────────────────────

// GET /api/docs
router.get('/api/docs', authMw, async (request, env) => {
  const auth = (request as any).auth
  const { listDocs } = await import('./docService')
  const docs = await listDocs(env, auth.sub)
  return json(docs)
})

// GET /api/docs/:id/content
router.get('/api/docs/:id/content', authMw, async (request, env) => {
  const auth = (request as any).auth
  const doc = await docService.getDocMetadata(env, request.params.id)
  if (!doc) return error(404, 'Not found')
  if (doc.owner_id !== auth.sub) return error(403, 'Forbidden')

  return serveR2Object(env, doc.r2_key)
})

// GET /api/docs/:id
router.get('/api/docs/:id', authMw, async (request, env) => {
  const auth = (request as any).auth
  const doc = await docService.getDoc(env, request.params.id, auth.sub)
  if (!doc) return error(404, 'Not found')
  return json(doc)
})

// POST /api/docs

// DELETE /api/docs/:id
router.delete('/api/docs/:id', authMw, async (request, env) => {
  const auth = (request as any).auth
  const result = await docService.deleteDoc(env, request.params.id, auth.sub)
  if (result.status !== 200) return error(result.status, result.error!)
  return json({ success: true })
})

// POST /api/docs
router.post('/api/docs', authMw, async (request, env) => {
  const { title, content } = await request.json() as { title?: string; content: string }
  if (typeof content !== 'string') return error(400, 'content required')
  const auth = (request as any).auth
  const doc = await docService.createDoc(env, title || 'Untitled', content, auth.sub)
  return json(doc, { status: 201 })
})

// PATCH /api/docs/:id/patch
router.patch('/api/docs/:id/patch', authMw, async (request, env) => {
  const { title, content, version } = await request.json() as { title?: string; content: string; version: number }
  if (typeof content !== 'string') return error(400, 'content required')
  if (typeof version !== 'number') return error(400, 'version required')

  const auth = (request as any).auth
  const result = await docService.patchDoc(env, request.params.id, title || 'Untitled', content, version, auth.sub)

  if (result.status === 404) return error(404, result.error!)
  if (result.status === 403) return error(403, result.error!)
  if (result.status === 409) {
    return json(
      { error: result.error, serverVersion: result.serverVersion, serverContent: result.serverContent },
      { status: 409 }
    )
  }
  return json(result)
})

// POST /api/docs/:id/share — create a database-backed, revocable share link.
router.post('/api/docs/:id/share', authMw, async (request, env) => {
  const { expiryMinutes } = await request.json().catch(() => ({})) as { expiryMinutes?: number }
  const auth = (request as any).auth
  const doc = await docService.getDocMetadata(env, request.params.id)
  if (!doc) return error(404, 'Not found')
  if (doc.owner_id !== auth.sub) return error(403, 'Forbidden')

  const share = await createShareLink(env, request.params.id, auth.sub, expiryMinutes || 24 * 60)
  return json(share, { status: 201 })
})

// GET /api/docs/:id/shares — list existing share links for deletion/re-copy UI.
router.get('/api/docs/:id/shares', authMw, async (request, env) => {
  const auth = (request as any).auth
  const doc = await docService.getDocMetadata(env, request.params.id)
  if (!doc) return error(404, 'Not found')
  if (doc.owner_id !== auth.sub) return error(403, 'Forbidden')
  return json(await listShareLinks(env, request.params.id))
})

// DELETE /api/docs/:id/shares/:shareId — revoke a share link immediately.
router.delete('/api/docs/:id/shares/:shareId', authMw, async (request, env) => {
  const auth = (request as any).auth
  const doc = await docService.getDocMetadata(env, request.params.id)
  if (!doc) return error(404, 'Not found')
  if (doc.owner_id !== auth.sub) return error(403, 'Forbidden')
  const ok = await disableShareLink(env, request.params.id, request.params.shareId)
  if (!ok) return error(404, 'Share link not found')
  return json({ success: true })
})

// POST /api/upload — bind every image to the current document for strict visitor media auth.
router.post('/api/upload', authMw, async (request, env) => {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const docId = formData.get('docId') as string | null
  if (!file) return error(400, 'file required')
  if (!docId) return error(400, 'docId required')

  const auth = (request as any).auth
  const doc = await docService.getDocMetadata(env, docId)
  if (!doc) return error(404, 'Document not found')
  if (doc.owner_id !== auth.sub) return error(403, 'Forbidden')

  const result = await uploadImage(env.R2, env.DB, file, auth.sub, docId)
  return json({ id: result.id, key: result.key, url: result.url }, { status: 201 })
})

// GET /api/media/:key — owner media route, authenticated by JWT/query token, then redirected to a short-lived R2 signed URL.
router.get('/api/media/*', authMw, async (request, env) => {
  const auth = (request as any).auth
  const pathname = new URL(request.url).pathname
  const key = decodeURIComponent(pathname.slice('/api/media/'.length))
  if (!key) return error(400, 'key required')

  const image = await getImageByKey(env.DB, key)
  if (!image) return error(404, 'Not found')
  if (image.owner_id !== auth.sub) return error(403, 'Forbidden')

  return redirectToSignedR2Url(env, key, 10 * 60)
})

// GET /share/:shareId/media/* — visitor media route. Share is checked live in D1 on every request.
router.get('/share/:shareId/media/*', async (request, env) => {
  const share = await getActiveShareLink(env, request.params.shareId)
  if (!share) return error(403, 'Invalid, revoked, or expired share link')

  const doc = await docService.getDocMetadata(env, share.doc_id)
  if (!doc) return error(404, 'Document not found')

  const pathname = new URL(request.url).pathname
  const prefix = `/share/${request.params.shareId}/media/`
  const key = decodeURIComponent(pathname.slice(prefix.length))
  if (!key) return error(400, 'key required')

  const image = await getImageByKey(env.DB, key)
  if (!image) return error(404, 'Image not found')
  if (image.doc_id !== doc.id) return error(403, 'Image is not attached to this document')

  return redirectToSignedR2Url(env, key, 10 * 60)
})

// GET /share/:shareId — visitor document route. Share is checked live in D1 on every request.
router.get('/share/:shareId', async (request, env) => {
  const share = await getActiveShareLink(env, request.params.shareId)
  if (!share) return error(403, 'Invalid, revoked, or expired share link')

  const doc = await docService.getDocMetadata(env, share.doc_id)
  if (!doc) return error(404, 'Document not found')
  const content = await getDocContent(env.R2, doc.r2_key)

  return json({ id: doc.id, title: doc.title, content })
})

// 404



// GET /api/user/tokens — list API tokens without exposing hashes
router.get('/api/user/tokens', authMw, async (request, env) => {
  const auth = (request as any).auth
  const result = await env.DB.prepare(`
    SELECT id, name, created_at
    FROM api_tokens
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).bind(auth.sub).all()
  return json(result.results || [])
})

// POST /api/user/tokens — create a one-time visible API token
router.post('/api/user/tokens', authMw, async (request, env) => {
  const auth = (request as any).auth
  const { name } = await request.json().catch(() => ({})) as { name?: string }
  const cleanName = (name || '').trim()
  if (!cleanName) return error(400, 'Token name required')
  if (cleanName.length > 80) return error(400, 'Token name too long')

  const id = 'tok_' + crypto.randomUUID().slice(0, 12)
  const rawToken = newApiToken()
  const tokenHash = await sha256Base64url(rawToken)
  await env.DB.prepare(`
    INSERT INTO api_tokens (id, user_id, token_hash, name)
    VALUES (?, ?, ?, ?)
  `).bind(id, auth.sub, tokenHash, cleanName).run()

  return json({ id, name: cleanName, token: rawToken, created_at: new Date().toISOString() }, { status: 201 })
})

// DELETE /api/user/tokens/:id — revoke an API token owned by the current user
router.delete('/api/user/tokens/:id', authMw, async (request, env) => {
  const auth = (request as any).auth
  const result = await env.DB.prepare('DELETE FROM api_tokens WHERE id = ? AND user_id = ?')
    .bind(request.params.id, auth.sub).run()
  if (!result.meta?.changes) return error(404, 'Token not found')
  return json({ success: true })
})

// PUT /api/user/profile - Update email or password
router.put('/api/user/profile', async (request, env) => {
  const { requireAuth, getUserById, verifyPassword, hashPassword } = await import('./auth')
  const payload = await requireAuth(env.KV, request)
  if (!payload) return error(401, 'Unauthorized')

  const { email, currentPassword, newPassword } = await request.json() as { email?: string; currentPassword?: string; newPassword?: string }
  if (!currentPassword) return error(400, 'Current password is required to make changes')
  if (!email && !newPassword) return error(400, 'Nothing to update')

  // Get current user
  const user = await getUserById(env.DB, payload.sub)
  if (!user) return error(404, 'User not found')

  // Verify current password to allow changes
  const valid = await verifyPassword(currentPassword, user.password_hash)
  if (!valid) return error(403, 'Incorrect current password')

  let updates = []
  let params = []

  if (email && email !== user.email) {
    // Check if new email is taken
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
    if (existing) return error(409, 'Email already in use')
    updates.push('email = ?')
    params.push(email)
  }

  if (newPassword) {
    if (newPassword.length < 6) return error(400, 'New password must be at least 6 characters')
    const hash = await hashPassword(newPassword)
    updates.push('password_hash = ?')
    params.push(hash)
  }

  if (updates.length > 0) {
    params.push(payload.sub)
    await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()
  }

  return json({ success: true, message: 'Profile updated' })
})

router.all('*', () => error(404, 'Not found'))

export default router
