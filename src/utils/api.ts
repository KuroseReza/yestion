import { token } from '../stores/auth'

export const BASE_URL = import.meta.env.VITE_API_BASE || ''

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  const currentToken = token()
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error')
    throw new Error(`API error (${response.status}): ${errorBody}`)
  }

  return response.json()
}

export type Note = {
  id: string
  title: string
  r2_key?: string
  owner_id?: string
  created_at: string
  updated_at?: string
  content?: string
  version?: number
}

export type ShareLink = {
  id: string
  docId: string
  url: string
  enabled: boolean
  expiresAt: string | null
  createdAt: string
  revokedAt: string | null
}

function normalizeDoc(d: any): Note {
  return {
    id: d.id,
    title: d.title || 'Untitled',
    content: d.content || '',
    version: d.version,
    created_at: d.createdAt || d.created_at,
    updated_at: d.updatedAt || d.updated_at,
    r2_key: d.r2_key,
    owner_id: d.owner_id,
  }
}

export const fetchNotes = async (): Promise<Note[]> => {
  const docs = await apiFetch<any[]>('/api/docs')
  return docs.map(normalizeDoc)
}

export const createNote = async (title: string, content: string) => {
  const doc = await apiFetch<any>('/api/docs', {
    method: 'POST',
    body: JSON.stringify({ title, content })
  })
  return { success: true, docId: doc.id, version: doc.version }
}

export const updateNote = async (id: string, title: string, content: string, version: number) => {
  const res = await apiFetch<any>(`/api/docs/${id}/patch`, {
    method: 'PATCH',
    body: JSON.stringify({ title, content, version })
  })
  return { success: true, docId: id, version: res.version }
}

export const fetchNoteContent = async (id: string) => {
  const doc = normalizeDoc(await apiFetch<any>(`/api/docs/${id}`))
  return { title: doc.title, content: doc.content || '', version: doc.version || 1 }
}

export async function updateProfile(email?: string, currentPassword?: string, newPassword?: string) {
  return apiFetch('/api/user/profile', {
    method: 'PUT',
    body: JSON.stringify({ email, currentPassword, newPassword })
  })
}

export async function getTokens() {
  return apiFetch<any[]>('/api/user/tokens')
}

export async function createToken(name: string) {
  return apiFetch<{id: string, name: string, token: string}>('/api/user/tokens', {
    method: 'POST',
    body: JSON.stringify({ name })
  })
}

export async function revokeToken(id: string) {
  return apiFetch(`/api/user/tokens/${id}`, { method: 'DELETE' })
}

export async function getInvites() {
  return apiFetch<any[]>('/api/admin/invites')
}

export async function createInvite(remainingUses: number, expiresInHours?: number) {
  return apiFetch<{code: string}>('/api/auth/invite', {
    method: 'POST',
    body: JSON.stringify({ remainingUses, expiresInHours })
  })
}

export async function deleteInvite(code: string) {
  return apiFetch(`/api/admin/invites/${encodeURIComponent(code)}`, { method: 'DELETE' })
}

export async function fetchImages() {
  return apiFetch<any[]>('/api/images')
}

export async function deleteImageById(id: string) {
  return apiFetch<{success: boolean}>(`/api/images/${id}`, { method: 'DELETE' })
}

export const deleteNote = async (id: string) => {
  return apiFetch(`/api/docs/${id}`, { method: 'DELETE' })
}

export const shareNote = async (id: string, expiresInMinutes: number = 1440) => {
  return apiFetch<ShareLink>(`/api/docs/${id}/share`, {
    method: 'POST',
    body: JSON.stringify({ expiryMinutes: expiresInMinutes })
  })
}

export const listShares = async (id: string) => {
  return apiFetch<ShareLink[]>(`/api/docs/${id}/shares`)
}

export const deleteShare = async (docId: string, shareId: string) => {
  return apiFetch<{success: boolean}>(`/api/docs/${docId}/shares/${shareId}`, { method: 'DELETE' })
}

export const uploadImage = async (file: File, docId?: string) => {
  const formData = new FormData()
  formData.append('file', file)
  if (docId) formData.append('docId', docId)
  
  const currentToken = token()
  const headers: Record<string, string> = {}
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`
  
  const response = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers,
    body: formData
  })
  
  if (!response.ok) throw new Error(`Upload failed (${response.status}): ${await response.text().catch(() => '')}`)
  return response.json() as Promise<{ id: string, key: string, url: string }>
}

export const uploadMarkdown = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const currentToken = token()
  const headers: Record<string, string> = {}
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`
  
  const response = await fetch(`${BASE_URL}/api/upload-md`, {
    method: 'POST',
    headers,
    body: formData
  })
  
  if (!response.ok) throw new Error(`Upload failed (${response.status}): ${await response.text().catch(() => '')}`)
  return response.json() as Promise<{ id: string, title: string, content: string, version: number }>
}
