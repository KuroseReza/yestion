-- Allow images to exist without a document (doc_id becomes nullable).
-- SQLite doesn't support ALTER COLUMN DROP NOT NULL, so we recreate the table.

PRAGMA foreign_keys = OFF;

-- 1. Create new table with doc_id nullable
CREATE TABLE images_new (
  id TEXT PRIMARY KEY,
  doc_id TEXT REFERENCES docs(id) ON DELETE SET NULL,
  r2_key TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Copy existing data
INSERT INTO images_new (id, doc_id, r2_key, owner_id, filename, created_at)
  SELECT id, doc_id, r2_key, owner_id, filename, created_at FROM images;

-- 3. Swap tables
DROP TABLE images;
ALTER TABLE images_new RENAME TO images;

-- 4. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_images_doc_id ON images(doc_id);
CREATE INDEX IF NOT EXISTS idx_images_owner_id ON images(owner_id);

PRAGMA foreign_keys = ON;
