import { Show } from 'solid-js'
import type { JSX } from 'solid-js'
import { LogoIcon, LangIcon, SunIcon, MoonIcon, SettingsIcon } from '../components/Icons'
import { lang, setLang } from '../stores/i18n'
import { token } from '../stores/auth'
import { theme, toggleTheme } from '../stores/theme'
import { useNavigate, useLocation } from '@solidjs/router'

export default function MainLayout(props: { children?: JSX.Element }) {
  const navigate = useNavigate()
  const location = useLocation()
  
  const handleLangToggle = () => {
    setLang(lang() === 'en' ? 'zh' : 'en')
  }

  return (
    <div class="relative h-screen h-[100dvh] min-h-0 overflow-hidden warm-aurora text-stone-900 dark:text-stone-100 flex flex-col font-sans transition-colors duration-200">
      <header class="sticky top-0 z-50 flex items-center justify-between px-4 h-14 glass-panel border-x-0 border-t-0 rounded-none">
        <div class="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/')}>
          <div class="w-8 h-8 rounded-xl bg-amber-500/12 border border-amber-600/15 flex items-center justify-center group-hover:bg-amber-500/18 transition-colors">
            <LogoIcon class="w-5 h-5 text-amber-700 dark:text-amber-300" />
          </div>
          <span class="font-bold text-base hidden sm:block tracking-tight text-stone-900 dark:text-stone-50">Yestion</span>
        </div>
        
        <div class="flex items-center gap-1 sm:gap-2">
          <button onClick={() => navigate('/api-docs')} class="px-3 py-1.5 rounded-lg text-sm font-medium text-stone-600 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:bg-amber-50/80 dark:hover:bg-white/5 transition-colors hidden sm:block">
            API
          </button>

          <button onClick={toggleTheme} class="p-2 rounded-lg hover:bg-amber-50/80 dark:hover:bg-white/5 text-stone-600 dark:text-stone-300 hover:text-amber-700 dark:hover:text-amber-300 transition-colors active:scale-90" title="Toggle Theme">
            <Show when={theme() === 'dark'} fallback={<MoonIcon class="w-4.5 h-4.5 animate-icon-spin" />}>
              <SunIcon class="w-4.5 h-4.5 animate-icon-spin" />
            </Show>
          </button>

          <button onClick={handleLangToggle} class="p-2 rounded-lg hover:bg-amber-50/80 dark:hover:bg-white/5 text-stone-600 dark:text-stone-300 hover:text-amber-700 dark:hover:text-amber-300 transition-colors flex items-center gap-1.5" title="Switch Language">
            <LangIcon class="w-4 h-4" />
            <span class="text-xs font-bold uppercase hidden sm:block">{lang()}</span>
          </button>
          
          {token() && (
            <button
              onClick={() => navigate('/settings')}
              class={`p-2 rounded-lg transition-colors ${location.pathname === '/settings' ? 'bg-amber-100/80 dark:bg-white/10 text-amber-800 dark:text-amber-200' : 'text-stone-600 dark:text-stone-300 hover:bg-amber-50/80 dark:hover:bg-white/5 hover:text-amber-700 dark:hover:text-amber-300'}`}
              title="Settings"
            >
              <SettingsIcon class="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </header>

      <main class="flex-1 min-h-0 flex flex-col overflow-hidden animate-page-enter">
        {props.children}
      </main>
    </div>
  )
}
