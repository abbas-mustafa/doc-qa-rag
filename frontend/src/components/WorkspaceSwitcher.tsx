'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronsUpDown, FolderOpen, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Workspace } from '@/lib/types';

/**
 * Workspaces are document collections; chats are conversations inside one.
 * ChatGPT has no equivalent, so this borrows Claude's project-picker shape: the
 * scope lives in a compact switcher at the top of the drawer, leaving the list
 * below free to be conversations — which is what makes the drawer read as a
 * chat app rather than a file browser.
 */
export default function WorkspaceSwitcher({
  workspaces,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  loading,
}: {
  workspaces: Workspace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onCreate(name.trim());
      setName('');
      setCreating(false);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  const selected = workspaces.find((w) => w.id === selectedId);

  return (
    <div ref={ref} className="relative px-3 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-left text-sm transition-colors hover:bg-card"
      >
        <FolderOpen className="h-4 w-4 shrink-0 text-accent-2" />
        <span className="min-w-0 flex-1 truncate text-ink">
          {loading ? 'Loading…' : (selected?.name ?? 'No workspace')}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-x-3 top-full z-30 mt-1 overflow-hidden rounded-lg border border-line bg-card shadow-xl backdrop-blur-xl"
          >
            <div className="max-h-64 overflow-y-auto p-1">
              {workspaces.map((ws) => (
                <div key={ws.id} className="group/ws relative">
                  <button
                    onClick={() => {
                      onSelect(ws.id);
                      setOpen(false);
                    }}
                    className={clsx(
                      'flex w-full items-center gap-2 rounded-md py-2 pl-2 pr-8 text-left text-sm transition-colors',
                      ws.id === selectedId
                        ? 'bg-accent-2/10 text-ink'
                        : 'text-muted hover:bg-ink/5 hover:text-ink'
                    )}
                  >
                    {ws.id === selectedId ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-accent-2" />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <span className="truncate">{ws.name}</span>
                  </button>
                  <button
                    onClick={() => onDelete(ws.id)}
                    aria-label={`Delete workspace ${ws.name}`}
                    className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted opacity-0 transition-colors hover:text-danger group-hover/ws:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {workspaces.length === 0 && !loading && (
                <p className="px-2 py-3 text-xs text-muted">No workspaces yet.</p>
              )}
            </div>

            <div className="border-t border-line p-1">
              {creating ? (
                <form onSubmit={handleCreate} className="p-1">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Workspace name"
                    className="w-full rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent-2/60"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !name.trim()}
                    className="mt-1.5 w-full rounded-md bg-accent py-1.5 text-xs font-medium text-bg disabled:opacity-50"
                  >
                    {submitting ? 'Creating…' : 'Create'}
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New workspace
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
