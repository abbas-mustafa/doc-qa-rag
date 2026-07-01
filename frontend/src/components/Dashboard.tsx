'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, FileStack } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { ChatMessage, Workspace, WorkspaceDocument } from '@/lib/types';
import Sidebar from './Sidebar';
import DocumentsPanel from './DocumentsPanel';
import ChatPanel from './ChatPanel';

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileDocsOpen, setMobileDocsOpen] = useState(false);

  useEffect(() => {
    api
      .listWorkspaces()
      .then((data) => {
        setWorkspaces(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(() => toast.error('Could not reach the backend API'))
      .finally(() => setWorkspacesLoading(false));
  }, []);

  const refreshDocuments = useCallback(async (workspaceId: string) => {
    try {
      const docs = await api.listDocuments(workspaceId);
      setDocuments(docs);
    } catch {
      toast.error('Failed to load documents');
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDocuments([]);
      setMessages([]);
      return;
    }
    refreshDocuments(selectedId);
    api
      .getHistory(selectedId)
      .then(setMessages)
      .catch(() => toast.error('Failed to load chat history'));
  }, [selectedId, refreshDocuments]);

  // Poll while any document is still processing
  useEffect(() => {
    if (!selectedId) return;
    const hasProcessing = documents.some((d) => d.status === 'processing');
    if (!hasProcessing) return;
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

  async function handleDeleteWorkspace(id: string) {
    const deletedName = workspaces.find((w) => w.id === id)?.name;
    const remaining = workspaces.filter((w) => w.id !== id);
    setWorkspaces(remaining);
    try {
      await api.deleteWorkspace(id);
      toast.success(deletedName ? `Workspace "${deletedName}" deleted` : 'Workspace deleted');
      if (selectedId === id) {
        setSelectedId(remaining[0]?.id ?? null);
      }
    } catch {
      toast.error('Failed to delete workspace');
      api.listWorkspaces().then(setWorkspaces).catch(() => {});
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

  async function handleSend(question: string) {
    if (!selectedId) return;
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setSending(true);
    try {
      const res = await api.askQuestion(selectedId, question);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.answer, sources: res.sources }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to get an answer');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  const selectedWorkspace = workspaces.find((w) => w.id === selectedId) ?? null;

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          workspaces={workspaces}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={handleCreateWorkspace}
          onDelete={handleDeleteWorkspace}
          loading={workspacesLoading}
        />
      </div>

      {/* Mobile sidebar overlay */}
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
              <Sidebar
                workspaces={workspaces}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setMobileSidebarOpen(false);
                }}
                onCreate={handleCreateWorkspace}
                onDelete={handleDeleteWorkspace}
                loading={workspacesLoading}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-3 backdrop-blur-xl lg:px-6">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">
            {selectedWorkspace ? selectedWorkspace.name : 'Select a workspace'}
          </h1>
          <button
            onClick={() => setMobileDocsOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.07] xl:hidden"
          >
            <FileStack className="h-3.5 w-3.5" />
            Documents
            {mobileDocsOpen ? <X className="h-3 w-3" /> : null}
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Documents panel — desktop */}
          <div className="hidden w-80 shrink-0 overflow-y-auto border-r border-white/10 p-4 xl:block">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <FileStack className="h-3.5 w-3.5" />
              Documents
            </h2>
            {selectedId ? (
              <DocumentsPanel documents={documents} onUpload={handleUpload} onDelete={handleDeleteDocument} />
            ) : (
              <p className="text-sm text-zinc-500">Select or create a workspace to upload documents.</p>
            )}
          </div>

          {/* Documents panel — mobile/tablet collapsible */}
          <AnimatePresence>
            {mobileDocsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="absolute inset-x-0 top-[57px] z-30 overflow-y-auto border-b border-white/10 bg-[#0a0b12]/95 p-4 backdrop-blur-xl xl:hidden"
              >
                {selectedId ? (
                  <DocumentsPanel documents={documents} onUpload={handleUpload} onDelete={handleDeleteDocument} />
                ) : (
                  <p className="text-sm text-zinc-500">Select or create a workspace to upload documents.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat panel */}
          <div className="flex min-w-0 flex-1 flex-col p-4 lg:p-6">
            <ChatPanel
              messages={messages}
              onSend={handleSend}
              sending={sending}
              disabled={!selectedId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
