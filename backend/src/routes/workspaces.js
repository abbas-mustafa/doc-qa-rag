import express from 'express';
import * as workspaceController from '../controllers/workspaceController.js';

const router = express.Router();

router.post('/', workspaceController.createWorkspace);
router.get('/', workspaceController.listWorkspaces);
router.get('/:id', workspaceController.getWorkspace);
router.delete('/:id', workspaceController.deleteWorkspace);

export default router;
