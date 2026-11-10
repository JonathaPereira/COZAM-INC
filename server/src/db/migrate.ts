import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DbPool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(pool: DbPool): Promise<void> {
  const client = await pool.connect();
  try {
    // Se o schema auth não existir (ex: ambiente de teste com PGlite ou banco novo sem Supabase CLI),
    // cria os stubs necessários para que as migrations e constraints rodem idênticas ao Supabase.
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

      create table if not exists public._migrations (
        name text primary key,
        applied_at timestamptz default now()
      );
    `);

    const migrationsDir = path.resolve(__dirname, '../../../supabase/migrations');
    let files: string[] = [];
    try {
      const allFiles = await fs.readdir(migrationsDir);
      files = allFiles.filter((f) => f.endsWith('.sql')).sort();
    } catch (err) {
      console.warn('Pasta de migrations não encontrada:', migrationsDir, err);
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
  } finally {
    client.release();
  }
}
