import { createApp } from './app.js';
import { config } from './config.js';
import { getPool } from './db/pool.js';
import { runMigrations } from './db/migrate.js';

async function bootstrap() {
  console.log(`[COZAM] Inicializando ${config.appName}...`);
  console.log(`[COZAM] Ambiente: ${config.nodeEnv}`);

  const pool = getPool();

  try {
    console.log('[COZAM] Verificando e aplicando migrações do banco de dados...');
    await runMigrations(pool);
    console.log('[COZAM] Migrações concluídas com sucesso.');
  } catch (err: any) {
    console.error('[COZAM] Erro crítico nas migrações:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    if (config.isProduction) {
      console.warn('[COZAM] AVISO: Continuando inicialização do servidor HTTP para manter a aplicação online...');
    } else {
      process.exit(1);
    }
  }

  const app = createApp();

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[COZAM] Servidor ativo e pronto na porta ${config.port}`);
    console.log(`[COZAM] Acesso: http://localhost:${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('[COZAM] Falha fatal no bootstrap:', err);
  process.exit(1);
});
