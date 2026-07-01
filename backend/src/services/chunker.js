import { config } from '../config/index.js';

// Splits raw text into overlapping chunks for embedding.
// chunkSize/overlap are treated as word counts (a rough approximation of tokens).
export function chunkText(text, { chunkSize = config.chunkSize, overlap = config.chunkOverlap } = {}) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks = [];
  const step = chunkSize - overlap;
  for (let start = 0; start < words.length; start += step) {
    const chunkWords = words.slice(start, start + chunkSize);
    chunks.push(chunkWords.join(' '));
    if (start + chunkSize >= words.length) break;
  }

  return chunks;
}
