'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, FolderOpen, Plus, MessageSquareText, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import type { Workspace } from '@/lib/types';

interface SidebarProps {
  workspaces: Workspace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
}

export default function Sidebar({
  workspaces,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  loading,
}: SidebarProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onCreate(name.trim());
      setName('');
      setCreating(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-white/10 bg-white/[0.03] backdrop-blur-xl">
      <div className="flex items-center gap-2 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-500/20">
          <MessageSquareText className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-semibold tracking-tight">DocQA</span>
      </div>

      <div className="flex items-center justify-between px-5 pb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Workspaces
        </span>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setCreating((v) => !v)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Plus className={clsx('h-4 w-4 transition-transform', creating && 'rotate-45')} />
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {creating && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleCreate}
            className="overflow-hidden px-5"
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-zinc-500 focus:border-violet-400/60 focus:ring-1 focus:ring-violet-400/40"
            />
            <button
              type="submit"
              disabled={submitting}
              className="mb-3 w-full rounded-lg bg-gradient-to-r from-violet-500 to-cyan-400 py-2 text-sm font-medium text-white shadow-md shadow-violet-500/20 transition-opacity disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create workspace'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {loading ? (
          <div className="px-2 py-4 text-sm text-zinc-500">Loading workspaces…</div>
        ) : workspaces.length === 0 ? (
          <div className="px-2 py-4 text-sm text-zinc-500">No workspaces yet — create one above.</div>
        ) : (
          <ul className="flex flex-col gap-1">
            {workspaces.map((ws) => {
              const active = ws.id === selectedId;
              const confirming = confirmingId === ws.id;
              const deleting = deletingId === ws.id;
              return (
                <li key={ws.id} className="group relative">
                  <button
                    onClick={() => onSelect(ws.id)}
                    className={clsx(
                      'relative z-10 flex w-full items-center gap-2 rounded-lg py-2.5 pl-3 text-left text-sm transition-colors',
                      confirming ? 'pr-3' : 'pr-9',
                      active ? 'text-white' : 'text-zinc-400 hover:text-zinc-100'
                    )}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0" />
                    <span className="truncate">{ws.name}</span>
                  </button>

                  {active && (
                    <motion.div
                      layoutId="active-workspace"
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-500/20 to-cyan-400/10 ring-1 ring-violet-400/30"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}

                  {confirming ? (
                    <div className="absolute right-1.5 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1">
                      <button
                        onClick={() => handleDelete(ws.id)}
                        disabled={deleting}
                        title="Confirm delete"
                        className="flex h-5 w-5 items-center justify-center rounded text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        disabled={deleting}
                        title="Cancel"
                        className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-white/10 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingId(ws.id)}
                      title="Delete workspace"
                      className="absolute right-1.5 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-zinc-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
