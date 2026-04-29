export interface DocRow {
  id: string
  title: string
  r2_key: string
  version: number
  owner_id: string
  created_at: string
  updated_at: string
}

export interface ImageRow {
  id: string
  doc_id: string
  r2_key: string
  owner_id: string
  filename: string
  created_at: string
}

export interface ShareLinkRow {
  id: string
  doc_id: string
  created_by: string
  enabled: number
  expires_at: string | null
  created_at: string
  revoked_at: string | null
}

export async function getDoc(d1: D1Database, id: string): Promise<DocRow | null> {
  return d1.prepare('SELECT * FROM docs WHERE id = ?').bind(id).first<DocRow>()
}

export async function createDoc(
  d1: D1Database,
  r2: R2Bucket,
  id: string,
  title: string,
  content: string,
  owner_id: string,
): Promise<DocRow> {
  const r2Key = `docs/${owner_id}/${id}.md`
  await r2.put(r2Key, content, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  })
  await d1.prepare(
    'INSERT INTO docs (id, title, r2_key, version, owner_id) VALUES (?, ?, ?, 1, ?)'
  ).bind(id, title || 'Untitled', r2Key, owner_id).run()
  return (await getDoc(d1, id))!
}

export async function getDocContent(r2: R2Bucket, r2_key: string): Promise<string> {
  const object = await r2.get(r2_key)
  if (!object) return ''
  return object.text()
}

export async function updateDoc(
  d1: D1Database,
  r2: R2Bucket,
  id: string,
  title: string,
  content: string,
  newVersion: number,
): Promise<void> {
  const doc = await getDoc(d1, id)
  if (!doc) throw new Error('Document not found')
  await r2.put(doc.r2_key, content, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  })
  await d1.prepare(
    "UPDATE docs SET title = ?, version = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(title || 'Untitled', newVersion, id).run()
}

export async function listDocs(d1: D1Database, owner_id: string): Promise<DocRow[]> {
  const result = await d1.prepare(
    'SELECT id, title, r2_key, version, owner_id, created_at, updated_at FROM docs WHERE owner_id = ? ORDER BY updated_at DESC'
  ).bind(owner_id).all<DocRow>()
  return result.results || []
}

export async function recordImage(d1: D1Database, id: string, doc_id: string | null, r2_key: string, owner_id: string, filename: string): Promise<void> {
  await d1.prepare(
    'INSERT INTO images (id, doc_id, r2_key, owner_id, filename) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, doc_id, r2_key, owner_id, filename).run()
}

export async function getImageByKey(d1: D1Database, r2_key: string): Promise<ImageRow | null> {
  return d1.prepare('SELECT * FROM images WHERE r2_key = ?').bind(r2_key).first<ImageRow>()
}

export async function getImageById(d1: D1Database, id: string): Promise<ImageRow | null> {
  return d1.prepare('SELECT * FROM images WHERE id = ?').bind(id).first<ImageRow>()
}

export async function getImages(d1: D1Database, owner_id: string): Promise<ImageRow[]> {
  const result = await d1.prepare(
    'SELECT * FROM images WHERE owner_id = ? ORDER BY created_at DESC'
  ).bind(owner_id).all<ImageRow>()
  return result.results || []
}

export async function createShareLink(d1: D1Database, doc_id: string, created_by: string, expires_at: string | null): Promise<ShareLinkRow> {
  const id = 'shr_' + crypto.randomUUID().replace(/-/g, '')
  await d1.prepare(
    'INSERT INTO share_links (id, doc_id, created_by, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(id, doc_id, created_by, expires_at).run()
  return (await getShareLink(d1, id))!
}

export async function getShareLink(d1: D1Database, id: string): Promise<ShareLinkRow | null> {
  return d1.prepare('SELECT * FROM share_links WHERE id = ?').bind(id).first<ShareLinkRow>()
}

export async function getActiveShareLink(d1: D1Database, id: string): Promise<ShareLinkRow | null> {
  const row = await getShareLink(d1, id)
  if (!row || !row.enabled || row.revoked_at) return null
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null
  return row
}

export async function listShareLinks(d1: D1Database, doc_id: string): Promise<ShareLinkRow[]> {
  const result = await d1.prepare(
    'SELECT * FROM share_links WHERE doc_id = ? ORDER BY created_at DESC'
  ).bind(doc_id).all<ShareLinkRow>()
  return result.results || []
}

export async function disableShareLink(d1: D1Database, id: string, doc_id: string): Promise<boolean> {
  const result = await d1.prepare(
    "UPDATE share_links SET enabled = 0, revoked_at = datetime('now') WHERE id = ? AND doc_id = ?"
  ).bind(id, doc_id).run()
  return Boolean(result.meta?.changes)
}

export async function deleteImage(d1: D1Database, r2: R2Bucket, id: string, owner_id: string): Promise<boolean> {
  const image = await d1.prepare('SELECT * FROM images WHERE id = ? AND owner_id = ?').bind(id, owner_id).first<ImageRow>()
  if (!image) return false
  await r2.delete(image.r2_key).catch(() => {})
  await d1.prepare('DELETE FROM images WHERE id = ?').bind(id).run()
  return true
}

export async function getImagesByDocId(d1: D1Database, doc_id: string): Promise<ImageRow[]> {
  const result = await d1.prepare(
    'SELECT * FROM images WHERE doc_id = ?'
  ).bind(doc_id).all<ImageRow>()
  return result.results || []
}

export async function deleteDoc(
  d1: D1Database,
  r2: R2Bucket,
  id: string
): Promise<void> {
  const doc = await getDoc(d1, id)
  if (doc) {
    // Delete associated images from R2 and D1
    const images = await getImagesByDocId(d1, id)
    await Promise.all(images.map(async (img) => {
      await r2.delete(img.r2_key).catch(() => {})
      await d1.prepare('DELETE FROM images WHERE id = ?').bind(img.id).run()
    }))
    // Delete doc from R2 and D1
    await r2.delete(doc.r2_key)
    await d1.prepare('DELETE FROM docs WHERE id = ?').bind(id).run()
    // Also clean up share links
    await d1.prepare('DELETE FROM share_links WHERE doc_id = ?').bind(id).run()
  }
}

// ── Doc-Image reference tracking ─────────────────────

/**
 * Extract image r2_keys referenced in markdown content,
 * resolve them to image IDs, and update the doc_images join table.
 * Called on every doc create/update so share permission stays accurate.
 */
export async function syncDocImages(d1: D1Database, docId: string, markdown: string): Promise<void> {
  const doc = await getDoc(d1, docId)
  if (!doc) return

  const imageIds = new Set<string>()
  const r2Keys = new Set<string>()
  let m: RegExpExecArray | null

  // Extract markdown image targets, supporting:
  //   ![alt](uuid), ![alt](uuid.png), ![alt](/api/media/<r2_key>), ![alt](<raw r2_key>)
  const imageTargetRe = /!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\.[a-z0-9]+)?$/i

  while ((m = imageTargetRe.exec(markdown)) !== null) {
    const rawTarget = m[1].trim()
    let target = rawTarget
    try { target = decodeURIComponent(rawTarget) } catch { /* keep raw target */ }

    if (uuidRe.test(target)) {
      imageIds.add(target.includes('.') ? target.substring(0, target.lastIndexOf('.')) : target)
      continue
    }

    if (target.startsWith('/api/media/')) {
      r2Keys.add(target.slice('/api/media/'.length))
      continue
    }

    if (!target.includes('://') && target.includes('/')) {
      r2Keys.add(target.replace(/^\/+/, ''))
    }
  }

  // Delete existing references for this doc
  await d1.prepare('DELETE FROM doc_images WHERE doc_id = ?').bind(docId).run()

  for (const id of imageIds) {
    const image = await d1.prepare('SELECT id FROM images WHERE id = ? AND owner_id = ?').bind(id, doc.owner_id).first<{ id: string }>()
    if (image) {
      await d1.prepare('INSERT OR IGNORE INTO doc_images (doc_id, image_id) VALUES (?, ?)').bind(docId, image.id).run()
    }
  }

  for (const key of r2Keys) {
    const image = await d1.prepare('SELECT id FROM images WHERE r2_key = ? AND owner_id = ?').bind(key, doc.owner_id).first<{ id: string }>()
    if (image) {
      await d1.prepare('INSERT OR IGNORE INTO doc_images (doc_id, image_id) VALUES (?, ?)').bind(docId, image.id).run()
    }
  }
}

/**
 * Check if an image is referenced by a document (via doc_images join table).
 */
export async function isImageReferencedByDoc(d1: D1Database, imageId: string, docId: string): Promise<boolean> {
  const row = await d1.prepare(
    'SELECT 1 FROM doc_images WHERE doc_id = ? AND image_id = ?'
  ).bind(docId, imageId).first()
  return !!row
}
