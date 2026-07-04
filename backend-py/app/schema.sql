-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Workspaces group documents + conversations, now owned by a user.
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Workspace',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Multi-user ownership. Supabase auth.users.id (the JWT `sub`).
-- Nullable so pre-auth rows remain valid; enforced in the app layer when auth is on.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS user_id UUID;
CREATE INDEX IF NOT EXISTS workspaces_user_id_idx ON workspaces (user_id);

-- Documents uploaded into a workspace.
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  page_count INTEGER,
  status TEXT DEFAULT 'processing', -- processing | ready | failed
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS error TEXT;

-- Chunks: a unit of retrievable content. element_type records provenance so
-- figure descriptions and OCR text are searchable alongside normal text.
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  element_type TEXT DEFAULT 'text', -- text | ocr_text | figure | table
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS element_type TEXT DEFAULT 'text';

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id);

-- Conversation history per workspace.
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- user | assistant
  content TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
