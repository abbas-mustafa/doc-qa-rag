import type {
  AnswerStreamHandlers,
  Chat,
  ChatMessage,
  Workspace,
  WorkspaceDocument,
} from './types';
import { getAccessToken } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

async function errorFrom(res: Response): Promise<Error> {
  const body = await res.json().catch(() => ({}));
  // FastAPI uses `detail`; our 500 handler uses `error`.
  return new Error(body.detail || body.error || `Request failed with status ${res.status}`);
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

async function expectOk(res: Response): Promise<void> {
  if (!res.ok) throw await errorFrom(res);
}

interface SseFrame {
  event: string;
  data: string;
}

/**
 * Parse one Server-Sent Event frame.
 *
 * Hand-rolled because EventSource can't be used here at all: it only issues GET
 * and cannot set an Authorization header, and asking a question is an
 * authenticated POST.
 */
function parseFrame(frame: string): SseFrame {
  let event = 'message';
  const data: string[] = [];
  for (const raw of frame.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line.startsWith(':')) continue; // comment / keep-alive
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1); // one optional leading space
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  return { event, data: data.join('\n') };
}

/** Yield SSE frames from a response body, which arrives in arbitrary slices. */
async function* readFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<SseFrame> {
  const reader = body.getReader();
  // stream: true keeps a multi-byte character whole when a chunk boundary
  // splits it — answers contain em dashes and other non-ASCII.
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let split: number;
      while ((split = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        if (frame.trim()) yield parseFrame(frame);
      }
    }
  } finally {
    reader.cancel().catch(() => {});
    reader.releaseLock();
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

  // --------------------------------------------------------------- threads

  listChats: (workspaceId: string) =>
    authedFetch(`/api/chats/workspace/${workspaceId}`).then((res) => handleResponse<Chat[]>(res)),

  createChat: (workspaceId: string, title?: string) =>
    authedFetch(`/api/chats/workspace/${workspaceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title ?? null }),
    }).then((res) => handleResponse<Chat>(res)),

  renameChat: (chatId: string, title: string) =>
    authedFetch(`/api/chats/${chatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }).then((res) => handleResponse<Chat>(res)),

  deleteChat: (chatId: string) =>
    authedFetch(`/api/chats/${chatId}`, { method: 'DELETE' }).then(expectOk),

  /**
   * Ask a question and stream the answer.
   *
   * Chat-scoped: a workspace holds many threads, and the backend resolves the
   * workspace (for retrieval) from the chat.
   *
   * Resolves only once the server has confirmed the answer is saved, and throws
   * otherwise — including when the connection drops mid-answer. A partial reply
   * left on screen as though it were complete is the failure worth avoiding
   * here, since nothing about it would look wrong.
   */
  streamAnswer: async (chatId: string, question: string, handlers: AnswerStreamHandlers = {}) => {
    const res = await authedFetch(`/api/chat/${chatId}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    // Everything before the model call still fails as a normal status, so this
    // catches auth, a missing chat, and retrieval errors.
    if (!res.ok) throw await errorFrom(res);
    if (!res.body) throw new Error('This browser cannot read streamed responses');

    let done = false;
    for await (const { event, data } of readFrames(res.body)) {
      const payload = data ? JSON.parse(data) : {};
      if (event === 'sources') handlers.onSources?.(payload.sources ?? []);
      else if (event === 'delta') handlers.onDelta?.(payload.text ?? '');
      else if (event === 'error') throw new Error(payload.detail || 'Failed to get an answer');
      else if (event === 'done') {
        done = true;
        handlers.onDone?.({ chatTitle: payload.chatTitle ?? null });
      }
    }
    if (!done) throw new Error('The connection dropped before the answer finished');
  },

  getHistory: (chatId: string) =>
    authedFetch(`/api/chat/${chatId}/history`).then((res) => handleResponse<ChatMessage[]>(res)),
};
