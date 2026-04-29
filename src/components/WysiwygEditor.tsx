import { createSignal, onMount, onCleanup } from 'solid-js'
import { render } from 'solid-js/web'
import { Crepe } from '@milkdown/crepe'
import { $view } from '@milkdown/kit/utils'
import { imageSchema } from '@milkdown/kit/preset/commonmark'
import { imageBlockSchema } from '@milkdown/kit/component/image-block'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/nord.css'
import '../crepe-overrides.css'
import LazyImage from './LazyImage'
import { mermaidThemeConfig } from '../utils/mermaidTheme'

const LS_DEBOUNCE_MS = 500

const SVG_NS = 'http://www.w3.org/2000/svg'

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

function appendSvgLabel(parent: Element, label: string, y = 0) {
  const text = document.createElementNS(SVG_NS, 'text')
  text.setAttribute('x', '0')
  text.setAttribute('y', String(y))
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

function createLazyImageViewDom(initial: {
  src: string
  alt?: string
  title?: string
  block?: boolean
}, transformSrc?: (src: string) => string, onImageClick?: (src: string) => void) {
  const dom = document.createElement(initial.block ? 'div' : 'span')
  dom.className = initial.block
    ? 'wysiwyg-lazy-image wysiwyg-lazy-image-block milkdown-image-block'
    : 'wysiwyg-lazy-image milkdown-image-inline'
  dom.dataset.lazyImage = 'true'
  if (initial.block) {
    dom.contentEditable = 'false'
    dom.draggable = true
  }

  const [image, setImage] = createSignal({
    src: transformSrc?.(initial.src) || initial.src,
    alt: initial.alt || '',
    title: initial.title || '',
  })

  const dispose = render(
    () => {
      const data = image()
      return (
        <LazyImage
          src={data.src}
          alt={data.alt}
          title={data.title || undefined}
          animate={false}
          containerClass="wysiwyg-lazy-image-container"
          class="wysiwyg-lazy-image-img"
          onClick={onImageClick ? () => onImageClick(data.src) : undefined}
        />
      )
    },
    dom
  )

  return {
    dom,
    update: (next: { src: string; alt?: string; title?: string }) => {
      setImage({
        src: transformSrc?.(next.src) || next.src,
        alt: next.alt || '',
        title: next.title || '',
      })
    },
    dispose,
  }
}

const createLazyInlineImageView = (transformSrc?: (src: string) => string, onImageClick?: (src: string) => void) => $view(imageSchema.node, () => {
  return (initialNode) => {
    const view = createLazyImageViewDom({
      src: String(initialNode.attrs.src || ''),
      alt: String(initialNode.attrs.alt || ''),
      title: String(initialNode.attrs.title || ''),
    }, transformSrc, onImageClick)

    return {
      dom: view.dom,
      update: (updatedNode: typeof initialNode) => {
        if (updatedNode.type !== initialNode.type) return false
        view.update({
          src: String(updatedNode.attrs.src || ''),
          alt: String(updatedNode.attrs.alt || ''),
          title: String(updatedNode.attrs.title || ''),
        })
        return true
      },
      selectNode: () => view.dom.classList.add('selected'),
      deselectNode: () => view.dom.classList.remove('selected'),
      destroy: () => view.dispose(),
    }
  }
})

const createLazyImageBlockView = (transformSrc?: (src: string) => string, onImageClick?: (src: string) => void) => $view(imageBlockSchema.node, () => {
  return (initialNode) => {
    const view = createLazyImageViewDom({
      src: String(initialNode.attrs.src || ''),
      alt: String(initialNode.attrs.caption || ''),
      title: String(initialNode.attrs.caption || ''),
      block: true,
    }, transformSrc, onImageClick)

    return {
      dom: view.dom,
      update: (updatedNode: typeof initialNode) => {
        if (updatedNode.type !== initialNode.type) return false
        const caption = String(updatedNode.attrs.caption || '')
        view.update({
          src: String(updatedNode.attrs.src || ''),
          alt: caption,
          title: caption,
        })
        return true
      },
      selectNode: () => view.dom.classList.add('selected'),
      deselectNode: () => view.dom.classList.remove('selected'),
      destroy: () => view.dispose(),
    }
  }
})

export default function WysiwygEditor(props: {
  readonly?: boolean
  content: string
  onChange?: (markdown: string) => void
  class?: string
  /** Rewrite image src before rendering, e.g. note image IDs → authenticated media URLs. */
  transformSrc?: (src: string) => string
  /** Open rendered images (used by the public share page image zoom). */
  onImageClick?: (src: string) => void
  /** localStorage key for auto-saving drafts. Omit to disable. */
  storageKey?: string
}) {
      const [isInitializing, setIsInitializing] = createSignal(true)
  let containerRef: HTMLDivElement | undefined
  let crepe: Crepe | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let readonlyObserver: MutationObserver | null = null

  const saveToStorage = (markdown: string) => {
    if (!props.storageKey) return
    try {
      localStorage.setItem(props.storageKey, markdown)
    } catch { /* quota exceeded — silently skip */ }
  }

  const lockReadonlyDom = () => {
    if (!props.readonly || !containerRef) return
    containerRef.querySelectorAll<HTMLElement>('.cm-content, .cm-editor, .codemirror-host, .milkdown-code-block').forEach((el) => {
      if (el.getAttribute('contenteditable') !== 'false') el.setAttribute('contenteditable', 'false')
      if (el.getAttribute('tabindex') !== '-1') el.setAttribute('tabindex', '-1')
      if (el.getAttribute('aria-readonly') !== 'true') el.setAttribute('aria-readonly', 'true')
      el.blur()
    })
  }

  onMount(async () => {
    if (!containerRef) return

    // Restore draft from localStorage, falling back to prop
    let initial = props.content
    if (props.storageKey) {
      try {
        const saved = localStorage.getItem(props.storageKey)
        if (saved != null) initial = saved
      } catch { /* storage unavailable */ }
    }

    crepe = new Crepe({
      root: containerRef,
      defaultValue: initial,
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: {
          previewOnlyByDefault: false,
          renderPreview: (language, content, applyPreview) => {
            const normalizedLanguage = (language || '').toLowerCase()
            if (normalizedLanguage === 'mermaid' && content.trim()) {
              // Return placeholder → enables Crepe preview mode
              // Focus=show editor, Blur=show preview (code hidden)
              const placeholder = document.createElement('div')
              placeholder.style.cssText =
                'display:flex;align-items:center;justify-content:center;padding:36px 16px;' +
                'color:#a39d96;font-size:13px;'
              placeholder.textContent = 'Rendering diagram…'

              void (async () => {
                try {
                  const { default: mermaid } = await import('mermaid')
                  await mermaid.parse(content) // validate first — no error SVG
                  mermaid.initialize({ ...mermaidThemeConfig, securityLevel: "loose" as const })
                  const id = 'mermaid-' + Math.random().toString(36).slice(2, 8)
                  const { svg } = await mermaid.render(id, content)
                  const div = document.createElement('div')
                  div.innerHTML = svg
                  const style = document.createElement('style')
                  style.textContent = `
                    .mermaid-preview-inner svg text,
                    .mermaid-preview-inner svg tspan,
                    .mermaid-preview-inner svg .nodeLabel,
                    .mermaid-preview-inner svg .nodeLabel *,
                    .mermaid-preview-inner svg .label text,
                    .mermaid-preview-inner svg .edgeLabel,
                    .mermaid-preview-inner svg .edgeLabel *,
                    .mermaid-preview-inner svg .edgeLabel text,
                    .mermaid-preview-inner svg .edgeLabel tspan,
                    .mermaid-preview-inner svg foreignObject,
                    .mermaid-preview-inner svg foreignObject *,
                    .mermaid-preview-inner svg span,
                    .mermaid-preview-inner svg p {
                      fill: #fffbeb !important;
                      color: #fffbeb !important;
                    }
                    .mermaid-preview-inner svg .node rect,
                    .mermaid-preview-inner svg .node circle,
                    .mermaid-preview-inner svg .node ellipse,
                    .mermaid-preview-inner svg .node polygon,
                    .mermaid-preview-inner svg .node path {
                      fill: #451a03 !important;
                      stroke: #d97706 !important;
                    }
                    .mermaid-preview-inner svg .edgeLabel,
                    .mermaid-preview-inner svg .edgeLabel p,
                    .mermaid-preview-inner svg .labelBkg {
                      background-color: #292524 !important;
                      color: #fffbeb !important;
                      fill: #292524 !important;
                    }
                  `
                  div.appendChild(style)
                  div.className = 'mermaid-preview-inner'
                  div.style.cssText =
                    'display:flex;justify-content:center;overflow-x:auto;'
                  const svgEl = div.querySelector('svg')
                  const repairRenderedSvg = () => {
                    div.querySelectorAll('svg').forEach((renderedSvg) => repairEmptyMermaidFlowchartLabels(renderedSvg, content))
                    containerRef?.querySelectorAll<SVGSVGElement>('.mermaid-preview-inner svg').forEach((renderedSvg) => {
                      repairEmptyMermaidFlowchartLabels(renderedSvg, content)
                    })
                  }
                  if (svgEl) {
                    repairEmptyMermaidFlowchartLabels(svgEl, content)
                    svgEl.style.maxWidth = '100%'
                    svgEl.style.height = 'auto'
                    svgEl.removeAttribute('height')
                  }
                  applyPreview(div)
                  // Crepe/Vue may mount or normalize the preview DOM after applyPreview.
                  // Re-run the fallback after mount so CJK flowchart labels are not lost.
                  queueMicrotask(repairRenderedSvg)
                  window.setTimeout(repairRenderedSvg, 0)
                  window.setTimeout(repairRenderedSvg, 100)
                } catch {
                  applyPreview(null) // silent — no error shown
                }
              })()
              return placeholder
            }
            if (normalizedLanguage === 'mermaid' && !content.trim()) {
              return null
            }
            return null
          },
        },
      },
    })

    // Official Milkdown NodeView override: render inline markdown images with
    // the same lazy/skeleton/error behavior as the app-level LazyImage.
    crepe.editor.use(createLazyInlineImageView(props.transformSrc, props.onImageClick)).use(createLazyImageBlockView(props.transformSrc, props.onImageClick))

    // Keep the Raw Markdown panel in sync when initial content is restored
    // from localStorage before Milkdown emits the first markdownUpdated event.
    props.onChange?.(initial)

    crepe.on((listener) => {
      listener.markdownUpdated((_, markdown) => {
        props.onChange?.(markdown)
        // Debounced localStorage save
        if (props.storageKey) {
          if (saveTimer) clearTimeout(saveTimer)
          saveTimer = setTimeout(() => saveToStorage(markdown), LS_DEBOUNCE_MS)
        }
      })
    })

    crepe.setReadonly(props.readonly || false)
    await crepe.create()
    if (props.readonly && containerRef) {
      lockReadonlyDom()
      readonlyObserver = new MutationObserver(lockReadonlyDom)
      readonlyObserver.observe(containerRef, { childList: true, subtree: true, attributes: true, attributeFilter: ['contenteditable', 'tabindex'] })
    }
    setIsInitializing(false)
  })

  onCleanup(() => {
    readonlyObserver?.disconnect()
    readonlyObserver = null
    crepe?.destroy()
  })

  return (
    <div class={`relative ${props.class || ''}`}>
      {isInitializing() && (
        <div class="absolute inset-0 z-10 flex flex-col gap-3 items-center justify-center bg-white/40 dark:bg-black/10 backdrop-blur-sm rounded-2xl animate-fade-in" style={{ "min-height": "200px" }}>
          <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-600 border-r-2 border-r-transparent"></div>
          <span class="text-xs font-bold uppercase tracking-[0.2em] text-amber-700/60 animate-pulse">Initializing...</span>
        </div>
      )}
      <div ref={containerRef} class="wysiwyg-container milkdown" />
    </div>
  )
}

