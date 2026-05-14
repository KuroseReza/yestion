import { getActiveShareLink } from '../lib/shareService'
import { getDocContent, getImageById } from '../lib/db'
import * as docService from '../lib/docService'
import type { Env as AppEnv } from '../lib/index'

interface Env extends AppEnv {
  ASSETS: Fetcher
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;')
}

function stripMarkdown(md: string): string {
  return md.replace(/[#*`\\[\\]()!>|\\-~_]/g, '').replace(/\\n+/g, ' ').replace(/\\s+/g, ' ').trim()
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

    const pageTitle = `${doc.title} - Yestion`
    const t = escapeHtml(doc.title)
    const d = escapeHtml(description)
    const img = ogImage ? escapeHtml(ogImage) : ''

    const ogTags = [
      `<meta property="og:title" content="${t}" />`,
      `<meta property="og:description" content="${d}" />`,
      `<meta property="og:type" content="article" />`,
      `<meta property="og:url" content="${escapeHtml(context.request.url)}" />`,
      `<meta property="og:site_name" content="Yestion" />`,
      img ? `<meta property="og:image" content="${img}" />` : '',
      `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}" />`,
      `<meta name="twitter:title" content="${t}" />`,
      `<meta name="twitter:description" content="${d}" />`,
      img ? `<meta name="twitter:image" content="${img}" />` : '',
    ].filter(Boolean).join('\n    ')

    const shellUrl = new URL('/', context.request.url)
    const shell = await context.env.ASSETS.fetch(shellUrl)
    if (!shell.ok) return context.next()

    const rewritten = new HTMLRewriter()
      .on('title', {
        element(element) {
          element.setInnerContent(pageTitle)
        },
      })
      .on('head', {
        element(element) {
          element.append(`\n    ${ogTags}`, { html: true })
        },
      })
      .transform(shell)

    const headers = new Headers(rewritten.headers)
    headers.set('Content-Type', 'text/html; charset=utf-8')
    headers.set('Cache-Control', 'public, max-age=300')

    return new Response(rewritten.body, {
      status: rewritten.status,
      statusText: rewritten.statusText,
      headers,
    })
  } catch {
    return context.next()
  }
}
