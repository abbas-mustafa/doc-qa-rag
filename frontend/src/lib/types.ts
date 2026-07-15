export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export type DocumentStatus = 'processing' | 'ready' | 'failed';

export interface WorkspaceDocument {
  id: string;
  workspace_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  page_count: number | null;
  status: DocumentStatus;
  created_at: string;
}

export interface Source {
  documentId: string;
  documentName: string;
  pageNumber: number | null;
}

/** A conversation thread inside a workspace. */
export interface Chat {
  id: string;
  workspace_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[] | null;
  created_at?: string;
}

/** Callbacks for a streamed answer. See `api.streamAnswer`. */
export interface AnswerStreamHandlers {
  /** Fires once, before any text: retrieval already knows the sources. */
  onSources?: (sources: Source[]) => void;
  /** Fires per delta with the *new* text only, not the accumulated answer. */
  onDelta?: (text: string) => void;
  /** Fires once the answer is complete and persisted. */
  onDone?: (info: { chatTitle: string | null }) => void;
}
