import { t } from '../stores/i18n'

export default function ApiDocs() {
  return (
    <div class="w-full h-full overflow-y-auto custom-scrollbar p-6 lg:p-12">
      <div class="max-w-4xl mx-auto glass-panel rounded-[1.75rem] p-6 md:p-8">
        <h1 class="text-3xl font-bold mb-6 tracking-tight text-amber-800 dark:text-amber-300">
          {t('apiDocs') || 'API Documentation'}
        </h1>
        
        <p class="mb-8 text-stone-600 dark:text-stone-300">
          Welcome to the Yestion Public API documentation. All API endpoints are prefixed with <code class="bg-amber-100/80 dark:bg-white/10 px-2 py-1 rounded text-sm">/api</code>.
        </p>

        <div class="space-y-12">
          {/* Auth Section */}
          <section>
            <h2 class="text-2xl font-semibold mb-4 border-b border-amber-900/10 dark:border-white/10 pb-2">Authentication</h2>
            
            <div class="mb-6 glass-card p-4 rounded-xl border border-amber-900/10 dark:border-white/5">
              <div class="flex items-center gap-3 mb-2">
                <span class="px-2 py-1 bg-green-500/20 text-green-700 dark:text-green-400 font-bold text-xs rounded">POST</span>
                <code class="font-mono font-medium">/api/auth/login</code>
              </div>
              <p class="text-sm mb-3 text-stone-600 dark:text-stone-300">Authenticate user and receive a JWT token.</p>
              <h4 class="text-xs font-bold uppercase text-stone-500 mb-1">Body</h4>
              <pre class="text-xs bg-stone-950 text-amber-50 dark:bg-white/10 dark:text-stone-100 p-3 rounded-lg overflow-x-auto">
{`{
  "email": "user@example.com",
  "password": "yourpassword"
}`}
              </pre>
            </div>
            
            <div class="mb-6 glass-card p-4 rounded-xl border border-amber-900/10 dark:border-white/5">
              <div class="flex items-center gap-3 mb-2">
                <span class="px-2 py-1 bg-green-500/20 text-green-700 dark:text-green-400 font-bold text-xs rounded">POST</span>
                <code class="font-mono font-medium">/api/auth/register</code>
              </div>
              <p class="text-sm mb-3 text-stone-600 dark:text-stone-300">Register a new user with an invite code.</p>
              <h4 class="text-xs font-bold uppercase text-stone-500 mb-1">Body</h4>
              <pre class="text-xs bg-stone-950 text-amber-50 dark:bg-white/10 dark:text-stone-100 p-3 rounded-lg overflow-x-auto">
{`{
  "email": "newuser@example.com",
  "password": "yourpassword",
  "inviteCode": "inv_xxxxxx"
}`}
              </pre>
            </div>
          </section>

          {/* Docs Section */}
          <section>
            <h2 class="text-2xl font-semibold mb-4 border-b border-amber-900/10 dark:border-white/10 pb-2">Documents (Requires Auth)</h2>
            <p class="text-sm mb-4 text-stone-500">Include <code class="bg-amber-100/80 dark:bg-white/10 px-1 rounded">Authorization: Bearer &lt;token&gt;</code> in headers.</p>
            
            <div class="mb-6 glass-card p-4 rounded-xl border border-amber-900/10 dark:border-white/5">
              <div class="flex items-center gap-3 mb-2">
                <span class="px-2 py-1 bg-blue-500/20 text-blue-700 dark:text-blue-400 font-bold text-xs rounded">GET</span>
                <code class="font-mono font-medium">/api/docs</code>
              </div>
              <p class="text-sm mb-3 text-stone-600 dark:text-stone-300">List all documents for the authenticated user.</p>
            </div>

            <div class="mb-6 glass-card p-4 rounded-xl border border-amber-900/10 dark:border-white/5">
              <div class="flex items-center gap-3 mb-2">
                <span class="px-2 py-1 bg-green-500/20 text-green-700 dark:text-green-400 font-bold text-xs rounded">POST</span>
                <code class="font-mono font-medium">/api/docs</code>
              </div>
              <p class="text-sm mb-3 text-stone-600 dark:text-stone-300">Create a new document.</p>
              <pre class="text-xs bg-stone-950 text-amber-50 dark:bg-white/10 dark:text-stone-100 p-3 rounded-lg overflow-x-auto">
{`{
  "title": "Document Title",
  "content": "Markdown content here..."
}`}
              </pre>
            </div>

            <div class="mb-6 glass-card p-4 rounded-xl border border-amber-900/10 dark:border-white/5">
              <div class="flex items-center gap-3 mb-2">
                <span class="px-2 py-1 bg-purple-500/20 text-purple-700 dark:text-purple-400 font-bold text-xs rounded">PUT</span>
                <code class="font-mono font-medium">/api/docs/:id</code>
              </div>
              <p class="text-sm mb-3 text-stone-600 dark:text-stone-300">Update an existing document.</p>
            </div>
          </section>

          {/* User Profile Section */}
          <section>
            <h2 class="text-2xl font-semibold mb-4 border-b border-amber-900/10 dark:border-white/10 pb-2">User Profile (Requires Auth)</h2>
            <div class="mb-6 glass-card p-4 rounded-xl border border-amber-900/10 dark:border-white/5">
              <div class="flex items-center gap-3 mb-2">
                <span class="px-2 py-1 bg-purple-500/20 text-purple-700 dark:text-purple-400 font-bold text-xs rounded">PUT</span>
                <code class="font-mono font-medium">/api/user/profile</code>
              </div>
              <p class="text-sm mb-3 text-stone-600 dark:text-stone-300">Update email (username) or password.</p>
              <pre class="text-xs bg-stone-950 text-amber-50 dark:bg-white/10 dark:text-stone-100 p-3 rounded-lg overflow-x-auto">
{`{
  "currentPassword": "required_old_password",
  "email": "new_email@example.com",     // optional
  "newPassword": "new_password"         // optional
}`}
              </pre>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
