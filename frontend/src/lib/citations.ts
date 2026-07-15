import type { Source } from './types';

/**
 * Citation markers in answer text.
 *
 * The backend now asks the model to cite as [n], indexing the source list. Older
 * stored answers use [source: name, p.N] — sometimes with several pages in one
 * marker — and those are already in users' histories, so they're normalised to
 * [n] on read rather than left as raw text.
 */
const LEGACY_RE = /[ \t]*\[source:\s*([^\]]+?)\s*\]/gi;
const PAGE_RE = /^p\.?\s*(\d+)$/i;

/** [n] where n indexes `sources` 1-based. */
export const CITATION_RE = /\[(\d+)\]/g;

function findSource(sources: Source[], name: string, page: string | null): number {
  const i = sources.findIndex(
    (s) =>
      s.documentName === name &&
      (page === null || String(s.pageNumber ?? '') === page)
  );
  return i >= 0 ? i + 1 : 0;
}

/**
 * Rewrite legacy `[source: name, p.1, p.3]` markers into `[1][2]`.
 *
 * A marker that matches no current source is dropped rather than shown: it names
 * a document that isn't among this answer's sources, so there is nothing for the
 * reader to click through to and the raw text is just noise.
 */
export function normaliseCitations(content: string, sources: Source[]): string {
  return content.replace(LEGACY_RE, (_match, inner: string) => {
    const parts = inner.split(',').map((p) => p.trim());
    const name = parts[0];
    const pages = parts
      .slice(1)
      .map((p) => PAGE_RE.exec(p)?.[1])
      .filter((p): p is string => Boolean(p));

    const numbers = (pages.length ? pages : [null]).map((page) =>
      findSource(sources, name, page)
    );
    const valid = [...new Set(numbers.filter((n) => n > 0))];
    return valid.map((n) => `[${n}]`).join('');
  });
}
