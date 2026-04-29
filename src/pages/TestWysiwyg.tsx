import { createSignal } from 'solid-js'
import WysiwygEditor from '../components/WysiwygEditor'

const WYSIWYG_DRAFT_KEY = 'wysiwyg-draft-v3'
const LEGACY_DRAFT_KEYS = ['wysiwyg-draft', 'wysiwyg-draft-v2']

const TEST_IMAGE_URL =
  '/api/share/shr_95841b0419fd46e99ff93db337a3275e/media/usr_3b983954%2Fc3adce00-1a29-4492-9227-f95a9ee04747.png'

const DEFAULT_MARKDOWN =
  `# WYSIWYG LazyImage Test\n\nThis editor image is rendered through Milkdown's official NodeView API with LazyImage-style skeleton/error/lazy behavior.\n\n![R2 image test](${TEST_IMAGE_URL})\n\n> The image above comes from R2 through the share media route.\n\n- [ ] Task 1\n- [x] Task 2\n\n\`inline code\` example.`

function clearWysiwygDrafts() {
  try {
    localStorage.removeItem(WYSIWYG_DRAFT_KEY)
    for (const key of LEGACY_DRAFT_KEYS) localStorage.removeItem(key)
  } catch {
    // Storage may be unavailable in restricted contexts — ignore.
  }
}

export default function TestWysiwyg() {
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href)
    if (url.searchParams.get('resetDraft') === '1') {
      clearWysiwygDrafts()
      url.searchParams.delete('resetDraft')
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }

  const [content, setContent] = createSignal(DEFAULT_MARKDOWN)

  const resetDraft = () => {
    clearWysiwygDrafts()
    window.location.reload()
  }

  return (
    <div class="h-full min-h-0 overflow-y-auto custom-scrollbar warm-aurora text-stone-900 antialiased p-3 sm:p-6 md:p-8">
      {/* Aurora overlay */}
      <div class="pointer-events-none fixed inset-0 opacity-70 [background:radial-gradient(circle_at_20%_10%,rgba(245,158,11,.18),transparent_24rem),radial-gradient(circle_at_82%_18%,rgba(251,146,60,.14),transparent_22rem)]" />

      <article class="max-w-4xl w-full mx-auto glass-panel rounded-2xl sm:rounded-[2rem] p-3 sm:p-6 md:p-10 animate-fade-in">
        {/* Header — matching Share */}
        <header class="flex flex-col gap-3 border-b border-amber-900/10 pb-3 mb-4 shrink-0 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_24px_rgba(245,158,11,.55)]" />
            <div class="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700/80">
              WYSIWYG Editor Test
            </div>
          </div>
          <button
            type="button"
            onClick={resetDraft}
            class="self-start rounded-full border border-amber-900/10 bg-white/45 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-800/75 shadow-sm transition hover:bg-amber-100/70 hover:text-amber-900 dark:border-white/10 dark:bg-white/5 dark:text-amber-300/80 dark:hover:bg-white/10 sm:self-auto"
            title="Clear local WYSIWYG draft cache and reload the default test document"
          >
            Reset draft
          </button>
        </header>

        {/* Document area — natural flow, page wrapper scrolls when needed */}
        <div>
          <WysiwygEditor content={content()} onChange={setContent} storageKey={WYSIWYG_DRAFT_KEY} />

          {/* Raw output */}
          <details class="mt-6 group">
            <summary class="text-xs font-bold uppercase tracking-[0.2em] text-amber-700/60 cursor-pointer hover:text-amber-700 transition-colors select-none">
              Raw Markdown
            </summary>
            <pre class="mt-3 text-xs leading-relaxed whitespace-pre-wrap break-all bg-stone-100/60 dark:bg-stone-800/40 rounded-xl p-3 sm:p-4 border border-amber-900/10 text-stone-600 dark:text-stone-300">{content()}</pre>
          </details>
        </div>
      </article>
    </div>
  )
}
