import type { DbClient } from '../db/pool.js';
import { AppError } from '../middleware/errors.js';

export interface OrderItemInput {
  contract_item_id: string;
  quantity: number;
}

export interface RevertItemInput {
  contract_item_id: string;
  quantity: number;
}

/**
 * Valida a vigência do contrato e reserva os itens solicitados dentro da transação.
 * Utiliza SELECT ... FOR UPDATE para evitar condições de corrida em concorrência.
 */
export async function reserveContractItems(
  client: DbClient,
  contractId: string,
  items: OrderItemInput[],
  supplyOrderId: string,
  actorId: string,
  orderDate?: string
): Promise<void> {
  // 1. Valida vigência e situação do contrato
  const contractRes = await client.query(
    `SELECT c.*,
            (c.end_date < CURRENT_DATE) as is_expired
       FROM public.contracts c
      WHERE c.id = $1
      FOR SHARE`,
    [contractId]
  );

  if (contractRes.rowCount === 0) {
    throw new AppError('Contrato não encontrado.', { code: 'CONTRATO_NAO_ENCONTRADO', status: 404 });
  }

  const contract = contractRes.rows[0];

  if (['SUSPENSO', 'ENCERRADO', 'RESCINDIDO', 'VENCIDO'].includes(contract.status) || contract.is_expired) {
    throw new AppError(
      `Não é permitido emitir Ordem de Fornecimento para este contrato. Situação: ${contract.status}. Vigência expirada em ${contract.end_date}.`,
      { code: 'CONTRATO_FORA_DE_VIGENCIA', status: 422 }
    );
  }

  if (orderDate) {
    if (orderDate < contract.start_date || orderDate > contract.end_date) {
      throw new AppError(
        `A data da Ordem (${orderDate}) está fora do período de vigência contratual (${contract.start_date} a ${contract.end_date}).`,
        { code: 'DATA_FORA_DA_VIGENCIA', status: 422 }
      );
    }
  }

  // 2. Valida saldo disponível e reserva cada item
  for (const item of items) {
    if (item.quantity <= 0) {
      throw new AppError('A quantidade solicitada de cada item deve ser maior que zero.', {
        code: 'QUANTIDADE_INVALIDA',
        status: 400,
      });
    }

    // Trava a linha do item para leitura e atualização segura contra concorrência
    const lockRes = await client.query(
      `SELECT * FROM public.contract_items WHERE id = $1 AND contract_id = $2 FOR UPDATE`,
      [item.contract_item_id, contractId]
    );

    if (lockRes.rowCount === 0) {
      throw new AppError(`Item contratual ${item.contract_item_id} não pertence a este contrato.`, {
        code: 'ITEM_NAO_ENCONTRADO',
        status: 404,
      });
    }

    const itemRow = lockRes.rows[0];

    // Calcula saldo disponível em tempo real
    const balanceRes = await client.query(
      `SELECT * FROM public.v_contract_items WHERE id = $1`,
      [item.contract_item_id]
    );
    const balanceRow = balanceRes.rows[0];
    const availableQty = Number(balanceRow.available_quantity);

    if (item.quantity > availableQty) {
      throw new AppError(
        `Saldo contratual insuficiente para o item "${itemRow.item_code} - ${itemRow.description}". Solicitado: ${item.quantity} ${itemRow.unit}, Disponível: ${availableQty} ${itemRow.unit}.`,
        { code: 'SALDO_CONTRATUAL_INSUFICIENTE', status: 422 }
      );
    }

    const unitPrice = Number(itemRow.unit_price);
    const totalAmount = Math.round(item.quantity * unitPrice * 100) / 100;

    // Registra a movimentação de RESERVA
    await client.query(
      `INSERT INTO public.contract_item_movements 
       (contract_item_id, supply_order_id, movement_type, quantity, unit_price, total_amount, reason, actor_id)
       VALUES ($1, $2, 'RESERVA', $3, $4, $5, 'Reserva de quantidade para OF aguardando assinatura', $6)`,
      [item.contract_item_id, supplyOrderId, item.quantity, unitPrice, totalAmount, actorId]
    );
  }
}

/**
 * Converte as reservas de uma OF em baixas efetivas de saldo após assinatura.
 * Operação idempotente: se já estiver baixada, não duplica.
 */
export async function confirmContractItems(
  client: DbClient,
  supplyOrderId: string,
  actorId: string
): Promise<void> {
  // Verifica se já houve confirmação/baixa para esta OF
  const checkAlreadyBaixa = await client.query(
    `SELECT id FROM public.contract_item_movements 
      WHERE supply_order_id = $1 AND movement_type = 'BAIXA' LIMIT 1`,
    [supplyOrderId]
  );

  if ((checkAlreadyBaixa.rowCount ?? 0) > 0) {
    // Idempotência: já confirmado anteriormente
    return;
  }

  // Busca os itens da OF
  const soItems = await client.query(
    `SELECT soi.*, ci.unit_price
       FROM public.supply_order_items soi
       JOIN public.contract_items ci ON ci.id = soi.contract_item_id
      WHERE soi.supply_order_id = $1`,
    [supplyOrderId]
  );

  for (const r of soItems.rows) {
    const qty = Number(r.quantity);
    const unitPrice = Number(r.unit_price);
    const totalAmount = Math.round(qty * unitPrice * 100) / 100;

    // Registra a baixa efetiva
    await client.query(
      `INSERT INTO public.contract_item_movements 
       (contract_item_id, supply_order_id, movement_type, quantity, unit_price, total_amount, reason, actor_id)
       VALUES ($1, $2, 'BAIXA', $3, $4, $5, 'Baixa efetiva de saldo confirmada com via assinada da OF', $6)`,
      [r.contract_item_id, supplyOrderId, qty, unitPrice, totalAmount, actorId]
    );
  }
}

/**
 * Libera as quantidades reservadas de uma OF que foi cancelada antes da assinatura.
 */
export async function releaseReservedContractItems(
  client: DbClient,
  supplyOrderId: string,
  reason: string,
  actorId: string
): Promise<void> {
  const reservations = await client.query(
    `SELECT m.*
       FROM public.contract_item_movements m
      WHERE m.supply_order_id = $1 AND m.movement_type = 'RESERVA'`,
    [supplyOrderId]
  );

  for (const r of reservations.rows) {
    await client.query(
      `INSERT INTO public.contract_item_movements 
       (contract_item_id, supply_order_id, movement_type, quantity, unit_price, total_amount, reason, actor_id)
       VALUES ($1, $2, 'LIBERACAO', $3, $4, $5, $6, $7)`,
      [
        r.contract_item_id,
        supplyOrderId,
        r.quantity,
        r.unit_price,
        r.total_amount,
        `Liberação de reserva por cancelamento da OF: ${reason}`,
        actorId,
      ]
    );
  }
}

/**
 * Estorna quantidades de itens de uma OF já confirmada (cancelamento pós-assinatura ou fornecimento parcial).
 */
export async function revertDeliveredContractItems(
  client: DbClient,
  supplyOrderId: string,
  itemsToReturn: RevertItemInput[],
  reason: string,
  actorId: string
): Promise<void> {
  for (const it of itemsToReturn) {
    if (it.quantity <= 0) continue;

    const itemRow = await client.query(
      `SELECT unit_price FROM public.contract_items WHERE id = $1`,
      [it.contract_item_id]
    );
    if ((itemRow.rowCount ?? 0) === 0) continue;

    const unitPrice = Number(itemRow.rows[0].unit_price);
    const totalAmount = Math.round(it.quantity * unitPrice * 100) / 100;

    await client.query(
      `INSERT INTO public.contract_item_movements 
       (contract_item_id, supply_order_id, movement_type, quantity, unit_price, total_amount, reason, actor_id)
       VALUES ($1, $2, 'ESTORNO', $3, $4, $5, $6, $7)`,
      [
        it.contract_item_id,
        supplyOrderId,
        it.quantity,
        unitPrice,
        totalAmount,
        `Estorno de saldo contratual: ${reason}`,
        actorId,
      ]
    );
  }
}
