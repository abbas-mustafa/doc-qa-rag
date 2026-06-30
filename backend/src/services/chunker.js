import { config } from '../config/index.js';

// Splits raw text into overlapping chunks for embedding.
// To be implemented next session: token-aware splitting (not just char count),
// ideally respecting paragraph/sentence boundaries where possible.

export function chunkText(text, { chunkSize = config.chunkSize, overlap = config.chunkOverlap } = {}) {
  // TODO: replace this naive placeholder with a proper tokenizer-based splitter
  // (e.g. using gpt-tokenizer or tiktoken) so chunkSize reflects actual tokens, not words.
  throw new Error('chunkText not yet implemented');
}
