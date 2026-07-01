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

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[] | null;
  created_at?: string;
}
