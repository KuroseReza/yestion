import { createSignal } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { loginAuth, token } from '../stores/auth'
import { t } from '../stores/i18n'

const BASE_URL = import.meta.env.VITE_API_BASE || ''

export default function Login() {
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = createSignal(true)
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [inviteCode, setInviteCode] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal('')
  const [showPassword, setShowPassword] = createSignal(false)

  // If already logged in, redirect home
  if (token()) {
    navigate('/', { replace: true })
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const endpoint = isLogin() ? '/api/auth/login' : '/api/auth/register'
      const body = isLogin() 
        ? { email: email(), password: password() }
        : { email: email(), password: password(), inviteCode: inviteCode() }

      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || 'Authentication failed')
      }
      const data = await res.json()
      if (data.token) {
        loginAuth(data.token)
        navigate('/', { replace: true })
      } else {
        setError(isLogin() ? t('loginError') : t('registerError'))
      }
    } catch (err: any) {
      setError(isLogin() ? t('loginError') : t('registerError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="flex-1 flex items-center justify-center p-4 h-full warm-aurora">
      <div class="glass-panel w-full max-w-sm rounded-[1.75rem] p-8 flex flex-col items-center">
        <h1 class="text-2xl font-bold tracking-tight mb-8 text-stone-950 dark:text-stone-50">
          {isLogin() ? t('login') : t('register')}
        </h1>
        
        {error() && (
          <div class="w-full bg-red-500/10 border border-red-500/50 text-red-600 dark:text-red-200 text-sm p-3 rounded-lg mb-4">
            {error()}
          </div>
        )}

        <form onSubmit={handleSubmit} class="w-full flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-stone-500 dark:text-stone-50/60 uppercase tracking-wider">{t('email')}</label>
            <input 
              type="email" 
              value={email()} 
              onInput={e => setEmail(e.currentTarget.value)}
              class="w-full bg-white/70 dark:bg-white/10 border border-amber-900/15 dark:border-white/10 rounded-lg px-4 py-2 text-sm text-stone-950 dark:text-stone-50 focus:outline-none focus:border-[var(--color-primary)] transition-colors"
              required 
            />
          </div>
          
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-stone-500 dark:text-stone-50/60 uppercase tracking-wider">{t('password')}</label>
            <div class="relative">
              <input 
                type={showPassword() ? 'text' : 'password'}
                value={password()} 
                onInput={e => setPassword(e.currentTarget.value)}
                class="w-full bg-white/70 dark:bg-white/10 border border-amber-900/15 dark:border-white/10 rounded-lg pl-4 pr-10 py-2 text-sm text-stone-950 dark:text-stone-50 focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                required 
              />
              <button type="button" onClick={() => setShowPassword(!showPassword())} class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors" tabindex={-1}>
                {showPassword() ? (
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="m14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" x2="23" y1="1" y2="23"/></svg>
                ) : (
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          {!isLogin() && (
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-stone-500 dark:text-stone-50/60 uppercase tracking-wider">{t('inviteCode')}</label>
              <input 
                type="text" 
                value={inviteCode()} 
                onInput={e => setInviteCode(e.currentTarget.value)}
                class="w-full bg-white/70 dark:bg-white/10 border border-amber-900/15 dark:border-white/10 rounded-lg px-4 py-2 text-sm text-stone-950 dark:text-stone-50 focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                required 
              />
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading()}
            class="mt-4 w-full btn-warm-primary font-medium py-2.5 rounded-lg transition-colors border border-transparent dark:border-white/10 disabled:opacity-50"
          >
            {isLogin() 
              ? (loading() ? t('loggingIn') : t('loginAction')) 
              : (loading() ? t('registering') : t('registerAction'))}
          </button>

          <div class="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin()); setError(''); setEmail(''); setPassword(''); setInviteCode(''); }}
              class="text-sm text-stone-500 hover:text-[var(--color-primary)] transition-colors"
            >
              {isLogin() ? t('noAccount') : t('hasAccount')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
