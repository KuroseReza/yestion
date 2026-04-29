import { createMemo, onMount, onCleanup, createEffect, createSignal, Show } from 'solid-js'
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
  const [zoomedSrc, setZoomedSrc] = createSignal<string | null>(null)

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
      const alt = escapeAttr(String(text || ''))
      const t = title ? escapeAttr(String(title)) : ''
      return `<span data-yes-img data-share-image-placeholder="true" data-src="${escapeAttr(src)}" data-alt="${alt}" data-title="${t}"></span>`
    }

    // Avoid raw HTML execution/rendering in public share viewer.
    ;(r as any).html = ({ text }: any) => escapeHtml(String(text || ''))

    return marked.parse(props.content || '', { renderer: r }) as string
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

      const dispose = render(
        () => (
          <div onClick={() => setZoomedSrc(src)} class="share-image-frame cursor-zoom-in">
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
      <Show when={zoomedSrc()}>
        <div
          class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setZoomedSrc(null)}
        >
          <img
            src={zoomedSrc()!}
            class="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-image-in"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </Show>
    </>
  )
}
