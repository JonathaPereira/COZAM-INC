import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { getPool } from '../db/pool.js';
import { runInTransaction } from '../db/transaction.js';
import { parseContractPdf, cleanCnpj } from '../services/contract-parser.js';
import { AppError } from '../middleware/errors.js';

export const contractsRouter = Router();

const isoDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (AAAA-MM-DD).').refine((val) => {
  const [y, m, d] = val.split('-').map(Number);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return dateObj.getUTCFullYear() === y && dateObj.getUTCMonth() === m - 1 && dateObj.getUTCDate() === d;
}, 'Data de calendário inválida.');

const contractItemSchema = z.object({
  item_code: z.string().trim().min(1, 'Código do item é obrigatório.'),
  item_group: z.string().trim().optional().nullable(),
  description: z.string().trim().min(1, 'Descrição do item é obrigatória.'),
  category: z.enum([
    'MATERIAL_CONSUMO',
    'MATERIAL_EXPEDIENTE',
    'AGUA_CAFE',
    'MATERIAL_ELETRICO',
    'EPIS',
    'SERVICOS',
    'LOCACAO',
    'OUTROS',
  ]).default('MATERIAL_CONSUMO'),
  unit: z.string().trim().min(1, 'Unidade de fornecimento é obrigatória.'),
  original_quantity: z.coerce.number().positive('Quantidade contratada deve ser positiva.'),
  unit_price: z.coerce.number().positive('Valor unitário deve ser positivo.'),
  total_price: z.coerce.number().positive('Valor total do item deve ser positivo.'),
});

const createContractSchema = z.object({
  contract_number: z.string().trim().min(1, 'Número do contrato é obrigatório.'),
  year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
  procurement_id: z.string().uuid().optional().nullable(),
  procurement_process_number: z.string().trim().optional().nullable(),
  bidding_number: z.string().trim().optional().nullable(),
  procurement_modality: z.string().trim().optional().nullable(),
  supplier_id: z.string().uuid('Fornecedor é obrigatório.'),
  object: z.string().trim().min(1, 'Objeto contratual é obrigatório.'),
  legal_framework: z.string().trim().default('Lei 14.133/2021'),
  signing_date: isoDateSchema.optional().nullable(),
  start_date: isoDateSchema,
  end_date: isoDateSchema,
  delivery_deadline_days: z.coerce.number().int().min(1).default(15),
  total_amount: z.coerce.number().positive('Valor total contratado deve ser positivo.'),
  status: z.enum([
    'EM_ELABORACAO',
    'AGUARDANDO_CONFERENCIA',
    'ATIVO',
    'PROXIMO_VENCIMENTO',
    'SUSPENSO',
    'ENCERRADO',
    'VENCIDO',
    'RESCINDIDO',
  ]).default('ATIVO'),
  items: z.array(contractItemSchema).min(1, 'O contrato deve possuir pelo menos 1 item.'),
});

const updateContractSchema = z.object({
  contract_number: z.string().trim().min(1).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  procurement_id: z.string().uuid().optional().nullable(),
  supplier_id: z.string().uuid().optional(),
  object: z.string().trim().min(1).optional(),
  legal_framework: z.string().trim().optional(),
  signing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  delivery_deadline_days: z.coerce.number().int().min(1).optional(),
  status: z.enum([
    'EM_ELABORACAO',
    'AGUARDANDO_CONFERENCIA',
    'ATIVO',
    'PROXIMO_VENCIMENTO',
    'SUSPENSO',
    'ENCERRADO',
    'VENCIDO',
    'RESCINDIDO',
  ]).optional(),
});

const createAmendmentSchema = z.object({
  amendment_number: z.string().trim().min(1, 'Identificação do aditivo é obrigatória.'),
  amendment_type: z.enum(['PRAZO', 'QUANTITATIVO_ACRESCIMO', 'QUANTITATIVO_SUPRESSAO', 'REAJUSTE', 'OUTRO']),
  signing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de celebração do aditivo inválida.'),
  new_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  additional_amount: z.coerce.number().default(0),
  justification: z.string().trim().min(1, 'Justificativa do termo aditivo é obrigatória.'),
});

// Listagem de contratos
contractsRouter.get('/contracts', authenticate, requirePermission('contracts.view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const supplierId = typeof req.query.supplier_id === 'string' ? req.query.supplier_id.trim() : '';
    const procurementId = typeof req.query.procurement_id === 'string' ? req.query.procurement_id.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const activeOnly = req.query.active_only === '1' || req.query.active_only === 'true';

    const where: string[] = ['1=1'];
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(c.contract_number ilike $${params.length} or c.object ilike $${params.length} or c.supplier_name ilike $${params.length})`);
    }
    if (supplierId) {
      params.push(supplierId);
      where.push(`c.supplier_id = $${params.length}`);
    }
    if (procurementId) {
      params.push(procurementId);
      where.push(`c.procurement_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`c.computed_status = $${params.length}`);
    }
    if (activeOnly) {
      where.push(`c.computed_status IN ('ATIVO', 'PROXIMO_VENCIMENTO')`);
    }

    const query = `
      SELECT * FROM public.v_contracts c
       WHERE ${where.join(' AND ')}
       ORDER BY c.end_date ASC, c.contract_number ASC
    `;

    const result = await pool.query(query, params);
    res.json(
      result.rows.map((row) => ({
        ...row,
        total_amount: Number(row.total_amount),
        requested_amount: Number(row.requested_amount || 0),
        remaining_amount: Number(row.remaining_amount || 0),
        days_to_expire: row.days_to_expire !== null ? Number(row.days_to_expire) : null,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// Pesquisa global de itens em contratos vigentes (para Lançamento Múltiplo de OFs)
contractsRouter.get('/contracts/items/search', authenticate, requirePermission('contracts.view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const onlyAvailable = req.query.only_available !== '0' && req.query.only_available !== 'false';
    const supplierId = typeof req.query.supplier_id === 'string' ? req.query.supplier_id.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const limit = Math.min(150, Math.max(1, Number(req.query.limit || 60)));

    const where: string[] = [
      `vc.computed_status IN ('ATIVO', 'PROXIMO_VENCIMENTO')`,
      `vci.active = true`,
      `vc.end_date >= CURRENT_DATE`,
    ];
    const params: unknown[] = [];

    if (onlyAvailable) {
      where.push(`vci.available_quantity > 0`);
    }
    if (supplierId) {
      params.push(supplierId);
      where.push(`vc.supplier_id = $${params.length}`);
    }
    if (category) {
      params.push(category);
      where.push(`vci.category = $${params.length}`);
    }
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);
      for (const term of terms) {
        params.push(`%${term}%`);
        where.push(
          `(vci.description ilike $${params.length} or vci.item_code ilike $${params.length} or vc.contract_number ilike $${params.length} or vc.supplier_name ilike $${params.length} or vc.object ilike $${params.length})`
        );
      }
    }

    params.push(limit);

    const query = `
      SELECT vci.id,
             vci.contract_id,
             vci.item_code,
             vci.item_group,
             vci.description,
             vci.category,
             vci.unit,
             vci.original_quantity,
             vci.current_quantity,
             vci.reserved_quantity,
             vci.requested_quantity,
             vci.available_quantity,
             vci.unit_price,
             vci.total_price,
             vc.contract_number,
             vc.year AS contract_year,
             vc.object AS contract_object,
             vc.start_date AS contract_start_date,
             vc.end_date AS contract_end_date,
             vc.supplier_id,
             vc.supplier_name,
             vc.supplier_cnpj,
             vc.computed_status AS contract_status
        FROM public.v_contract_items vci
        JOIN public.v_contracts vc ON vc.id = vci.contract_id
       WHERE ${where.join(' AND ')}
       ORDER BY vci.description ASC, vc.end_date ASC, vci.item_code ASC
       LIMIT $${params.length}
    `;

    const result = await pool.query(query, params);
    res.json(
      result.rows.map((r) => ({
        ...r,
        contract_year: Number(r.contract_year),
        original_quantity: Number(r.original_quantity),
        current_quantity: Number(r.current_quantity),
        reserved_quantity: Number(r.reserved_quantity || 0),
        requested_quantity: Number(r.requested_quantity || 0),
        available_quantity: Number(r.available_quantity || 0),
        unit_price: Number(r.unit_price),
        total_price: Number(r.total_price),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// Detalhes de um contrato com itens e movimentações
contractsRouter.get('/contracts/:id', authenticate, requirePermission('contracts.view'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const contractRes = await pool.query('SELECT * FROM public.v_contracts WHERE id = $1', [id]);
    if (contractRes.rowCount === 0) {
      throw new AppError('Contrato não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
    }

    const itemsRes = await pool.query(
      'SELECT * FROM public.v_contract_items WHERE contract_id = $1 ORDER BY item_code ASC',
      [id]
    );

    const amendmentsRes = await pool.query(
      `SELECT ca.*, cb.full_name as created_by_name
         FROM public.contract_amendments ca
         LEFT JOIN public.profiles cb ON cb.id = ca.created_by
        WHERE ca.contract_id = $1
        ORDER BY ca.signing_date DESC, ca.created_at DESC`,
      [id]
    );

    const ordersRes = await pool.query(
      `SELECT so.*, d.name AS destination_name
         FROM public.supply_orders so
         LEFT JOIN public.destinations d ON d.id = so.destination_id
        WHERE so.contract_id = $1
        ORDER BY so.issue_date DESC`,
      [id]
    );

    const contract = contractRes.rows[0];

    res.json({
      contract: {
        ...contract,
        total_amount: Number(contract.total_amount),
        requested_amount: Number(contract.requested_amount || 0),
        remaining_amount: Number(contract.remaining_amount || 0),
        days_to_expire: contract.days_to_expire !== null ? Number(contract.days_to_expire) : null,
      },
      items: itemsRes.rows.map((it) => ({
        ...it,
        original_quantity: Number(it.original_quantity),
        current_quantity: Number(it.current_quantity),
        unit_price: Number(it.unit_price),
        total_price: Number(it.total_price),
        reserved_quantity: Number(it.reserved_quantity || 0),
        requested_quantity: Number(it.requested_quantity || 0),
        delivered_quantity: Number(it.requested_quantity || 0),
        available_quantity: Number(it.available_quantity || 0),
        executed_amount: Number(it.executed_amount || 0),
        remaining_amount: Number(it.remaining_amount || 0),
      })),
      amendments: amendmentsRes.rows.map((a) => ({
        ...a,
        additional_amount: Number(a.additional_amount || 0),
      })),
      supply_orders: ordersRes.rows.map((o) => ({
        ...o,
        total_value: o.total_value !== null ? Number(o.total_value) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Parser e extração automática de dados de contrato em PDF com validação matemática
contractsRouter.post(
  '/contracts/parse-pdf',
  authenticate,
  requirePermission('contracts.write'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) {
        throw new AppError('Nenhum arquivo PDF de contrato foi enviado.', {
          code: 'DADOS_INVALIDOS',
          status: 400,
        });
      }

      const extracted = await parseContractPdf(file.buffer);

      let matchedSupplier: any = null;
      if (extracted.supplier_cnpj) {
        const pool = getPool();
        const digits = cleanCnpj(extracted.supplier_cnpj);
        const supRes = await pool.query(
          `SELECT id, name, legal_name, cnpj FROM public.suppliers 
            WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = $1 LIMIT 1`,
          [digits]
        );
        if (supRes.rowCount && supRes.rowCount > 0) {
          matchedSupplier = supRes.rows[0];
        }
      }

      res.json({
        success: true,
        extracted_data: {
          ...extracted,
          matched_supplier: matchedSupplier,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// Cadastro de contrato com itens
contractsRouter.post('/contracts', authenticate, requirePermission('contracts.write'), async (req, res, next) => {
  try {
    const data = createContractSchema.parse(req.body);

    const result = await runInTransaction(
      { actorId: req.user!.id, requestId: req.requestId },
      async (client) => {
        // Validação de unicidade do contrato por ano
        const check = await client.query(
          'SELECT id FROM public.contracts WHERE upper(trim(contract_number)) = upper(trim($1)) AND year = $2',
          [data.contract_number, data.year]
        );
        if (check.rowCount > 0) {
          throw new AppError(`O Contrato nº ${data.contract_number}/${data.year} já está cadastrado.`, {
            code: 'CONTRATO_DUPLICADO',
            status: 409,
          });
        }

        // Validação de datas
        if (new Date(data.end_date) < new Date(data.start_date)) {
          throw new AppError('A data final de vigência não pode ser anterior à data inicial.', {
            code: 'VIGENCIA_INVALIDA',
            status: 400,
          });
        }

        // Resolução unificada de Processo Licitatório (se informado diretamente por texto)
        let procurementId = data.procurement_id || null;
        if (!procurementId && data.procurement_process_number) {
          const cleanProcNum = data.procurement_process_number.trim();
          const procCheck = await client.query(
            'SELECT id FROM public.procurement_processes WHERE upper(trim(process_number)) = upper(trim($1))',
            [cleanProcNum]
          );
          if (procCheck.rowCount && procCheck.rowCount > 0) {
            procurementId = procCheck.rows[0].id;
          } else {
            const insProc = await client.query(
              `INSERT INTO public.procurement_processes 
               (process_number, year, bidding_number, modality, legal_framework, object, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id`,
              [
                cleanProcNum,
                data.year,
                data.bidding_number || cleanProcNum,
                data.procurement_modality || 'PREGAO_ELETRONICO',
                data.legal_framework || 'Lei 14.133/2021',
                data.object,
                req.user!.id,
              ]
            );
            procurementId = insProc.rows[0].id;
          }
        }

        const signingDate = data.signing_date || data.start_date;

        const insContract = await client.query(
          `INSERT INTO public.contracts 
           (contract_number, year, procurement_id, supplier_id, object, legal_framework, signing_date, start_date, end_date, delivery_deadline_days, total_amount, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING *`,
          [
            data.contract_number,
            data.year,
            procurementId,
            data.supplier_id,
            data.object,
            data.legal_framework,
            signingDate,
            data.start_date,
            data.end_date,
            data.delivery_deadline_days,
            data.total_amount,
            data.status,
            req.user!.id,
          ]
        );

        const contractId = insContract.rows[0].id;

        // Inserção dos itens do contrato
        for (const item of data.items) {
          await client.query(
            `INSERT INTO public.contract_items 
             (contract_id, item_code, item_group, description, category, unit, original_quantity, current_quantity, unit_price, total_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              contractId,
              item.item_code,
              item.item_group || null,
              item.description,
              item.category,
              item.unit,
              item.original_quantity,
              item.original_quantity,
              item.unit_price,
              item.total_price,
            ]
          );
        }

        const resContract = await client.query('SELECT * FROM public.v_contracts WHERE id = $1', [contractId]);
        return resContract.rows[0];
      }
    );

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// Atualização de dados cadastrais do contrato
contractsRouter.patch('/contracts/:id', authenticate, requirePermission('contracts.write'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateContractSchema.parse(req.body);

    const result = await runInTransaction(
      { actorId: req.user!.id, requestId: req.requestId },
      async (client) => {
        const contract = await client.query('SELECT * FROM public.contracts WHERE id = $1', [id]);
        if (contract.rowCount === 0) {
          throw new AppError('Contrato não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
        }

        const updates: string[] = ['updated_at = now()'];
        const values: unknown[] = [id];

        if (data.contract_number !== undefined) {
          values.push(data.contract_number);
          updates.push(`contract_number = $${values.length}`);
        }
        if (data.year !== undefined) {
          values.push(data.year);
          updates.push(`year = $${values.length}`);
        }
        if (data.procurement_id !== undefined) {
          values.push(data.procurement_id || null);
          updates.push(`procurement_id = $${values.length}`);
        }
        if (data.supplier_id !== undefined) {
          values.push(data.supplier_id);
          updates.push(`supplier_id = $${values.length}`);
        }
        if (data.object !== undefined) {
          values.push(data.object);
          updates.push(`object = $${values.length}`);
        }
        if (data.legal_framework !== undefined) {
          values.push(data.legal_framework);
          updates.push(`legal_framework = $${values.length}`);
        }
        if (data.signing_date !== undefined) {
          values.push(data.signing_date);
          updates.push(`signing_date = $${values.length}`);
        }
        if (data.start_date !== undefined) {
          values.push(data.start_date);
          updates.push(`start_date = $${values.length}`);
        }
        if (data.end_date !== undefined) {
          values.push(data.end_date);
          updates.push(`end_date = $${values.length}`);
        }
        if (data.delivery_deadline_days !== undefined) {
          values.push(data.delivery_deadline_days);
          updates.push(`delivery_deadline_days = $${values.length}`);
        }
        if (data.status !== undefined) {
          values.push(data.status);
          updates.push(`status = $${values.length}`);
        }

        const q = `UPDATE public.contracts SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
        const updated = await client.query(q, values);
        return updated.rows[0];
      }
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Registro de Termo Aditivo
contractsRouter.post('/contracts/:id/amendments', authenticate, requirePermission('contracts.write'), async (req, res, next) => {
  try {
    const { id: contractId } = req.params;
    const data = createAmendmentSchema.parse(req.body);

    const result = await runInTransaction(
      { actorId: req.user!.id, requestId: req.requestId },
      async (client) => {
        const contractRes = await client.query('SELECT * FROM public.contracts WHERE id = $1', [contractId]);
        if (contractRes.rowCount === 0) {
          throw new AppError('Contrato não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
        }

        const insAmend = await client.query(
          `INSERT INTO public.contract_amendments 
           (contract_id, amendment_number, amendment_type, signing_date, new_end_date, additional_amount, justification, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            contractId,
            data.amendment_number,
            data.amendment_type,
            data.signing_date,
            data.new_end_date || null,
            data.additional_amount || 0,
            data.justification,
            req.user!.id,
          ]
        );

        // Se aditivo de prazo estende vigência
        if (data.new_end_date) {
          await client.query('UPDATE public.contracts SET end_date = $1, updated_at = now() WHERE id = $2', [
            data.new_end_date,
            contractId,
          ]);
        }

        // Se aditivo financeiro altera valor total
        if (data.additional_amount && data.additional_amount !== 0) {
          await client.query(
            'UPDATE public.contracts SET total_amount = total_amount + $1, updated_at = now() WHERE id = $2',
            [data.additional_amount, contractId]
          );
        }

        return insAmend.rows[0];
      }
    );

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// Adicionar item manualmente a um contrato existente (para correção de tabelas incompletas)
contractsRouter.post('/contracts/:id/items', authenticate, requirePermission('contracts.write'), async (req, res, next) => {
  try {
    const { id: contractId } = req.params;
    const itemInput = contractItemSchema.extend({
      total_price: z.coerce.number().positive().optional(),
      recalculate_contract_total: z.boolean().optional().default(true),
    }).parse(req.body);

    const lineTotal =
      itemInput.total_price ??
      Math.round(Number(itemInput.original_quantity) * Number(itemInput.unit_price) * 100) / 100;

    const result = await runInTransaction(
      { actorId: req.user!.id, reason: 'Inclusão manual de item no contrato', requestId: req.requestId },
      async (client) => {
        const contractRes = await client.query('SELECT id FROM public.contracts WHERE id = $1', [contractId]);
        if ((contractRes.rowCount ?? 0) === 0) {
          throw new AppError('Contrato não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
        }

        const dupCheck = await client.query(
          'SELECT id FROM public.contract_items WHERE contract_id = $1 AND upper(trim(item_code)) = upper(trim($2))',
          [contractId, itemInput.item_code]
        );
        if ((dupCheck.rowCount ?? 0) > 0) {
          throw new AppError(`Já existe um item com o código "${itemInput.item_code}" neste contrato.`, {
            code: 'ITEM_DUPLICADO',
            status: 409,
          });
        }

        const ins = await client.query(
          `INSERT INTO public.contract_items
           (contract_id, item_code, item_group, description, category, unit, original_quantity, current_quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            contractId,
            itemInput.item_code,
            itemInput.item_group || null,
            itemInput.description,
            itemInput.category,
            itemInput.unit,
            itemInput.original_quantity,
            itemInput.original_quantity,
            itemInput.unit_price,
            lineTotal,
          ]
        );

        if (itemInput.recalculate_contract_total) {
          await client.query(
            'UPDATE public.contracts SET total_amount = total_amount + $1, updated_at = now() WHERE id = $2',
            [lineTotal, contractId]
          );
        }

        await client.query(
          `INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, summary)
           VALUES ($1, $2, $3, 'ITEM_CONTRATO_ADICIONADO', 'contract_items', $4, $5)`,
          [
            req.user!.id,
            req.user!.full_name || 'Usuário',
            req.user!.role,
            ins.rows[0].id,
            `Inclusão manual do item ${itemInput.item_code} no contrato`,
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

// Correção manual de um item contratual (quando importação ou cadastro ficou fora de esquadro)
contractsRouter.patch('/contracts/:id/items/:itemId', authenticate, requirePermission('contracts.write'), async (req, res, next) => {
  try {
    const { id: contractId, itemId } = req.params;
    const patchSchema = z.object({
      item_code: z.string().trim().min(1).optional(),
      description: z.string().trim().min(1).optional(),
      category: contractItemSchema.shape.category.optional(),
      unit: z.string().trim().min(1).optional(),
      original_quantity: z.coerce.number().positive('Quantidade deve ser maior que zero.').optional(),
      unit_price: z.coerce.number().positive('Valor unitário deve ser maior que zero.').optional(),
      recalculate_contract_total: z.boolean().optional().default(true),
    });
    const data = patchSchema.parse(req.body);

    const result = await runInTransaction(
      { actorId: req.user!.id, reason: 'Correção manual de item contratual', requestId: req.requestId },
      async (client) => {
        const curRes = await client.query(
          `SELECT ci.*,
                  vci.reserved_quantity,
                  vci.requested_quantity
             FROM public.contract_items ci
             JOIN public.v_contract_items vci ON vci.id = ci.id
            WHERE ci.id = $1 AND ci.contract_id = $2
            FOR UPDATE OF ci`,
          [itemId, contractId]
        );

        if ((curRes.rowCount ?? 0) === 0) {
          throw new AppError('Item contratual não encontrado neste contrato.', {
            code: 'NAO_ENCONTRADO',
            status: 404,
          });
        }

        const cur = curRes.rows[0];
        const nextCode = data.item_code ?? cur.item_code;
        if (nextCode !== cur.item_code) {
          const dupCheck = await client.query(
            'SELECT id FROM public.contract_items WHERE contract_id = $1 AND upper(trim(item_code)) = upper(trim($2)) AND id <> $3',
            [contractId, nextCode, itemId]
          );
          if ((dupCheck.rowCount ?? 0) > 0) {
            throw new AppError(`Já existe outro item com o código "${nextCode}" neste contrato.`, {
              code: 'ITEM_DUPLICADO',
              status: 409,
            });
          }
        }

        const oldOrigQty = Number(cur.original_quantity);
        const oldCurrQty = Number(cur.current_quantity);
        const committedQty = Number(cur.reserved_quantity || 0) + Number(cur.requested_quantity || 0);

        const nextOrigQty = data.original_quantity ?? oldOrigQty;
        const deltaQty = nextOrigQty - oldOrigQty;
        const nextCurrQty = Math.round((oldCurrQty + deltaQty) * 1000) / 1000;

        if (nextCurrQty < committedQty) {
          throw new AppError(
            `Não é possível reduzir a quantidade para ${nextOrigQty}: já existem ${committedQty} ${cur.unit} reservados/solicitados em Ordens de Fornecimento.`,
            { code: 'QUANTIDADE_MENOR_QUE_CONSUMIDO', status: 422 }
          );
        }

        const nextUnitPrice = data.unit_price ?? Number(cur.unit_price);
        const oldTotalPrice = Number(cur.total_price);
        const nextTotalPrice = Math.round(nextOrigQty * nextUnitPrice * 100) / 100;
        const deltaAmount = Math.round((nextTotalPrice - oldTotalPrice) * 100) / 100;

        const upd = await client.query(
          `UPDATE public.contract_items
              SET item_code = $1,
                  description = $2,
                  category = $3,
                  unit = $4,
                  original_quantity = $5,
                  current_quantity = $6,
                  unit_price = $7,
                  total_price = $8,
                  updated_at = now()
            WHERE id = $9
            RETURNING *`,
          [
            nextCode,
            data.description ?? cur.description,
            data.category ?? cur.category,
            data.unit ?? cur.unit,
            nextOrigQty,
            nextCurrQty,
            nextUnitPrice,
            nextTotalPrice,
            itemId,
          ]
        );

        if (data.recalculate_contract_total && deltaAmount !== 0) {
          await client.query(
            'UPDATE public.contracts SET total_amount = GREATEST(0, total_amount + $1), updated_at = now() WHERE id = $2',
            [deltaAmount, contractId]
          );
        }

        await client.query(
          `INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, summary, old_data, new_data)
           VALUES ($1, $2, $3, 'ITEM_CONTRATO_CORRIGIDO', 'contract_items', $4, $5, $6, $7)`,
          [
            req.user!.id,
            req.user!.full_name || 'Usuário',
            req.user!.role,
            itemId,
            `Correção manual do item ${nextCode} (${cur.description.slice(0, 50)})`,
            JSON.stringify(cur),
            JSON.stringify(upd.rows[0]),
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

// Remoção manual de item contratual (somente se não possuir nenhuma OF ou movimentação vinculada)
contractsRouter.delete('/contracts/:id/items/:itemId', authenticate, requirePermission('contracts.write'), async (req, res, next) => {
  try {
    const { id: contractId, itemId } = req.params;

    await runInTransaction(
      { actorId: req.user!.id, reason: 'Exclusão manual de item contratual sem movimentações', requestId: req.requestId },
      async (client) => {
        const curRes = await client.query(
          'SELECT * FROM public.contract_items WHERE id = $1 AND contract_id = $2 FOR UPDATE',
          [itemId, contractId]
        );
        if ((curRes.rowCount ?? 0) === 0) {
          throw new AppError('Item contratual não encontrado neste contrato.', { code: 'NAO_ENCONTRADO', status: 404 });
        }

        const usageCheck = await client.query(
          `SELECT 1 FROM public.supply_order_items WHERE contract_item_id = $1
           UNION ALL
           SELECT 1 FROM public.contract_item_movements WHERE contract_item_id = $1
           LIMIT 1`,
          [itemId]
        );
        if ((usageCheck.rowCount ?? 0) > 0) {
          throw new AppError('Não é possível excluir este item pois já existem Ordens de Fornecimento ou movimentações vinculadas a ele.', {
            code: 'ITEM_EM_USO',
            status: 409,
          });
        }

        const item = curRes.rows[0];
        await client.query('DELETE FROM public.contract_items WHERE id = $1', [itemId]);
        await client.query(
          'UPDATE public.contracts SET total_amount = GREATEST(0, total_amount - $1), updated_at = now() WHERE id = $2',
          [Number(item.total_price || 0), contractId]
        );

        await client.query(
          `INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, summary, old_data)
           VALUES ($1, $2, $3, 'ITEM_CONTRATO_REMOVIDO', 'contract_items', $4, $5, $6)`,
          [
            req.user!.id,
            req.user!.full_name || 'Usuário',
            req.user!.role,
            itemId,
            `Exclusão manual do item ${item.item_code} do contrato`,
            JSON.stringify(item),
          ]
        );
      }
    );

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
