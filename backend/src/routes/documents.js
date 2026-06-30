import express from 'express';
import { upload } from '../middleware/upload.js';
import * as documentController from '../controllers/documentController.js';

const router = express.Router();

// Upload a document into a workspace, triggers parsing + chunking + embedding
router.post('/upload/:workspaceId', upload.single('file'), documentController.uploadDocument);

// List documents in a workspace
router.get('/workspace/:workspaceId', documentController.listDocuments);

// Delete a document (and its chunks, via cascade)
router.delete('/:id', documentController.deleteDocument);

export default router;
