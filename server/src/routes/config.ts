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
