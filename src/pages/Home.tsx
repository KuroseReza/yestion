import { createSignal, createEffect, onMount, onCleanup, Show, For } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { token } from '../stores/auth'
import { t } from '../stores/i18n'
import { FileIcon, PlusIcon, TrashIcon, ShareIcon, PhotoIcon, UploadIcon } from '../components/Icons'
import WysiwygEditor from '../components/WysiwygEditor'
import LazyImage from '../components/LazyImage'
import {
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
  shareNote,
  listShares,
  deleteShare,
  uploadImage,
  uploadMarkdown,
  fetchNoteContent,
  fetchImages,
  BASE_URL,
  type Note,
  type ShareLink,
} from '../utils/api'

export default function Home() {
  const navigate = useNavigate()

  createEffect(() => {
    if (!token()) navigate('/login', { replace: true })
  })

  if (!token()) return null

  const [notes, setNotes] = createSignal<Note[]>([])
  const [activeNoteId, setActiveNoteId] = createSignal<string | null>(null)
  const [title, setTitle] = createSignal('')
  const [content, setContent] = createSignal('')
  const [saving, setSaving] = createSignal(false)
  const [sharing, setSharing] = createSignal(false)
  const [deleting, setDeleting] = createSignal(false)
  const [uploading, setUploading] = createSignal(false)
  const [uploadingMd, setUploadingMd] = createSignal(false)
  const [loading, setLoading] = createSignal(false)
  const [notesLoading, setNotesLoading] = createSignal(true)
  const [version, setVersion] = createSignal<number>(1)
  const [editorKey, setEditorKey] = createSignal(1)
  const [isMobileEditorOpen, setIsMobileEditorOpen] = createSignal(false)
  const [sharePanelOpen, setSharePanelOpen] = createSignal(false)
  const [shareLinks, setShareLinks] = createSignal<ShareLink[]>([])
  const [shareLoading, setShareLoading] = createSignal(false)
  const [imageDialogOpen, setImageDialogOpen] = createSignal(false)
  const [saveMenuOpen, setSaveMenuOpen] = createSignal(false)
  const [imageAlt, setImageAlt] = createSignal('')
  const [imageFile, setImageFile] = createSignal<File | null>(null)
  const [imageMap, setImageMap] = createSignal<Record<string, string>>({})
  const [expiryMinutes, setExpiryMinutes] = createSignal(1440)
  const [existingImages, setExistingImages] = createSignal<any[] | null>(null)
  let uploadMdRef: HTMLInputElement | undefined
  let draftSaveTimer: ReturnType<typeof setTimeout> | null = null
  const [canPersistDraft, setCanPersistDraft] = createSignal(false)
  const [cloudTitle, setCloudTitle] = createSignal('')
  const [cloudContent, setCloudContent] = createSignal('')

  const draftKeyFor = (docId: string | null) => `yestion:draft:${docId || 'new'}`
  const currentDraftKey = () => draftKeyFor(activeNoteId())
  const readDraft = (docId: string | null): { title: string; content: string } | null => {
    try {
      const raw = localStorage.getItem(draftKeyFor(docId))
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (typeof parsed?.title === 'string' && typeof parsed?.content === 'string') return parsed
    } catch { /* ignore malformed draft */ }
    return null
  }
  const removeDraft = (docId: string | null) => {
    try { localStorage.removeItem(draftKeyFor(docId)) } catch { /* storage unavailable */ }
  }

  createEffect(() => {
    const key = currentDraftKey()
    const nextTitle = title()
    const nextContent = content()
    const ready = canPersistDraft() && !loading()
    if (draftSaveTimer) clearTimeout(draftSaveTimer)
    if (!ready) return
    draftSaveTimer = setTimeout(() => {
      try {
        if (nextTitle === cloudTitle() && nextContent === cloudContent()) {
          localStorage.removeItem(key)
        } else {
          localStorage.setItem(key, JSON.stringify({ title: nextTitle, content: nextContent, updatedAt: Date.now() }))
        }
      } catch { /* quota exceeded / storage unavailable */ }
    }, 500)
  })

  onCleanup(() => { if (draftSaveTimer) clearTimeout(draftSaveTimer) })

  const remountEditor = () => setEditorKey(key => key + 1)

  const refreshImageMap = async () => {
    try {
      const images = await fetchImages()
      const map: Record<string, string> = {}
      for (const img of images) {
        map[img.id] = img.r2_key
      }
      setImageMap(map)
    } catch { /* silently fail */ }
  }

  const loadNotes = async () => {
    setNotesLoading(true)
    try {
      const data = await fetchNotes()
      data.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
      setNotes(data)
    } catch (err) {
      console.error(err)
    } finally {
      setNotesLoading(false)
    }
  }

  const loadShares = async (docId = activeNoteId()) => {
    if (!docId) return
    setShareLoading(true)
    try {
      setShareLinks(await listShares(docId))
    } catch (err) {
      console.error(err)
      setShareLinks([])
    } finally {
      setShareLoading(false)
    }
  }

  onMount(() => {
    loadNotes()
    refreshImageMap()
  })

  const handleSelectNote = async (note: Note) => {
    setCanPersistDraft(false)
    setSaveMenuOpen(false)
    setIsMobileEditorOpen(true)
    setActiveNoteId(note.id)
    setTitle(note.title)
    setContent(t('loading'))
    remountEditor()
    setSharePanelOpen(false)
    setImageDialogOpen(false)
    setLoading(true)
    try {
      const res = await fetchNoteContent(note.id)
      setCloudTitle(res.title)
      setCloudContent(res.content)
      const draft = readDraft(note.id)
      setTitle(draft?.title ?? res.title)
      setContent(draft?.content ?? res.content)
      setVersion(res.version)
      remountEditor()
    } catch (err) {
      setContent(t('loadingError'))
    } finally {
      setLoading(false)
      setCanPersistDraft(true)
    }
  }

  const handleNewNote = () => {
    setCanPersistDraft(false)
    setSaveMenuOpen(false)
    const draft = readDraft(null)
    setIsMobileEditorOpen(true)
    setActiveNoteId(null)
    setCloudTitle('')
    setCloudContent('')
    setTitle(draft?.title ?? '')
    setContent(draft?.content ?? '')
    setVersion(1)
    remountEditor()
    setSharePanelOpen(false)
    setImageDialogOpen(false)
    setCanPersistDraft(true)
  }
  
  const handleBackToList = () => setIsMobileEditorOpen(false)

  const handleDelete = async () => {
    if (!activeNoteId() || deleting()) return
    if (!confirm(t('confirmDelete'))) return
    setDeleting(true)
    setCanPersistDraft(false)
    setSaveMenuOpen(false)
    try {
      const deletedId = activeNoteId()
      await deleteNote(deletedId!)
      removeDraft(deletedId)
      setActiveNoteId(null)
      setContent('')
      setTitle('')
      setCloudTitle('')
      setCloudContent('')
      setShareLinks([])
      remountEditor()
      await loadNotes()
      setIsMobileEditorOpen(false)
    } catch (err) {
      alert(t('deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    if (saving() || loading()) return
    const previousId = activeNoteId()
    setSaving(true)
    setCanPersistDraft(false)
    setSaveMenuOpen(false)
    try {
      const finalTitle = title().trim() || 'Untitled'
      if (previousId) {
        const res = await updateNote(previousId, finalTitle, content(), version())
        setVersion(res.version)
      } else {
        const res = await createNote(finalTitle, content())
        setActiveNoteId(res.docId)
        setVersion(res.version)
      }
      setTitle(finalTitle)
      setCloudTitle(finalTitle)
      setCloudContent(content())
      removeDraft(previousId)
      removeDraft(activeNoteId())
      await loadNotes()
      refreshImageMap()
    } catch (err) {
      alert(t('saveError'))
    } finally {
      setSaving(false)
      setCanPersistDraft(true)
    }
  }

  const handleDiscardLocalChanges = async () => {
    if (loading() || saving()) return
    setSaveMenuOpen(false)
    setCanPersistDraft(false)
    const docId = activeNoteId()
    removeDraft(docId)
    if (!docId) {
      setTitle('')
      setContent('')
      setCloudTitle('')
      setCloudContent('')
      setVersion(1)
      remountEditor()
      setCanPersistDraft(true)
      return
    }
    setLoading(true)
    try {
      const res = await fetchNoteContent(docId)
      setTitle(res.title)
      setContent(res.content)
      setVersion(res.version)
      setCloudTitle(res.title)
      setCloudContent(res.content)
      remountEditor()
    } catch (err) {
      alert(t('loadingError'))
    } finally {
      setLoading(false)
      setCanPersistDraft(true)
    }
  }


  const handleShare = async () => {
    if (!activeNoteId() || sharing()) return
    setSharing(true)
    try {
      const res = await shareNote(activeNoteId()!, expiryMinutes() || 0)
      await navigator.clipboard.writeText(window.location.origin + res.url)
      setSharePanelOpen(true)
      await loadShares(activeNoteId()!)
      alert(t('shareSuccess'))
    } catch (err) {
      alert(t('shareError'))
    } finally {
      setSharing(false)
    }
  }

  const handleCreateShare = async () => {
    if (!activeNoteId() || sharing()) return
    setSharing(true)
    try {
      await shareNote(activeNoteId()!, expiryMinutes() || 0)
      await loadShares(activeNoteId()!)
    } catch (err) {
      alert(t('shareError'))
    } finally {
      setSharing(false)
    }
  }

  const handleOpenSharePanel = async () => {
    if (!activeNoteId()) return
    setSharePanelOpen(!sharePanelOpen())
    if (!sharePanelOpen()) await loadShares(activeNoteId())
  }

  const handleCopyShare = async (share: ShareLink) => {
    await navigator.clipboard.writeText(window.location.origin + share.url)
  }

  const handleDeleteShare = async (shareId: string) => {
    if (!activeNoteId()) return
    if (!confirm(t('revokeShareConfirm'))) return
    await deleteShare(activeNoteId()!, shareId)
    await loadShares(activeNoteId())
  }

  const insertMarkdownAtCursor = (markdown: string) => {
    setContent(`${content()}${markdown}`)
    remountEditor()
  }

  const handleInsertImage = async () => {
    if (uploading()) return
    const file = imageFile()
    if (!file) {
      alert(t('chooseImageFirst'))
      return
    }

    setUploading(true)
    try {
      const res = await uploadImage(file, activeNoteId() || undefined)
      const alt = imageAlt().trim() || file.name
      insertMarkdownAtCursor(`\n![${alt}](${res.id})\n`)
      setImageDialogOpen(false)
      setImageFile(null)
      setImageAlt('')
      setExistingImages(null)
    } catch (err) {
      alert(t('uploadError'))
    } finally {
      setUploading(false)
    }
  }

  const openImageDialog = async () => {
    setImageDialogOpen(true)
    setExistingImages(null)
    try { setExistingImages(await fetchImages()) } catch (_) { setExistingImages([]) }
  }

  const handleInsertExistingImage = (img: any) => {
    const alt = img.filename || 'image'
    insertMarkdownAtCursor(`\n![${alt}](${img.id})\n`)
    setImageDialogOpen(false)
    setExistingImages(null)
  }

  const handleUploadMd = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.md')) {
      alert('Only .md files are allowed')
      input.value = ''
      return
    }

    setUploadingMd(true)
    try {
      const doc = await uploadMarkdown(file)
      setCanPersistDraft(false)
      removeDraft(null)
      removeDraft(doc.id)
      await loadNotes()
      // Open the uploaded note
      setActiveNoteId(doc.id)
      setTitle(doc.title)
      setContent(doc.content)
      setVersion(doc.version)
      setCloudTitle(doc.title)
      setCloudContent(doc.content)
      setIsMobileEditorOpen(true)
      remountEditor()
      setCanPersistDraft(true)
    } catch (err: any) {
      alert(err.message || 'Upload failed')
    } finally {
      setUploadingMd(false)
      input.value = ''
    }
  }

  const transformEditorImageSrc = (src: string) => {
    if (!src || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) return src
    const key = imageMap()[src]
    if (!key || !token()) return src
    return `${BASE_URL}/api/media/${key}?token=${encodeURIComponent(token()!)}`
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div class="flex h-full min-h-0 w-full overflow-hidden p-3 md:p-4 gap-3 md:gap-4">
      <div class={`w-full md:w-64 lg:w-72 shrink-0 min-h-0 flex-col glass-panel rounded-2xl overflow-hidden ${isMobileEditorOpen() ? 'hidden md:flex' : 'flex'}`}>
        <div class="px-4 h-14 border-b border-amber-900/10 dark:border-white/5 flex items-center justify-between shrink-0">
          <span class="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">{t('docs')}</span>
          <div class="flex items-center gap-1">
            <button onClick={() => uploadMdRef?.click()} disabled={uploadingMd()} class="p-2 text-stone-500 hover:text-amber-600 dark:text-stone-400 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-white/5 rounded-md transition-colors" title={t('uploadMd')}>
              <UploadIcon class="w-4 h-4" />
            </button>
            <button onClick={handleNewNote} class="p-2 text-stone-500 hover:text-amber-600 dark:text-stone-400 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-white/5 rounded-md transition-colors" title={t('newDoc')}>
              <PlusIcon class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">
          <Show when={!notesLoading()} fallback={
            <div class="flex flex-col gap-2 p-2 animate-pulse">
              <div class="h-12 bg-stone-200/50 dark:bg-white/5 rounded-lg w-full"></div>
              <div class="h-12 bg-stone-200/50 dark:bg-white/5 rounded-lg w-full"></div>
              <div class="h-12 bg-stone-200/50 dark:bg-white/5 rounded-lg w-full"></div>
            </div>
          }>
          <Show when={notes().length > 0} fallback={<div class="text-xs text-stone-400 dark:text-stone-50/30 text-center p-6 italic">{t('noDocs')}</div>}>
            <For each={notes()}>{(note, i) => (
              <button onClick={() => handleSelectNote(note)} style={`animation-delay:${i() * 50}ms`} class={`animate-list-in flex flex-col text-left px-3 py-2.5 rounded-lg transition-colors border active:scale-[0.98] ${activeNoteId() === note.id && isMobileEditorOpen() ? 'bg-white/75 dark:bg-white/10 border-amber-900/10 dark:border-white/10 shadow-sm' : 'border-transparent hover:bg-amber-100/50 dark:hover:bg-white/5'}`}>
                <span class={`text-sm font-medium truncate w-full ${activeNoteId() === note.id ? 'text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-300'}`}>{note.title || t('untitled')}</span>
                <span class="text-[10px] font-medium opacity-50 mt-1 uppercase tracking-wider text-stone-500 dark:text-stone-400">{new Date(note.updated_at || note.created_at).toLocaleDateString()}</span>
              </button>
            )}</For>
          </Show>
          </Show>
        </div>
        <input type="file" accept=".md,.markdown" class="hidden" ref={uploadMdRef} onChange={handleUploadMd} />
      </div>

      <div class={`flex-1 min-h-0 flex-col relative min-w-0 glass-panel rounded-2xl overflow-hidden ${isMobileEditorOpen() ? 'flex' : 'hidden md:flex'}`}>
        <Show when={isMobileEditorOpen() || activeNoteId() !== null} fallback={<div class="flex-1 flex flex-col items-center justify-center text-stone-400 dark:text-stone-50/20"><FileIcon class="w-12 h-12 mb-4 opacity-30" /><p class="font-medium text-sm">{t('emptyEditor')}</p></div>}>
          <div class="flex items-center px-4 md:px-8 h-14 border-b border-amber-900/10 dark:border-white/5 shrink-0">
            <button onClick={handleBackToList} class="md:hidden mr-2 p-2 -ml-2 rounded-md hover:bg-amber-50 dark:hover:bg-white/5 transition-colors text-stone-500 dark:text-stone-400">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <input type="text" value={title()} onInput={e => setTitle(e.currentTarget.value)} class="flex-1 min-w-0 bg-transparent text-lg md:text-xl font-bold text-stone-950 dark:text-stone-50 outline-none placeholder-slate-300 dark:placeholder-white/20" placeholder={t('untitled')} disabled={loading()} />
            <div class="flex items-center gap-2 ml-4 shrink-0">
              <button onClick={openImageDialog} disabled={uploading() || loading()} class={`p-2 rounded-md hover:bg-amber-50 dark:hover:bg-white/5 text-stone-500 dark:text-stone-400 transition-colors active:scale-90 ${uploading() ? 'animate-pulse' : ''}`} title={t('insertImage')}><PhotoIcon class="w-4.5 h-4.5" /></button>
              <button onClick={handleShare} disabled={sharing() || loading() || !activeNoteId()} class="p-2 rounded-md hover:bg-amber-50 dark:hover:bg-white/5 text-stone-500 dark:text-stone-400 transition-colors active:scale-90" title={t('shareLinks')}><ShareIcon class="w-4.5 h-4.5" /></button>
              <button onClick={handleOpenSharePanel} disabled={!activeNoteId()} class="hidden sm:inline-flex px-2.5 py-1.5 rounded-md text-xs border border-amber-900/10 dark:border-white/10 text-stone-500 dark:text-stone-400 hover:bg-amber-50 dark:hover:bg-white/5 active:scale-95">{t('shareLinks')}</button>
              <button onClick={handleDelete} disabled={deleting() || loading() || !activeNoteId()} class="p-2 rounded-md hover:bg-amber-50 dark:hover:bg-white/5 text-stone-500 dark:text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-colors active:scale-90" title={t('confirmDelete')}><TrashIcon class="w-4.5 h-4.5" /></button>
              <button onClick={handleNewNote} class="md:hidden p-2 rounded-md hover:bg-amber-50 dark:hover:bg-white/5 text-stone-500 dark:text-stone-400 transition-colors active:scale-90"><PlusIcon class="w-4.5 h-4.5" /></button>
              <div class="relative flex shrink-0">
                <button onClick={handleSave} disabled={saving() || loading()} class="px-4 py-1.5 shrink-0 whitespace-nowrap rounded-l-md btn-warm-primary text-sm font-medium transition-colors disabled:opacity-50 border-r border-white/20">{saving() ? t('syncing') : t('sync')}</button>
                <button type="button" onClick={() => setSaveMenuOpen(!saveMenuOpen())} disabled={saving() || loading()} class="px-2 py-1.5 rounded-r-md btn-warm-primary text-sm font-medium transition-colors disabled:opacity-50" aria-label={t('syncMenu')}>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7" /></svg>
                </button>
                <Show when={saveMenuOpen()}>
                  <div class="absolute right-0 top-full mt-2 z-30 w-64 rounded-xl border border-amber-900/10 dark:border-white/10 bg-white/95 dark:bg-stone-950/95 backdrop-blur shadow-xl p-1 animate-panel-in">
                    <button type="button" onClick={handleDiscardLocalChanges} class="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-white/5">
                      <span class="block">{t('discardLocalChanges')}</span>
                      <span class="block mt-0.5 text-[10px] font-normal text-stone-400 dark:text-stone-500">{t('discardLocalChangesDesc')}</span>
                    </button>
                  </div>
                </Show>
              </div>
            </div>
          </div>

          <Show when={sharePanelOpen()}>
            <div class="mx-4 md:mx-8 mt-4 rounded-xl border border-amber-900/10 dark:border-white/10 glass-card backdrop-blur p-4 shadow-sm animate-panel-in">
              <div class="flex items-center justify-between mb-3"><div><div class="text-sm font-semibold text-stone-800 dark:text-stone-50">{t('shareLinks')}</div><div class="text-xs text-stone-500 dark:text-stone-50/40">{t('shareLinksDesc')}</div></div><button class="text-xs text-stone-500 hover:text-stone-950 dark:hover:text-white" onClick={() => setSharePanelOpen(false)}>{t('close')}</button></div>
              <div class="flex items-end gap-2 mb-4">
                <div class="flex flex-col gap-1 flex-1">
                  <label class="text-[10px] text-stone-500 dark:text-stone-400 uppercase tracking-wider">{t('expiryTime')}</label>
                  <select value={expiryMinutes()} onChange={e => setExpiryMinutes(parseInt(e.currentTarget.value))} class="w-full rounded-lg border border-amber-900/10 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm outline-none text-stone-950 dark:text-stone-50">
                    <option value="60">1 {t('hour')}</option>
                    <option value="720">12 {t('hours')}</option>
                    <option value="1440">24 {t('hours')}</option>
                    <option value="10080">7 {t('days')}</option>
                    <option value="43200">30 {t('days')}</option>
                    <option value="0">{t('neverExpire')}</option>
                  </select>
                </div>
                <button onClick={handleCreateShare} disabled={sharing()} class="px-4 py-2 rounded-lg btn-warm-primary text-sm font-medium disabled:opacity-50 whitespace-nowrap">{sharing() ? t('creating') : t('createShare')}</button>
              </div>
              <Show when={!shareLoading()} fallback={<div class="text-xs text-stone-400">{t('loadingShares')}</div>}>
                <Show when={shareLinks().length > 0} fallback={<div class="text-xs text-stone-400">{t('noShareLinks')}</div>}>
                  <div class="space-y-2">
                    <For each={shareLinks()}>{(share) => (
                      <div class="flex flex-col sm:flex-row sm:items-center gap-2 justify-between rounded-lg bg-amber-50/70 dark:bg-black/20 border border-amber-900/10 dark:border-white/10 px-3 py-2">
                        <div class="min-w-0"><div class="text-xs font-mono truncate text-stone-700 dark:text-stone-200">{window.location.origin + share.url}</div><div class="text-[11px] text-stone-500 dark:text-stone-50/40">{share.enabled ? t('active') : t('revoked')} · {t('expires')} {share.expiresAt ? new Date(share.expiresAt).toLocaleString() : t('never')}</div></div>
                        <div class="flex gap-2 shrink-0"><button class="px-2 py-1 rounded-md text-xs bg-amber-600 text-white" onClick={() => handleCopyShare(share)}>{t('copy')}</button><button class="px-2 py-1 rounded-md text-xs bg-red-500/10 text-red-500 border border-red-500/20 disabled:opacity-40" disabled={!share.enabled} onClick={() => handleDeleteShare(share.id)}>{t('revoke')}</button></div>
                      </div>
                    )}</For>
                  </div>
                </Show>
              </Show>
            </div>
          </Show>

          <Show when={imageDialogOpen()}>
            <div class="mx-4 md:mx-8 mt-4 rounded-xl border border-amber-900/10 dark:border-white/10 glass-card backdrop-blur p-4 shadow-sm animate-panel-in max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div class="flex items-center justify-between mb-3"><div><div class="text-sm font-semibold text-stone-800 dark:text-stone-50">{t('insertImage')}</div></div><button class="text-xs text-stone-500 hover:text-stone-950 dark:hover:text-white" onClick={() => { setImageDialogOpen(false); setExistingImages(null) }}>{t('close')}</button></div>
              <div class="grid sm:grid-cols-[1fr_220px] gap-3 mb-4">
                <label class="flex flex-col items-center justify-center min-h-28 rounded-lg border border-dashed border-amber-900/20 dark:border-white/15 bg-amber-50/60 dark:bg-black/20 cursor-pointer text-center px-4">
                  <PhotoIcon class="w-6 h-6 mb-2 text-stone-400" />
                  <span class="text-sm text-stone-700 dark:text-stone-200">{imageFile()?.name || t('chooseImage')}</span>
                  <span class="text-xs text-stone-400 mt-1">{t('imageFormats')}</span>
                  <input type="file" accept="image/*" class="hidden" onChange={(e) => { const file = e.currentTarget.files?.[0] || null; setImageFile(file); if (file && !imageAlt()) setImageAlt(file.name.replace(/\\.[^.]+$/, '')) }} />
                </label>
                <div class="flex flex-col gap-2">
                  <input value={imageAlt()} onInput={e => setImageAlt(e.currentTarget.value)} placeholder={t('altText')} class="w-full rounded-lg border border-amber-900/10 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm outline-none text-stone-950 dark:text-stone-50" />
                  <button onClick={handleInsertImage} disabled={uploading()} class="rounded-lg btn-warm-primary text-sm font-medium py-2 disabled:opacity-50">{uploading() ? t('uploading') : t('uploadAndInsert')}</button>
                </div>
              </div>
              <Show when={existingImages() === null}>
                <div class="flex items-center justify-center py-4 text-stone-400"><div class="animate-spin rounded-full h-5 w-5 border-t-2 border-amber-600 border-r-2 border-r-transparent mr-2" />{t('loading')}</div>
              </Show>
              <Show when={existingImages() !== null && existingImages()!.length > 0}>
                <div class="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">{t('myImages')}</div>
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  <For each={existingImages()!}>{img => (
                    <button onClick={() => handleInsertExistingImage(img)} class="border border-amber-900/10 dark:border-white/10 rounded-lg overflow-hidden bg-amber-50/30 dark:bg-black/20 hover:ring-2 hover:ring-amber-500 transition-all cursor-pointer active:scale-95">
                      <LazyImage 
                        src={`${BASE_URL}/api/media/${img.r2_key || ''}?token=${encodeURIComponent(token()!)}`} 
                        alt={img.filename} 
                        class="w-full h-20 object-cover" 
                        containerClass="w-full h-20"
                      />
                      <div class="text-[9px] text-stone-500 dark:text-stone-400 truncate px-1 py-0.5">{img.filename}</div>
                    </button>
                  )}</For>
                </div>
              </Show>
            </div>
          </Show>
          
          <div class="flex-1 min-h-0 h-full overflow-y-auto custom-scrollbar relative" onKeyDown={onKeyDown}>
            <Show when={!loading()} fallback={
              <div class="p-4 md:p-8 animate-pulse">
                <div class="h-10 bg-stone-200 dark:bg-white/10 rounded-md w-1/3 mb-8"></div>
                <div class="space-y-4">
                  <div class="h-4 bg-stone-200 dark:bg-white/10 rounded w-3/4"></div>
                  <div class="h-4 bg-stone-200 dark:bg-white/10 rounded w-5/6"></div>
                  <div class="h-4 bg-stone-200 dark:bg-white/10 rounded w-1/2"></div>
                </div>
              </div>
            }>
              <div class="p-4 md:p-8">
                <For each={[editorKey()]}>
                {() => (
                  <WysiwygEditor
                    content={content()}
                    onChange={setContent}
                    transformSrc={transformEditorImageSrc}
                    class="min-h-[55vh]"
                  />
                )}
              </For>
              </div>


            </Show>
          </div>
        </Show>
      </div>
    </div>
  )
}
