'use client';

import { Children, type ReactNode } from 'react';
import type { Source } from '@/lib/types';
import { CITATION_RE } from '@/lib/citations';

/**
 * A numbered inline citation, rendered where the model wrote [n].
 *
 * Superscript rather than a pill: a claim can carry two or three of these, and
 * at body-text size they'd break the line's rhythm. The number is the same one
 * shown on the source chip below the answer, and clicking highlights that chip —
 * which is as far as a citation can currently go, since documents are stored on
 * an ephemeral disk with no endpoint to serve them back.
 */
export function CitationBadge({
  n,
  source,
  onSelect,
}: {
  n: number;
  source: Source;
  onSelect: (n: number) => void;
}) {
  const label = `${source.documentName}${source.pageNumber ? `, page ${source.pageNumber}` : ''}`;
  return (
    <button
      type="button"
      onClick={() => onSelect(n)}
      title={label}
      aria-label={`Source ${n}: ${label}`}
      className="mx-px inline-flex h-[1.15em] min-w-[1.15em] translate-y-[-0.35em] items-center justify-center rounded-[0.25em] bg-accent/15 px-[0.25em] align-baseline font-mono text-[0.65em] font-medium text-accent ring-1 ring-line transition-colors hover:bg-accent/30 hover:text-ink"
    >
      {n}
    </button>
  );
}

/**
 * Replace [n] markers inside rendered markdown children with clickable badges.
 *
 * Runs per element rather than over the raw string so it can't corrupt markdown
 * syntax before parsing — `[1]` looks like a link label to a markdown parser, and
 * pre-substituting HTML would either be escaped or break link/reference parsing.
 */
export function withCitations(
  children: ReactNode,
  sources: Source[],
  onSelect: (n: number) => void
): ReactNode {
  if (sources.length === 0) return children;

  return Children.map(children, (child) => {
    if (typeof child !== 'string') return child;

    const parts: ReactNode[] = [];
    let cursor = 0;
    // matchAll needs a fresh lastIndex; the shared regex is global.
    CITATION_RE.lastIndex = 0;
    for (const match of child.matchAll(CITATION_RE)) {
      const n = Number(match[1]);
      // Out-of-range numbers aren't citations — e.g. a literal "[10]" in prose
      // when the answer has three sources. Leave them as written.
      if (n < 1 || n > sources.length || match.index === undefined) continue;
      if (match.index > cursor) parts.push(child.slice(cursor, match.index));
      parts.push(
        <CitationBadge
          key={`${match.index}-${n}`}
          n={n}
          source={sources[n - 1]}
          onSelect={onSelect}
        />
      );
      cursor = match.index + match[0].length;
    }

    if (parts.length === 0) return child;
    if (cursor < child.length) parts.push(child.slice(cursor));
    return parts;
  });
}
