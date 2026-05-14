-- Full-text search index on products (name + description)
-- This enables efficient text search using PostgreSQL's built-in full-text search

-- Add a generated tsvector column for full-text search
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B')
  ) STORED;

-- Create GIN index on the search vector for fast full-text queries
CREATE INDEX IF NOT EXISTS "products_search_idx" ON "products" USING GIN ("search_vector");
