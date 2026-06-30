import OpenAI from 'openai';
import { config } from '../config/index.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

// Builds a prompt from retrieved chunks + question, calls the chat model,
// and returns an answer with citation markers tied to source chunks.
// To be implemented next session.
export async function generateAnswer(question, retrievedChunks) {
  // TODO:
  // 1. If retrievedChunks is empty -> return "I don't have enough information to answer that."
  // 2. Build context block with chunk text + [source: documentName, page X] labels
  // 3. System prompt: "Answer only using the provided context. Cite sources inline."
  // 4. Call openai.chat.completions.create({ model: config.chatModel, messages: [...] })
  // 5. Return { answer, sources: [{ documentId, documentName, pageNumber }] }
  throw new Error('generateAnswer not yet implemented');
}
