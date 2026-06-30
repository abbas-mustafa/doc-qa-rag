import { query } from '../db/pool.js';

// TODO (next session): wire this up to:
// 1. services/embeddings.js -> embed the user's question
// 2. services/retrieval.js -> pgvector similarity search (top-K chunks above threshold)
// 3. services/llm.js -> build citation-aware prompt, call chat model
// 4. Save user + assistant messages to `messages` table with sources
export async function askQuestion(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Placeholder response until retrieval + generation pipeline is built
    res.json({
      answer: 'RAG pipeline not yet implemented. This is a placeholder response.',
      sources: [],
      question,
      workspaceId,
    });
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
