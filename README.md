# Yestion

A modern Markdown note-taking and sharing platform built with SolidJS on Cloudflare's edge — single-domain Pages Functions architecture, glassmorphism UI, i18n (EN/ZH).

## Architecture

```
Browser
  │
  └─ yestion.clozapine.bid    ← Cloudflare Pages (static + Functions, single domain)
      ├─ /                       Editor home
      ├─ /login                  Login page
      ├─ /share/:id              Shared document (visitor view)
      ├─ /settings               Settings
      └─ /api/*                  API (Pages Functions)
```

| Layer | Technology |
|---|---|
| Frontend | SolidJS + Tailwind CSS v4 + Vite |
| Backend | Pages Functions (`functions/api/[[route]].ts`) |
| Database | Cloudflare D1 (docs, users, images, share_links, api_tokens, invite_codes) |
| Storage | Cloudflare R2 (markdown content + uploaded images) |
| Auth | PBKDF2 password hashing + JWT (bearer tokens) |
| Image signing | `aws4fetch` SigV4 pre-signed R2 URLs |

## Features

- **Markdown editor** with live preview, `Ctrl+S` / `Cmd+S` save, image upload + insert
- **.md file import** — upload .md files directly from the sidebar
- **Share links** with configurable expiry time (1h–30d, or never) — database-backed with real-time revocation
- **Image management** — view all uploaded images, copy markdown to re-insert, delete from R2
- **Admin panel** — invite codes with usage tracking, API token management
- **Glassmorphism UI** — light/dark modes, responsive mobile layout
- **i18n** — English / 中文 toggle
- **R2 cleanup** — deleting a document also removes its R2 file and all associated images

## Wrangler Bindings

| Binding | Type | Resource |
|---|---|---|
| `DB` | D1 | `f2ktion-db` |
| `KV` | KV | JWT secret namespace |
| `R2` | R2 Bucket | `f2ktion-media` |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `INIT_ADMIN_EMAIL` | optional | Seed admin email (first run only, default: `admin@f2ktion.dev`) |
| `INIT_ADMIN_PASSWORD` | optional | Seed admin password (first run only, default: `change-me`) |
| `R2_ACCESS_KEY_ID` | optional* | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | optional* | R2 S3-compatible secret key |
| `R2_ACCOUNT_ID` | optional* | Cloudflare account ID |
| `R2_BUCKET` | optional* | R2 bucket name (default: `f2ktion-media`) |
| `VITE_API_BASE` | optional | API base URL (empty for same-domain) |

> \* When R2 keys are not set, images are served via Worker stream (no signed URLs). Slower but works without extra config — good for dev/low-traffic.

## Development

```bash
# Setup
cp .env.example .env
npm install

# Dev server (frontend only — API calls go to deployed or local Worker)
npm run dev

# Production build + sync asset paths
npm run build:sync

# Preview built output
npm run preview
```

### Deploy

```bash
npm run build:sync
CLOUDFLARE_API_TOKEN=*** npx wrangler pages deploy dist \
  --project-name=yestion --branch=master --commit-dirty
```

## Project Structure

```
yestion/
├── src/                    # SolidJS frontend
│   ├── pages/              # Home, Login, Share, Settings
│   ├── components/         # Icons
│   ├── stores/             # auth, i18n, theme
│   └── utils/              # api.ts
├── functions/
│   ├── api/[[route]].ts    # All API routes (single-entry)
│   ├── share/[id].ts       # Shared document SSR page
│   ├── lib/                # auth, db, docService, mediaService, shareService, r2sign
│   ├── schema.sql          # D1 schema
│   └── migrations/         # D1 migration files
├── docs/
│   └── PRD.md              # Product requirements + API reference
├── dist/                   # Build output
├── wrangler.toml
└── package.json
```

## Documentation

- [PRD & API Reference](docs/PRD.md) — full product spec with all API endpoints, request/response schemas, and auth details
