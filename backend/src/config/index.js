import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL,
  geminiApiKey: process.env.GEMINI_API_KEY,
  embeddingModel: process.env.EMBEDDING_MODEL || 'gemini-embedding-001',
  embeddingDimensions: 768,
  chatModel: process.env.CHAT_MODEL || 'gemini-2.5-flash',
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 10),
  // Chunking strategy
  chunkSize: 500, // approx tokens per chunk
  chunkOverlap: 50, // overlap between consecutive chunks
  topK: 5, // number of chunks retrieved per query
  similarityThreshold: 0.3, // below this, treat as "no good match found"
};
