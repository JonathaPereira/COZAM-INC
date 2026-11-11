import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { getPool } from '../db/pool.js';
import { runInTransaction } from '../db/transaction.js';
import { AppError } from '../middleware/errors.js';

export const procurementRouter = Router();

const createProcurementSchema = z.object({
  process_number: z.string().trim().min(1, 'Número do processo administrativo é obrigatório.'),
  year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
  bidding_number: z.string().trim().min(1, 'Número ou identificação da licitação é obrigatório.'),
  modality: z.enum(['PREGAO_ELETRONICO', 'CONCORRENCIA', 'DISPENSA', 'INEXIGIBILIDADE', 'OUTRA']).default('PREGAO_ELETRONICO'),
  legal_framework: z.string().trim().default('Lei 14.133/2021'),
  object: z.string().trim().min(1, 'Objeto da contratação é obrigatório.'),
  opening_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de abertura inválida.').optional().nullable(),
  homologation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de homologação inválida.').optional().nullable(),
  manager_id: z.string().uuid().optional().nullable(),
  status: z.string().trim().default('HOMOLOGADO'),
  notes: z.string().trim().optional().nullable(),
});

const updateProcurementSchema = createProcurementSchema.partial();

// Listagem de processos licitatórios
procurementRouter.get('/procurement-processes', authenticate, requirePermission('procurements.view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const modality = typeof req.query.modality === 'string' ? req.query.modality.trim() : '';
    const year = typeof req.query.year === 'string' ? parseInt(req.query.year, 10) : null;

    const where: string[] = ['1=1'];
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(pp.bidding_number ilike $${params.length} or pp.process_number ilike $${params.length} or pp.object ilike $${params.length})`);
    }
    if (modality) {
      params.push(modality);
      where.push(`pp.modality = $${params.length}`);
    }
    if (year && !isNaN(year)) {
      params.push(year);
      where.push(`pp.year = $${params.length}`);
    }

    const query = `
      SELECT pp.*,
             cb.full_name AS manager_name,
             (SELECT COUNT(*) FROM public.contracts c WHERE c.procurement_id = pp.id)::int AS contracts_count
        FROM public.procurement_processes pp
        LEFT JOIN public.profiles cb ON cb.id = pp.manager_id
       WHERE ${where.join(' AND ')}
       ORDER BY pp.year DESC, pp.created_at DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Detalhes de um processo licitatório com contratos vinculados
procurementRouter.get('/procurement-processes/:id', authenticate, requirePermission('procurements.view'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const procRes = await pool.query(
      `SELECT pp.*, cb.full_name AS manager_name
         FROM public.procurement_processes pp
         LEFT JOIN public.profiles cb ON cb.id = pp.manager_id
        WHERE pp.id = $1`,
      [id]
    );

    if (procRes.rowCount === 0) {
      throw new AppError('Processo licitatório não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
    }

    const contractsRes = await pool.query(
      `SELECT * FROM public.v_contracts WHERE procurement_id = $1 ORDER BY contract_number ASC`,
      [id]
    );

    res.json({
      procurement: procRes.rows[0],
      contracts: contractsRes.rows.map((c) => ({
        ...c,
        total_amount: Number(c.total_amount),
        requested_amount: Number(c.requested_amount || 0),
        remaining_amount: Number(c.remaining_amount || 0),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Cadastro de processo licitatório
procurementRouter.post('/procurement-processes', authenticate, requirePermission('procurements.write'), async (req, res, next) => {
  try {
    const data = createProcurementSchema.parse(req.body);
    const result = await runInTransaction(
      { actorId: req.user!.id, requestId: req.requestId },
      async (client) => {
        const ins = await client.query(
          `INSERT INTO public.procurement_processes 
           (process_number, year, bidding_number, modality, legal_framework, object, opening_date, homologation_date, manager_id, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            data.process_number,
            data.year,
            data.bidding_number,
            data.modality,
            data.legal_framework,
            data.object,
            data.opening_date || null,
            data.homologation_date || null,
            data.manager_id || req.user!.id,
            data.status,
            data.notes || null,
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

// Atualização de processo licitatório
procurementRouter.patch('/procurement-processes/:id', authenticate, requirePermission('procurements.write'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateProcurementSchema.parse(req.body);

    const result = await runInTransaction(
      { actorId: req.user!.id, requestId: req.requestId },
      async (client) => {
        const proc = await client.query('SELECT * FROM public.procurement_processes WHERE id = $1', [id]);
        if (proc.rowCount === 0) {
          throw new AppError('Processo licitatório não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
        }

        const updates: string[] = ['updated_at = now()'];
        const values: unknown[] = [id];

        if (data.process_number !== undefined) {
          values.push(data.process_number);
          updates.push(`process_number = $${values.length}`);
        }
        if (data.year !== undefined) {
          values.push(data.year);
          updates.push(`year = $${values.length}`);
        }
        if (data.bidding_number !== undefined) {
          values.push(data.bidding_number);
          updates.push(`bidding_number = $${values.length}`);
        }
        if (data.modality !== undefined) {
          values.push(data.modality);
          updates.push(`modality = $${values.length}`);
        }
        if (data.legal_framework !== undefined) {
          values.push(data.legal_framework);
          updates.push(`legal_framework = $${values.length}`);
        }
        if (data.object !== undefined) {
          values.push(data.object);
          updates.push(`object = $${values.length}`);
        }
        if (data.opening_date !== undefined) {
          values.push(data.opening_date || null);
          updates.push(`opening_date = $${values.length}`);
        }
        if (data.homologation_date !== undefined) {
          values.push(data.homologation_date || null);
          updates.push(`homologation_date = $${values.length}`);
        }
        if (data.manager_id !== undefined) {
          values.push(data.manager_id || null);
          updates.push(`manager_id = $${values.length}`);
        }
        if (data.status !== undefined) {
          values.push(data.status);
          updates.push(`status = $${values.length}`);
        }
        if (data.notes !== undefined) {
          values.push(data.notes || null);
          updates.push(`notes = $${values.length}`);
        }

        const q = `UPDATE public.procurement_processes SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
        const updated = await client.query(q, values);
        return updated.rows[0];
      }
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});
