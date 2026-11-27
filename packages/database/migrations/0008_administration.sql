CREATE TABLE website_pages (
  slug TEXT PRIMARY KEY NOT NULL,
  draft_title TEXT NOT NULL,
  draft_body TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  published_title TEXT,
  published_body TEXT,
  published_at TEXT
) STRICT;
