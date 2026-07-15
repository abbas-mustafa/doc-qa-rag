'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Sparkles } from 'lucide-react';
import type { ChatMessage } from '@/lib/types';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import GradientText from './fx/GradientText';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (question: string) => Promise<void>;
  /** A question is in flight. Covers the whole request, including streaming. */
  sending: boolean;
  /** The answer has started arriving, and is the last item in `messages`. */
  streaming: boolean;
  disabled: boolean;
  /** Shown as clickable starters on an empty thread. */
  suggestions?: string[];
}

const MAX_TEXTAREA_HEIGHT = 200;

export default function ChatPanel({
  messages,
  onSend,
  sending,
  streaming,
  disabled,
  suggestions = [],
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Only auto-scroll when the user is already at the bottom. Yanking them down
  // mid-scroll while they're reading an earlier answer is the single most
  // irritating thing a chat UI can do.
  //
  // Instant while streaming: a growing answer re-fires this every delta, and a
  // smooth scroll restarted before it can finish never arrives, so the view
  // lags behind the text it's meant to follow.
  useEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth' });
  }, [messages, sending, atBottom, streaming]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [input]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    // 48px of slack so a nearly-bottom position still counts as "following".
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
  }

  async function submitQuestion(text?: string) {
    const question = (text ?? input).trim();
    if (!question || sending || disabled) return;
    setInput('');
    setAtBottom(true);
    await onSend(question);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="relative flex h-full flex-col">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {/* The centred column. Full-bleed prose is the main reason a chat app
            stops feeling like one — ChatGPT/Claude/Gemini all cap this. */}
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {empty ? (
            <EmptyState disabled={disabled} suggestions={suggestions} onPick={submitQuestion} />
          ) : (
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {messages.map((m, i) => (
                  <MessageBubble key={m.id ?? i} message={m} />
                ))}
              </AnimatePresence>
              {/* Only until the first token lands — once text is arriving, the
                  answer itself is the progress indicator. */}
              {sending && !streaming && <TypingIndicator />}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <AnimatePresence>
        {!atBottom && !empty && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => {
              setAtBottom(true);
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            aria-label="Scroll to latest"
            className="absolute bottom-28 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-card text-muted shadow-lg backdrop-blur-md transition-colors hover:text-ink"
          >
            <ArrowDown className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="shrink-0 px-4 pb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuestion();
          }}
          className="mx-auto w-full max-w-3xl"
        >
          <div className="relative flex items-end rounded-3xl border border-line bg-card/80 px-4 py-3 backdrop-blur-md transition-colors focus-within:border-accent-2/50">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              rows={1}
              placeholder={disabled ? 'Select a workspace first' : 'Ask about your documents…'}
              className="max-h-[200px] flex-1 resize-none bg-transparent pr-10 text-sm text-ink outline-none placeholder:text-muted disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={disabled || sending || !input.trim()}
              aria-label="Send"
              className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-bg transition-all hover:shadow-md hover:shadow-accent/30 disabled:opacity-30 disabled:shadow-none"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            Answers are grounded in this workspace&apos;s documents and cite their sources.
          </p>
        </form>
      </div>
    </div>
  );
}

function EmptyState({
  disabled,
  suggestions,
  onPick,
}: {
  disabled: boolean;
  suggestions: string[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-line">
        <Sparkles className="h-6 w-6 text-accent" />
      </div>
      <h2 className="font-display text-xl font-semibold text-ink">
        Ask your <GradientText>documents</GradientText>
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted">
        {disabled
          ? 'Select or create a workspace to get started.'
          : 'Every answer is grounded in the files in this workspace, with citations back to the page.'}
      </p>

      {!disabled && suggestions.length > 0 && (
        <div className="mt-6 flex w-full max-w-md flex-col gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="rounded-xl border border-line bg-card/60 px-4 py-2.5 text-left text-sm text-muted transition-colors hover:border-accent-2/40 hover:bg-card hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
