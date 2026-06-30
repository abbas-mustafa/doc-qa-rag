import { query } from '../db/pool.js';

export async function createWorkspace(req, res, next) {
  try {
    const { name } = req.body;
    const result = await query(
      'INSERT INTO workspaces (name) VALUES ($1) RETURNING *',
      [name || 'My Workspace']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function listWorkspaces(req, res, next) {
  try {
    const result = await query('SELECT * FROM workspaces ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function getWorkspace(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM workspaces WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}
