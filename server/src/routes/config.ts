import { Router } from 'express';
import { config } from '../config.js';

export const configRouter = Router();

configRouter.get('/config', (req, res) => {
  res.json({
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    appName: config.appName,
    environment: config.nodeEnv,
  });
});

configRouter.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});
