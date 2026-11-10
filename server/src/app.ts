import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler } from './middleware/errors.js';
import { configRouter } from './routes/config.js';
import { meRouter } from './routes/me.js';
import { suppliersRouter } from './routes/suppliers.js';
import { processesRouter } from './routes/processes.js';
import { supplyOrdersRouter } from './routes/supply-orders.js';
import { invoicesRouter } from './routes/invoices.js';
import { paymentsRouter } from './routes/payments.js';
import { documentsRouter } from './routes/documents.js';
import { dashboardRouter } from './routes/dashboard.js';
import { reportsRouter } from './routes/reports.js';
import { usersRouter } from './routes/users.js';
import { auditRouter } from './routes/audit.js';

export function createApp(): Express {
  const app = express();

  // Segurança HTTP
  app.use(
    helmet({
      contentSecurityPolicy: false, // permite inline previews de blobs/PDFs no frontend
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(compression());
  app.use(express.json({ limit: '10mb' }));

  // Identificador único de cada requisição para rastreabilidade e auditoria
  app.use((req, res, next) => {
    req.requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });

  // Limite de taxa (proteção de força bruta)
  if (config.isProduction) {
    app.use(
      '/api',
      rateLimit({
        windowMs: 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: {
            code: 'MUITAS_REQUISICOES',
            message: 'Muitas requisições originadas do mesmo IP. Aguarde um minuto.',
          },
        },
      })
    );
  }

  // Rotas da API
  app.use('/api', configRouter);
  app.use('/api', meRouter);
  app.use('/api', suppliersRouter);
  app.use('/api', processesRouter);
  app.use('/api', supplyOrdersRouter);
  app.use('/api', invoicesRouter);
  app.use('/api', paymentsRouter);
  app.use('/api', documentsRouter);
  app.use('/api', dashboardRouter);
  app.use('/api', reportsRouter);
  app.use('/api', usersRouter);
  app.use('/api', auditRouter);

  // Tratamento de erros da API
  app.use('/api', errorHandler);

  // Frontend em produção: entrega os arquivos estáticos compilados do Vite
  if (fs.existsSync(config.clientDistDir)) {
    app.use(express.static(config.clientDistDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(config.clientDistDir, 'index.html'));
    });
  }

  return app;
}
