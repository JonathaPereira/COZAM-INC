import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appName: string;
  environment: string;
}

let cachedConfig: AppConfig | null = null;

export async function fetchAppConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Não foi possível carregar a configuração da aplicação.');
  cachedConfig = await res.json();
  return cachedConfig!;
}

export async function getSupabase(): Promise<SupabaseClient | null> {
  if (supabaseInstance) return supabaseInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const cfg = await fetchAppConfig();
      if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
        supabaseInstance = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
        return supabaseInstance;
      }
    } catch (err) {
      console.warn('Supabase não configurado ou offline. Operando em modo de desenvolvimento.', err);
    }
    return null;
  })();

  return initPromise;
}
