import express from 'express';
import * as chatController from '../controllers/chatController.js';

const router = express.Router();

// Ask a question; runs retrieval + generation, returns answer + citations
router.post('/:workspaceId', chatController.askQuestion);

// Get conversation history for a workspace
router.get('/:workspaceId/history', chatController.getHistory);

export default router;
