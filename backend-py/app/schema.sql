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

-- Retrieval uses EXACT cosine search over the per-workspace chunk subset. This
-- guarantees correct recall for a multi-tenant app (every query filters by
-- workspace). An approximate index (IVFFlat/HNSW) is intentionally NOT used:
-- with small per-workspace sets it post-filters results away and can miss the
-- correct chunk. If a single workspace ever grows to millions of chunks, add an
-- HNSW index and tune ef_search — but validate recall under the workspace filter.
CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id);

-- Conversation history. Originally one implicit log per workspace; `chat_id`
-- (below) splits it into named threads. `workspace_id` is retained so the
-- pre-threads backfill has something to group on, and so a message can still be
-- traced to its workspace in one hop.
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- user | assistant
  content TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Threads: many conversations per workspace, titled from the opening question.
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Sidebar reads are always "threads in this workspace, newest activity first".
CREATE INDEX IF NOT EXISTS chats_workspace_updated_idx ON chats (workspace_id, updated_at DESC);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS chat_id UUID REFERENCES chats(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON messages (chat_id, created_at);

-- Backfill: fold each workspace's pre-threads history into one thread, so no
-- existing conversation is orphaned when reads move to chat_id. Idempotent —
-- it only ever touches rows that have no chat yet, so re-running schema.sql is
-- safe and this becomes a no-op once every message is assigned.
DO $$
DECLARE
  ws_id UUID;
  new_chat_id UUID;
BEGIN
  FOR ws_id IN
    SELECT DISTINCT workspace_id FROM messages
    WHERE chat_id IS NULL AND workspace_id IS NOT NULL
  LOOP
    INSERT INTO chats (workspace_id, title, created_at, updated_at)
    SELECT ws_id, 'Imported conversation', MIN(created_at), MAX(created_at)
    FROM messages WHERE workspace_id = ws_id AND chat_id IS NULL
    RETURNING id INTO new_chat_id;

    UPDATE messages SET chat_id = new_chat_id
    WHERE workspace_id = ws_id AND chat_id IS NULL;
  END LOOP;
END $$;
