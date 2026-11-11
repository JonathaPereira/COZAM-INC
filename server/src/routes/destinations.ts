import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { getPool } from '../db/pool.js';
import { runInTransaction } from '../db/transaction.js';
import { AppError } from '../middleware/errors.js';

export const destinationsRouter = Router();

const createDestinationSchema = z.object({
  name: z.string().trim().min(1, 'Nome do município/entidade é obrigatório.'),
  cnpj: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().min(1, 'Cidade é obrigatória.'),
  state: z.string().trim().length(2, 'UF deve ter 2 caracteres.').default('AL'),
  contact_department: z.string().trim().optional().nullable(),
  contact_name: z.string().trim().optional().nullable(),
  contact_phone: z.string().trim().optional().nullable(),
  contact_email: z.string().trim().email('E-mail de contato inválido.').optional().nullable(),
});

const updateDestinationSchema = createDestinationSchema.partial().extend({
  active: z.boolean().optional(),
});

// Listagem de destinatários
destinationsRouter.get('/destinations', authenticate, async (req, res, next) => {
  try {
    const all = req.query.all === '1' || req.query.all === 'true';
    const pool = getPool();
    const query = all
      ? 'select * from public.destinations order by name asc'
      : 'select * from public.destinations where active = true order by name asc';

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Detalhes de um destinatário
destinationsRouter.get('/destinations/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.query('select * from public.destinations where id = $1', [id]);
    if (result.rowCount === 0) {
      throw new AppError('Destinatário não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Cadastro de destinatário
destinationsRouter.post(
  '/destinations',
  authenticate,
  requirePermission('destinations.manage'),
  async (req, res, next) => {
    try {
      const data = createDestinationSchema.parse(req.body);
      const result = await runInTransaction(
        { actorId: req.user!.id, requestId: req.requestId },
        async (client) => {
          const check = await client.query(
            'select id from public.destinations where upper(trim(name)) = upper(trim($1))',
            [data.name]
          );
          if (check.rowCount > 0) {
            throw new AppError('Já existe um município/entidade cadastrado com este nome.', {
              code: 'DESTINATARIO_DUPLICADO',
              status: 409,
            });
          }

          const ins = await client.query(
            `insert into public.destinations (name, cnpj, address, city, state, contact_department, contact_name, contact_phone, contact_email)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             returning *`,
            [
              data.name.toUpperCase(),
              data.cnpj || null,
              data.address || null,
              data.city,
              data.state.toUpperCase(),
              data.contact_department || null,
              data.contact_name || null,
              data.contact_phone || null,
              data.contact_email || null,
            ]
          );
          return ins.rows[0];
        }
      );

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Atualização de destinatário
destinationsRouter.patch(
  '/destinations/:id',
  authenticate,
  requirePermission('destinations.manage'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = updateDestinationSchema.parse(req.body);

      const result = await runInTransaction(
        { actorId: req.user!.id, requestId: req.requestId },
        async (client) => {
          const dest = await client.query('select * from public.destinations where id = $1', [id]);
          if (dest.rowCount === 0) {
            throw new AppError('Destinatário não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
          }

          const updates: string[] = ['updated_at = now()'];
          const values: unknown[] = [id];

          if (data.name !== undefined) {
            values.push(data.name.toUpperCase());
            updates.push(`name = $${values.length}`);
          }
          if (data.cnpj !== undefined) {
            values.push(data.cnpj || null);
            updates.push(`cnpj = $${values.length}`);
          }
          if (data.address !== undefined) {
            values.push(data.address || null);
            updates.push(`address = $${values.length}`);
          }
          if (data.city !== undefined) {
            values.push(data.city);
            updates.push(`city = $${values.length}`);
          }
          if (data.state !== undefined) {
            values.push(data.state.toUpperCase());
            updates.push(`state = $${values.length}`);
          }
          if (data.contact_department !== undefined) {
            values.push(data.contact_department || null);
            updates.push(`contact_department = $${values.length}`);
          }
          if (data.contact_name !== undefined) {
            values.push(data.contact_name || null);
            updates.push(`contact_name = $${values.length}`);
          }
          if (data.contact_phone !== undefined) {
            values.push(data.contact_phone || null);
            updates.push(`contact_phone = $${values.length}`);
          }
          if (data.contact_email !== undefined) {
            values.push(data.contact_email || null);
            updates.push(`contact_email = $${values.length}`);
          }
          if (data.active !== undefined) {
            values.push(data.active);
            updates.push(`active = $${values.length}`);
          }

          const q = `update public.destinations set ${updates.join(', ')} where id = $1 returning *`;
          const updated = await client.query(q, values);
          return updated.rows[0];
        }
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);
