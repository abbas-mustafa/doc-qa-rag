import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL,
  openaiApiKey: process.env.OPENAI_API_KEY,
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  chatModel: process.env.CHAT_MODEL || 'gpt-4o-mini',
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 10),
  // Chunking strategy
  chunkSize: 500, // approx tokens per chunk
  chunkOverlap: 50, // overlap between consecutive chunks
  topK: 5, // number of chunks retrieved per query
  similarityThreshold: 0.3, // below this, treat as "no good match found"
};
