import { createSignal, onMount } from 'solid-js'
import { useParams } from '@solidjs/router'
import MarkdownPreview from '../components/MarkdownPreview'
import { BASE_URL } from '../utils/api'

export default function Share() {
  const params = useParams()
  const [_title, setTitle] = createSignal('')
  const [content, setContent] = createSignal('')
  const [imageMap, setImageMap] = createSignal<Record<string, string>>({})
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal('')

  onMount(async () => {
    try {
      const shareId = params.id
      if (!shareId) throw new Error('Invalid share link')

      // Fetch document content and image map in parallel
      const [docRes, imgRes] = await Promise.all([
        fetch(`${BASE_URL}/api/share/${shareId}`),
        fetch(`${BASE_URL}/api/share/${shareId}/images`),
        
      ])

      if (!docRes.ok) {
        if (docRes.status === 403) throw new Error('Link revoked or expired')
        if (docRes.status === 404) throw new Error('Document not found')
        throw new Error('Failed to load document')
      }

      const data = await docRes.json() as { title: string; content: string }
      setTitle(data.title || 'Untitled')
      setContent(data.content || '')

      // Build image map: UUID → r2_key
      if (imgRes.ok) {
        const imgData = await imgRes.json() as { images: { id: string; r2_key: string }[] }
        const map: Record<string, string> = {}
        for (const img of imgData.images || []) {
          map[img.id] = img.r2_key
        }
        setImageMap(map)
      }

      
    } catch (err: any) {
      setError(err.message || 'Failed to load document')
    } finally {
      setLoading(false)
    }
  })

  // Visitor image URLs: route through share-scoped media endpoint
  const transformImgSrc = (href: string) => {
    const src = href || ''
    if (!src) return src
    if (src.startsWith('data:') || src.startsWith('blob:')) return src

    let key = ''
    const sameOriginMediaPrefix = `${BASE_URL}/api/media/`
    if (src.startsWith('/api/media/')) {
      key = src.slice('/api/media/'.length)
    } else if (src.startsWith(sameOriginMediaPrefix)) {
      key = src.slice(sameOriginMediaPrefix.length)
    } else if (src.startsWith('http://') || src.startsWith('https://')) {
      return src
    } else {
      const normalized = src.includes('.') ? src.substring(0, src.lastIndexOf('.')) : src
      key = imageMap()[src] || imageMap()[normalized] || (src.includes('/') ? src.replace(/^\/+/, '') : '')
    }

    if (!key) return src
    let decodedKey = key
    try { decodedKey = decodeURIComponent(key) } catch { /* keep encoded key */ }
    return `${BASE_URL}/api/share/${params.id}/media/${encodeURIComponent(decodedKey)}`
  }

  return (
    <div class="min-h-screen warm-aurora text-stone-900 font-sans antialiased p-4 sm:p-8 md:p-12 overflow-y-auto">
      <div class="pointer-events-none fixed inset-0 opacity-70 [background:radial-gradient(circle_at_20%_10%,rgba(245,158,11,.18),transparent_24rem),radial-gradient(circle_at_82%_18%,rgba(251,146,60,.14),transparent_22rem)]" />
      <article class="relative max-w-4xl mx-auto glass-panel rounded-[2rem] p-5 sm:p-8 md:p-12 animate-fade-in">
        <header class="flex flex-col gap-3 border-b border-amber-900/10 pb-7 mb-8">
          <div class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_24px_rgba(245,158,11,.55)]" />
            <div class="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700/80">Yestion Shared Note</div>
          </div>
        </header>

        {loading() && (
          <div class="flex items-center justify-center py-20 text-stone-500 w-full animate-fade-in">
            <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-600 border-r-2 border-r-transparent mr-3"></div>
            Loading...
          </div>
        )}

        {error() && (
          <div class="py-10 px-4 text-center text-red-700 bg-red-50/70 rounded-2xl border border-red-200/80 animate-fade-in">
            {error()}
          </div>
        )}

        {!loading() && !error() && (
          <MarkdownPreview
            content={content()}
            imageMap={imageMap()}
            transformSrc={transformImgSrc}
            class="share-markdown wysiwyg-share"
          />
        )}
      </article>
    </div>
  )
}
