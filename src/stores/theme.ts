import { createSignal, createEffect } from 'solid-js'

type Theme = 'light' | 'dark'

const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem('theme') as Theme
  if (stored === 'light' || stored === 'dark') return stored
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

export const [theme, setThemeSignal] = createSignal<Theme>(getInitialTheme())

export const toggleTheme = () => {
  const newTheme = theme() === 'light' ? 'dark' : 'light'
  localStorage.setItem('theme', newTheme)
  setThemeSignal(newTheme)
}

createEffect(() => {
  if (theme() === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
})
