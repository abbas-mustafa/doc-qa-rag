'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileStack, Menu, PanelLeftClose, PanelLeft, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { Chat, ChatMessage, Source, Workspace, WorkspaceDocument } from '@/lib/types';
import Sidebar from './Sidebar';
import DocumentsPanel from './DocumentsPanel';
import ChatPanel from './ChatPanel';
import { useAuth } from './AuthProvider';

const SUGGESTIONS = [
  'Summarise the key points across these documents.',
  'What are the main risks or caveats mentioned?',
  'List every figure or table and what it shows.',
];

export default function Dashboard() {
  const { user } = useAuth();
  const storageKey = `docqa:lastWorkspace:${user?.id ?? 'dev'}`;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [chats, setChats] = useState<Chat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  // History is stored with the thread it belongs to, rather than as a bare
  // array cleared on switch. Two things fall out of that: no setState-in-effect
  // just to blank the previous thread, and a slow in-flight fetch can never
  // paint itself over a thread the user has since switched away from.
  const [history, setHistory] = useState<{ chatId: string | null; messages: ChatMessage[] }>({
    chatId: null,
    messages: [],
  });
  const [sending, setSending] = useState(false);

  // The answer currently arriving, held apart from `history` rather than
  // appended to it and mutated. It only becomes a real message once the server
  // says it's saved, so the rendered thread never contains anything the backend
  // hasn't committed — and switching threads mid-answer hides it for free.
  const [streaming, setStreaming] = useState<{
    chatId: string;
    content: string;
    sources: Source[];
  } | null>(null);

  // Threads created in this session have nothing to fetch. Asking anyway races
  // the optimistic first question: the fetch resolves last and paints its empty
  // array over the message the user just sent. Ids are dropped once the thread
  // has server-side history worth loading.
  const knownEmptyChats = useRef<Set<string>>(new Set());

  const messages = history.chatId === selectedChatId ? history.messages : [];
  const isStreamingHere = streaming?.chatId === selectedChatId;
  const visibleMessages: ChatMessage[] = isStreamingHere
    ? [...messages, { role: 'assistant', content: streaming.content, sources: streaming.sources }]
    : messages;

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileDocsOpen, setMobileDocsOpen] = useState(false);

  useEffect(() => {
    api
      .listWorkspaces()
      .then((data) => {
        setWorkspaces(data);
        if (data.length > 0) {
          const saved = localStorage.getItem(storageKey);
          setSelectedId(saved && data.some((w) => w.id === saved) ? saved : data[0].id);
        }
      })
      .catch(() => toast.error('Could not reach the backend API'))
      .finally(() => setWorkspacesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) localStorage.setItem(storageKey, selectedId);
  }, [selectedId, storageKey]);

  const refreshDocuments = useCallback(async (workspaceId: string) => {
    try {
      setDocuments(await api.listDocuments(workspaceId));
    } catch {
      toast.error('Failed to load documents');
    }
  }, []);

  // Workspace switch: reset thread state, then load this workspace's threads and
  // open the most recent one (the backend orders by updated_at DESC).
  useEffect(() => {
    setDocuments([]);
    setChats([]);
    setSelectedChatId(null);
    if (!selectedId) return;

    refreshDocuments(selectedId);
    setChatsLoading(true);
    api
      .listChats(selectedId)
      .then((data) => {
        setChats(data);
        setSelectedChatId(data[0]?.id ?? null);
      })
      .catch(() => toast.error('Failed to load conversations'))
      .finally(() => setChatsLoading(false));
  }, [selectedId, refreshDocuments]);

  // Thread switch: load its history. A thread we created ourselves is known to
  // be empty, and `messages` already derives to [] for it, so there is nothing
  // to fetch and nothing to set.
  useEffect(() => {
    if (!selectedChatId) return;
    if (knownEmptyChats.current.has(selectedChatId)) return;
    let cancelled = false;
    api
      .getHistory(selectedChatId)
      .then((msgs) => {
        if (!cancelled) setHistory({ chatId: selectedChatId, messages: msgs });
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load chat history');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedChatId]);

  useEffect(() => {
    if (!selectedId) return;
    if (!documents.some((d) => d.status === 'processing')) return;
    const interval = setInterval(() => refreshDocuments(selectedId), 2500);
    return () => clearInterval(interval);
  }, [selectedId, documents, refreshDocuments]);

  async function handleCreateWorkspace(name: string) {
    try {
      const ws = await api.createWorkspace(name);
      setWorkspaces((prev) => [ws, ...prev]);
      setSelectedId(ws.id);
      toast.success(`Workspace "${ws.name}" created`);
    } catch {
      toast.error('Failed to create workspace');
    }
  }

  async function handleDeleteWorkspace(id: string) {
    const deletedName = workspaces.find((w) => w.id === id)?.name;
    const remaining = workspaces.filter((w) => w.id !== id);
    setWorkspaces(remaining);
    try {
      await api.deleteWorkspace(id);
      toast.success(deletedName ? `Workspace "${deletedName}" deleted` : 'Workspace deleted');
      if (selectedId === id) setSelectedId(remaining[0]?.id ?? null);
    } catch {
      toast.error('Failed to delete workspace');
      api.listWorkspaces().then(setWorkspaces).catch(() => {});
    }
  }

  async function handleUpload(file: File) {
    if (!selectedId) return;
    try {
      const { document } = await api.uploadDocument(selectedId, file);
      setDocuments((prev) => [document, ...prev]);
      toast.success(`"${file.name}" uploaded — processing…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  async function handleDeleteDocument(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    try {
      await api.deleteDocument(id);
    } catch {
      toast.error('Failed to delete document');
      if (selectedId) refreshDocuments(selectedId);
    }
  }

  async function handleNewChat() {
    if (!selectedId) return;
    // Reuse an untouched thread rather than stacking up empty "New chat" rows,
    // which is what ChatGPT does when you hit New twice.
    const blank = chats.find((c) => c.title === 'New chat');
    if (blank) {
      setSelectedChatId(blank.id);
      setMobileSidebarOpen(false);
      return;
    }
    try {
      const chat = await api.createChat(selectedId);
      knownEmptyChats.current.add(chat.id);
      setChats((prev) => [chat, ...prev]);
      setSelectedChatId(chat.id);
      setMobileSidebarOpen(false);
    } catch {
      toast.error('Failed to start a new chat');
    }
  }

  async function handleRenameChat(id: string, title: string) {
    const previous = chats;
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      await api.renameChat(id, title);
    } catch {
      toast.error('Failed to rename chat');
      setChats(previous);
    }
  }

  async function handleDeleteChat(id: string) {
    const previous = chats;
    const remaining = chats.filter((c) => c.id !== id);
    setChats(remaining);
    if (selectedChatId === id) setSelectedChatId(remaining[0]?.id ?? null);
    try {
      await api.deleteChat(id);
    } catch {
      toast.error('Failed to delete chat');
      setChats(previous);
    }
  }

  async function handleSend(question: string) {
    if (!selectedId) return;

    // A thread may not exist yet if the workspace has never been used, or if the
    // user picked a suggestion on a fresh workspace. Create one on demand so
    // asking a question never dead-ends.
    let chatId = selectedChatId;
    if (!chatId) {
      try {
        const chat = await api.createChat(selectedId);
        knownEmptyChats.current.add(chat.id);
        setChats((prev) => [chat, ...prev]);
        setSelectedChatId(chat.id);
        chatId = chat.id;
      } catch {
        toast.error('Failed to start a new chat');
        return;
      }
    }

    const optimistic: ChatMessage = { role: 'user', content: question };
    setHistory((prev) =>
      prev.chatId === chatId
        ? { chatId, messages: [...prev.messages, optimistic] }
        : { chatId, messages: [optimistic] }
    );
    setSending(true);

    // Accumulated outside state: `answer` is rebuilt from every delta, and
    // reading it back from a setState updater to append the next one would tie
    // the text to render timing for no benefit.
    let answer = '';
    let sources: Source[] = [];
    let title: string | null = null;
    try {
      await api.streamAnswer(chatId, question, {
        // Always arrives before the first delta, so the first rendered frame of
        // the answer already knows what its [n] badges point at.
        onSources: (s) => {
          sources = s;
        },
        onDelta: (text) => {
          answer += text;
          setStreaming({ chatId, content: answer, sources });
        },
        onDone: ({ chatTitle }) => {
          title = chatTitle;
        },
      });

      // Reached only once the server confirmed the answer is saved, so this
      // thread is now worth fetching again if the user navigates away and back.
      knownEmptyChats.current.delete(chatId);
      setHistory((prev) =>
        prev.chatId === chatId
          ? { chatId, messages: [...prev.messages, { role: 'assistant', content: answer, sources }] }
          : prev
      );
      // The first exchange titles the thread; reflect it without a refetch.
      if (title) {
        setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title: title as string } : c)));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to get an answer');
      // Roll back the optimistic question, but only if the user is still looking
      // at the thread it was asked in.
      setHistory((prev) =>
        prev.chatId === chatId ? { chatId, messages: prev.messages.slice(0, -1) } : prev
      );
    } finally {
      // Batched with the commit above into a single render, so the answer never
      // appears twice — once from `streaming`, once from `history`.
      setSending(false);
      setStreaming(null);
    }
  }

  const selectedWorkspace = workspaces.find((w) => w.id === selectedId) ?? null;
  const activeChat = chats.find((c) => c.id === selectedChatId) ?? null;

  const sidebarProps = {
    workspaces,
    selectedWorkspaceId: selectedId,
    onSelectWorkspace: setSelectedId,
    onCreateWorkspace: handleCreateWorkspace,
    onDeleteWorkspace: handleDeleteWorkspace,
    workspacesLoading,
    chats,
    selectedChatId,
    onSelectChat: (id: string) => {
      setSelectedChatId(id);
      setMobileSidebarOpen(false);
    },
    onNewChat: handleNewChat,
    onRenameChat: handleRenameChat,
    onDeleteChat: handleDeleteChat,
    chatsLoading,
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop drawer — collapsible, like ChatGPT's. */}
      <AnimatePresence initial={false}>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="hidden shrink-0 overflow-hidden lg:block"
          >
            <Sidebar {...sidebarProps} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            />
            <motion.div
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <Sidebar {...sidebarProps} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line bg-card/40 px-4 py-3 backdrop-blur-xl lg:px-6">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-ink/10 hover:text-ink lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            className="hidden rounded-lg p-1.5 text-muted transition-colors hover:bg-ink/10 hover:text-ink lg:block"
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>

          <h1 className="min-w-0 flex-1 truncate font-display text-sm font-medium text-ink">
            {activeChat?.title ?? selectedWorkspace?.name ?? 'Select a workspace'}
          </h1>

          <button
            onClick={() => setMobileDocsOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card/60 px-3 py-1.5 text-xs text-ink transition-colors hover:bg-card xl:hidden"
          >
            <FileStack className="h-3.5 w-3.5" />
            Documents
            {mobileDocsOpen ? <X className="h-3 w-3" /> : null}
          </button>
        </header>

        <div className="relative flex min-h-0 flex-1">
          <div className="hidden w-80 shrink-0 overflow-y-auto border-r border-line p-4 xl:block">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
              <FileStack className="h-3.5 w-3.5" />
              Documents
            </h2>
            {selectedId ? (
              <DocumentsPanel
                documents={documents}
                onUpload={handleUpload}
                onDelete={handleDeleteDocument}
              />
            ) : (
              <p className="text-sm text-muted">Select or create a workspace to upload documents.</p>
            )}
          </div>

          <AnimatePresence>
            {mobileDocsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="absolute inset-x-0 top-0 z-30 max-h-full overflow-y-auto border-b border-line bg-bg/95 p-4 backdrop-blur-xl xl:hidden"
              >
                {selectedId ? (
                  <DocumentsPanel
                    documents={documents}
                    onUpload={handleUpload}
                    onDelete={handleDeleteDocument}
                  />
                ) : (
                  <p className="text-sm text-muted">
                    Select or create a workspace to upload documents.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex min-w-0 flex-1 flex-col">
            <ChatPanel
              messages={visibleMessages}
              onSend={handleSend}
              sending={sending}
              streaming={isStreamingHere}
              disabled={!selectedId}
              suggestions={documents.some((d) => d.status === 'ready') ? SUGGESTIONS : []}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
