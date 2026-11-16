import { Router } from 'express';
import { z } from 'zod';
import { permissionsOf } from '@cozam/shared';
import { authenticate } from '../middleware/auth.js';
import { getPool } from '../db/pool.js';
import { AppError } from '../middleware/errors.js';

export const meRouter = Router();

const updateSignatureSchema = z.object({
  job_title: z.string().trim().max(120).optional().nullable(),
  signature_data_url: z.string().max(1500000).optional().nullable(),
});

meRouter.get('/me', authenticate, (req, res) => {
  const user = req.user!;
  const permissions = Array.from(permissionsOf(user));

  res.json({
    profile: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      extra_permissions: user.extra_permissions,
      active: user.active,
      job_title: user.job_title ?? null,
      signature_data_url: user.signature_data_url ?? null,
    },
    permissions,
  });
});

meRouter.put('/me/signature', authenticate, async (req, res, next) => {
  try {
    const data = updateSignatureSchema.parse(req.body);
    const sig = data.signature_data_url?.trim() || null;

    if (sig && !/^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/i.test(sig)) {
      throw new AppError('Formato de assinatura inválido. Envie uma imagem PNG ou JPG ou desenhe no quadro.', {
        code: 'FORMATO_ASSINATURA_INVALIDO',
        status: 400,
      });
    }

    const jobTitle = data.job_title?.trim() || null;
    const pool = getPool();

    const upd = await pool.query(
      `update public.profiles
          set job_title = $1,
              signature_data_url = $2,
              updated_at = now()
        where id = $3
        returning id, full_name, email, role, extra_permissions, active, job_title, signature_data_url`,
      [jobTitle, sig, req.user!.id]
    );

    res.json({
      success: true,
      profile: upd.rows[0],
    });
  } catch (err) {
    next(err);
  }
});
