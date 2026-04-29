-- Users: email + password auth with role-based access
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Invite codes: admin-generated, with usage/expiry limits
CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES users(id),
  remaining_uses INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Documents: D1 stores metadata/title; R2 stores Markdown body.
CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled',
  r2_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_docs_owner_updated ON docs(owner_id, updated_at DESC);

-- Images: each upload is bound to a document for strict shared-note media authorization.
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  doc_id TEXT REFERENCES docs(id) ON DELETE SET NULL,
  r2_key TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_images_doc_id ON images(doc_id);
CREATE INDEX IF NOT EXISTS idx_images_owner_id ON images(owner_id);

-- Database-backed share links. Access is checked live on every request so links can be revoked.
CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  enabled INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_share_links_doc_id ON share_links(doc_id);
CREATE INDEX IF NOT EXISTS idx_share_links_enabled_expires ON share_links(enabled, expires_at);

-- Document-Image reference table for share permission control.
-- When a doc is saved, image references are extracted from markdown
-- and registered here. Share tokens can ONLY access images linked to the doc.
CREATE TABLE IF NOT EXISTS doc_images (
  doc_id TEXT NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  PRIMARY KEY (doc_id, image_id)
);
CREATE INDEX IF NOT EXISTS idx_doc_images_doc_id ON doc_images(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_images_image_id ON doc_images(image_id);

-- API Tokens for programmatic access
CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
