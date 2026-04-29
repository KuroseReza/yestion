import { AutoRouter, json, error } from 'itty-router'
import {
  requireAuth, signToken, getUserByEmail, getUserById, createUser,
  generateInviteCode, consumeInviteCode, listUsers, seedAdminIfNeeded, verifyPassword, extractBearerToken,
  UserRow, JwtPayload
} from '../lib/auth'
import * as docService from '../lib/docService'
import { uploadImage } from '../lib/mediaService'
import { getDocContent, getImageByKey, getImages, deleteImage as deleteImageFromDb, isImageReferencedByDoc } from '../lib/db'
import { getSignedUrl } from '../lib/r2sign'
import { createShareLink, getActiveShareLink, listShareLinks, disableShareLink } from '../lib/shareService'

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

const router = AutoRouter({
  before: [
    async (request, env: Env) => {
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
      await seedAdminIfNeeded(env.DB, env)
    },
  ],
  finally: [
    (response, request) => {
      const cors = (request as any)._cors
      if (cors && response && response.status < 300) {
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v as string))
      }
      return response
    },
  ],
})

// ── Auth helpers (copied from worker) ─────────────────

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

async function authMw(request: Request, env: Env): Promise<Response | undefined> {
  const payload = await authenticateRequest(env, request)
  if (!payload) return error(401, 'Unauthorized')
  ;(request as any).auth = payload
}

async function adminMw(request: Request, env: Env): Promise<Response | undefined> {
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

function markdownReferencesImage(markdown: string, image: { id: string; r2_key: string }): boolean {
  const imageTargetRe = /!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g
  let match: RegExpExecArray | null
  while ((match = imageTargetRe.exec(markdown)) !== null) {
    const rawTarget = match[1].trim()
    let target = rawTarget
    try { target = decodeURIComponent(rawTarget) } catch { /* keep raw target */ }

    if (target.startsWith('/api/media/')) target = target.slice('/api/media/'.length)
    if (target.startsWith('/')) target = target.slice(1)

    const withoutExtension = target.includes('.') ? target.substring(0, target.lastIndexOf('.')) : target
    if (target === image.r2_key || target === image.id || withoutExtension === image.id) return true
  }
  return false
}

// ── Auth Endpoints ────────────────────────────────────

router.post('/api/auth/login', async (request, env: Env) => {
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

router.post('/api/auth/register', async (request, env: Env) => {
  const { email, password, inviteCode } = await request.json() as {
    email?: string; password?: string; inviteCode?: string
  }
  if (!email || !password || !inviteCode) return error(400, 'email, password, and inviteCode required')
  if (password.length < 6) return error(400, 'Password must be at least 6 characters')
  const valid = await consumeInviteCode(env.DB, inviteCode)
  if (!valid) return error(400, 'Invalid, expired, or used invite code')
  const existing = await getUserByEmail(env.DB, email)
  if (existing) return error(409, 'Email already registered')
  const user = await createUser(env.DB, email, password, 'user')
  const token = await signToken(env.KV, { sub: user.id, role: user.role })
  return json({ token, user: { id: user.id, email: user.email, role: user.role } }, { status: 201 })
})

// ── Admin Endpoints ───────────────────────────────────

router.post('/api/auth/invite', adminMw, async (request, env: Env) => {
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

router.get('/api/admin/users', adminMw, async (request, env: Env) => {
  return json(await listUsers(env.DB))
})

router.get('/api/admin/invites', adminMw, async (request, env: Env) => {
  const result = await env.DB.prepare(`
    SELECT code, created_by, remaining_uses, expires_at, created_at
    FROM invite_codes
    WHERE remaining_uses > 0 AND (expires_at IS NULL OR expires_at > datetime('now'))
    ORDER BY created_at DESC
  `).all()
  return json(result.results || [])
})

router.delete('/api/admin/invites/:code', adminMw, async (request, env: Env) => {
  const code = decodeURIComponent(request.params.code)
  if (!code) return error(400, 'code required')
  const result = await env.DB.prepare('DELETE FROM invite_codes WHERE code = ?').bind(code).run()
  if (!result.meta?.changes) return error(404, 'Invite code not found')
  return json({ deleted: true })
})

router.patch('/api/admin/users/:id', adminMw, async (request, env: Env) => {
  const auth = (request as any).auth
  const targetId = request.params.id
  if (targetId === auth.sub) return error(400, 'Cannot modify your own account')
  const { disabled, role } = await request.json() as { disabled?: boolean; role?: 'admin' | 'user' }
  if (disabled !== undefined) {
    await env.DB.prepare('UPDATE users SET disabled = ? WHERE id = ?').bind(disabled ? 1 : 0, targetId).run()
  }
  if (role) {
    if (!['admin', 'user'].includes(role)) return error(400, 'Invalid role')
    await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, targetId).run()
  }
  const user = await env.DB.prepare('SELECT id, email, role, disabled, created_at FROM users WHERE id = ?').bind(targetId).first<UserRow>()
  if (!user) return error(404, 'User not found')
  return json(user)
})

router.delete('/api/admin/users/:id', adminMw, async (request, env: Env) => {
  const auth = (request as any).auth
  const targetId = request.params.id
  if (targetId === auth.sub) return error(400, 'Cannot delete your own account')
  const result = await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run()
  if (!result.meta?.changes) return error(404, 'User not found')
  return json({ deleted: true })
})

// ── Doc Endpoints ─────────────────────────────────────

router.get('/api/docs', authMw, async (request, env: Env) => {
  const auth = (request as any).auth
  return json(await docService.listDocs(env, auth.sub))
})

router.get('/api/docs/:id/content', authMw, async (request, env: Env) => {
  const auth = (request as any).auth
  const doc = await docService.getDocMetadata(env, request.params.id)
  if (!doc) return error(404, 'Not found')
  if (doc.owner_id !== auth.sub) return error(403, 'Forbidden')
  return serveR2Object(env, doc.r2_key)
})

router.get('/api/docs/:id', authMw, async (request, env: Env) => {
  const auth = (request as any).auth
  const doc = await docService.getDoc(env, request.params.id, auth.sub)
  if (!doc) return error(404, 'Not found')
  return json(doc)
})

router.post('/api/docs', authMw, async (request, env: Env) => {
  const { title, content } = await request.json() as { title?: string; content: string }
  if (typeof content !== 'string') return error(400, 'content required')
  const auth = (request as any).auth
  const doc = await docService.createDoc(env, title || 'Untitled', content, auth.sub)
  return json(doc, { status: 201 })
})

router.delete('/api/docs/:id', authMw, async (request, env: Env) => {
  const auth = (request as any).auth
  const result = await docService.deleteDoc(env, request.params.id, auth.sub)
  if (result.status !== 200) return error(result.status, result.error!)
  return json({ success: true })
})

router.patch('/api/docs/:id/patch', authMw, async (request, env: Env) => {
  const { title, content, version } = await request.json() as { title?: string; content: string; version: number }
  if (typeof content !== 'string') return error(400, 'content required')
  if (typeof version !== 'number') return error(400, 'version required')
  const auth = (request as any).auth
  const result = await docService.patchDoc(env, request.params.id, title || 'Untitled', content, version, auth.sub)
  if (result.status === 404) return error(404, result.error!)
  if (result.status === 403) return error(403, result.error!)
  if (result.status === 409) {
    return json({ error: result.error, serverVersion: result.serverVersion, serverContent: result.serverContent }, { status: 409 })
  }
  return json(result)
})

// ── Share Endpoints ───────────────────────────────────

router.post('/api/docs/:id/share', authMw, async (request, env: Env) => {
  const { expiryMinutes } = await request.json().catch(() => ({})) as { expiryMinutes?: number }
  const auth = (request as any).auth
  const doc = await docService.getDocMetadata(env, request.params.id)
  if (!doc) return error(404, 'Not found')
  if (doc.owner_id !== auth.sub) return error(403, 'Forbidden')
  const share = await createShareLink(env, request.params.id, auth.sub, expiryMinutes !== undefined ? expiryMinutes : 24 * 60)
  return json(share, { status: 201 })
})

router.get('/api/docs/:id/shares', authMw, async (request, env: Env) => {
  const auth = (request as any).auth
  const doc = await docService.getDocMetadata(env, request.params.id)
  if (!doc) return error(404, 'Not found')
  if (doc.owner_id !== auth.sub) return error(403, 'Forbidden')
  return json(await listShareLinks(env, request.params.id))
})

router.delete('/api/docs/:id/shares/:shareId', authMw, async (request, env: Env) => {
  const auth = (request as any).auth
  const doc = await docService.getDocMetadata(env, request.params.id)
  if (!doc) return error(404, 'Not found')
  if (doc.owner_id !== auth.sub) return error(403, 'Forbidden')
  const ok = await disableShareLink(env, request.params.id, request.params.shareId)
  if (!ok) return error(404, 'Share link not found')
  return json({ success: true })
})

// ── Upload ────────────────────────────────────────────

router.post('/api/upload', authMw, async (request, env: Env) => {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const docId = formData.get('docId') as string | null
  if (!file) return error(400, 'file required')
  const auth = (request as any).auth
  const result = await uploadImage(env.R2, env.DB, file, auth.sub, docId || undefined)
  return json({ id: result.id, key: result.key, url: result.url }, { status: 201 })
})

router.post('/api/upload-md', authMw, async (request, env: Env) => {
  const contentType = request.headers.get('Content-Type') || ''
  if (!contentType.includes('multipart/form-data')) return error(400, 'Expected multipart/form-data')

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return error(400, 'file required')
  const auth = (request as any).auth

  // Only allow .md files
  const fileName = (file as any).name || 'untitled.md'
  if (!fileName.endsWith('.md')) return error(400, 'Only .md files allowed')

  const content = await file.text()
  const title = fileName.replace(/\.md$/i, '').trim() || 'Untitled'

  const doc = await docService.createDoc(env, title, content, auth.sub)
  return json(doc, { status: 201 })
})

// ── Media ─────────────────────────────────────────────

router.get('/api/media/*', authMw, async (request, env: Env) => {
  const auth = (request as any).auth
  const pathname = new URL(request.url).pathname
  const key = decodeURIComponent(pathname.slice('/api/media/'.length))
  if (!key) return error(400, 'key required')
  const image = await getImageByKey(env.DB, key)
  if (!image) return error(404, 'Not found')
  if (image.owner_id !== auth.sub) return error(403, 'Forbidden')
  return redirectToSignedR2Url(env, key, 10 * 60)
})

// ── Image Management ──────────────────────────────────

router.get('/api/images', authMw, async (request, env: Env) => {
  const auth = (request as any).auth
  const images = await getImages(env.DB, auth.sub)
  return json(images)
})

router.delete('/api/images/:id', authMw, async (request, env: Env) => {
  const auth = (request as any).auth
  const ok = await deleteImageFromDb(env.DB, env.R2, request.params.id, auth.sub)
  if (!ok) return error(404, 'Image not found')
  return json({ success: true })
})

// ── Public Share (visitor routes) ─────────────────────

router.get('/api/share/:shareId/media/*', async (request, env: Env) => {
  const share = await getActiveShareLink(env, request.params.shareId)
  if (!share) return error(403, 'Invalid, revoked, or expired share link')
  const doc = await docService.getDocMetadata(env, share.doc_id)
  if (!doc) return error(404, 'Document not found')
  const pathname = new URL(request.url).pathname
  const prefix = `/api/share/${request.params.shareId}/media/`
  const key = decodeURIComponent(pathname.slice(prefix.length))
  if (!key) return error(400, 'key required')
  const image = await getImageByKey(env.DB, key)
  const r2Key = key
  if (!image) return error(404, 'Image not found')
  if (image.owner_id !== doc.owner_id) return error(403, 'Forbidden')
  // Share tokens can only access images explicitly referenced in the document's markdown.
  // Older docs may not have doc_images rows because they stored `/api/media/<r2_key>` in markdown
  // instead of UUID-only references, so fall back to exact markdown-image target parsing.
  let allowed = await isImageReferencedByDoc(env.DB, image.id, doc.id)
  if (!allowed) {
    const content = await getDocContent(env.R2, doc.r2_key)
    allowed = markdownReferencesImage(content, image)
  }
  if (!allowed) return error(403, 'Image is not referenced by this document')
  return redirectToSignedR2Url(env, r2Key, 10 * 60)
})

// ── Share image map (for frontend UUID resolution) ─────

router.get('/api/share/:shareId/images', async (request, env: Env) => {
  const share = await getActiveShareLink(env, request.params.shareId)
  if (!share) return error(403, 'Invalid, revoked, or expired share link')
  const result = await env.DB.prepare(
    `SELECT i.id, i.r2_key
     FROM doc_images di
     JOIN images i ON i.id = di.image_id
     WHERE di.doc_id = ?`
  ).bind(share.doc_id).all<{ id: string; r2_key: string }>()
  const images = (result.results || []).map(r => ({ id: r.id, r2_key: r.r2_key }))
  return json({ images }, { status: 200 })
})

router.get('/api/share/:shareId', async (request, env: Env) => {
  const share = await getActiveShareLink(env, request.params.shareId)
  if (!share) return error(403, 'Invalid, revoked, or expired share link')
  const doc = await docService.getDocMetadata(env, share.doc_id)
  if (!doc) return error(404, 'Document not found')
  const content = await getDocContent(env.R2, doc.r2_key)
  return json({ id: doc.id, title: doc.title, content })
})

// ── User Endpoints ────────────────────────────────────

router.get('/api/user/tokens', authMw, async (request, env: Env) => {
  const auth = (request as any).auth
  const result = await env.DB.prepare('SELECT id, name, created_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC').bind(auth.sub).all()
  return json(result.results || [])
})

router.post('/api/user/tokens', authMw, async (request, env: Env) => {
  const auth = (request as any).auth
  const { name } = await request.json().catch(() => ({})) as { name?: string }
  const cleanName = (name || '').trim()
  if (!cleanName) return error(400, 'Token name required')
  if (cleanName.length > 80) return error(400, 'Token name too long')
  const id = 'tok_' + crypto.randomUUID().slice(0, 12)
  const rawToken = newApiToken()
  const tokenHash = await sha256Base64url(rawToken)
  await env.DB.prepare('INSERT INTO api_tokens (id, user_id, token_hash, name) VALUES (?, ?, ?, ?)').bind(id, auth.sub, tokenHash, cleanName).run()
  return json({ id, name: cleanName, token: rawToken, created_at: new Date().toISOString() }, { status: 201 })
})

router.delete('/api/user/tokens/:id', authMw, async (request, env: Env) => {
  const auth = (request as any).auth
  const result = await env.DB.prepare('DELETE FROM api_tokens WHERE id = ? AND user_id = ?').bind(request.params.id, auth.sub).run()
  if (!result.meta?.changes) return error(404, 'Token not found')
  return json({ success: true })
})

router.put('/api/user/profile', async (request, env: Env) => {
  const { requireAuth, getUserById, verifyPassword, hashPassword } = await import('../lib/auth')
  const payload = await requireAuth(env.KV, request)
  if (!payload) return error(401, 'Unauthorized')
  const { email, currentPassword, newPassword } = await request.json() as { email?: string; currentPassword?: string; newPassword?: string }
  if (!currentPassword) return error(400, 'Current password is required to make changes')
  if (!email && !newPassword) return error(400, 'Nothing to update')
  const user = await getUserById(env.DB, payload.sub)
  if (!user) return error(404, 'User not found')
  const valid = await verifyPassword(currentPassword, user.password_hash)
  if (!valid) return error(403, 'Incorrect current password')
  let updates: string[] = []
  let params: any[] = []
  if (email && email !== user.email) {
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

export const onRequest: PagesFunction<Env> = async (context) => {
  return router.fetch(context.request, context.env)
}
