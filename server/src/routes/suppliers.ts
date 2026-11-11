import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { getPool } from '../db/pool.js';
import { runInTransaction } from '../db/transaction.js';
import { AppError } from '../middleware/errors.js';

export const suppliersRouter = Router();

const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Nome do fornecedor é obrigatório.'),
  legal_name: z.string().trim().optional().nullable(),
  cnpj: z.string().trim().optional().nullable(),
  state_registration: z.string().trim().optional().nullable(),
  street: z.string().trim().optional().nullable(),
  number: z.string().trim().optional().nullable(),
  complement: z.string().trim().optional().nullable(),
  neighborhood: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  zip_code: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  contact_person: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  display_order: z.number().int().optional().default(100),
  is_simples_nacional: z.boolean().optional().default(false),
});

const updateSupplierSchema = createSupplierSchema.partial().extend({
  active: z.boolean().optional(),
});

suppliersRouter.get('/suppliers', authenticate, async (req, res, next) => {
  try {
    const all = req.query.all === '1' || req.query.all === 'true';
    const pool = getPool();
    const query = all
      ? 'select * from public.suppliers order by display_order asc, name asc'
      : 'select * from public.suppliers where active = true order by display_order asc, name asc';

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

suppliersRouter.post('/suppliers', authenticate, requirePermission('suppliers.manage'), async (req, res, next) => {
  try {
    const data = createSupplierSchema.parse(req.body);
    const result = await runInTransaction(
      { actorId: req.user!.id, requestId: req.requestId },
      async (client) => {
        const ins = await client.query(
          `insert into public.suppliers (
            name, legal_name, cnpj, state_registration, street, number, complement,
            neighborhood, city, state, zip_code, phone, email, contact_person, notes,
            display_order, is_simples_nacional
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          returning *`,
          [
            data.name,
            data.legal_name || null,
            data.cnpj || null,
            data.state_registration || null,
            data.street || null,
            data.number || null,
            data.complement || null,
            data.neighborhood || null,
            data.city || null,
            data.state || null,
            data.zip_code || null,
            data.phone || null,
            data.email || null,
            data.contact_person || null,
            data.notes || null,
            data.display_order,
            data.is_simples_nacional ?? false,
          ]
        );
        return ins.rows[0];
      }
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

suppliersRouter.patch('/suppliers/:id', authenticate, requirePermission('suppliers.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateSupplierSchema.parse(req.body);

    const result = await runInTransaction(
      { actorId: req.user!.id, requestId: req.requestId },
      async (client) => {
        const cur = await client.query('select * from public.suppliers where id = $1', [id]);
        if (cur.rowCount === 0) {
          throw new AppError('Fornecedor não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
        }
        const row = cur.rows[0];
        const upd = await client.query(
          `update public.suppliers
              set name = coalesce($1, name),
                  legal_name = coalesce($2, legal_name),
                  cnpj = coalesce($3, cnpj),
                  display_order = coalesce($4, display_order),
                  active = coalesce($5, active),
                  is_simples_nacional = case when $6::boolean then $7::boolean else is_simples_nacional end
            where id = $8
            returning *`,
          [
            data.name ?? null,
            data.legal_name ?? null,
            data.cnpj ?? null,
            data.display_order ?? null,
            data.active ?? null,
            data.is_simples_nacional !== undefined,
            data.is_simples_nacional ?? false,
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
