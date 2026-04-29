import { recordImage } from './db'

function generateId(): string {
  return crypto.randomUUID()
}

export async function uploadImage(
  r2: R2Bucket,
  d1: D1Database,
  file: File,
  owner_id: string,
  doc_id?: string,
): Promise<{ id: string; url: string; key: string }> {
  const id = generateId()
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const r2Key = `${owner_id}/${id}.${ext}`

  await r2.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type },
  })

  await recordImage(d1, id, doc_id || null, r2Key, owner_id, `${id}.${ext}`)

  const url = `/api/media/${r2Key}`
  return { id, url, key: r2Key }
}
