import { query } from '../db/pool.js';
import { config } from '../config/index.js';

// Given a query embedding, find the top-K most similar chunks within a workspace,
// filtered above a similarity threshold (cosine similarity).
export async function retrieveRelevantChunks(workspaceId, queryEmbedding, topK = config.topK) {
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  const result = await query(
    `SELECT c.*, d.original_name,
            (1 - (c.embedding <=> $1)) AS similarity
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE d.workspace_id = $2
     ORDER BY c.embedding <=> $1
     LIMIT $3`,
    [vectorLiteral, workspaceId, topK]
  );

  return result.rows.filter((row) => row.similarity >= config.similarityThreshold);
}
