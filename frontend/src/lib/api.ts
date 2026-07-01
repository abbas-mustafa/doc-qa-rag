import type { ChatMessage, Source, Workspace, WorkspaceDocument } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export const api = {
  listWorkspaces: () =>
    fetch(`${API_URL}/api/workspaces`).then((res) => handleResponse<Workspace[]>(res)),

  createWorkspace: (name: string) =>
    fetch(`${API_URL}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then((res) => handleResponse<Workspace>(res)),

  listDocuments: (workspaceId: string) =>
    fetch(`${API_URL}/api/documents/workspace/${workspaceId}`).then((res) =>
      handleResponse<WorkspaceDocument[]>(res)
    ),

  uploadDocument: (workspaceId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${API_URL}/api/documents/upload/${workspaceId}`, {
      method: 'POST',
      body: formData,
    }).then((res) => handleResponse<{ message: string; document: WorkspaceDocument }>(res));
  },

  deleteDocument: async (id: string) => {
    const res = await fetch(`${API_URL}/api/documents/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to delete document');
    }
  },

  deleteWorkspace: async (id: string) => {
    const res = await fetch(`${API_URL}/api/workspaces/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to delete workspace');
    }
  },

  askQuestion: (workspaceId: string, question: string) =>
    fetch(`${API_URL}/api/chat/${workspaceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }).then((res) =>
      handleResponse<{ answer: string; sources: Source[]; question: string; workspaceId: string }>(
        res
      )
    ),

  getHistory: (workspaceId: string) =>
    fetch(`${API_URL}/api/chat/${workspaceId}/history`).then((res) =>
      handleResponse<ChatMessage[]>(res)
    ),
};
