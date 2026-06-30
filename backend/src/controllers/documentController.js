import { query } from '../db/pool.js';

// TODO (next session): wire this up to:
// 1. services/documentParser.js -> extract raw text from PDF/DOCX/TXT
// 2. services/chunker.js -> split text into overlapping chunks
// 3. services/embeddings.js -> embed each chunk via OpenAI
// 4. Insert document + chunks into Postgres (pgvector)
export async function uploadDocument(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Insert a placeholder document row with status "processing"
    const result = await query(
      `INSERT INTO documents (workspace_id, filename, original_name, mime_type, status)
       VALUES ($1, $2, $3, $4, 'processing') RETURNING *`,
      [workspaceId, file.filename, file.originalname, file.mimetype]
    );

    const document = result.rows[0];

    // TODO: kick off async parsing + chunking + embedding pipeline here.
    // For now, respond immediately; client can poll status or we add websockets later.
    res.status(202).json({
      message: 'Document uploaded, processing not yet implemented',
      document,
    });
  } catch (err) {
    next(err);
  }
}

export async function listDocuments(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const result = await query(
      'SELECT * FROM documents WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function deleteDocument(req, res, next) {
  try {
    const { id } = req.params;
    await query('DELETE FROM documents WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
