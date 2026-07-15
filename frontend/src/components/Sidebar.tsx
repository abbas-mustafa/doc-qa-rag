'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, LogOut, MessageSquarePlus, MessageSquareText, Pencil, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import type { Chat, Workspace } from '@/lib/types';
import { useAuth } from './AuthProvider';
import WorkspaceSwitcher from './WorkspaceSwitcher';

interface SidebarProps {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string) => Promise<void>;
  onDeleteWorkspace: (id: string) => Promise<void>;
  workspacesLoading: boolean;

  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => Promise<void>;
  onRenameChat: (id: string, title: string) => Promise<void>;
  onDeleteChat: (id: string) => Promise<void>;
  chatsLoading: boolean;
}

/**
 * Groups threads the way ChatGPT/Claude do. Buckets are computed from calendar
 * day boundaries rather than elapsed hours, so something from 11pm last night
 * reads as "Yesterday" at 7am rather than "Today".
 */
function groupChats(chats: Chat[]): { label: string; items: Chat[] }[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 86_400_000;

  const buckets: Record<string, Chat[]> = { Today: [], Yesterday: [], 'Previous 7 days': [], Older: [] };

  for (const chat of chats) {
    const updated = new Date(chat.updated_at).getTime();
    if (updated >= startOfToday.getTime()) buckets.Today.push(chat);
    else if (updated >= startOfToday.getTime() - dayMs) buckets.Yesterday.push(chat);
    else if (updated >= startOfToday.getTime() - 7 * dayMs) buckets['Previous 7 days'].push(chat);
    else buckets.Older.push(chat);
  }

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export default function Sidebar(props: SidebarProps) {
  const { authConfigured, user, signOut } = useAuth();
  const [creatingChat, setCreatingChat] = useState(false);
  const groups = useMemo(() => groupChats(props.chats), [props.chats]);

  async function handleNewChat() {
    setCreatingChat(true);
    try {
      await props.onNewChat();
    } finally {
      setCreatingChat(false);
    }
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-card/40 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-5 pb-1 pt-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-line">
          <MessageSquareText className="h-4 w-4 text-accent" />
        </div>
        <span className="font-display text-base font-semibold tracking-tight text-ink">DocQA</span>
      </div>

      <WorkspaceSwitcher
        workspaces={props.workspaces}
        selectedId={props.selectedWorkspaceId}
        onSelect={props.onSelectWorkspace}
        onCreate={props.onCreateWorkspace}
        onDelete={props.onDeleteWorkspace}
        loading={props.workspacesLoading}
      />

      <div className="px-3 pt-2">
        <button
          onClick={handleNewChat}
          disabled={!props.selectedWorkspaceId || creatingChat}
          className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink transition-colors hover:border-accent/40 hover:bg-card disabled:opacity-40"
        >
          <MessageSquarePlus className="h-4 w-4 text-accent" />
          New chat
        </button>
      </div>

      <div className="mt-2 flex-1 overflow-y-auto px-3 pb-3">
        {props.chatsLoading ? (
          <ChatSkeleton />
        ) : props.chats.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted">
            {props.selectedWorkspaceId
              ? 'No conversations yet. Start one above.'
              : 'Select a workspace to see its chats.'}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                {group.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((chat) => (
                  <ChatRow
                    key={chat.id}
                    chat={chat}
                    active={chat.id === props.selectedChatId}
                    onSelect={() => props.onSelectChat(chat.id)}
                    onRename={(title) => props.onRenameChat(chat.id, title)}
                    onDelete={() => props.onDeleteChat(chat.id)}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {authConfigured && user && (
        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-2/15 text-xs font-medium uppercase text-accent-2 ring-1 ring-line-2">
            {(user.email ?? '?').charAt(0)}
          </div>
          <span className="min-w-0 flex-1 truncate text-xs text-muted">{user.email}</span>
          <button
            onClick={async () => {
              try {
                await signOut();
              } catch {
                toast.error('Failed to sign out');
              }
            }}
            aria-label="Sign out"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-ink/10 hover:text-ink"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
}

function ChatRow({
  chat,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  chat: Chat;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [title, setTitle] = useState(chat.title);

  async function commit(e: React.FormEvent) {
    e.preventDefault();
    const next = title.trim();
    if (!next || next === chat.title) {
      setEditing(false);
      setTitle(chat.title);
      return;
    }
    setEditing(false);
    await onRename(next);
  }

  if (editing) {
    return (
      <li>
        <form onSubmit={commit} className="px-1 py-0.5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditing(false);
                setTitle(chat.title);
              }
            }}
            className="w-full rounded-md border border-accent-2/50 bg-surface-2 px-2 py-1.5 text-sm text-ink outline-none"
          />
        </form>
      </li>
    );
  }

  return (
    <li className="group/chat relative">
      <button
        onClick={onSelect}
        className={clsx(
          'flex w-full items-center rounded-lg py-2 pl-3 text-left text-sm transition-colors',
          confirming ? 'pr-14' : 'pr-14',
          active ? 'bg-accent-2/10 text-ink ring-1 ring-line-2' : 'text-muted hover:bg-ink/5 hover:text-ink'
        )}
      >
        <span className="truncate">{chat.title}</span>
      </button>

      <div
        className={clsx(
          'absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 transition-opacity',
          // Always visible on touch, hover-revealed on pointer devices.
          'opacity-100 md:opacity-0 md:group-hover/chat:opacity-100',
          (confirming || active) && 'md:opacity-100'
        )}
      >
        {confirming ? (
          <>
            <button
              onClick={async () => {
                setConfirming(false);
                await onDelete();
              }}
              aria-label="Confirm delete chat"
              className="flex h-6 w-6 items-center justify-center rounded text-danger hover:bg-danger/20"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirming(false)}
              aria-label="Cancel delete"
              className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-ink/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              aria-label={`Rename ${chat.title}`}
              className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-ink/10 hover:text-ink"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${chat.title}`}
              className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-ink/10 hover:text-danger"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function ChatSkeleton() {
  return (
    <div className="space-y-1.5 px-1 pt-3">
      {[70, 90, 55, 80].map((w, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.12 }}
          className="h-8 rounded-lg bg-ink/5"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  );
}
