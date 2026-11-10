import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DbPool } from './pool.js';

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

    // Se a tabela public.profiles já existir no banco (ex: migrações já executadas no Supabase SQL Editor),
    // registra os arquivos como já aplicados para não tentar recriar tabelas e types existentes.
    const schemaCheck = await client.query(
      `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles'`
    );
    if (schemaCheck.rowCount > 0) {
      for (const file of files) {
        await client.query(`insert into public._migrations (name) values ($1) on conflict (name) do nothing`, [file]);
      }
      console.log('[COZAM] Schema existente detectado. Migrações sincronizadas com sucesso.');
      return;
    }

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
      } catch (err) {
        await client.exec('rollback');
        throw new Error(`Falha na migration ${file}: ${(err as Error).message}`);
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
