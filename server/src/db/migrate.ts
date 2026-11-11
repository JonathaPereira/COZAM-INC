import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DbPool } from './pool.js';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(pool: DbPool): Promise<void> {
  const client = await pool.connect();
  try {
    // 1. Garante a tabela de controle de migrações
    await client.exec(`
      create table if not exists public._migrations (
        name text primary key,
        applied_at timestamptz default now()
      );
    `);

    // 2. Se for banco PGlite (testes locais em memória), cria os stubs de auth e storage
    if (pool.isPGlite()) {
      await client.exec(`
        do $$
        begin
          if not exists (select 1 from pg_roles where rolname = 'anon') then
            create role anon;
          end if;
          if not exists (select 1 from pg_roles where rolname = 'authenticated') then
            create role authenticated;
          end if;
        end $$;

        create schema if not exists auth;
        create schema if not exists storage;

        create table if not exists auth.users (
          id uuid primary key default gen_random_uuid(),
          email text unique,
          raw_user_meta_data jsonb default '{}'::jsonb,
          created_at timestamptz default now()
        );

        create or replace function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('app.actor_id', true), '')::uuid;
        $$;

        create table if not exists storage.buckets (
          id text primary key,
          name text not null,
          public boolean default false,
          file_size_limit bigint,
          allowed_mime_types text[]
        );

        create table if not exists storage.objects (
          id uuid primary key default gen_random_uuid(),
          bucket_id text references storage.buckets(id),
          name text,
          owner uuid,
          created_at timestamptz default now(),
          updated_at timestamptz default now(),
          last_accessed_at timestamptz default now(),
          metadata jsonb
        );
      `);
    }

    // Busca resiliente do diretório supabase/migrations
    const candidateDirs = [
      path.resolve(process.cwd(), 'supabase/migrations'),
      path.resolve(process.cwd(), 'COZAM-INC/supabase/migrations'),
      path.resolve(__dirname, '../../supabase/migrations'),
      path.resolve(__dirname, '../../../supabase/migrations'),
    ];

    let migrationsDir: string | null = null;
    let files: string[] = [];

    for (const dir of candidateDirs) {
      try {
        const entries = await fs.readdir(dir);
        files = entries.filter((f) => f.endsWith('.sql')).sort();
        if (files.length > 0) {
          migrationsDir = dir;
          break;
        }
      } catch {
        // tenta o próximo candidato
      }
    }

    if (!migrationsDir) {
      console.warn('[COZAM] Nenhuma pasta de migrations encontrada nos caminhos candidatos:', candidateDirs);
      return;
    }

    // Se a tabela public.profiles já existir no banco (ex: migrações iniciais executadas no Supabase SQL Editor),
    // registra apenas as migrações iniciais (001..003) se _migrations estiver vazia.
    const initialCountRes = await client.query(`select count(*)::int as count from public._migrations`);
    if (initialCountRes.rows[0]?.count === 0) {
      const schemaCheck = await client.query(
        `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles'`
      );
      if (schemaCheck.rowCount > 0) {
        const baseMigrations = [
          '20261110000001_schema.sql',
          '20261110000002_business_rules.sql',
          '20261110000003_security_views_storage.sql',
        ];
        for (const baseFile of baseMigrations) {
          await client.query(`insert into public._migrations (name) values ($1) on conflict (name) do nothing`, [baseFile]);
        }
        console.log('[COZAM] Schema inicial preexistente detectado. Migrações base (001-003) sincronizadas.');
      }
    }

    const errors: Array<{ file: string; error: string; detail?: string }> = [];

    for (const file of files) {
      const check = await client.query('select 1 from public._migrations where name = $1', [file]);
      if (check.rowCount > 0) continue;

      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
      console.log(`Aplicando migration: ${file}...`);
      await client.exec('begin');
      try {
        await client.exec(sql);
        await client.query('insert into public._migrations (name) values ($1)', [file]);
        await client.exec('commit');
        console.log(`Migration ${file} concluída com sucesso.`);
      } catch (err: any) {
        await client.exec('rollback');
        console.error(`[COZAM] FALHA AO EXECUTAR MIGRATION ${file}:`, err?.message || err);
        if (err?.detail) console.error(`[COZAM] Detalhes do erro: ${err.detail}`);
        if (err?.hint) console.error(`[COZAM] Dica: ${err.hint}`);
        errors.push({ file, error: err?.message || String(err), detail: err?.detail });
      }
    }

    // ---------------------------------------------------------------------------
    // Auto-Recuperação Garantida: Verifica se public.contracts e v_contracts existem.
    // Se não existirem (ex: se migration anterior abortou o fluxo), aplica o DDL diretamente.
    // ---------------------------------------------------------------------------
    const contractsTableCheck = await client.query(
      `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'contracts'`
    );
    if (contractsTableCheck.rowCount === 0) {
      console.log('[COZAM] Tabela public.contracts ausente. Aplicando schema de contratos diretamente...');
      const contractMigrationPath = path.join(migrationsDir, '20261111000002_contracts_procurement_and_supply_order_items.sql');
      try {
        const contractSql = await fs.readFile(contractMigrationPath, 'utf-8');
        await client.exec(contractSql);
        await client.query(
          `insert into public._migrations (name) values ('20261111000002_contracts_procurement_and_supply_order_items.sql') on conflict (name) do nothing`
        );
        console.log('[COZAM] Schema de contratos e licitações aplicado com sucesso via auto-recuperação!');
      } catch (fallbackErr: any) {
        console.error('[COZAM] Erro ao aplicar schema de contratos via fallback:', fallbackErr?.message || fallbackErr);
      }
    }

    if (errors.length > 0) {
      console.warn(`[COZAM] AVISO: ${errors.length} migration(s) apresentaram erros:`, errors);
      if (!config.isProduction) {
        throw new Error(`Falha em ${errors.length} migrations: ${errors.map((e) => e.file).join(', ')}`);
      }
    }

    // Garante a existência dos usuários e perfis de demonstração/homologação apenas no banco local (PGlite)
    if (pool.isPGlite()) {
      await client.query(`
        insert into auth.users (id, email, raw_user_meta_data)
        values
          ('00000000-0000-0000-0000-000000000001', 'compras@cozam.al.gov.br', '{"role":"admin"}'::jsonb),
          ('00000000-0000-0000-0000-000000000002', 'pagamentos@cozam.al.gov.br', '{"role":"pagamentos"}'::jsonb)
        on conflict (id) do nothing;

        insert into public.profiles (id, full_name, email, role, active)
        values
          ('00000000-0000-0000-0000-000000000001', 'Administrador Compras (Demonstração)', 'compras@cozam.al.gov.br', 'admin', true),
          ('00000000-0000-0000-0000-000000000002', 'Operador Pagamentos (Demonstração)', 'pagamentos@cozam.al.gov.br', 'pagamentos', true)
        on conflict (id) do update set
          role = excluded.role,
          active = true;
      `);
    }
  } finally {
    client.release();
  }
}

export async function getMigrationStatus(pool: DbPool) {
  const client = await pool.connect();
  try {
    const migrationsRes = await client.query('select name, applied_at from public._migrations order by name');
    const tablesRes = await client.query(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
    );
    const viewsRes = await client.query(
      "select table_name from information_schema.views where table_schema = 'public' order by table_name"
    );
    const tables = tablesRes.rows.map((r: any) => r.table_name);
    const views = viewsRes.rows.map((r: any) => r.table_name);

    return {
      applied_migrations: migrationsRes.rows,
      tables,
      views,
      contractsExists: tables.includes('contracts'),
      contractItemsExists: tables.includes('contract_items'),
      vContractsExists: views.includes('v_contracts'),
    };
  } finally {
    client.release();
  }
}
