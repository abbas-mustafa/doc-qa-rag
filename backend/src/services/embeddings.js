import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

// Embeds a single string or batch of strings. Returns a single vector for a
// string input, or an array of vectors for an array input.
export async function embedText(textOrArray) {
  const model = genAI.getGenerativeModel({ model: config.embeddingModel });

  if (Array.isArray(textOrArray)) {
    const { embeddings } = await model.batchEmbedContents({
      requests: textOrArray.map((text) => ({
        content: { role: 'user', parts: [{ text }] },
        outputDimensionality: config.embeddingDimensions,
      })),
    });
    return embeddings.map((e) => e.values);
  }

  const { embedding } = await model.embedContent({
    content: { role: 'user', parts: [{ text: textOrArray }] },
    outputDimensionality: config.embeddingDimensions,
  });
  return embedding.values;
}
