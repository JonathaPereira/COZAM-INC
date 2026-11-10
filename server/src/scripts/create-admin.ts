import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { getPool } from '../db/pool.js';
import { runMigrations } from '../db/migrate.js';

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string, def = '') => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
  };

  const email = getArg('--email', 'compras@cozam.al.gov.br');
  const name = getArg('--name', 'Administrador — Compras');
  const password = getArg('--password', 'Cozam@2026');

  console.log(`[COZAM] Criando/atualizando usuário administrador: ${email} (${name})`);

  const pool = getPool();
  await runMigrations(pool);

  let userId: string | null = null;

  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: listData } = await supabase.auth.admin.listUsers();
    const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (existing) {
      console.log(`[COZAM] Usuário já existe no Supabase Auth (${existing.id}). Atualizando senha...`);
      await supabase.auth.admin.updateUserById(existing.id, {
        password,
        user_metadata: { full_name: name, role: 'admin' },
      });
      userId = existing.id;
    } else {
      console.log(`[COZAM] Criando usuário no Supabase Auth...`);
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, role: 'admin' },
      });
      if (createErr || !created.user) {
        throw new Error(`Falha no Supabase Auth: ${createErr?.message}`);
      }
      userId = created.user.id;
    }
  } else {
    // Modo local / standalone
    const userRes = await pool.query(
      `insert into auth.users (email, raw_user_meta_data)
       values ($1, $2)
       on conflict (email) do update set raw_user_meta_data = excluded.raw_user_meta_data
       returning id`,
      [email, JSON.stringify({ full_name: name, role: 'admin' })]
    );
    userId = userRes.rows[0].id;
  }

  await pool.query(
    `insert into public.profiles (id, full_name, email, role, active)
     values ($1, $2, $3, 'admin', true)
     on conflict (id) do update
       set full_name = excluded.full_name,
           email = excluded.email,
           role = 'admin',
           active = true`,
    [userId, name, email]
  );

  console.log(`[COZAM] Administrador configurado com sucesso!`);
  console.log(`  E-mail: ${email}`);
  console.log(`  Função: Administrador — Compras`);
  console.log(`  ID:     ${userId}`);
  await pool.end();
}

main().catch((err) => {
  console.error('[COZAM] Erro:', err);
  process.exit(1);
});
