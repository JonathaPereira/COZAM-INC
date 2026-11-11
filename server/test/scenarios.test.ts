import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../src/app.js';
import { createPGlitePool, setCustomPool, type DbPool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';

describe('COZAM — Suíte de Testes Obrigatórios (Cenários A até J)', () => {
  let app: any;
  let pool: DbPool;
  let adminToken: string;
  let pagamentosToken: string;

  let mzSupplierId: string;
  let nacSupplierId: string;

  beforeAll(async () => {
    // Inicializa banco em memória via PGlite
    const pglite = new PGlite();
    pool = createPGlitePool(pglite);
    setCustomPool(pool);

    await runMigrations(pool);

    // Cria perfis de teste
    const client = await pool.connect();
    try {
      await client.query(`
        insert into auth.users (id, email, raw_user_meta_data)
        values
          ('00000000-0000-0000-0000-000000000001', 'admin@cozam.al.gov.br', '{"role":"admin"}'::jsonb),
          ('00000000-0000-0000-0000-000000000002', 'pagamentos@cozam.al.gov.br', '{"role":"pagamentos"}'::jsonb)
        on conflict (id) do nothing;

        insert into public.profiles (id, full_name, email, role, active)
        values
          ('00000000-0000-0000-0000-000000000001', 'Administrador Compras', 'admin@cozam.al.gov.br', 'admin', true),
          ('00000000-0000-0000-0000-000000000002', 'Operador Pagamentos', 'pagamentos@cozam.al.gov.br', 'pagamentos', true)
        on conflict (id) do update set active = true;
      `);

      const sRes = await client.query('select id, name from public.suppliers order by display_order asc');
      mzSupplierId = sRes.rows.find((s: any) => s.name === 'MZ Bernardi').id;
      nacSupplierId = sRes.rows.find((s: any) => s.name === 'Nacional').id;
    } finally {
      client.release();
    }

    adminToken = 'mock-admin';
    pagamentosToken = 'mock-pagamentos';
    app = createApp();
  });

  afterAll(async () => {
    await pool.end();
  });

  // ---------------------------------------------------------------------------
  // Cenário A: Compras cadastra uma OF e uma NF, encaminha para Pagamentos
  // e o responsável consegue baixar os dois documentos.
  // ---------------------------------------------------------------------------
  it('Cenário A: Compras cadastra OF e NF com PDF, encaminha e Pagamentos baixa ambos', async () => {
    // 1. Cria processo
    const procRes = await request(app)
      .post('/api/processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        process_number: 'PROC-2026/001',
        description: 'Aquisição de materiais de consumo para saúde',
      })
      .expect(201);
    const processId = procRes.body.id;

    // 2. Compras cadastra OF com PDF
    const ofPdfBuffer = Buffer.from('%PDF-1.4 OF_TEST_CONTENT');
    const ofRes = await request(app)
      .post('/api/supply-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('process_id', processId)
      .field('supplier_id', mzSupplierId)
      .field('of_number', 'OF-001/2026')
      .field('issue_date', '2026-11-01')
      .field('total_value', '50000.00')
      .attach('file', ofPdfBuffer, 'OF-001.pdf')
      .expect(201);
    const supplyOrderId = ofRes.body.id;

    // 3. Compras cadastra NF com PDF
    const nfPdfBuffer = Buffer.from('%PDF-1.4 NF_TEST_CONTENT');
    const nfRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supply_order_id', supplyOrderId)
      .field('invoice_number', 'NF-1001')
      .field('issue_date', '2026-11-05')
      .field('amount', '15000.00')
      .field('modality', 'FUMIP')
      .field('notes', 'Entrega regular')
      .attach('file', nfPdfBuffer, 'NF-1001.pdf')
      .expect(201);
    const invoiceId = nfRes.body.id;

    expect(nfRes.body.forward_status).toBe('RASCUNHO');

    // 4. Encaminha para Pagamentos
    const fwdRes = await request(app)
      .post(`/api/invoices/${invoiceId}/forward`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(fwdRes.body.forward_status).toBe('ENCAMINHADA');

    // 5. Usuário de Pagamentos acessa a fila e consulta a NF
    const queueRes = await request(app)
      .get('/api/invoices?queue=1')
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .expect(200);
    expect(queueRes.body.data.some((inv: any) => inv.id === invoiceId)).toBe(true);

    const detailRes = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .expect(200);

    const ofDoc = detailRes.body.documents.find((d: any) => d.kind === 'OF');
    const nfDoc = detailRes.body.documents.find((d: any) => d.kind === 'NF');
    expect(ofDoc).toBeDefined();
    expect(nfDoc).toBeDefined();

    // 6. Pagamentos baixa ambos os documentos e recebe os bytes originais
    const dlOf = await request(app)
      .get(`/api/documents/${ofDoc.id}/content?download=1`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .expect(200);
    expect(dlOf.body.toString()).toContain('OF_TEST_CONTENT');

    const dlNf = await request(app)
      .get(`/api/documents/${nfDoc.id}/content?download=1`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .expect(200);
    expect(dlNf.body.toString()).toContain('NF_TEST_CONTENT');
  });

  // ---------------------------------------------------------------------------
  // Cenário B: Pagamentos registra um pagamento parcial e o sistema calcula
  // corretamente o saldo.
  // ---------------------------------------------------------------------------
  it('Cenário B: Pagamento parcial calcula saldo devedor e muda situação para PARCIALMENTE_PAGA', async () => {
    // Localiza a NF-1001 de R$ 15.000,00 do Cenário A
    const listRes = await request(app)
      .get('/api/invoices?search=NF-1001')
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .expect(200);
    const invoiceId = listRes.body.data[0].id;

    // Registra 1º pagamento parcial: R$ 5.000,00
    const payRes = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .field('amount', '5000.00')
      .field('payment_date', '2026-11-06')
      .field('notes', '1ª parcela paga')
      .expect(201);

    expect(payRes.body.invoice.total_paid).toBe(5000);
    expect(payRes.body.invoice.balance).toBe(10000);
    expect(payRes.body.invoice.status).toBe('PARCIALMENTE_PAGA');

    // Registra 2º pagamento parcial: R$ 4.000,00
    const payRes2 = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .field('amount', '4000.00')
      .field('payment_date', '2026-11-07')
      .expect(201);

    expect(payRes2.body.invoice.total_paid).toBe(9000);
    expect(payRes2.body.invoice.balance).toBe(6000);
    expect(payRes2.body.invoice.status).toBe('PARCIALMENTE_PAGA');
  });

  // ---------------------------------------------------------------------------
  // Cenário C: Pagamentos registra o valor restante e a NF passa automaticamente
  // para totalmente paga.
  // ---------------------------------------------------------------------------
  it('Cenário C: Pagamento do saldo restante torna a NF TOTALMENTE_PAGA com saldo zero', async () => {
    const listRes = await request(app)
      .get('/api/invoices?search=NF-1001')
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .expect(200);
    const invoiceId = listRes.body.data[0].id;

    // Registra 3º pagamento: R$ 6.000,00 (quitando os R$ 15.000,00)
    const payRes = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .field('amount', '6000.00')
      .field('payment_date', '2026-11-08')
      .expect(201);

    expect(payRes.body.invoice.total_paid).toBe(15000);
    expect(payRes.body.invoice.balance).toBe(0);
    expect(payRes.body.invoice.status).toBe('TOTALMENTE_PAGA');
  });

  // ---------------------------------------------------------------------------
  // Cenário D: Uma OF possui três notas fiscais diferentes e cada uma mantém
  // seu próprio histórico.
  // ---------------------------------------------------------------------------
  it('Cenário D: Uma mesma OF possui três NFs distintas com históricos e saldos independentes', async () => {
    // Cria processo
    const procRes = await request(app)
      .post('/api/processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ process_number: 'PROC-2026/002', description: 'Medicamentos hospitalares' })
      .expect(201);

    // Cria OF com PDF
    const ofRes = await request(app)
      .post('/api/supply-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('process_id', procRes.body.id)
      .field('supplier_id', mzSupplierId)
      .field('of_number', 'OF-002/2026')
      .field('issue_date', '2026-11-01')
      .attach('file', Buffer.from('%PDF-1.4 OF2'), 'OF2.pdf')
      .expect(201);
    const ofId = ofRes.body.id;

    // Cria 3 NFs para esta OF
    const pdf = Buffer.from('%PDF-1.4 NF');
    const nfA = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supply_order_id', ofId)
      .field('invoice_number', 'NF-2001')
      .field('issue_date', '2026-11-02')
      .field('amount', '1000.00')
      .field('modality', 'FUMIP')
      .field('forward', 'true')
      .attach('file', pdf, 'NF2001.pdf')
      .expect(201);

    const nfB = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supply_order_id', ofId)
      .field('invoice_number', 'NF-2002')
      .field('issue_date', '2026-11-03')
      .field('amount', '2000.00')
      .field('modality', 'COMPRA_COMPARTILHADA')
      .field('forward', 'true')
      .attach('file', pdf, 'NF2002.pdf')
      .expect(201);

    const nfC = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supply_order_id', ofId)
      .field('invoice_number', 'NF-2003')
      .field('issue_date', '2026-11-04')
      .field('amount', '3000.00')
      .field('modality', 'FUMIP')
      .field('forward', 'true')
      .attach('file', pdf, 'NF2003.pdf')
      .expect(201);

    // Paga integralmente apenas a NF-2001
    await request(app)
      .post(`/api/invoices/${nfA.body.id}/payments`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .field('amount', '1000.00')
      .field('payment_date', '2026-11-05')
      .expect(201);

    // Paga parcialmente a NF-2002
    await request(app)
      .post(`/api/invoices/${nfB.body.id}/payments`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .field('amount', '800.00')
      .field('payment_date', '2026-11-05')
      .expect(201);

    // NF-2003 permanece sem pagamentos

    // Verifica a OF
    const ofDetail = await request(app)
      .get(`/api/supply-orders/${ofId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(ofDetail.body.invoices).toHaveLength(3);
    const iA = ofDetail.body.invoices.find((i: any) => i.id === nfA.body.id);
    const iB = ofDetail.body.invoices.find((i: any) => i.id === nfB.body.id);
    const iC = ofDetail.body.invoices.find((i: any) => i.id === nfC.body.id);

    expect(iA.status).toBe('TOTALMENTE_PAGA');
    expect(iA.balance).toBe(0);

    expect(iB.status).toBe('PARCIALMENTE_PAGA');
    expect(iB.balance).toBe(1200);

    expect(iC.status).toBe('AGUARDANDO_PAGAMENTO');
    expect(iC.balance).toBe(3000);
  });

  // ---------------------------------------------------------------------------
  // Cenário E: Um processo possui fornecedores diferentes, com OFs separadas.
  // ---------------------------------------------------------------------------
  it('Cenário E: Um mesmo processo administrativo possui OFs de fornecedores distintos (MZ Bernardi e Nacional)', async () => {
    const procRes = await request(app)
      .post('/api/processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ process_number: 'PROC-MULTI-2026', description: 'Aquisição compartilhada ampla' })
      .expect(201);
    const processId = procRes.body.id;

    // OF 1: MZ Bernardi
    await request(app)
      .post('/api/supply-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('process_id', processId)
      .field('supplier_id', mzSupplierId)
      .field('of_number', 'OF-MZ-001')
      .field('issue_date', '2026-11-01')
      .expect(201);

    // OF 2: Nacional
    await request(app)
      .post('/api/supply-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('process_id', processId)
      .field('supplier_id', nacSupplierId)
      .field('of_number', 'OF-NAC-001')
      .field('issue_date', '2026-11-01')
      .expect(201);

    const procDetail = await request(app)
      .get(`/api/processes/${processId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(procDetail.body.supply_orders).toHaveLength(2);
    const suppliers = procDetail.body.supply_orders.map((s: any) => s.supplier_name);
    expect(suppliers).toContain('MZ Bernardi');
    expect(suppliers).toContain('Nacional');
  });

  // ---------------------------------------------------------------------------
  // Cenário F: Uma nota possui comentário informando emissão parcial, sem
  // alterar indevidamente seu saldo financeiro.
  // ---------------------------------------------------------------------------
  it('Cenário F: Comentário sobre valor faltante de fornecimento NÃO altera o saldo devedor da NF', async () => {
    // Processo e OF
    const procRes = await request(app)
      .post('/api/processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ process_number: 'PROC-PARCIAL-2026', description: 'Fornecimento parcelado' })
      .expect(201);

    const ofRes = await request(app)
      .post('/api/supply-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('process_id', procRes.body.id)
      .field('supplier_id', mzSupplierId)
      .field('of_number', 'OF-PARCIAL-01')
      .field('issue_date', '2026-11-01')
      .attach('file', Buffer.from('%PDF-1.4 OF'), 'OF.pdf')
      .expect(201);

    // NF cadastrada por R$ 5.000,00 com comentário: "Nota emitida parcialmente. Faltam R$ 2.520,00..."
    const nfRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supply_order_id', ofRes.body.id)
      .field('invoice_number', 'NF-PARCIAL-001')
      .field('issue_date', '2026-11-05')
      .field('amount', '5000.00')
      .field('modality', 'FUMIP')
      .field('notes', 'Nota emitida parcialmente. Faltam R$ 2.520,00 para completar o valor previsto.')
      .field('forward', 'true')
      .attach('file', Buffer.from('%PDF-1.4 NF'), 'NF.pdf')
      .expect(201);

    // Saldo financeiro deve ser rigorosamente R$ 5.000,00 (NÃO R$ 7.520,00)
    expect(nfRes.body.amount).toBe(5000);
    expect(nfRes.body.total_paid).toBe(0);
    expect(nfRes.body.balance).toBe(5000);

    // Pagamento de R$ 5.000,00 deve liquidar a NF
    const payRes = await request(app)
      .post(`/api/invoices/${nfRes.body.id}/payments`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .field('amount', '5000.00')
      .field('payment_date', '2026-11-06')
      .expect(201);

    expect(payRes.body.invoice.status).toBe('TOTALMENTE_PAGA');
    expect(payRes.body.invoice.balance).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Cenário G: Uma nota antiga é cadastrada como não verificada, sem ser
  // considerada paga.
  // ---------------------------------------------------------------------------
  it('Cenário G: Nota histórica não verificada é criada com status NAO_VERIFICADA e não como paga', async () => {
    const histRes = await request(app)
      .post('/api/invoices/historical')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supplier_id', mzSupplierId)
      .field('invoice_number', 'NF-ANTIGA-999')
      .field('reported_status', 'SEM_INFORMACAO')
      .field('informed_by', 'Levantamento inicial de arquivos físicos')
      .field('notes', 'Nota constante em pasta arquivada')
      .expect(201);

    expect(histRes.body.status).toBe('NAO_VERIFICADA');
    expect(histRes.body.total_paid).toBe(0);
    expect(histRes.body.verified).toBe(false);

    // Tentar pagar nota não verificada deve ser bloqueado
    const tryPay = await request(app)
      .post(`/api/invoices/${histRes.body.id}/payments`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .field('amount', '100.00')
      .field('payment_date', '2026-11-06')
      .expect(422);

    expect(tryPay.body.error.code).toBe('NF_NAO_VERIFICADA');
  });

  // ---------------------------------------------------------------------------
  // Cenário H: Um usuário de Pagamentos tenta acessar funções administrativas
  // e recebe acesso negado.
  // ---------------------------------------------------------------------------
  it('Cenário H: Usuário de Pagamentos recebe 403 ACESSO_NEGADO ao tentar operações administrativas', async () => {
    // 1. Tentar criar processo
    const res1 = await request(app)
      .post('/api/processes')
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .send({ process_number: 'HACK-01', description: 'Teste' })
      .expect(403);
    expect(res1.body.error.code).toBe('ACESSO_NEGADO');

    // 2. Tentar criar usuário
    const res2 = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .send({ email: 'novo@teste.com', full_name: 'Novo', role: 'admin' })
      .expect(403);
    expect(res2.body.error.code).toBe('ACESSO_NEGADO');

    // 3. Tentar ver log de auditoria geral
    const res3 = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .expect(403);
    expect(res3.body.error.code).toBe('ACESSO_NEGADO');

    // 4. Tentar criar fornecedor
    const res4 = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .send({ name: 'Fornecedor Proibido' })
      .expect(403);
    expect(res4.body.error.code).toBe('ACESSO_NEGADO');
  });

  // ---------------------------------------------------------------------------
  // Cenário I: O sistema impede que um usuário registre um pagamento superior
  // ao saldo devedor.
  // ---------------------------------------------------------------------------
  it('Cenário I: Bloqueio estrito de pagamento superior ao saldo devedor (código PAGAMENTO_EXCEDE_SALDO)', async () => {
    // Cria processo, OF e NF de R$ 2.000,00
    const procRes = await request(app)
      .post('/api/processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ process_number: 'PROC-SALDO-2026', description: 'Teste de saldo' })
      .expect(201);

    const ofRes = await request(app)
      .post('/api/supply-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('process_id', procRes.body.id)
      .field('supplier_id', mzSupplierId)
      .field('of_number', 'OF-SALDO-01')
      .field('issue_date', '2026-11-01')
      .attach('file', Buffer.from('%PDF-1.4 OF'), 'OF.pdf')
      .expect(201);

    const nfRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supply_order_id', ofRes.body.id)
      .field('invoice_number', 'NF-EXCEDE-01')
      .field('issue_date', '2026-11-05')
      .field('amount', '2000.00')
      .field('modality', 'FUMIP')
      .field('forward', 'true')
      .attach('file', Buffer.from('%PDF-1.4 NF'), 'NF.pdf')
      .expect(201);
    const invoiceId = nfRes.body.id;

    // Tenta pagar R$ 2.000,01 (> 2000)
    const failRes = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .field('amount', '2000.01')
      .field('payment_date', '2026-11-06')
      .expect(422);

    expect(failRes.body.error.code).toBe('PAGAMENTO_EXCEDE_SALDO');

    // Paga R$ 1.500,00 com sucesso (saldo restante: R$ 500,00)
    await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .field('amount', '1500.00')
      .field('payment_date', '2026-11-06')
      .expect(201);

    // Tenta pagar R$ 500,01 (> 500)
    const failRes2 = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .field('amount', '500.01')
      .field('payment_date', '2026-11-06')
      .expect(422);

    expect(failRes2.body.error.code).toBe('PAGAMENTO_EXCEDE_SALDO');
  });

  // ---------------------------------------------------------------------------
  // Cenário J: Um pagamento corrigido ou cancelado mantém seu histórico de
  // auditoria.
  // ---------------------------------------------------------------------------
  it('Cenário J: Pagamento corrigido e cancelado mantém histórico de auditoria completo com justificativa', async () => {
    // Processo, OF e NF
    const procRes = await request(app)
      .post('/api/processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ process_number: 'PROC-AUDIT-2026', description: 'Teste de auditoria' })
      .expect(201);

    const ofRes = await request(app)
      .post('/api/supply-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('process_id', procRes.body.id)
      .field('supplier_id', mzSupplierId)
      .field('of_number', 'OF-AUDIT-01')
      .field('issue_date', '2026-11-01')
      .attach('file', Buffer.from('%PDF-1.4 OF'), 'OF.pdf')
      .expect(201);

    const nfRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supply_order_id', ofRes.body.id)
      .field('invoice_number', 'NF-AUDIT-01')
      .field('issue_date', '2026-11-05')
      .field('amount', '8000.00')
      .field('modality', 'FUMIP')
      .field('forward', 'true')
      .attach('file', Buffer.from('%PDF-1.4 NF'), 'NF.pdf')
      .expect(201);
    const invoiceId = nfRes.body.id;

    // 1. Pagamentos registra R$ 3.000,00
    const payRes = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .field('amount', '3000.00')
      .field('payment_date', '2026-11-06')
      .expect(201);
    const paymentId = payRes.body.payment.id;

    // 2. Pagamentos corrige o pagamento para R$ 2.500,00 com justificativa
    const editRes = await request(app)
      .patch(`/api/payments/${paymentId}`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .send({
        amount: 2500,
        reason: 'Digitado R$ 3.000,00 por engano; valor correto no extrato é R$ 2.500,00.',
      })
      .expect(200);

    expect(editRes.body.payment.amount).toBe(2500);
    expect(editRes.body.invoice.total_paid).toBe(2500);

    // 3. Pagamentos cancela o pagamento com justificativa
    const cancelRes = await request(app)
      .post(`/api/payments/${paymentId}/cancel`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .send({
        reason: 'TED devolvida pelo banco do fornecedor devido a dados bancários divergentes.',
      })
      .expect(200);

    expect(cancelRes.body.payment.status).toBe('CANCELADO');
    expect(cancelRes.body.invoice.total_paid).toBe(0);
    expect(cancelRes.body.invoice.balance).toBe(8000);
    expect(cancelRes.body.invoice.status).toBe('AGUARDANDO_PAGAMENTO');

    // 4. Administrador consulta os logs de auditoria desta NF
    const auditRes = await request(app)
      .get(`/api/audit?invoice_id=${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const actions = auditRes.body.data.map((a: any) => a.action);
    expect(actions).toContain('PAGAMENTO_REGISTRADO');
    expect(actions).toContain('PAGAMENTO_CORRIGIDO');
    expect(actions).toContain('PAGAMENTO_CANCELADO');

    const editLog = auditRes.body.data.find((a: any) => a.action === 'PAGAMENTO_CORRIGIDO');
    expect(editLog.reason).toContain('Digitado R$ 3.000,00 por engano');

    const cancelLog = auditRes.body.data.find((a: any) => a.action === 'PAGAMENTO_CANCELADO');
    expect(cancelLog.reason).toContain('TED devolvida pelo banco');
  });

  // ---------------------------------------------------------------------------
  // Cenário K: Suporte a Municípios consorciados (cadastro e filtragem de pendências)
  // ---------------------------------------------------------------------------
  it('Cenário K: Cadastra NF com município e filtra pendências por município', async () => {
    // 1. Verifica lista de municípios iniciais
    const munRes = await request(app)
      .get('/api/invoices/municipalities')
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .expect(200);

    expect(munRes.body.municipalities).toContain('Santana do Mundaú');
    expect(munRes.body.municipalities).toContain('Branquinha');
    expect(munRes.body.municipalities).toContain('União dos Palmares');
    expect(munRes.body.municipalities).toContain('Carneiros');

    // 2. Compras cadastra processo e OF
    const proc = await request(app)
      .post('/api/processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ process_number: 'PROC-MUN-2026', description: 'Processo com Município' })
      .expect(201);

    const ofRes = await request(app)
      .post('/api/supply-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('process_id', proc.body.id)
      .field('supplier_id', mzSupplierId)
      .field('of_number', 'OF-MUN-01')
      .field('issue_date', '2026-05-10')
      .attach('file', Buffer.from('%PDF-1.4 OF'), 'of-mun.pdf')
      .expect(201);

    // 3. Cadastra NF com o município 'Santana do Mundaú'
    const invRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supply_order_id', ofRes.body.id)
      .field('invoice_number', 'NF-MUN-100')
      .field('issue_date', '2026-05-12')
      .field('amount', '15000')
      .field('modality', 'FUMIP')
      .field('municipality', 'Santana do Mundaú')
      .field('forward', 'true')
      .attach('file', Buffer.from('%PDF-1.4 NF'), 'nf-mun.pdf')
      .expect(201);

    expect(invRes.body.municipality).toBe('Santana do Mundaú');

    // 4. Pagamentos filtra por município Santana do Mundaú
    const filterSantana = await request(app)
      .get('/api/invoices?municipality=Santana')
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .expect(200);

    const santanaInvoices = filterSantana.body.data.filter((i: any) => i.id === invRes.body.id);
    expect(santanaInvoices.length).toBe(1);
    expect(santanaInvoices[0].municipality).toBe('Santana do Mundaú');

    // 5. Pagamentos filtra por Carneiros -> não deve retornar a NF de Santana do Mundaú
    const filterCarneiros = await request(app)
      .get('/api/invoices?municipality=Carneiros')
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .expect(200);

    const carneirosInvoices = filterCarneiros.body.data.filter((i: any) => i.id === invRes.body.id);
    expect(carneirosInvoices.length).toBe(0);
  });

  it('Cenário L — Exclusão Administrativa de NF e OF anexadas por engano com auditoria', async () => {
    // 1. Cadastra processo e fornecedor
    const procRes = await request(app)
      .post('/api/processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        process_number: 'PROC-DEL-2026',
        year: 2026,
        description: 'Processo para teste de exclusão administrativa',
      })
      .expect(201);

    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Fornecedor Teste Delecao Ltda',
        cnpj: '11.222.333/0001-99',
      })
      .expect(201);

    // 2. Cadastra OF
    const ofRes = await request(app)
      .post('/api/supply-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('process_id', procRes.body.id)
      .field('supplier_id', supRes.body.id)
      .field('of_number', 'OF-MISTAKE-999')
      .field('issue_date', '2026-06-01')
      .attach('file', Buffer.from('%PDF-1.4 OF'), 'of-errada.pdf')
      .expect(201);

    // 3. Cadastra NF vinculada
    const nfRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supply_order_id', ofRes.body.id)
      .field('invoice_number', 'NF-MISTAKE-999')
      .field('issue_date', '2026-06-02')
      .field('amount', '5000')
      .field('modality', 'FUMIP')
      .attach('file', Buffer.from('%PDF-1.4 NF'), 'nf-errada.pdf')
      .expect(201);

    const invoiceId = nfRes.body.id;
    const supplyOrderId = ofRes.body.id;

    // 4. Operador de pagamentos tenta excluir a NF -> 403 Forbidden
    await request(app)
      .delete(`/api/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .send({ reason: 'Tentativa indevida' })
      .expect(403);

    // 5. Admin exclui a OF junto com a NF vinculada (exclusão de Ordem + Notas) com justificativa opcional
    const delOfRes = await request(app)
      .delete(`/api/supply-orders/${supplyOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'OF e NF geradas em duplicidade' })
      .expect(200);

    expect(delOfRes.body.success).toBe(true);

    // 6. Nem a NF nem a OF existem mais
    await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    await request(app)
      .get(`/api/supply-orders/${supplyOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    // 7. Verifica se os registros de auditoria foram gerados para a NF e para a OF
    const auditRes = await request(app)
      .get('/api/audit?action=NF_EXCLUIDA')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const nfAudit = auditRes.body.data.find((a: any) => a.action === 'NF_EXCLUIDA' && a.entity_id === invoiceId);
    expect(nfAudit).toBeDefined();
    expect(nfAudit.reason).toContain('duplicidade');

    const ofAuditRes = await request(app)
      .get('/api/audit?action=OF_EXCLUIDA')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const ofAudit = ofAuditRes.body.data.find((a: any) => a.action === 'OF_EXCLUIDA' && a.entity_id === supplyOrderId);
    expect(ofAudit).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Cenário L: Edição de dados de Ordens e Notas (apenas Admin) e busca por município
  // ---------------------------------------------------------------------------
  it('Cenário L: Edição de dados de OF e NF ativa apenas para Admin e busca por município', async () => {
    // 1. Cadastra Processo, Fornecedor e OF
    const proc = await request(app)
      .post('/api/processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ process_number: 'PROC-EDIT-2026/01', description: 'Processo para teste de edição' })
      .expect(201);

    const sup = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fornecedor Edicao Teste Ltda', cnpj: '22.333.444/0001-55' })
      .expect(201);

    const ofRes = await request(app)
      .post('/api/supply-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('process_id', proc.body.id)
      .field('supplier_id', sup.body.id)
      .field('of_number', 'OF-EDIT-001')
      .field('issue_date', '2026-07-01')
      .field('total_value', '10000')
      .attach('file', Buffer.from('%PDF-1.4 OF'), 'of.pdf')
      .expect(201);

    // 2. Cadastra NF com município e encaminha para pagamento
    const nfRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supply_order_id', ofRes.body.id)
      .field('invoice_number', 'NF-EDIT-901')
      .field('issue_date', '2026-07-05')
      .field('amount', '3500')
      .field('modality', 'COMPRA_COMPARTILHADA')
      .field('municipality', 'Branquinha')
      .field('forward', 'true')
      .attach('file', Buffer.from('%PDF-1.4 NF'), 'nf.pdf')
      .expect(201);

    const ofId = ofRes.body.id;
    const nfId = nfRes.body.id;

    // 3. Usuário de Pagamentos tenta editar dados da OF -> 403 Forbidden
    await request(app)
      .patch(`/api/supply-orders/${ofId}`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .send({ of_number: 'OF-HACKED' })
      .expect(403);

    // 4. Usuário de Pagamentos tenta editar dados da NF -> 403 Forbidden
    await request(app)
      .patch(`/api/invoices/${nfId}`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .send({ invoice_number: 'NF-HACKED' })
      .expect(403);

    // 5. Admin edita dados da OF com sucesso
    const editOfRes = await request(app)
      .patch(`/api/supply-orders/${ofId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        of_number: 'OF-EDIT-001-REV',
        total_value: 12000,
        notes: 'Observação atualizada',
      })
      .expect(200);

    expect(editOfRes.body.of_number).toBe('OF-EDIT-001-REV');
    expect(editOfRes.body.total_value).toBe(12000);

    // 6. Admin edita dados da NF com sucesso (incluindo município e valor)
    const editNfRes = await request(app)
      .patch(`/api/invoices/${nfId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoice_number: 'NF-EDIT-901-REV',
        amount: 4000,
        municipality: 'União dos Palmares',
        reason: 'Ajuste de município e valor homologado',
      })
      .expect(200);

    expect(editNfRes.body.invoice_number).toBe('NF-EDIT-901-REV');
    expect(editNfRes.body.amount).toBe(4000);

    // 7. Busca demandas por município via query e via search
    const filterRes = await request(app)
      .get('/api/invoices?municipality=Palmares')
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .expect(200);

    expect(filterRes.body.data.some((inv: any) => inv.id === nfId)).toBe(true);

    const searchRes = await request(app)
      .get('/api/invoices?search=Palmares')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(searchRes.body.data.some((inv: any) => inv.id === nfId)).toBe(true);

    // 8. Busca de OF por município
    const ofMunRes = await request(app)
      .get('/api/supply-orders?municipality=Palmares')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(ofMunRes.body.some((o: any) => o.id === ofId)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Cenário M: Mecanismo de redefinição de senha com autorização do Administrador
  // (para e-mails institucionais fictícios usados como login)
  // ---------------------------------------------------------------------------
  it('Cenário M: Gerente de Pagamentos solicita nova senha e Administrador autoriza no painel', async () => {
    // 1. Solicitação de redefinição enviada pelo login institucional de pagamentos
    const reqRes = await request(app)
      .post('/api/auth/request-password-reset')
      .send({
        email: 'pagamentos@cozam.al.gov.br',
        proposed_password: 'NovaSenhaPag@2026',
        reason: 'Esqueci a senha após o recesso - João Paulo',
      })
      .expect(201);

    expect(reqRes.body.success).toBe(true);

    // 2. Consulta pública do status da solicitação pelo e-mail
    const statusRes = await request(app)
      .get('/api/auth/password-reset-status?email=pagamentos@cozam.al.gov.br')
      .expect(200);

    expect(statusRes.body.request).toBeDefined();
    expect(statusRes.body.request.status).toBe('PENDENTE');
    expect(statusRes.body.request.request_reason).toContain('João Paulo');

    // 3. Admin recebe notificação com contagem pendente
    const countRes = await request(app)
      .get('/api/password-reset-requests/pending-count')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(countRes.body.pendingCount).toBeGreaterThanOrEqual(1);

    // 4. Admin lista as solicitações
    const listRes = await request(app)
      .get('/api/password-reset-requests?status=PENDENTE')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const pendingItem = listRes.body.find((r: any) => r.email === 'pagamentos@cozam.al.gov.br');
    expect(pendingItem).toBeDefined();

    // 5. Usuário não-admin tenta autorizar -> 403 Forbidden
    await request(app)
      .post(`/api/password-reset-requests/${pendingItem.id}/approve`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .send({})
      .expect(403);

    // 6. Admin autoriza a mudança de senha
    const approveRes = await request(app)
      .post(`/api/password-reset-requests/${pendingItem.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ admin_notes: 'Autorizado conforme solicitação do setor de pagamentos' })
      .expect(200);

    expect(approveRes.body.success).toBe(true);

    // 7. Status atualizado para APROVADA
    const checkApproved = await request(app)
      .get('/api/auth/password-reset-status?email=pagamentos@cozam.al.gov.br')
      .expect(200);

    expect(checkApproved.body.request.status).toBe('APROVADA');

    // 8. Registro de auditoria gravado
    const auditRes = await request(app)
      .get('/api/audit?action=SENHA_REDEFINIDA_ADMIN')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(auditRes.body.data.some((a: any) => a.action === 'SENHA_REDEFINIDA_ADMIN')).toBe(true);

    // 9. Admin também pode redefinir senha diretamente de qualquer usuário
    const directSetRes = await request(app)
      .post('/api/users/00000000-0000-0000-0000-000000000002/set-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'SenhaDiretaAdmin@2026', reason: 'Redefinição direta presencial' })
      .expect(200);

    expect(directSetRes.body.success).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Cenário N: Município na OF, fornecedor Simples Nacional e Retenção Tributária (IRRF 1,2%)
  // ---------------------------------------------------------------------------
  it('Cenário N: Suporte a Município na OF, fornecedor Simples Nacional e Retenção de 1,2% (IRRF)', async () => {
    // 1. Cadastra Processo e Fornecedor optante pelo Simples Nacional
    const proc = await request(app)
      .post('/api/processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ process_number: 'PROC-TRIBUTOS-2026', description: 'Processo com tributos e OF municipal' })
      .expect(201);

    const supSimples = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Fornecedor Simples Ltda',
        cnpj: '11.222.333/0001-44',
        is_simples_nacional: true,
      })
      .expect(201);

    expect(supSimples.body.is_simples_nacional).toBe(true);

    const supNormal = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Fornecedor Lucro Presumido SA',
        cnpj: '99.888.777/0001-66',
        is_simples_nacional: false,
      })
      .expect(201);

    expect(supNormal.body.is_simples_nacional).toBe(false);

    // 2. Cadastra OF informando o município consorciado com PDF anexado
    const ofRes = await request(app)
      .post('/api/supply-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('process_id', proc.body.id)
      .field('supplier_id', supNormal.body.id)
      .field('of_number', 'OF-MUN-001/2026')
      .field('issue_date', '2026-11-11')
      .field('total_value', '50000.00')
      .field('municipality', 'Branquinha')
      .attach('file', Buffer.from('%PDF-1.4 OF'), 'OF-MUN-001.pdf')
      .expect(201);

    expect(ofRes.body.municipality).toBe('Branquinha');

    // 3. Cadastra NF de R$ 50.000,00 e encaminha para Pagamentos
    const nfRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supply_order_id', ofRes.body.id)
      .field('invoice_number', 'NF-TRIB-50000')
      .field('issue_date', '2026-11-11')
      .field('amount', '50000.00')
      .field('modality', 'FUMIP')
      .field('municipality', 'Branquinha')
      .field('forward', 'true')
      .attach('file', Buffer.from('%PDF-1.4 NF'), 'nf-trib.pdf')
      .expect(201);

    // 4. Primeiro pagamento PARCIAL: R$ 25.000,00 COM retenção de IRRF (1,2%)
    // Alíquota 1,2% -> R$ 300,00 de imposto retido e R$ 24.700,00 líquido
    const pay1 = await request(app)
      .post(`/api/invoices/${nfRes.body.id}/payments`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .send({
        amount: 25000.0,
        payment_date: '2026-11-11',
        is_tax_exempt: false,
        tax_rate: 0.012,
      })
      .expect(201);

    expect(Number(pay1.body.payment.amount)).toBe(25000);
    expect(Number(pay1.body.payment.gross_amount)).toBe(25000);
    expect(Number(pay1.body.payment.tax_rate)).toBe(0.012);
    expect(Number(pay1.body.payment.tax_amount)).toBe(300);
    expect(Number(pay1.body.payment.net_amount)).toBe(24700);
    expect(pay1.body.payment.is_tax_exempt).toBe(false);
    expect(Number(pay1.body.invoice.balance)).toBe(25000);

    // 5. Segundo pagamento (quitação restante): R$ 25.000,00 COM isenção tributária (checkbox marcada)
    // Alíquota 0% -> R$ 0,00 de imposto retido e R$ 25.000,00 líquido
    const pay2 = await request(app)
      .post(`/api/invoices/${nfRes.body.id}/payments`)
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .send({
        amount: 25000.0,
        payment_date: '2026-11-12',
        is_tax_exempt: true,
      })
      .expect(201);

    expect(Number(pay2.body.payment.amount)).toBe(25000);
    expect(Number(pay2.body.payment.tax_amount)).toBe(0);
    expect(Number(pay2.body.payment.net_amount)).toBe(25000);
    expect(pay2.body.payment.is_tax_exempt).toBe(true);
    expect(Number(pay2.body.invoice.balance)).toBe(0);
    expect(pay2.body.invoice.status).toBe('TOTALMENTE_PAGA');

    // 6. Relatório de pagamentos por período deve conter colunas de município e valores fiscais
    const repRes = await request(app)
      .get('/api/reports/pagamentos_periodo')
      .set('Authorization', `Bearer ${pagamentosToken}`)
      .expect(200);

    const repRow = repRes.body.rows.find((r: any) => r.invoice_number === 'NF-TRIB-50000');
    expect(repRow).toBeDefined();
    expect(repRow.municipality).toBe('Branquinha');
    expect(repRes.body.columns.some((c: any) => c.key === 'tax_amount')).toBe(true);
    expect(repRes.body.columns.some((c: any) => c.key === 'net_amount')).toBe(true);
  });

  it('Cenário O: Gestão de Contratos — Cadastro de processo licitatório, contrato com itens, saldo inicial e aditivo de prazo', async () => {
    // 1. Cadastra processo licitatório
    const procRes = await request(app)
      .post('/api/procurement-processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        process_number: 'PROC-LIC-002/2026',
        year: 2026,
        bidding_number: 'Pregão Eletrônico 002/2026',
        modality: 'PREGAO_ELETRONICO',
        legal_framework: 'Lei 14.133/2021',
        object: 'Contratação para aquisição de material elétrico, EPIs e suprimentos',
        opening_date: '2026-03-10',
        homologation_date: '2026-04-01',
      })
      .expect(201);

    expect(procRes.body.bidding_number).toBe('Pregão Eletrônico 002/2026');

    // 2. Cadastra contrato vinculado ao processo e fornecedor MZ Bernardi
    const contractRes = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contract_number: '012/2026',
        year: 2026,
        procurement_id: procRes.body.id,
        supplier_id: mzSupplierId,
        object: 'Contratação para fornecimento de café e materiais de consumo',
        legal_framework: 'Lei 14.133/2021',
        signing_date: '2026-04-16',
        start_date: '2026-04-16',
        end_date: '2027-04-16',
        delivery_deadline_days: 15,
        total_amount: 2000.0,
        status: 'ATIVO',
        items: [
          {
            item_code: '1-1',
            item_group: 'Lote 1',
            description: 'Café em pó tradicional 250g',
            category: 'AGUA_CAFE',
            unit: 'Unidade',
            original_quantity: 100,
            unit_price: 20.0,
            total_price: 2000.0,
          },
        ],
      })
      .expect(201);

    const contractId = contractRes.body.id;
    expect(contractRes.body.contract_number).toBe('012/2026');
    expect(Number(contractRes.body.total_amount)).toBe(2000);

    // 3. Consulta detalhes do contrato com itens e saldos
    const detailRes = await request(app)
      .get(`/api/contracts/${contractId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(detailRes.body.contract.total_amount).toBe(2000);
    expect(detailRes.body.contract.requested_amount).toBe(0);
    expect(detailRes.body.contract.remaining_amount).toBe(2000);
    expect(detailRes.body.items).toHaveLength(1);
    expect(detailRes.body.items[0].original_quantity).toBe(100);
    expect(detailRes.body.items[0].available_quantity).toBe(100);

    // 4. Registra Termo Aditivo de prorrogação de vigência
    const amendRes = await request(app)
      .post(`/api/contracts/${contractId}/amendments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amendment_number: '1º Termo Aditivo',
        amendment_type: 'PRAZO',
        signing_date: '2027-03-01',
        new_end_date: '2027-10-16',
        justification: 'Prorrogação de vigência em conformidade com o art. 107 da Lei 14.133/2021',
      })
      .expect(201);

    expect(amendRes.body.amendment_number).toBe('1º Termo Aditivo');

    // 5. Verifica que vigência foi atualizada
    const updatedRes = await request(app)
      .get(`/api/contracts/${contractId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(updatedRes.body.contract.end_date).toContain('2027-10-16');
    expect(updatedRes.body.amendments).toHaveLength(1);
  });
});
