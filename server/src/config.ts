import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  appName: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  databaseUrl: string;
  localStorageDir: string;
  clientDistDir: string;
  maxUploadBytes: number;
}

export const config: AppConfig = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  appName: 'COZAM — Sistema Integrado de Compras e Pagamentos',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  databaseUrl: process.env.DATABASE_URL || '',
  localStorageDir: process.env.LOCAL_STORAGE_DIR || path.resolve(__dirname, '../../storage_data'),
  clientDistDir: process.env.CLIENT_DIST_DIR || path.resolve(__dirname, '../../client/dist'),
  maxUploadBytes: 20 * 1024 * 1024, // 20 MB
};
