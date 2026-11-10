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
  display_order: z.number().int().optional().default(100),
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
          `insert into public.suppliers (name, legal_name, cnpj, display_order)
           values ($1, $2, $3, $4)
           returning *`,
          [data.name, data.legal_name || null, data.cnpj || null, data.display_order]
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
                  active = coalesce($5, active)
            where id = $6
            returning *`,
          [
            data.name ?? null,
            data.legal_name ?? null,
            data.cnpj ?? null,
            data.display_order ?? null,
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
