import { Router } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { getPool } from '../db/pool.js';
import { runInTransaction } from '../db/transaction.js';
import { AppError } from '../middleware/errors.js';

export const usersRouter = Router();

const createUserSchema = z.object({
  email: z.string().email('E-mail inválido.').trim().toLowerCase(),
  full_name: z.string().trim().min(1, 'Nome completo é obrigatório.'),
  role: z.enum(['admin', 'pagamentos', 'admin_secundario']),
  extra_permissions: z.array(z.string()).optional().default([]),
  password: z.string().min(6, 'Senha provisória deve ter no mínimo 6 caracteres.').optional(),
});

const updateUserSchema = z.object({
  full_name: z.string().trim().min(1).optional(),
  role: z.enum(['admin', 'pagamentos', 'admin_secundario']).optional(),
  extra_permissions: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

usersRouter.get('/users', authenticate, requirePermission('users.manage'), async (req, res, next) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `select id, full_name, email, role, extra_permissions, active, created_at, updated_at
         from public.profiles
        order by role asc, full_name asc`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/users', authenticate, requirePermission('users.manage'), async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const pool = getPool();

    // Checa duplicidade de e-mail no perfil
    const existing = await pool.query('select 1 from public.profiles where lower(email) = $1', [data.email]);
    if (existing.rowCount > 0) {
      throw new AppError('Já existe um usuário cadastrado com este e-mail.', {
        code: 'EMAIL_DUPLICADO',
        status: 409,
      });
    }

    let authUserId: string | null = null;
    if (config.supabaseUrl && config.supabaseServiceRoleKey) {
      const admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: data.email,
        password: data.password || 'Cozam@2026',
        email_confirm: true,
        user_metadata: {
          full_name: data.full_name,
          role: data.role,
        },
      });
      if (authErr || !authData.user) {
        throw new AppError(`Erro ao criar usuário no Supabase Auth: ${authErr?.message}`, {
          code: 'AUTH_ADMIN_ERROR',
          status: 400,
        });
      }
      authUserId = authData.user.id;
    }

    const result = await runInTransaction(
      { actorId: req.user!.id, requestId: req.requestId },
      async (client) => {
        // Se não houver Supabase Auth ativo (modo dev/testes), cria um registro em auth.users se existir
        if (!authUserId) {
          const authIns = await client.query(
            `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
            [data.email, JSON.stringify({ full_name: data.full_name, role: data.role })]
          );
          authUserId = authIns.rows[0].id;
        }

        const ins = await client.query(
          `insert into public.profiles (id, full_name, email, role, extra_permissions, active)
           values ($1, $2, $3, $4, $5, true)
           on conflict (id) do update
             set full_name = excluded.full_name,
                 role = excluded.role,
                 extra_permissions = excluded.extra_permissions,
                 active = true
           returning *`,
          [authUserId, data.full_name, data.email, data.role, data.extra_permissions]
        );
        return ins.rows[0];
      }
    );

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/users/:id', authenticate, requirePermission('users.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);
    const user = req.user!;

    // Proteção contra auto-bloqueio: administrador não pode desativar ou rebaixar a própria conta
    if (id === user.id) {
      if (data.active === false) {
        throw new AppError('Você não pode desativar sua própria conta de administrador.', {
          code: 'AUTO_DESATIVACAO_PROIBIDA',
          status: 422,
        });
      }
      if (data.role && data.role !== 'admin') {
        throw new AppError('Você não pode alterar sua própria função de Administrador.', {
          code: 'AUTO_REBAIXAMENTO_PROIBIDO',
          status: 422,
        });
      }
    }

    const result = await runInTransaction(
      { actorId: user.id, requestId: req.requestId },
      async (client) => {
        const cur = await client.query('select * from public.profiles where id = $1', [id]);
        if (cur.rowCount === 0) {
          throw new AppError('Usuário não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
        }

        const upd = await client.query(
          `update public.profiles
              set full_name = coalesce($1, full_name),
                  role = coalesce($2, role),
                  extra_permissions = coalesce($3, extra_permissions),
                  active = coalesce($4, active)
            where id = $5
            returning *`,
          [
            data.full_name ?? null,
            data.role ?? null,
            data.extra_permissions ?? null,
            data.active ?? null,
            id,
          ]
        );
        return upd.rows[0];
      }
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/users/:id/reset-password', authenticate, requirePermission('users.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const cur = await pool.query('select email from public.profiles where id = $1', [id]);
    if (cur.rowCount === 0) {
      throw new AppError('Usuário não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
    }
    const email = cur.rows[0].email;

    if (config.supabaseUrl && config.supabaseServiceRoleKey) {
      const admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await admin.auth.resetPasswordForEmail(email);
    }

    res.json({ ok: true, message: `Instruções de redefinição de senha enviadas para ${email}.` });
  } catch (err) {
    next(err);
  }
});
