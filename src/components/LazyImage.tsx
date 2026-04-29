import { createResource, Show, ErrorBoundary, Suspense } from 'solid-js'
import ImageSkeleton from './ImageSkeleton'

function BrokenImageIcon() {
  return (
    <div class="absolute inset-0 flex items-center justify-center bg-stone-100/60 dark:bg-stone-800/40 rounded-md">
      <div class="flex flex-col items-center gap-1 text-stone-400 dark:text-stone-500">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.41a2.25 2.25 0 0 1 3.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
      </div>
    </div>
  )
}

function AsyncImage(props: { src: string; alt: string; title?: string; class?: string; onClick?: () => void; animate?: boolean }) {
  const [loadedSrc] = createResource(props.src, (url) => {
    return new Promise<string>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        void (async () => {
          if (typeof img.decode === 'function') {
            try {
              await img.decode()
            } catch {
              // Animated/cross-origin images may reject decode() after load;
              // load still means the resource is usable.
            }
          }
          resolve(url)
        })()
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = url
    })
  })

  return (
    <Suspense fallback={<ImageSkeleton />}>
      <Show when={loadedSrc()} fallback={<BrokenImageIcon />}>
        <img
          src={loadedSrc()!}
          alt={props.alt}
          title={props.title}
          class={`${props.animate === false ? '' : 'animate-image-in'} rounded-md max-w-full h-auto ${props.class || ''}`.trim()}
          loading="lazy"
          onClick={props.onClick}
        />
      </Show>
    </Suspense>
  )
}

export default function LazyImage(props: {
  src: string
  alt?: string
  title?: string
  class?: string
  containerClass?: string
  onClick?: () => void
  animate?: boolean
}) {
  return (
    <div class={`relative overflow-hidden ${props.containerClass || 'rounded-md my-4 min-h-[120px]'}`}>
      <ErrorBoundary fallback={<BrokenImageIcon />}>
        <AsyncImage
          src={props.src}
          alt={props.alt || ''}
          title={props.title}
          class={props.class}
          onClick={props.onClick}
          animate={props.animate}
        />
      </ErrorBoundary>
    </div>
  )
}
