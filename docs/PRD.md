# Yestion — PRD & API Reference

## Product Vision

A minimalist, high-performance cloud Markdown note-taking & publishing platform. Glassmorphism UI with dark/light mode, bilingual (EN/ZH), running on Cloudflare's edge. Creators focus on content; readers get a clean, secure read-only view.

## Core Features

### Document Management (Owner)
- **Auth**: PBKDF2 + JWT login. Admin-seeded on first deploy.
- **List**: Sorted by `updated_at DESC`, glass-panel sidebar.
- **Editor**: Raw markdown textarea + rendered preview toggle. `Cmd+S` / `Ctrl+S` save. Auto-version with conflict detection (409).
- **.md Import**: Upload `.md` files directly — filename becomes title.
- **Image Upload**: Upload images via file picker, stored in R2 with SigV4 pre-signed URLs. Inserted as `![alt](/api/media/...)` in markdown.

### Sharing (Visitor)
- **Database-backed share links**: UUID-based IDs with optional expiry (1h to 30d, or never). Revocable at any time.
- **Read-only view**: Clean glassmorphism page with rendered markdown. Images are served through share-scoped signed URLs.
- **No auth required** for visitors.

### Image Management
- **Settings → My Images**: Grid view of all uploaded images with thumbnails.
- **Copy MD**: One-click copy markdown `![filename](url)` to clipboard.
- **Delete**: Removes from R2 + D1.

### Admin
- **Invite Codes**: Generate codes with configurable remaining uses. Delete codes.
- **API Tokens**: Create/revoke bearer tokens for programmatic access.

### UI/UX
- **Glassmorphism**: Frosted glass panels with warm amber accents.
- **Dark/Light mode**: Toggle in header.
- **Responsive**: Mobile-first with collapsible sidebar.
- **i18n**: English / 中文.

## Technical Constraints

- **Frontend**: SolidJS (signals, no VDOM). Tailwind CSS v4 utility classes only.
- **Backend**: Single Pages Functions entry (`functions/api/[[route]].ts`) — no separate Worker.
- **Database**: D1 for metadata (docs, users, images, share_links, api_tokens, invite_codes).
- **Storage**: R2 for markdown content + uploaded images. Linked via `r2_key`.
- **Image Auth**: `aws4fetch` SigV4 signatures for R2 pre-signed URLs. 10-minute expiry.
- **Password Hashing**: PBKDF2 (SHA-256, 100k iterations, 16-byte salt). Stored as `base64url(salt):base64url(hash)`.
- **R2 Cleanup**: Deleting a document also deletes its R2 file, all associated images from R2, and share links from D1.

---

## API Reference

**Base URL**: Single-domain (https://yestion.clozapine.bid), no separate Worker domain.

**Auth**: 
- Owner: `Authorization: Bearer <JWT or API Token>`. Browser `<img>` also supports `?token=<JWT>`.
- API Token plaintext only returned on creation; D1 stores SHA-256 hash.
- Visitor: Database-backed `share_links.id` real-time auth (no HMAC `expires/sig`).
- CORS: Global support.

### Authentication

#### Login
```
POST /api/auth/login
Body: { "email": "admin@example.com", "password": "***" }
Response: { "token": "***", "user": { "id": "...", "role": "admin" } }
```

#### Register
```
POST /api/auth/register
Body: { "email": "...", "password": "***", "inviteCode": "..." }
Response: { "token": "***", "user": { "id": "...", "role": "user" } }
```

#### Create Invite Code (Admin)
```
POST /api/auth/invite
Headers: Authorization: Bearer <admin JWT or API Token>
Body: { "remainingUses": 1, "expiresInHours": 24 }
Response: { "code": "inv_...", "remainingUses": 1, "expiresAt": "..." }
```

#### List Invite Codes (Admin)
```
GET /api/admin/invites
Headers: Authorization: Bearer <admin JWT or API Token>
Response: [{ "code": "inv_...", "remaining_uses": 1, "expires_at": null, "created_at": "..." }]
```

### API Tokens

#### List
```
GET /api/user/tokens
Headers: Authorization: Bearer <JWT or API Token>
Response: [{ "id": "tok_...", "name": "Mac CLI", "created_at": "..." }]
```

#### Create
```
POST /api/user/tokens
Headers: Authorization: Bearer <JWT or API Token>
Body: { "name": "Mac CLI" }
Response: { "id": "tok_...", "name": "Mac CLI", "token": "***", "created_at": "..." }
```
Token plaintext returned once only — copy immediately.

#### Revoke
```
DELETE /api/user/tokens/:id
Headers: Authorization: Bearer <JWT or API Token>
Response: { "success": true }
```

### Documents

#### Create
```
POST /api/docs
Headers: Authorization: Bearer <JWT or API Token>
Body: { "title": "Title", "content": "Markdown body" }
Response: { "id": "...", "title": "...", "content": "...", "version": 1 }
```
`title` stored in D1; content stored in R2.

#### List
```
GET /api/docs
Headers: Authorization: Bearer <JWT or API Token>
Response: [{ "id": "...", "title": "...", "version": 1, "createdAt": "...", "updatedAt": "..." }]
```

#### Get
```
GET /api/docs/:id
Headers: Authorization: Bearer <JWT or API Token>
Response: { "id": "...", "title": "...", "content": "...", "version": 1 }
```

#### Update
```
PATCH /api/docs/:id/patch
Headers: Authorization: Bearer <JWT or API Token>
Body: { "title": "Title", "content": "Markdown body", "version": 1 }
```
Optimistic locking via `version`. Returns 409 on conflict.

#### Delete
```
DELETE /api/docs/:id
Headers: Authorization: Bearer <JWT or API Token>
```
Also removes R2 files, all associated images, and share links.

### Share Links (Database-backed)

#### Create
```
POST /api/docs/:id/share
Headers: Authorization: Bearer <JWT or API Token>
Body: { "expiryMinutes": 1440 }
Response: {
  "id": "shr_...",
  "docId": "...",
  "url": "/share/shr_...",
  "enabled": true,
  "expiresAt": "...",
  "createdAt": "...",
  "revokedAt": null
}
```

#### List
```
GET /api/docs/:id/shares
Headers: Authorization: Bearer <JWT or API Token>
```

#### Revoke
```
DELETE /api/docs/:id/shares/:shareId
Headers: Authorization: Bearer <JWT or API Token>
```
Sets `share_links.enabled = 0` + `revoked_at`. Subsequent visitor access fails in real-time.

#### Visitor Access
```
GET /share/:shareId         → returns { title, content } after D1 verification
GET /share/:shareId/media/* → checks share + image.doc_id match, returns signed R2 URL or stream
```

### Media

#### Upload Image
```
POST /api/upload
Headers: Authorization: Bearer <JWT or API Token>
Body: FormData { file, docId }
Response: { "id": "...", "key": "media/{owner_id}/{doc_id}/{uuid}.png", "url": "/api/media/..." }
```
Writes to R2 + D1 `images` table (with `doc_id` for share-scoped access).

#### Owner Access
```
GET /api/media/*
Headers: Authorization: Bearer <JWT or API Token> or ?token=<JWT>
```
Worker verifies owner, returns signed R2 URL or stream fallback.

#### Upload .md File
```
POST /api/upload-md
Headers: Authorization: Bearer <JWT or API Token>
Body: FormData { file }
```

### Image Management

#### List
```
GET /api/images
Headers: Authorization: Bearer <JWT or API Token>
```

#### Delete
```
DELETE /api/images/:id
Headers: Authorization: Bearer <JWT or API Token>
```

### User Profile

```
PUT /api/user/profile
Headers: Authorization: Bearer <JWT or API Token>
Body: { "email": "new@example.com", "password": "newpass" }
```

---

## API Routes Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/login | — | Login, returns JWT |
| POST | /api/auth/register | — | Register with invite code |
| POST | /api/auth/invite | admin | Create invite code |
| GET | /api/admin/invites | admin | List invite codes |
| DELETE | /api/admin/invites/:code | admin | Delete invite code |
| GET | /api/docs | owner | List user's documents |
| POST | /api/docs | owner | Create document |
| GET | /api/docs/:id | owner | Get document + content |
| PATCH | /api/docs/:id/patch | owner | Update document (version check) |
| DELETE | /api/docs/:id | owner | Delete doc + R2 files + images + shares |
| POST | /api/docs/:id/share | owner | Create share link |
| GET | /api/docs/:id/shares | owner | List share links |
| DELETE | /api/docs/:id/shares/:shareId | owner | Revoke share link |
| POST | /api/upload | owner | Upload image |
| POST | /api/upload-md | owner | Import .md file |
| GET | /api/media/:key | owner | Get signed image URL |
| GET | /api/images | owner | List user's images |
| DELETE | /api/images/:id | owner | Delete image |
| GET | /api/share/:shareId | — | Get shared document |
| GET | /api/share/:shareId/media/:key | — | Get shared image (signed redirect) |
| PUT | /api/user/profile | owner | Update email/password |
| GET | /api/user/tokens | owner | List API tokens |
| POST | /api/user/tokens | owner | Create API token |
| DELETE | /api/user/tokens/:id | owner | Revoke API token |
