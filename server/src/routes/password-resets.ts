import { Router } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';
import { getPool } from '../db/pool.js';
import { runInTransaction } from '../db/transaction.js';
import { AppError } from '../middleware/errors.js';

export const passwordResetsRouter = Router();

const requestResetSchema = z.object({
  email: z.string().email('E-mail funcional inválido.').trim().toLowerCase(),
  proposed_password: z.string().min(6, 'A nova senha deve ter no mínimo 6 caracteres.').optional(),
  reason: z.string().trim().optional(),
});

const approveResetSchema = z.object({
  temporary_password: z.string().min(6, 'Senha provisória deve ter no mínimo 6 caracteres.').optional(),
  admin_notes: z.string().trim().optional(),
});

const setPasswordSchema = z.object({
  password: z.string().min(6, 'A nova senha deve ter no mínimo 6 caracteres.'),
  reason: z.string().trim().optional(),
});

/**
 * Função utilitária para atualizar a senha no Supabase Auth usando a service_role key
 */
async function updateSupabasePassword(userId: string, newPassword: string): Promise<void> {
  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    const admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (error) {
      throw new AppError(`Erro ao atualizar senha no Supabase Auth: ${error.message}`, {
        code: 'AUTH_UPDATE_ERROR',
        status: 500,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 1. ROTA PÚBLICA: Solicitar redefinição de senha ao Administrador
// ---------------------------------------------------------------------------
passwordResetsRouter.post('/auth/request-password-reset', async (req, res, next) => {
  try {
    const data = requestResetSchema.parse(req.body);
    const pool = getPool();

    // 1. Localiza o usuário pelo e-mail funcional
    const userRes = await pool.query(
      `select id, full_name, role, email, active from public.profiles
        where lower(trim(email)) = lower(trim($1))`,
      [data.email]
    );

    if (userRes.rowCount === 0) {
      throw new AppError('Nenhum usuário cadastrado foi encontrado com este e-mail funcional.', {
        code: 'USUARIO_NAO_ENCONTRADO',
        status: 404,
      });
    }

    const user = userRes.rows[0];
    if (user.active === false) {
      throw new AppError('Este usuário está inativo no sistema. Contate a administração do COZAM.', {
        code: 'USUARIO_INATIVO',
        status: 403,
      });
    }

    // 2. Verifica se já existe uma solicitação PENDENTE para este usuário
    const pendingRes = await pool.query(
      `select id from public.password_reset_requests
        where user_id = $1 and status = 'PENDENTE'`,
      [user.id]
    );

    if (pendingRes.rowCount > 0) {
      // Atualiza a solicitação pendente existente
      const existingId = pendingRes.rows[0].id;
      await pool.query(
        `update public.password_reset_requests
            set proposed_password = coalesce($1, proposed_password),
                request_reason = coalesce($2, request_reason),
                created_at = now()
          where id = $3`,
        [data.proposed_password || null, data.reason || null, existingId]
      );

      res.json({
        success: true,
        message: 'Você já possui uma solicitação pendente. Os dados foram atualizados e o Administrador foi notificado.',
      });
      return;
    }

    // 3. Cria a nova solicitação
    await pool.query(
      `insert into public.password_reset_requests (
        user_id, email, full_name, role, status, request_reason, proposed_password
      ) values ($1, $2, $3, $4, 'PENDENTE', $5, $6)`,
      [
        user.id,
        user.email,
        user.full_name,
        user.role,
        data.reason || 'Esquecimento de senha de acesso institucional.',
        data.proposed_password || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Solicitação de redefinição registrada com sucesso! O Administrador Principal foi notificado no painel e autorizará sua nova senha.',
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 2. ROTA PÚBLICA: Consultar status da última solicitação do e-mail
// ---------------------------------------------------------------------------
passwordResetsRouter.get('/auth/password-reset-status', async (req, res, next) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    if (!email) {
      res.json({ request: null });
      return;
    }

    const pool = getPool();
    const result = await pool.query(
      `select id, status, request_reason, temporary_password, created_at, resolved_at, approved_by_name
         from public.password_reset_requests
        where lower(trim(email)) = lower(trim($1))
        order by created_at desc
        limit 1`,
      [email]
    );

    if (result.rowCount === 0) {
      res.json({ request: null });
      return;
    }

    res.json({ request: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 3. ROTA AUTENTICADA: Contagem de solicitações pendentes (para o Header e badges)
// ---------------------------------------------------------------------------
passwordResetsRouter.get('/password-reset-requests/pending-count', authenticate, async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      res.json({ pendingCount: 0 });
      return;
    }

    const pool = getPool();
    const countRes = await pool.query(
      `select count(*)::int as count from public.password_reset_requests where status = 'PENDENTE'`
    );

    res.json({ pendingCount: countRes.rows[0]?.count || 0 });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 4. ROTA AUTENTICADA: Listagem de solicitações de senha (apenas Admin)
// ---------------------------------------------------------------------------
passwordResetsRouter.get('/password-reset-requests', authenticate, async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      throw new AppError('Apenas o Administrador possui acesso às solicitações de redefinição de senha.', {
        code: 'ACESSO_NEGADO',
        status: 403,
      });
    }

    const pool = getPool();
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    const where: string[] = ['1=1'];
    const params: any[] = [];

    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    const result = await pool.query(
      `select id, user_id, email, full_name, role, status, request_reason,
              case when proposed_password is not null then true else false end as has_proposed_password,
              proposed_password, temporary_password, admin_notes,
              approved_by_name, created_at, resolved_at
         from public.password_reset_requests
        where ${where.join(' and ')}
        order by case when status = 'PENDENTE' then 0 else 1 end, created_at desc`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 5. ROTA AUTENTICADA: Aprovar solicitação de redefinição (apenas Admin)
// ---------------------------------------------------------------------------
passwordResetsRouter.post('/password-reset-requests/:id/approve', authenticate, async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      throw new AppError('Apenas o Administrador possui permissão para aprovar redefinição de senha.', {
        code: 'ACESSO_NEGADO',
        status: 403,
      });
    }

    const { id } = req.params;
    const data = approveResetSchema.parse(req.body);
    const pool = getPool();

    // 1. Busca solicitação
    const reqRes = await pool.query('select * from public.password_reset_requests where id = $1', [id]);
    if (reqRes.rowCount === 0) {
      throw new AppError('Solicitação não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
    }

    const requestItem = reqRes.rows[0];
    if (requestItem.status !== 'PENDENTE') {
      throw new AppError('Esta solicitação já foi finalizada anteriormente.', {
        code: 'JA_FINALIZADA',
        status: 422,
      });
    }

    // Define qual senha será ativada: provisória do admin OU a solicitada pelo usuário OU padrão institucional
    const finalPassword = data.temporary_password || requestItem.proposed_password || 'Cozam@2026';

    // 2. Atualiza a senha no Supabase Auth
    await updateSupabasePassword(requestItem.user_id, finalPassword);

    // 3. Atualiza registro da solicitação e grava auditoria
    await runInTransaction(
      { actorId: req.user!.id, reason: data.admin_notes || 'Aprovação de solicitação de nova senha', requestId: req.requestId },
      async (client) => {
        await client.query(
          `update public.password_reset_requests
              set status = 'APROVADA',
                  resolved_at = now(),
                  approved_by = $1,
                  approved_by_name = $2,
                  temporary_password = $3,
                  admin_notes = $4,
                  proposed_password = null
            where id = $5`,
          [
            req.user!.id,
            req.user!.full_name || 'Administrador',
            data.temporary_password ? finalPassword : null,
            data.admin_notes || null,
            id,
          ]
        );

        await client.query(
          `insert into public.audit_logs (
            actor_id, actor_name, actor_role, action, entity_type, entity_id,
            summary, reason
          ) values ($1, $2, $3, 'SENHA_REDEFINIDA_ADMIN', 'users', $4, $5, $6)`,
          [
            req.user!.id,
            req.user!.full_name || 'Administrador',
            req.user!.role,
            requestItem.user_id,
            `Administrador autorizou redefinição de senha para ${requestItem.email} (${requestItem.full_name})`,
            data.admin_notes || 'Autorização de senha aprovada com sucesso.',
          ]
        );
      }
    );

    res.json({
      success: true,
      message: `Senha de ${requestItem.full_name} autorizada com sucesso!`,
      passwordActive: finalPassword,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 6. ROTA AUTENTICADA: Recusar solicitação de redefinição (apenas Admin)
// ---------------------------------------------------------------------------
passwordResetsRouter.post('/password-reset-requests/:id/reject', authenticate, async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      throw new AppError('Apenas o Administrador possui permissão para recusar solicitações de senha.', {
        code: 'ACESSO_NEGADO',
        status: 403,
      });
    }

    const { id } = req.params;
    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim()
      ? req.body.reason.trim()
      : 'Solicitação recusada pelo Administrador.';

    const pool = getPool();
    const reqRes = await pool.query('select * from public.password_reset_requests where id = $1', [id]);
    if (reqRes.rowCount === 0) {
      throw new AppError('Solicitação não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
    }
    const requestItem = reqRes.rows[0];

    await pool.query(
      `update public.password_reset_requests
          set status = 'REJEITADA',
              resolved_at = now(),
              approved_by = $1,
              approved_by_name = $2,
              admin_notes = $3,
              proposed_password = null
        where id = $4`,
      [req.user!.id, req.user!.full_name || 'Administrador', reason, id]
    );

    res.json({ success: true, message: 'Solicitação recusada com sucesso.' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 7. ROTA AUTENTICADA: Definir senha de qualquer usuário diretamente (apenas Admin)
// ---------------------------------------------------------------------------
passwordResetsRouter.post('/users/:id/set-password', authenticate, async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      throw new AppError('Apenas o Administrador pode redefinir senhas diretamente.', {
        code: 'ACESSO_NEGADO',
        status: 403,
      });
    }

    const { id } = req.params;
    const data = setPasswordSchema.parse(req.body);
    const pool = getPool();

    const userRes = await pool.query('select id, full_name, email, role from public.profiles where id = $1', [id]);
    if (userRes.rowCount === 0) {
      throw new AppError('Usuário não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
    }
    const targetUser = userRes.rows[0];

    // Atualiza senha no Supabase Auth
    await updateSupabasePassword(targetUser.id, data.password);

    // Registra na auditoria
    await pool.query(
      `insert into public.audit_logs (
        actor_id, actor_name, actor_role, action, entity_type, entity_id,
        summary, reason
      ) values ($1, $2, $3, 'SENHA_DEFINIDA_ADMIN', 'users', $4, $5, $6)`,
      [
        req.user!.id,
        req.user!.full_name || 'Administrador',
        req.user!.role,
        targetUser.id,
        `Administrador redefiniu diretamente a senha de ${targetUser.email} (${targetUser.full_name})`,
        data.reason || 'Alteração manual de senha pelo Administrador.',
      ]
    );

    res.json({
      success: true,
      message: `Nova senha para ${targetUser.full_name} definida com sucesso.`,
    });
  } catch (err) {
    next(err);
  }
});
