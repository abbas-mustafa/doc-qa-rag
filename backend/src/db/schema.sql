-- Enable the pgvector extension (run once per database)
CREATE EXTENSION IF NOT EXISTS vector;

-- Workspaces let a user group multiple documents together
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Workspace',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Documents uploaded by the user
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  page_count INTEGER,
  status TEXT DEFAULT 'processing', -- processing | ready | failed
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chunks of text extracted from documents, each with an embedding vector
-- text-embedding-3-small produces 1536-dimensional vectors
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast similarity search (IVFFlat; good enough for small/medium datasets)
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Conversation history per workspace, for multi-turn context
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' | 'assistant'
  content TEXT NOT NULL,
  sources JSONB, -- array of {document_id, chunk_id, page_number} used for this answer
  created_at TIMESTAMPTZ DEFAULT now()
);
