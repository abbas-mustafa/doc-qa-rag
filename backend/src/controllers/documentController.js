import { query } from '../db/pool.js';
import { parseDocument } from '../services/documentParser.js';
import { chunkText } from '../services/chunker.js';
import { embedText } from '../services/embeddings.js';

// Parses, chunks, and embeds a document, then stores the chunks and flips
// the document status to "ready" (or "failed" on error). Runs in the
// background so the upload request can respond immediately.
async function processDocument(document, filePath) {
  try {
    const { text, pageCount } = await parseDocument(filePath, document.mime_type);
    const chunks = chunkText(text);
    const embeddings = await embedText(chunks);

    for (let i = 0; i < chunks.length; i++) {
      await query(
        `INSERT INTO chunks (document_id, content, chunk_index, embedding)
         VALUES ($1, $2, $3, $4)`,
        [document.id, chunks[i], i, `[${embeddings[i].join(',')}]`]
      );
    }

    await query('UPDATE documents SET status = $1, page_count = $2 WHERE id = $3', [
      'ready',
      pageCount,
      document.id,
    ]);
  } catch (err) {
    console.error('Document processing failed:', err);
    await query('UPDATE documents SET status = $1 WHERE id = $2', ['failed', document.id]);
  }
}

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

    // Kick off parsing + chunking + embedding in the background.
    // Client polls GET /api/documents/workspace/:workspaceId to see status flip to "ready".
    processDocument(document, file.path);

    res.status(202).json({
      message: 'Document uploaded, processing started',
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
