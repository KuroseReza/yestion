import { createSignal } from 'solid-js'

export const [token, setTokenSignal] = createSignal<string | null>(localStorage.getItem('yestion_token'))

export const loginAuth = (t: string) => {
  localStorage.setItem('yestion_token', t)
  setTokenSignal(t)
}

export const logoutAuth = () => {
  localStorage.removeItem('yestion_token')
  setTokenSignal(null)
}

export const userRole = () => {
  const t = token()
  if (!t) return 'user'
  try {
    const payload = JSON.parse(atob(t.split('.')[1]))
    return payload.role || 'user'
  } catch (e) {
    return 'user'
  }
}
