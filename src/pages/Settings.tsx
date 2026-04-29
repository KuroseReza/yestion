import { createSignal, createEffect, createResource, Show, For, Suspense } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { token, logoutAuth, userRole } from '../stores/auth'
import { t } from '../stores/i18n'
import { updateProfile, getTokens, createToken, revokeToken, getInvites, createInvite, deleteInvite, fetchImages, deleteImageById, uploadImage, BASE_URL } from '../utils/api'
import LazyImage from '../components/LazyImage'

export default function Settings() {
  const navigate = useNavigate()
  
  createEffect(() => {
    if (!token()) navigate('/login', { replace: true })
  })

  if (!token()) return null

  const [activeTab, setActiveTab] = createSignal<'profile' | 'tokens' | 'invites' | 'images'>('profile')
  const [showMobileMenu, setShowMobileMenu] = createSignal(true)

  const selectTab = (tab: 'profile' | 'tokens' | 'invites' | 'images') => {
    setActiveTab(tab)
    setShowMobileMenu(false)
  }

  // Profile State
  const [email, setEmail] = createSignal('')
  const [currentPassword, setCurrentPassword] = createSignal('')
  const [newPassword, setNewPassword] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [msg, setMsg] = createSignal({ text: '', type: '' })

  const handleProfileSubmit = async (e: Event) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })
    if (!currentPassword()) return setMsg({ text: t('currentPasswordRequired'), type: 'error' })
    if (!email() && !newPassword()) return setMsg({ text: t('nothingToUpdate'), type: 'error' })
    
    setLoading(true)
    try {
      await updateProfile(email() || undefined, currentPassword(), newPassword() || undefined)
      setMsg({ text: t('profileUpdated'), type: 'success' })
      setEmail('')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err: any) {
      setMsg({ text: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Tokens State
  const [tokens, setTokens] = createSignal<any[]>([])
  const [tokenName, setTokenName] = createSignal('')
  const [newTokenRaw, setNewTokenRaw] = createSignal('')

  const loadTokens = async () => {
    try { setTokens(await getTokens()) } catch (err) {}
  }

  const handleCreateToken = async (e: Event) => {
    e.preventDefault()
    if (!tokenName().trim()) return setMsg({ text: t('tokenNameRequired'), type: 'error' })
    setLoading(true)
    try {
      const res = await createToken(tokenName())
      setNewTokenRaw(res.token)
      setTokenName('')
      loadTokens()
    } catch (err: any) { setMsg({ text: err.message || t('operationFailed'), type: 'error' }) }
    setLoading(false)
  }

  const handleRevokeToken = async (id: string) => {
    if (!confirm(t('revokeTokenConfirm'))) return
    try {
      await revokeToken(id)
      loadTokens()
    } catch (err: any) { setMsg({ text: err.message || t('operationFailed'), type: 'error' }) }
  }

  // Invites State
  const [invites, setInvites] = createSignal<any[]>([])
  const [uses, setUses] = createSignal('1')

  const loadInvites = async () => {
    if (userRole() !== 'admin') return
    try { setInvites(await getInvites()) } catch (err: any) { setMsg({ text: err.message || t('operationFailed'), type: 'error' }) }
  }

  const handleCreateInvite = async (e: Event) => {
    e.preventDefault()
    setLoading(true)
    try {
      await createInvite(parseInt(uses(), 10) || 1)
      loadInvites()
    } catch (err: any) { setMsg({ text: err.message || t('operationFailed'), type: 'error' }) }
    setLoading(false)
  }

  const handleDeleteInvite = async (code: string) => {
    if (!confirm(t('deleteInviteConfirm'))) return
    try {
      await deleteInvite(code)
      loadInvites()
    } catch (err: any) { setMsg({ text: err.message || t('operationFailed'), type: 'error' }) }
  }

  // Images State — SolidJS <Suspense> + createResource
  const [_imagesTrigger, setImagesTrigger] = createSignal(0)
  const [images] = createResource(async () => {
    _imagesTrigger() // track changes
    return fetchImages()
  })
  const [imageDeleting, setImageDeleting] = createSignal<string | null>(null)
  const [zoomedImage, setZoomedImage] = createSignal<string | null>(null)
  const [settingsUploading, setSettingsUploading] = createSignal(false)
  let settingsUploadRef: HTMLInputElement | undefined

  const handleSettingsUpload = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    setSettingsUploading(true)
    try {
      await uploadImage(file)
      setImagesTrigger(n => n + 1)
    } catch (err: any) { setMsg({ text: err.message || t('operationFailed'), type: 'error' }) }
    setSettingsUploading(false)
    input.value = ''
  }

  const handleDeleteImage = async (id: string) => {
    if (!confirm(t('deleteImageConfirm'))) return
    setImageDeleting(id)
    try {
      await deleteImageById(id)
      setImagesTrigger(n => n + 1)
    } catch (err: any) { setMsg({ text: err.message || t('operationFailed'), type: 'error' }) }
    setImageDeleting(null)
  }

  const handleCopyImageMd = async (image: any, filename: string) => {
    const md = `![${filename}](${image.id})`
    await navigator.clipboard.writeText(md)
    setMsg({ text: t('markdownCopied'), type: 'success' })
    setTimeout(() => setMsg({ text: '', type: '' }), 2000)
  }

  createEffect(() => {
    if (activeTab() === 'tokens') loadTokens()
    if (activeTab() === 'invites' && userRole() === 'admin') loadInvites()
    if (activeTab() === 'images') setImagesTrigger(n => n + 1)
  })

  return (
    <div class="flex-1 flex flex-col md:flex-row max-w-6xl mx-auto w-full h-full overflow-hidden p-3 md:p-4 gap-3">
      
      {/* Mobile Menu / Desktop Sidebar */}
      <div class={`w-full md:w-64 flex-col glass-panel rounded-2xl overflow-hidden 
        ${showMobileMenu() ? 'flex' : 'hidden md:flex'}`}>
        <div class="p-5 md:p-6 border-b border-amber-900/10 dark:border-white/5 md:border-none shrink-0">
          <h2 class="text-xl font-bold text-stone-950 dark:text-stone-50">{t('settings')}</h2>
        </div>
        
        <div class="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          <button onClick={() => selectTab('profile')} class={`p-3 rounded-lg text-sm font-medium text-left transition-colors ${activeTab() === 'profile' ? 'bg-white dark:bg-white/10 text-amber-600 dark:text-amber-400 shadow-sm border border-amber-900/10 dark:border-white/5' : 'text-stone-600 dark:text-stone-400 hover:bg-amber-100/50 dark:hover:bg-white/5 border border-transparent'}`}>{t('userProfile')}</button>
          
          <button onClick={() => selectTab('tokens')} class={`p-3 rounded-lg text-sm font-medium text-left transition-colors ${activeTab() === 'tokens' ? 'bg-white dark:bg-white/10 text-amber-600 dark:text-amber-400 shadow-sm border border-amber-900/10 dark:border-white/5' : 'text-stone-600 dark:text-stone-400 hover:bg-amber-100/50 dark:hover:bg-white/5 border border-transparent'}`}>{t('apiTokens')}</button>
          
          <button onClick={() => selectTab('images')} class={`p-3 rounded-lg text-sm font-medium text-left transition-colors ${activeTab() === 'images' ? 'bg-white dark:bg-white/10 text-amber-600 dark:text-amber-400 shadow-sm border border-amber-900/10 dark:border-white/5' : 'text-stone-600 dark:text-stone-400 hover:bg-amber-100/50 dark:hover:bg-white/5 border border-transparent'}`}>{t('myImages')}</button>
          
          <Show when={userRole() === 'admin'}>
            <div class="my-2 border-t border-amber-900/10 dark:border-white/5 mx-2"></div>
            <button onClick={() => selectTab('invites')} class={`p-3 rounded-lg text-sm font-medium text-left transition-colors flex items-center justify-between ${activeTab() === 'invites' ? 'bg-white dark:bg-white/10 text-amber-600 dark:text-amber-400 shadow-sm border border-amber-900/10 dark:border-white/5' : 'text-stone-600 dark:text-stone-400 hover:bg-amber-100/50 dark:hover:bg-white/5 border border-transparent'}`}>
              <span>{t('inviteCodes')}</span>
              <span class="text-[10px] uppercase tracking-wider opacity-60">{t('admin')}</span>
            </button>
          </Show>
          
          <div class="mt-auto pt-4 flex shrink-0">
            <button onClick={() => { logoutAuth(); navigate('/login', { replace: true }) }} class="flex-1 p-3 rounded-lg text-sm font-medium text-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-500/20">
              {t('logout')}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div class={`flex-1 flex-col ${!showMobileMenu() ? 'flex' : 'hidden md:flex'} glass-panel rounded-2xl overflow-hidden`}>
        <div class="md:hidden flex items-center p-4 border-b border-amber-900/10 dark:border-white/5 gap-2 shrink-0">
          <button onClick={() => setShowMobileMenu(true)} class="p-2 -ml-2 text-stone-500 hover:text-stone-950 dark:text-stone-400 dark:hover:text-white rounded-md">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h3 class="font-bold text-lg text-stone-950 dark:text-stone-50 capitalize">{activeTab() === 'profile' ? t('userProfile') : activeTab() === 'tokens' ? t('apiTokens') : activeTab() === 'images' ? t('myImages') : t('inviteCodes')}</h3>
        </div>
        
        <div class="p-6 md:p-10 flex-1 overflow-y-auto">
          <div class="max-w-xl mx-auto">
            <Show when={msg().text && activeTab() !== 'profile'}>
              <div data-testid="settings-global-message" class={`mb-4 p-3 text-sm font-medium rounded-md border ${msg().type === 'error' ? 'text-red-600 bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20' : 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20'}`}>{msg().text}</div>
            </Show>
            {/* Profile Tab */}
            <Show when={activeTab() === 'profile'}>
              <h3 class="text-2xl font-bold text-stone-950 dark:text-stone-50 mb-1 hidden md:block">{t('userProfile')}</h3>
              <p class="text-sm text-stone-500 dark:text-stone-400 mb-8 hidden md:block">{t('updateCredentials')}</p>
              
              <form onSubmit={handleProfileSubmit} class="flex flex-col gap-4">
                <Show when={msg().text}>
                  <div class={`p-3 text-sm font-medium rounded-md border ${msg().type === 'error' ? 'text-red-600 bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20' : 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20'}`}>
                    {msg().text}
                  </div>
                </Show>
                
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold text-stone-600 dark:text-stone-400">{t('newEmail')}</label>
                  <input type="email" value={email()} onInput={e => setEmail(e.currentTarget.value)} class="w-full bg-white/70 dark:bg-stone-900/60 border border-amber-900/20 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors" placeholder={t('leaveBlank')} />
                </div>
                
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold text-stone-600 dark:text-stone-400">{t('newPassword')}</label>
                  <input type="password" value={newPassword()} onInput={e => setNewPassword(e.currentTarget.value)} class="w-full bg-white/70 dark:bg-stone-900/60 border border-amber-900/20 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors" placeholder={t('leaveBlank')} />
                </div>
                
                <div class="flex flex-col gap-1.5 mt-4 pt-6 border-t border-amber-900/10 dark:border-white/5">
                  <label class="text-xs font-semibold text-stone-600 dark:text-stone-400">{t('currentPassword')} <span class="text-red-500">*</span></label>
                  <input type="password" value={currentPassword()} onInput={e => setCurrentPassword(e.currentTarget.value)} class="w-full bg-white/70 dark:bg-stone-900/60 border border-amber-900/20 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors" required placeholder={t('requiredToSave')} />
                </div>
                
                <button type="submit" disabled={loading()} class="mt-2 px-4 py-2 rounded-md btn-warm-primary text-sm font-medium disabled:opacity-50 self-start transition-colors">
                  {loading() ? t('saving') : t('saveChanges')}
                </button>
              </form>
            </Show>

            {/* API Tokens Tab */}
            <Show when={activeTab() === 'tokens'}>
              <h3 class="text-2xl font-bold text-stone-950 dark:text-stone-50 mb-1 hidden md:block">{t('apiTokens')}</h3>
              <p class="text-sm text-stone-500 dark:text-stone-400 mb-8 hidden md:block">{t('apiTokensDesc')}</p>
              
              <form onSubmit={handleCreateToken} class="flex gap-2 mb-8">
                <input type="text" value={tokenName()} onInput={e => setTokenName(e.currentTarget.value)} placeholder={t('tokenNamePlaceholder')} class="flex-1 bg-white/70 dark:bg-stone-900/60 border border-amber-900/20 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors" required />
                <button type="submit" disabled={loading()} class="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-stone-950 rounded-md text-sm font-medium disabled:opacity-50 hover:bg-slate-800 dark:hover:bg-amber-100 transition-colors">{t('create')}</button>
              </form>

              <Show when={newTokenRaw()}>
                <div class="mb-8 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-md">
                  <p class="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-2">{t('tokenCreated')}</p>
                  <code class="block p-3 glass-panel border border-emerald-100 dark:border-emerald-500/20 rounded font-mono text-xs break-all text-stone-800 dark:text-emerald-100">{newTokenRaw()}</code>
                </div>
              </Show>

              <div class="space-y-2">
                <h4 class="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-3">{t('activeTokens')}</h4>
                <Show when={tokens().length === 0}>
                  <div class="text-sm text-stone-500 dark:text-stone-400 italic">{t('noTokens')}</div>
                </Show>
                <For each={tokens()}>{tok => (
                  <div class="flex items-center justify-between p-3 border border-amber-900/10 dark:border-white/10 rounded-md">
                    <div>
                      <div class="font-medium text-sm text-stone-950 dark:text-stone-50">{tok.name}</div>
                      <div class="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{new Date(tok.created_at).toLocaleString()}</div>
                    </div>
                    <button onClick={() => handleRevokeToken(tok.id)} class="text-xs font-medium text-red-600 dark:text-red-400 hover:underline px-2 py-1">{t('revoke')}</button>
                  </div>
                )}</For>
              </div>
            </Show>

            {/* Invites Tab */}
            <Show when={activeTab() === 'invites' && userRole() === 'admin'}>
              <h3 class="text-2xl font-bold text-stone-950 dark:text-stone-50 mb-1 hidden md:block">{t('inviteCodes')}</h3>
              <p class="text-sm text-stone-500 dark:text-stone-400 mb-8 hidden md:block">{t('inviteCodesDesc')}</p>
              
              <form onSubmit={handleCreateInvite} class="flex gap-2 mb-8">
                <input type="number" min="1" value={uses()} onInput={e => setUses(e.currentTarget.value)} class="w-24 bg-white/70 dark:bg-stone-900/60 border border-amber-900/20 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors" required placeholder={t('uses')} />
                <button type="submit" disabled={loading()} class="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium disabled:opacity-50 hover:bg-amber-700 transition-colors">{t('generate')}</button>
              </form>

              <div class="space-y-2">
                <h4 class="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-3">{t('activeInvites')}</h4>
                <Show when={invites().length === 0}>
                  <div class="text-sm text-stone-500 dark:text-stone-400 italic">{t('noActiveInvites')}</div>
                </Show>
                <For each={invites()}>{inv => (
                  <div class="flex items-center gap-2 p-3 border border-amber-900/10 dark:border-white/10 rounded-md">
                    <code class="flex-1 min-w-0 overflow-x-auto whitespace-nowrap font-mono text-sm text-amber-700 dark:text-amber-400 font-medium select-all">{inv.code}</code>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="text-xs text-stone-500 dark:text-stone-400 bg-amber-50 dark:bg-white/10 px-2 py-1 rounded whitespace-nowrap">{t('uses')}: {inv.remaining_uses}</span>
                      <button onClick={() => handleDeleteInvite(inv.code)} class="text-xs font-medium text-red-600 dark:text-red-400 hover:underline px-1 py-1 whitespace-nowrap">{t('delete')}</button>
                    </div>
                  </div>
                )}</For>
              </div>
            </Show>

            {/* Images Tab */}
            <Show when={activeTab() === 'images'}>
              <h3 class="text-2xl font-bold text-stone-950 dark:text-stone-50 mb-1 hidden md:block">{t('myImages')}</h3>
              <p class="text-sm text-stone-500 dark:text-stone-400 mb-8 hidden md:block">{t('myImagesDesc')}</p>
              
              <div class="flex items-center gap-2 mb-6">
                <label class={`px-4 py-2 rounded-md btn-warm-primary text-sm font-medium cursor-pointer transition-colors ${settingsUploading() ? 'opacity-50 pointer-events-none' : ''}`}>
                  {settingsUploading() ? t('uploading') : t('uploadImage')}
                  <input type="file" accept="image/*" class="hidden" ref={settingsUploadRef} onChange={handleSettingsUpload} disabled={settingsUploading()} />
                </label>
              </div>

              <Suspense fallback={
                <div class="flex items-center justify-center py-12">
                  <div class="flex flex-col items-center gap-3 text-stone-400">
                    <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-600 border-r-2 border-r-transparent" />
                    <span class="text-sm">{t('loading')}</span>
                  </div>
                </div>
              }>
                <Show when={(images() || []).length === 0}>
                  <div class="text-sm text-stone-500 dark:text-stone-400 italic">{t('noImages')}</div>
                </Show>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <For each={images()}>{img => (
                  <div class="border border-amber-900/10 dark:border-white/10 rounded-lg overflow-hidden bg-amber-50/30 dark:bg-black/20">
                    <LazyImage 
                      src={`${BASE_URL}/api/media/${img.r2_key || ''}?token=${encodeURIComponent(token()!)}`} 
                      alt={img.filename} 
                      class="w-full h-32 object-cover border-b border-amber-900/10 dark:border-white/10 cursor-zoom-in hover:opacity-90 transition-opacity" 
                      containerClass="w-full h-32"
                      onClick={() => setZoomedImage(`${BASE_URL}/api/media/${img.r2_key || ''}?token=${encodeURIComponent(token()!)}`)} 
                    />
                    <div class="p-3">
                      <div class="text-xs font-mono text-stone-700 dark:text-stone-300 truncate">{img.filename}</div>
                      <div class="text-[10px] text-stone-400 mt-1">{new Date(img.created_at).toLocaleDateString()}</div>
                      <div class="flex gap-2 mt-2">
                        <button onClick={() => handleCopyImageMd(img, img.filename)} class="flex-1 px-2 py-1.5 rounded text-[11px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors">{t('copyMarkdown')}</button>
                        <button onClick={() => handleDeleteImage(img.id)} disabled={imageDeleting() === img.id} class="px-2 py-1.5 rounded text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 transition-colors">{imageDeleting() === img.id ? '...' : t('delete')}</button>
                      </div>
                    </div>
                  </div>
                )}</For>
              </div>
              </Suspense>

              <Show when={zoomedImage()}>
                <div class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out animate-fade-in" onClick={() => setZoomedImage(null)}>
                  <img src={zoomedImage()!} class="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-image-in" onClick={(e) => e.stopPropagation()} />
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
}
