-- Document-Image reference table for share permission control.
-- When a doc is saved, image references are extracted from markdown
-- and registered here. Share tokens can only access images linked to the document.

CREATE TABLE IF NOT EXISTS doc_images (
  doc_id TEXT NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  PRIMARY KEY (doc_id, image_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_images_doc_id ON doc_images(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_images_image_id ON doc_images(image_id);
