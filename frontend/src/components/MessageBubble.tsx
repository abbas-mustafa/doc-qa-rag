'use client';

import { motion } from 'framer-motion';
import { FileText, Sparkles, User } from 'lucide-react';
import clsx from 'clsx';
import type { ChatMessage } from '@/lib/types';

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={clsx('flex gap-3', isUser && 'flex-row-reverse')}
    >
      <div
        className={clsx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-gradient-to-br from-cyan-400 to-violet-500'
            : 'bg-white/10 ring-1 ring-white/10'
        )}
      >
        {isUser ? <User className="h-4 w-4 text-white" /> : <Sparkles className="h-4 w-4 text-violet-300" />}
      </div>

      <div className={clsx('flex max-w-[75%] flex-col gap-2', isUser && 'items-end')}>
        <div
          className={clsx(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
            isUser
              ? 'bg-gradient-to-br from-violet-500 to-cyan-500 text-white rounded-tr-sm'
              : 'border border-white/10 bg-white/[0.04] text-zinc-100 backdrop-blur-sm rounded-tl-sm'
          )}
        >
          {message.content}
        </div>

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.sources.map((s, i) => (
              <span
                key={`${s.documentId}-${i}`}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-400"
              >
                <FileText className="h-3 w-3" />
                {s.documentName}
                {s.pageNumber ? ` · p.${s.pageNumber}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
