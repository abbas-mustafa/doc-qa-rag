import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

function buildSystemPrompt() {
  const today = new Date().toISOString().split('T')[0];
  return (
    `Today's date is ${today}. Use it to reason about durations and anything described as "present" or "ongoing". ` +
    'Answer the question using only the provided context. ' +
    'Cite sources inline using the format [source: documentName, page X] (omit page if unknown). ' +
    "If the context doesn't contain enough information to answer, say so plainly."
  );
}

// Builds a prompt from retrieved chunks + question, calls the chat model,
// and returns an answer with citation markers tied to source chunks.
export async function generateAnswer(question, retrievedChunks) {
  if (retrievedChunks.length === 0) {
    return { answer: "I don't have enough information to answer that.", sources: [] };
  }

  const contextBlock = retrievedChunks
    .map((chunk, i) => {
      const pageLabel = chunk.page_number ? `, page ${chunk.page_number}` : '';
      return `[${i + 1}] (source: ${chunk.original_name}${pageLabel})\n${chunk.content}`;
    })
    .join('\n\n');

  const prompt = `Context:\n${contextBlock}\n\nQuestion: ${question}`;

  const model = genAI.getGenerativeModel({
    model: config.chatModel,
    systemInstruction: buildSystemPrompt(),
  });
  const result = await model.generateContent(prompt);

  const seen = new Set();
  const sources = [];
  for (const chunk of retrievedChunks) {
    const key = `${chunk.document_id}:${chunk.page_number ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      documentId: chunk.document_id,
      documentName: chunk.original_name,
      pageNumber: chunk.page_number,
    });
  }

  return { answer: result.response.text(), sources };
}
