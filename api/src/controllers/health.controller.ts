import type { RequestHandler } from 'express';
import { checkDbHealth } from '../services/health.service.js';

export const getHealth: RequestHandler = async (_req, res) => {
  const db = await checkDbHealth();
  res.status(200).json({
    status: 'ok',
    db,
    timestamp: new Date().toISOString(),
  });
};
