import { Router } from 'express';
import { config } from '../config.js';
import { getPool } from '../db/pool.js';
import { getMigrationStatus, runMigrations } from '../db/migrate.js';

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

configRouter.get('/system/status', async (req, res) => {
  try {
    const pool = getPool();
    const status = await getMigrationStatus(pool);
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      is_production: config.isProduction,
      ...status,
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: err?.message || String(err),
      detail: err?.detail,
    });
  }
});

configRouter.post('/system/migrate', async (req, res) => {
  try {
    const pool = getPool();
    await runMigrations(pool);
    const status = await getMigrationStatus(pool);
    res.json({
      ok: true,
      message: 'Migrações e verificação de schema executadas com sucesso!',
      ...status,
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: err?.message || String(err),
      detail: err?.detail,
      hint: err?.hint,
    });
  }
});

configRouter.post('/dev/seed', async (req, res, next) => {
  if (config.isProduction) {
    res.status(403).json({ error: { code: 'PROIBIDO', message: 'Carga de demonstração desabilitada em produção.' } });
    return;
  }
  try {
    const { seedDemoData } = await import('../scripts/seed-demo.js');
    await seedDemoData();
    res.json({ ok: true, message: 'Dados de demonstração carregados com sucesso!' });
  } catch (err) {
    next(err);
  }
});
