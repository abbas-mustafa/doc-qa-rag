'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, FileText, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import type { ChatMessage } from '@/lib/types';
import Markdown from './Markdown';

/**
 * Asymmetric by design, following ChatGPT/Claude/Gemini: the *user* gets a
 * bubble (short, scannable, clearly theirs), the *assistant* renders as
 * full-width prose with no container. Bubbling both reads as SMS and caps long
 * cited answers at an awkward width.
 */
export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const chipRefs = useRef<(HTMLElement | null)[]>([]);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clicking an inline citation flashes its chip. A flash rather than a
  // persistent selection: it answers "which source is this?" and then gets out
  // of the way, with no state for the reader to clean up.
  const selectSource = useCallback((n: number) => {
    setHighlighted(n);
    chipRefs.current[n - 1]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setHighlighted(null), 1600);
  }, []);

  useEffect(() => () => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
  }, []);

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-line-2 bg-accent-2/10 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-ink">
          {message.content}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="group/msg flex gap-3"
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 ring-1 ring-line">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
      </div>

      <div className="min-w-0 flex-1">
        <Markdown
          content={message.content}
          sources={message.sources ?? []}
          onSelectSource={selectSource}
        />

        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {message.sources.map((s, i) => (
              <span
                key={`${s.documentId}-${i}`}
                ref={(el) => {
                  chipRefs.current[i] = el;
                }}
                className={clsx(
                  'flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-xs transition-colors duration-300',
                  highlighted === i + 1
                    ? 'border-accent/60 bg-accent/15 text-ink'
                    : 'border-line bg-card/60 text-muted'
                )}
              >
                {/* The chip's number is what inline [n] badges point at. */}
                <span className="text-accent/70">{i + 1}</span>
                <FileText className="h-3 w-3 text-accent/70" />
                {s.documentName}
                {s.pageNumber ? ` · p.${s.pageNumber}` : ''}
              </span>
            ))}
          </div>
        )}

        <CopyButton content={message.content} />
      </div>
    </motion.div>
  );
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard is unavailable over plain http on some browsers; silently
      // skip rather than throwing a toast for a non-essential affordance.
    }
  }

  return (
    <button
      onClick={copy}
      aria-label={copied ? 'Copied' : 'Copy message'}
      className={clsx(
        'mt-2 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted transition-all hover:text-ink',
        // Revealed on hover for pointer users, but always present on touch,
        // where there is no hover to reveal it with.
        'opacity-100 md:opacity-0 md:group-hover/msg:opacity-100 md:focus-visible:opacity-100'
      )}
    >
      {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
