import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { getPool } from '../db/pool.js';
import { runInTransaction } from '../db/transaction.js';
import { parseContractPdf, cleanCnpj } from '../services/contract-parser.js';
import { AppError } from '../middleware/errors.js';

export const contractsRouter = Router();

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
  signing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de celebração inválida.'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial de vigência inválida.'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final de vigência inválida.'),
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
            data.signing_date,
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
