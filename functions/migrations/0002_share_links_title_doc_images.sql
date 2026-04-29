-- Existing D1 migration for DB-backed share links, document titles, and doc-bound images.
ALTER TABLE docs ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled';
ALTER TABLE images ADD COLUMN doc_id TEXT REFERENCES docs(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_images_r2_key ON images(r2_key);
CREATE INDEX IF NOT EXISTS idx_images_doc_id ON images(doc_id);
CREATE INDEX IF NOT EXISTS idx_images_owner_id ON images(owner_id);
CREATE INDEX IF NOT EXISTS idx_docs_owner_updated ON docs(owner_id, updated_at DESC);

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
