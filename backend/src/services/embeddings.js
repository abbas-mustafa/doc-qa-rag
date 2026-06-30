import OpenAI from 'openai';
import { config } from '../config/index.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

// Embeds a single string or batch of strings.
// To be implemented next session: batch requests efficiently (OpenAI allows array input).
export async function embedText(textOrArray) {
  // TODO:
  // const response = await openai.embeddings.create({
  //   model: config.embeddingModel,
  //   input: textOrArray,
  // });
  // return response.data.map(d => d.embedding);
  throw new Error('embedText not yet implemented');
}
