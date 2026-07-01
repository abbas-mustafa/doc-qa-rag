import { query } from '../db/pool.js';
import { embedText } from '../services/embeddings.js';
import { retrieveRelevantChunks } from '../services/retrieval.js';
import { generateAnswer } from '../services/llm.js';

export async function askQuestion(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const queryEmbedding = await embedText(question);
    const relevantChunks = await retrieveRelevantChunks(workspaceId, queryEmbedding);
    const { answer, sources } = await generateAnswer(question, relevantChunks);

    await query(
      `INSERT INTO messages (workspace_id, role, content) VALUES ($1, 'user', $2)`,
      [workspaceId, question]
    );
    await query(
      `INSERT INTO messages (workspace_id, role, content, sources) VALUES ($1, 'assistant', $2, $3)`,
      [workspaceId, answer, JSON.stringify(sources)]
    );

    res.json({ answer, sources, question, workspaceId });
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const result = await query(
      'SELECT * FROM messages WHERE workspace_id = $1 ORDER BY created_at ASC',
      [workspaceId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}
