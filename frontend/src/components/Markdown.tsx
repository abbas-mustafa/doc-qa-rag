'use client';

import { useMemo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Source } from '@/lib/types';
import { normaliseCitations } from '@/lib/citations';
import { withCitations } from './Citation';

/**
 * Renders assistant answers as markdown.
 *
 * Previously these were `whitespace-pre-wrap` plain text, so any bullet, bold
 * run, or table the model returned showed up as literal `*` and `|` characters.
 * remark-gfm is included specifically because RAG answers over reports lean on
 * tables and it isn't part of CommonMark.
 *
 * Components are mapped explicitly rather than via a prose plugin so every
 * element lands on the design tokens, and so wide content (tables, code) gets
 * its own horizontal scroll container instead of stretching the chat column.
 */
export default function Markdown({
  content,
  sources = [],
  onSelectSource,
}: {
  content: string;
  sources?: Source[];
  onSelectSource?: (n: number) => void;
}) {
  // Legacy [source: ...] markers become [n] before parsing; the badges
  // themselves are substituted per element, after.
  const text = useMemo(() => normaliseCitations(content, sources), [content, sources]);

  const cite = (children: ReactNode): ReactNode =>
    onSelectSource ? withCitations(children, sources, onSelectSource) : children;

  return (
    <div className="text-sm leading-relaxed text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{cite(children)}</p>,
          h1: ({ children }) => (
            <h1 className="mb-3 mt-4 font-display text-lg font-semibold first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-4 font-display text-base font-semibold first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-3 font-display text-sm font-semibold first:mt-0">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1 pl-5 marker:text-accent/60 last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5 marker:text-accent/60 last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{cite(children)}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{cite(children)}</strong>
          ),
          em: ({ children }) => <em className="italic">{cite(children)}</em>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2 hover:text-accent/80"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-accent/40 pl-3 text-muted last:mb-0">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-line" />,
          code: ({ className, children }) => {
            // react-markdown gives fenced blocks a `language-*` class; bare
            // inline spans have none. That's the only reliable way to tell them
            // apart here, and they need very different treatment.
            const isBlock = Boolean(className);
            if (!isBlock) {
              return (
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-accent">
                  {children}
                </code>
              );
            }
            return (
              <code className="block font-mono text-xs leading-relaxed text-ink">{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 last:mb-0">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto last:mb-0">
              <table className="w-full border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-line bg-surface-2 px-2.5 py-1.5 font-medium text-ink">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-line px-2.5 py-1.5 align-top">{cite(children)}</td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
