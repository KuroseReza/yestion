import * as db from './db'

interface DocBindings {
  DB: D1Database
  R2: R2Bucket
}

function generateId(): string {
  return crypto.randomUUID().slice(0, 8)
}

function normalizeTitle(title?: string): string {
  const t = (title || '').trim()
  return t || 'Untitled'
}

function toResponse(doc: db.DocRow, content: string) {
  return {
    id: doc.id,
    title: doc.title,
    content,
    version: doc.version,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}

export async function getDoc(env: DocBindings, id: string, owner_id?: string) {
  const doc = await db.getDoc(env.DB, id)
  if (!doc) return null
  if (owner_id && doc.owner_id !== owner_id) return null
  const content = await db.getDocContent(env.R2, doc.r2_key)
  return toResponse(doc, content)
}

export async function getDocMetadata(env: DocBindings, id: string) {
  return db.getDoc(env.DB, id)
}

export async function createDoc(env: DocBindings, title: string, content: string, owner_id: string) {
  const id = generateId()
  const doc = await db.createDoc(env.DB, env.R2, id, normalizeTitle(title), content, owner_id)
  // Sync image references so share permission is accurate
  await db.syncDocImages(env.DB, id, content)
  return toResponse(doc, content)
}

export async function patchDoc(env: DocBindings, id: string, title: string, newContent: string, clientVersion: number, owner_id: string) {
  const doc = await db.getDoc(env.DB, id)
  if (!doc) return { status: 404, error: 'Document not found' }
  if (doc.owner_id !== owner_id) return { status: 403, error: 'Forbidden' }

  if (doc.version !== clientVersion) {
    return {
      status: 409,
      error: 'Version conflict',
      serverVersion: doc.version,
      serverContent: await db.getDocContent(env.R2, doc.r2_key),
    }
  }

  const newVersion = doc.version + 1
  await db.updateDoc(env.DB, env.R2, id, normalizeTitle(title), newContent, newVersion)
  // Sync image references so share permission is accurate
  await db.syncDocImages(env.DB, id, newContent)

  return {
    status: 200,
    id: doc.id,
    title: normalizeTitle(title),
    content: newContent,
    version: newVersion,
    createdAt: doc.created_at,
    updatedAt: new Date().toISOString(),
  }
}

export async function listDocs(env: DocBindings, owner_id: string) {
  const docs = await db.listDocs(env.DB, owner_id)
  return Promise.all(docs.map(async (doc) => toResponse(doc, await db.getDocContent(env.R2, doc.r2_key))))
}

export async function deleteDoc(env: DocBindings, id: string, owner_id: string) {
  const doc = await db.getDoc(env.DB, id)
  if (!doc) return { status: 404, error: 'Not found' }
  if (doc.owner_id !== owner_id) return { status: 403, error: 'Forbidden' }
  
  await db.deleteDoc(env.DB, env.R2, id)
  return { status: 200, success: true }
}
