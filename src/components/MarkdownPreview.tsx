import { createMemo, onMount, onCleanup, createEffect } from 'solid-js'
import { render } from 'solid-js/web'
import { marked } from 'marked'
import mermaid from 'mermaid'
import { mermaidThemeConfig } from '../utils/mermaidTheme'
import LazyImage from './LazyImage'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const SVG_NS = 'http://www.w3.org/2000/svg'

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/"/g, '&quot;')
}

function imagePlaceholderHtml(src: string, alt = '', title = '', width = '', height = '') {
  const widthAttr = width ? ` data-width="${escapeAttr(width)}"` : ''
  const heightAttr = height ? ` data-height="${escapeAttr(height)}"` : ''
  return `<span data-yes-img data-share-image-placeholder="true" data-src="${escapeAttr(src)}" data-alt="${escapeAttr(alt)}" data-title="${escapeAttr(title)}"${widthAttr}${heightAttr}></span>`
}

function createImagePlaceholderElement(src: string, alt = '', title = '', width = '', height = '') {
  const placeholder = document.createElement('span')
  placeholder.setAttribute('data-yes-img', '')
  placeholder.setAttribute('data-share-image-placeholder', 'true')
  placeholder.setAttribute('data-src', src)
  placeholder.setAttribute('data-alt', alt)
  placeholder.setAttribute('data-title', title)
  if (width) placeholder.setAttribute('data-width', width)
  if (height) placeholder.setAttribute('data-height', height)
  return placeholder
}

function numericDimension(value: string) {
  const trimmed = value.trim()
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return undefined
  const n = Number(trimmed)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function imageFrameStyle(width: string, height: string) {
  const w = numericDimension(width)
  const h = numericDimension(height)
  if (!w && !h) return undefined

  const style: Record<string, string> = {}
  if (w) style['max-width'] = `${w}px`
  if (w && h) style['aspect-ratio'] = `${w} / ${h}`
  return style
}

const allowedHtmlTags = new Set([
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'ins',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'picture',
  'pre',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'small',
  'source',
  'span',
  'strike',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
])

const removedHtmlTags = new Set([
  'base',
  'button',
  'embed',
  'form',
  'iframe',
  'input',
  'link',
  'meta',
  'object',
  'script',
  'select',
  'style',
  'textarea',
])

const globalHtmlAttrs = new Set([
  'align',
  'aria-hidden',
  'aria-label',
  'dir',
  'height',
  'id',
  'lang',
  'role',
  'title',
  'width',
])

const tagHtmlAttrs: Record<string, Set<string>> = {
  a: new Set(['href', 'name', 'target', 'rel']),
  blockquote: new Set(['cite']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
  details: new Set(['open']),
  img: new Set(['alt', 'decoding', 'loading', 'src', 'srcset']),
  li: new Set(['value']),
  ol: new Set(['reversed', 'start', 'type']),
  q: new Set(['cite']),
  source: new Set(['src', 'srcset', 'type', 'media']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
}

const alertLabels: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
}

const safeDataImagePattern = /^data:image\/(?:png|gif|jpe?g|webp|avif);base64,[a-z0-9+/]+=*$/i

function isAllowedHtmlAttr(tag: string, attr: string) {
  return globalHtmlAttrs.has(attr) || tagHtmlAttrs[tag]?.has(attr) || false
}

function normalizeUrl(value: string) {
  return value.trim().replace(/[\u0000-\u001f\u007f]+/g, '')
}

function isSafeUrl(value: string, image = false) {
  const normalized = normalizeUrl(value)

  if (!normalized) return false
  if (normalized.startsWith('#')) return true
  if (normalized.startsWith('/') && !normalized.startsWith('//')) return true
  if (normalized.startsWith('./') || normalized.startsWith('../')) return true
  if (image && safeDataImagePattern.test(normalized)) return true

  try {
    const base = typeof window === 'undefined' ? 'https://example.invalid' : window.location.origin
    const url = new URL(normalized, base)
    const protocol = url.protocol.toLowerCase()
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:' || protocol === 'tel:' || (image && protocol === 'blob:')
  } catch {
    return false
  }
}

function sanitizeSrcset(value: string, resolveSrc: (href: string) => string) {
  return value
    .split(',')
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/)
      const src = parts.shift()
      if (!src) return ''
      const resolved = resolveSrc(src)
      if (!isSafeUrl(resolved, true)) return ''
      return [resolved, ...parts].join(' ')
    })
    .filter(Boolean)
    .join(', ')
}

function unwrapElement(element: Element) {
  const parent = element.parentNode
  if (!parent) return

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }

  element.remove()
}

function sanitizeHtmlNode(node: Node, resolveSrc: (href: string) => string) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove()
      continue
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue

    const element = child as HTMLElement
    const tag = element.tagName.toLowerCase()

    if (removedHtmlTags.has(tag)) {
      element.remove()
      continue
    }

    if (!allowedHtmlTags.has(tag)) {
      sanitizeHtmlNode(element, resolveSrc)
      unwrapElement(element)
      continue
    }

    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.name.toLowerCase()
      const originalName = attr.name
      const value = attr.value

      if (attrName.startsWith('on') || attrName === 'style' || attrName === 'srcdoc' || !isAllowedHtmlAttr(tag, attrName)) {
        element.removeAttribute(originalName)
        continue
      }

      if (attrName === 'href' || attrName === 'cite') {
        const normalized = normalizeUrl(value)
        if (!isSafeUrl(normalized)) {
          element.removeAttribute(originalName)
          continue
        }
        element.setAttribute(originalName, normalized)
      }

      if (attrName === 'src') {
        const resolved = resolveSrc(value)
        if (!isSafeUrl(resolved, true)) {
          element.removeAttribute(originalName)
          continue
        }
        element.setAttribute(originalName, resolved)
      }

      if (attrName === 'srcset') {
        const srcset = sanitizeSrcset(value, resolveSrc)
        if (!srcset) {
          element.removeAttribute(originalName)
          continue
        }
        element.setAttribute(originalName, srcset)
      }
    }

    if (tag === 'a') {
      const href = element.getAttribute('href') || ''
      if (/^https?:\/\//i.test(href)) {
        element.setAttribute('target', '_blank')
        element.setAttribute('rel', 'nofollow noopener noreferrer')
      }
    }

    if (tag === 'img') {
      const src = element.getAttribute('src') || ''
      if (!src) {
        element.remove()
        continue
      }

      element.replaceWith(createImagePlaceholderElement(
        src,
        element.getAttribute('alt') || '',
        element.getAttribute('title') || '',
        element.getAttribute('width') || '',
        element.getAttribute('height') || '',
      ))
      continue
    }

    sanitizeHtmlNode(element, resolveSrc)
  }
}

function sanitizeHtmlFragment(html: string, resolveSrc: (href: string) => string) {
  if (!html.trim()) return ''
  if (typeof document === 'undefined') return escapeHtml(html)

  const template = document.createElement('template')
  template.innerHTML = html
  sanitizeHtmlNode(template.content, resolveSrc)
  return template.innerHTML
}

function decodeHtmlEntities(value: string) {
  if (typeof document === 'undefined') return value

  const textarea = document.createElement('textarea')
  textarea.innerHTML = value
  return textarea.value
}

function tokensToPlainText(tokens: any): string {
  if (!tokens) return ''
  if (Array.isArray(tokens)) return tokens.map(tokensToPlainText).join('')
  if (Array.isArray(tokens.tokens)) return tokensToPlainText(tokens.tokens)
  if (typeof tokens.text === 'string') return tokens.text
  if (typeof tokens.raw === 'string') return tokens.raw
  return ''
}

function githubSlug(value: string, counts: Map<string, number>) {
  const base =
    decodeHtmlEntities(value)
      .replace(/<[^>]*>/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  const seen = counts.get(base) || 0
  counts.set(base, seen + 1)
  return seen ? base + '-' + seen : base
}

function renderGithubAlert(body: string) {
  const marker = body.match(/^\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>\s*)?/i)
  if (!marker) return ''

  const kind = marker[1].toLowerCase()
  let content = body.slice(marker[0].length)

  if (content.startsWith('</p>')) {
    content = content.slice('</p>'.length)
  } else {
    content = '<p>' + content
  }

  return '<div class="share-alert share-alert-' + kind + '"><div class="share-alert-title">' + alertLabels[kind] + '</div>' + content + '</div>\n'
}


function stripMermaidLabel(raw: string) {
  return raw
    .replace(/^\[|\]$/g, '')
    .replace(/^\{|\}$/g, '')
    .replace(/^\(\(|\)\)$/g, '')
    .replace(/^\(|\)$/g, '')
    .trim()
}

function collectFlowchartLabels(content: string) {
  const nodeLabels = new Map<string, string>()
  const edgeLabels = new Map<string, string>()
  const nodeRe = /\b([A-Za-z][\w-]*)\s*(\[([^\]]+)\]|\{([^}]+)\}|\(\(([^)]+)\)\)|\(([^)]+)\))/g
  let m: RegExpExecArray | null
  while ((m = nodeRe.exec(content)) !== null) {
    const id = m[1]
    const label = stripMermaidLabel(m[2])
    if (id && label) nodeLabels.set(id, label)
  }

  const edgeRe = /\b([A-Za-z][\w-]*)\b\s*[-.=]+>\s*\|([^|]+)\|\s*\b([A-Za-z][\w-]*)\b/g
  while ((m = edgeRe.exec(content)) !== null) {
    const [, from, label, to] = m
    if (from && to && label.trim()) edgeLabels.set(`${from}_${to}`, label.trim())
  }
  return { nodeLabels, edgeLabels }
}

function appendSvgLabel(parent: Element, label: string) {
  const text = document.createElementNS(SVG_NS, 'text')
  text.setAttribute('x', '0')
  text.setAttribute('y', '0')
  text.setAttribute('text-anchor', 'middle')
  text.setAttribute('dominant-baseline', 'central')
  text.setAttribute('fill', '#fffbeb')
  text.setAttribute('style', 'fill:#fffbeb!important;color:#fffbeb!important;font-size:16px;font-weight:500;')
  text.textContent = label
  parent.appendChild(text)
}

function repairEmptyMermaidFlowchartLabels(svgEl: SVGSVGElement, content: string) {
  const { nodeLabels, edgeLabels } = collectFlowchartLabels(content)
  if (!nodeLabels.size && !edgeLabels.size) return

  svgEl.querySelectorAll<SVGGElement>('g.node[id*="-flowchart-"]').forEach((node) => {
    if (node.textContent?.trim()) return
    const match = node.id.match(/-flowchart-(.+?)-\d+$/)
    const label = match ? nodeLabels.get(match[1]) : undefined
    if (label) appendSvgLabel(node, label)
  })

  svgEl.querySelectorAll<SVGGElement>('g.edgeLabel g.label[data-id^="L_"]').forEach((labelGroup) => {
    if (labelGroup.textContent?.trim()) return
    const id = labelGroup.getAttribute('data-id') || ''
    const match = id.match(/^L_(.+)_(.+)_\d+$/)
    const label = match ? edgeLabels.get(`${match[1]}_${match[2]}`) : undefined
    if (label) appendSvgLabel(labelGroup, label)
  })
}

export default function MarkdownPreview(props: {
  content: string
  class?: string
  baseUrl?: string
  token?: string
  /** id → r2_key mapping for UUID-style references `![alt](uuid)` */
  imageMap?: Record<string, string>
  /** Share context: rewrites /api/media/xxx → share endpoint */
  transformSrc?: (href: string) => string
}) {
  let containerRef: HTMLDivElement | undefined
  const disposers = new Set<() => void>()

  /** Resolve an image href to a real API URL */
  function resolveSrc(href: string): string {
    if (!href) return ''
    if (href.startsWith('data:') || href.startsWith('blob:')) return href

    // UUID reference: ![alt](uuid) or ![alt](uuid.png)
    const uuidMatch = href.match(UUID_RE)
    if (uuidMatch && props.imageMap) {
      const r2Key = props.imageMap[uuidMatch[0]]
      if (r2Key) {
        const apiPath = `/api/media/${r2Key}`
        if (props.transformSrc) return props.transformSrc(apiPath)
        let url = props.baseUrl ? `${props.baseUrl}${apiPath}` : apiPath
        if (props.token) url += '?token=' + encodeURIComponent(props.token)
        return url
      }
    }

    if (props.transformSrc) return props.transformSrc(href)
    return href
  }

  const html = createMemo(() => {
    const r = new marked.Renderer()

    const headingSlugs = new Map<string, number>()

    ;(r as any).heading = function (this: any, { tokens, depth }: any) {
      const text = tokensToPlainText(tokens)
      const id = githubSlug(text, headingSlugs)
      const body = this.parser.parseInline(tokens)
      const safeId = escapeAttr(id)
      return '<h' + depth + ' id="' + safeId + '"><a class="share-heading-anchor" href="#' + safeId + '" aria-hidden="true">#</a>' + body + '</h' + depth + '>'
    }

    ;(r as any).blockquote = function (this: any, { tokens }: any) {
      const body = this.parser.parse(tokens)
      const alert = renderGithubAlert(body)
      if (alert) return alert
      return '<blockquote>\n' + body + '</blockquote>\n'
    }

    ;(r as any).checkbox = ({ checked }: any) =>
      '<input class="share-task-checkbox" ' + (checked ? 'checked="" ' : '') + 'disabled="" type="checkbox"> '

    // Public share viewer: use static HTML, not Milkdown/CodeMirror.
    r.code = ({ text, lang }: any) => {
      const language = String(lang || '').toLowerCase()
      const source = String(text || '')
      if (language === 'mermaid') {
        return `<div class="share-mermaid-block mermaid-preview-container"><div class="mermaid" data-mermaid-source="${encodeURIComponent(source)}">${escapeHtml(source)}</div></div>`
      }
      return `<pre class="share-code-block"><code class="language-${escapeAttr(language)}">${escapeHtml(source)}</code></pre>`
    }

    r.image = ({ href, title, text }: any) => {
      const src = resolveSrc(String(href || ''))
      return imagePlaceholderHtml(src, String(text || ''), title ? String(title) : '')
    }

    // Render GitHub-style inline HTML, but only after stripping unsafe tags and attributes.
    ;(r as any).html = ({ text }: any) => sanitizeHtmlFragment(String(text || ''), resolveSrc)

    return marked.parse(props.content || '', { renderer: r, gfm: true, breaks: false }) as string
  })

  async function hydrateMermaid() {
    if (!containerRef) return
    const nodes = Array.from(containerRef.querySelectorAll<HTMLElement>('.mermaid'))
    if (!nodes.length) return
    try {
      mermaid.initialize(mermaidThemeConfig as any)
      await mermaid.run({ nodes })
      nodes.forEach((node) => {
        const source = decodeURIComponent(node.getAttribute('data-mermaid-source') || '')
        const svg = node.querySelector<SVGSVGElement>('svg')
        if (svg && source) repairEmptyMermaidFlowchartLabels(svg, source)
      })
    } catch (e) {
      console.error('Mermaid render error:', e)
    }
  }

  function normalizeImageParagraphs() {
    if (!containerRef) return
    containerRef.querySelectorAll<HTMLParagraphElement>('p').forEach((paragraph) => {
      const children = Array.from(paragraph.childNodes).filter((node) => {
        return node.nodeType !== Node.TEXT_NODE || Boolean(node.textContent?.trim())
      })
      if (children.length === 1) {
        const only = children[0] as HTMLElement
        if (only.nodeType === Node.ELEMENT_NODE && only.hasAttribute('data-share-image-placeholder')) {
          paragraph.classList.add('share-image-paragraph')
        }
      }
    })
  }

  function hydrateImages() {
    for (const d of disposers) d()
    disposers.clear()
    if (!containerRef) return

    const placeholders = containerRef.querySelectorAll('[data-yes-img]')
    placeholders.forEach((el) => {
      const src = el.getAttribute('data-src') || ''
      const alt = el.getAttribute('data-alt') || ''
      const title = el.getAttribute('data-title') || ''
      const width = el.getAttribute('data-width') || ''
      const height = el.getAttribute('data-height') || ''
      const frameStyle = imageFrameStyle(width, height)

      const dispose = render(
        () => (
          <div class="share-image-frame cursor-zoom-in" style={frameStyle}>
            <LazyImage
              src={src}
              alt={alt}
              title={title || undefined}
              containerClass="share-lazy-image"
              class="share-lazy-image-img"
            />
          </div>
        ),
        el as HTMLElement
      )
      disposers.add(dispose)
    })
  }

  function hydrateDynamicContent() {
    normalizeImageParagraphs()
    hydrateImages()
    void hydrateMermaid()
  }

  onMount(() => hydrateDynamicContent())
  createEffect(() => {
    html()
    queueMicrotask(() => hydrateDynamicContent())
  })

  onCleanup(() => {
    for (const d of disposers) d()
    disposers.clear()
  })

  return (
    <>
      <div
        ref={containerRef}
        class={props.class || ''}
        innerHTML={html()}
      />
    </>
  )
}
