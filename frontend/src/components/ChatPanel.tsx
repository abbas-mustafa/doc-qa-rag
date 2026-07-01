'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import type { ChatMessage } from '@/lib/types';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (question: string) => Promise<void>;
  sending: boolean;
  disabled: boolean;
}

const MAX_TEXTAREA_HEIGHT = 160;

export default function ChatPanel({ messages, onSend, sending, disabled }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [input]);

  async function submitQuestion() {
    const question = input.trim();
    if (!question || sending || disabled) return;
    setInput('');
    await onSend(question);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitQuestion();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-1 py-2">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-zinc-500">
            <p className="text-sm">Ask a question about the documents in this workspace.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <MessageBubble key={m.id ?? i} message={m} />
            ))}
          </AnimatePresence>
        )}
        {sending && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={disabled ? 'Select a workspace first' : 'Ask something about your documents…'}
          className="max-h-40 flex-1 resize-none overflow-y-auto rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-violet-400/60 focus:ring-1 focus:ring-violet-400/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || sending || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-white shadow-lg shadow-violet-500/20 transition-opacity disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
