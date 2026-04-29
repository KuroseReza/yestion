import { getActiveShareLink } from '../lib/shareService'
import { getDocContent, getImageById } from '../lib/db'
import * as docService from '../lib/docService'

interface Env {
  DB: D1Database
  R2: R2Bucket
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;')
}

function stripMarkdown(md: string): string {
  return md.replace(/[#*`\\[\\]()!>|\\-~_]/g, '').replace(/\\n+/g, ' ').replace(/\\s+/g, ' ').trim()
}

// Synced from dist/index.html via build_and_sync.sh
const CSS_PATH = '/assets/index-d4bswsIW.css'
const JS_PATH = '/assets/index-d70jJJIY.js'

function renderHtml(ogTags: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${ogTags}
    <script>
      if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    </script>
    <script type="module" crossorigin src="${JS_PATH}"></script>
    <link rel="stylesheet" crossorigin href="${CSS_PATH}">
  </head>
  <body class="bg-slate-50 text-slate-900 dark:bg-[#0a0a0a] dark:text-[#ededef] antialiased transition-colors duration-300">
    <div id="root"></div>
  </body>
</html>`
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const shareId = (context.params as any).id
  if (!shareId) return context.next()

  try {
    const share = await getActiveShareLink(context.env, shareId)
    if (!share) return context.next()

    const doc = await docService.getDocMetadata(context.env, share.doc_id)
    if (!doc) return context.next()

    const content = await getDocContent(context.env.R2, doc.r2_key)
    const description = stripMarkdown(content).slice(0, 200)

    // Find first image — support UUID, full URL, and relative path formats
    const imgMatch = content.match(/!\[[^\]]*\]\(([^)]+)\)/)
    let ogImage = ''
    if (imgMatch) {
      const rawUrl = imgMatch[1]
      const base = new URL(context.request.url).origin
      if (rawUrl.startsWith('/api/media/')) {
        const key = rawUrl.slice('/api/media/'.length)
        ogImage = `${base}/api/share/${shareId}/media/${encodeURIComponent(key)}`
      } else if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        ogImage = rawUrl
      } else if (rawUrl.startsWith('/')) {
        ogImage = new URL(rawUrl, base).href
      } else {
        // UUID format: ![alt](uuid) or ![alt](uuid.png)
        const id = rawUrl.includes('.') ? rawUrl.substring(0, rawUrl.lastIndexOf('.')) : rawUrl
        const img = await getImageById(context.env.DB, id)
        if (img) {
          ogImage = `${base}/api/share/${shareId}/media/${encodeURIComponent(img.r2_key)}`
        }
      }
    }

    const t = escapeHtml(doc.title)
    const d = escapeHtml(description)
    const img = ogImage ? escapeHtml(ogImage) : ''

    const ogTags = [
      `<title>${t} – Yestion</title>`,
      `<meta property="og:title" content="${t}" />`,
      `<meta property="og:description" content="${d}" />`,
      `<meta property="og:type" content="article" />`,
      `<meta property="og:url" content="${context.request.url}" />`,
      `<meta property="og:site_name" content="Yestion" />`,
      img ? `<meta property="og:image" content="${img}" />` : '',
      `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}" />`,
      `<meta name="twitter:title" content="${t}" />`,
      `<meta name="twitter:description" content="${d}" />`,
      img ? `<meta name="twitter:image" content="${img}" />` : '',
    ].filter(Boolean).join('\n    ')

    return new Response(renderHtml(ogTags), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    })
  } catch {
    return context.next()
  }
}
