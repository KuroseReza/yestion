import type { Env } from './index'
import * as db from './db'

export interface ShareLinkResponse {
  id: string
  docId: string
  url: string
  enabled: boolean
  expiresAt: string | null
  createdAt: string
  revokedAt: string | null
}

function toResponse(row: db.ShareLinkRow): ShareLinkResponse {
  return {
    id: row.id,
    docId: row.doc_id,
    url: `/share/${row.id}`,
    enabled: Boolean(row.enabled) && !row.revoked_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  }
}

export async function createShareLink(env: Env, docId: string, createdBy: string, expiryMinutes?: number): Promise<ShareLinkResponse> {
  const expiresAt = expiryMinutes && expiryMinutes > 0
    ? new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString()
    : null
  const row = await db.createShareLink(env.DB, docId, createdBy, expiresAt)
  return toResponse(row)
}

export async function getActiveShareLink(env: Env, shareId: string): Promise<db.ShareLinkRow | null> {
  return db.getActiveShareLink(env.DB, shareId)
}

export async function listShareLinks(env: Env, docId: string): Promise<ShareLinkResponse[]> {
  const rows = await db.listShareLinks(env.DB, docId)
  return rows.map(toResponse)
}

export async function disableShareLink(env: Env, docId: string, shareId: string): Promise<boolean> {
  return db.disableShareLink(env.DB, shareId, docId)
}
