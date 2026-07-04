import type { ChatMessage, Source, Workspace, WorkspaceDocument } from './types';
import { getAccessToken } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // FastAPI uses `detail`; our 500 handler uses `error`.
    throw new Error(body.detail || body.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

async function expectOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.error || `Request failed with status ${res.status}`);
  }
}

export const api = {
  listWorkspaces: () =>
    authedFetch('/api/workspaces').then((res) => handleResponse<Workspace[]>(res)),

  createWorkspace: (name: string) =>
    authedFetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then((res) => handleResponse<Workspace>(res)),

  listDocuments: (workspaceId: string) =>
    authedFetch(`/api/documents/workspace/${workspaceId}`).then((res) =>
      handleResponse<WorkspaceDocument[]>(res)
    ),

  uploadDocument: (workspaceId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return authedFetch(`/api/documents/upload/${workspaceId}`, {
      method: 'POST',
      body: formData,
    }).then((res) => handleResponse<{ message: string; document: WorkspaceDocument }>(res));
  },

  deleteDocument: (id: string) =>
    authedFetch(`/api/documents/${id}`, { method: 'DELETE' }).then(expectOk),

  deleteWorkspace: (id: string) =>
    authedFetch(`/api/workspaces/${id}`, { method: 'DELETE' }).then(expectOk),

  askQuestion: (workspaceId: string, question: string) =>
    authedFetch(`/api/chat/${workspaceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }).then((res) =>
      handleResponse<{ answer: string; sources: Source[]; question: string; workspaceId: string }>(
        res
      )
    ),

  getHistory: (workspaceId: string) =>
    authedFetch(`/api/chat/${workspaceId}/history`).then((res) =>
      handleResponse<ChatMessage[]>(res)
    ),
};
