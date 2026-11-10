import { getPool } from '../db/pool.js';
import { runMigrations } from '../db/migrate.js';
import { uploadDocument } from '../services/storage.js';

export async function seedDemoData() {
  console.log('[COZAM SEED] Iniciando carga de dados fictícios para homologação...');

  const pool = getPool();
  await runMigrations(pool);
  const client = await pool.connect();

  try {
    const adminId = '00000000-0000-0000-0000-000000000001';
    const pagamentosId = '00000000-0000-0000-0000-000000000002';

    // 1. Obter os fornecedores padrão
    const mzRes = await client.query(`select id from public.suppliers where name = 'MZ Bernardi' limit 1`);
    const nacRes = await client.query(`select id from public.suppliers where name = 'Nacional' limit 1`);

    if (mzRes.rowCount === 0 || nacRes.rowCount === 0) {
      throw new Error('Fornecedores MZ Bernardi ou Nacional não encontrados no banco.');
    }

    const mzId = mzRes.rows[0].id;
    const nacId = nacRes.rows[0].id;

    // Buffer de documento PDF sintético válido
    const createSamplePdf = (title: string): Buffer => {
      return Buffer.from(
        `%PDF-1.4\n1 0 obj\n<< /Title (${title}) /Author (COZAM Consorcio) >>\nendobj\n2 0 obj\n<< /Type /Catalog /Pages 3 0 R >>\nendobj\n3 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000078 00000 n \n0000000133 00000 n \ntrailer\n<< /Size 4 /Root 2 0 R >>\nstartxref\n188\n%%EOF`
      );
    };

    // 2. Verifica se a carga já foi realizada
    const existing = await client.query(
      `select 1 from public.administrative_processes where process_number = '001/2026'`
    );
    if (existing.rowCount && existing.rowCount > 0) {
      console.log('[COZAM SEED] Dados de demonstração já presentes no banco de dados. Carga concluída.');
      return;
    }

    await client.exec('begin');
    await client.query(`set local "app.actor_id" = '${adminId}'`);
    await client.query(`set local "app.reason" = 'Carga inicial de dados de demonstração'`);

    // -------------------------------------------------------------------------
    // PROCESSO 1: Insumos Hospitalares (MZ Bernardi)
    // -------------------------------------------------------------------------
    const p1 = await client.query(
      `insert into public.administrative_processes (process_number, description, created_by)
       values ('001/2026', 'Aquisição emergencial de medicamentos e insumos hospitalares para atendimento dos municípios consorciados', $1)
       returning id`,
      [adminId]
    );
    const p1Id = p1.rows[0].id;

    // OF 2026/001 (R$ 250.000,00)
    const of1Doc = await uploadDocument(createSamplePdf('OF-2026-001'), 'OF', 'OF-2026-001.pdf', 'application/pdf');
    const of1 = await client.query(
      `insert into public.supply_orders (process_id, supplier_id, of_number, issue_date, total_value, created_by)
       values ($1, $2, '2026/001', '2026-02-01', 250000.00, $3)
       returning id`,
      [p1Id, mzId, adminId]
    );
    const of1Id = of1.rows[0].id;

    await client.query(
      `insert into public.documents (supply_order_id, kind, file_name, size_bytes, mime_type, storage_path, sha256, is_current, version, uploaded_by)
       values ($1, 'OF', 'OF-2026-001.pdf', $2, 'application/pdf', $3, $4, true, 1, $5)`,
      [of1Id, of1Doc.sizeBytes, of1Doc.storagePath, of1Doc.sha256, adminId]
    );

    // NF 10450 (R$ 120.000,00 | FUMIP | Parcialmente Paga)
    const nf1Doc = await uploadDocument(createSamplePdf('NF-10450'), 'NF', 'NF-10450.pdf', 'application/pdf');
    const nf1 = await client.query(
      `insert into public.invoices (invoice_number, supplier_id, process_id, supply_order_id, issue_date, amount, modality, notes, forward_status, created_by)
       values ('10450', $1, $2, $3, '2026-02-05', 120000.00, 'FUMIP', 'Remessa prioritária de antibióticos e analgésicos.', 'RASCUNHO', $4)
       returning id`,
      [mzId, p1Id, of1Id, adminId]
    );
    const nf1Id = nf1.rows[0].id;

    await client.query(
      `insert into public.documents (invoice_id, kind, file_name, size_bytes, mime_type, storage_path, sha256, is_current, version, uploaded_by)
       values ($1, 'NF', 'NF-10450.pdf', $2, 'application/pdf', $3, $4, true, 1, $5)`,
      [nf1Id, nf1Doc.sizeBytes, nf1Doc.storagePath, nf1Doc.sha256, adminId]
    );

    // Encaminha para Pagamentos
    await client.query(
      `update public.invoices
          set forward_status = 'ENCAMINHADA',
              forwarded_at = '2026-02-06 09:30:00+00',
              forwarded_by = $2
        where id = $1`,
      [nf1Id, adminId]
    );

    // Pagamento parcial de R$ 70.000,00 na NF 10450
    const rec1Doc = await uploadDocument(createSamplePdf('Comprovante-001'), 'COMPROVANTE', 'Comprovante-TED-70k.pdf', 'application/pdf');
    const pay1 = await client.query(
      `insert into public.payments (invoice_id, payment_date, amount, notes, created_by)
       values ($1, '2026-02-12', 70000.00, '1ª parcela paga via TED Bancária', $2)
       returning id`,
      [nf1Id, pagamentosId]
    );
    await client.query(
      `insert into public.documents (payment_id, kind, file_name, size_bytes, mime_type, storage_path, sha256, is_current, version, uploaded_by)
       values ($1, 'COMPROVANTE', 'Comprovante-TED-70k.pdf', $2, 'application/pdf', $3, $4, true, 1, $5)`,
      [pay1.rows[0].id, rec1Doc.sizeBytes, rec1Doc.storagePath, rec1Doc.sha256, pagamentosId]
    );

    // NF 10451 (R$ 80.000,00 | COMPRA COMPARTILHADA | Totalmente Paga)
    const nf2Doc = await uploadDocument(createSamplePdf('NF-10451'), 'NF', 'NF-10451.pdf', 'application/pdf');
    const nf2 = await client.query(
      `insert into public.invoices (invoice_number, supplier_id, process_id, supply_order_id, issue_date, amount, modality, notes, forward_status, created_by)
       values ('10451', $1, $2, $3, '2026-02-08', 80000.00, 'COMPRA_COMPARTILHADA', 'Fornecimento compartilhado para 4 unidades básicas.', 'RASCUNHO', $4)
       returning id`,
      [mzId, p1Id, of1Id, adminId]
    );
    const nf2Id = nf2.rows[0].id;

    await client.query(
      `insert into public.documents (invoice_id, kind, file_name, size_bytes, mime_type, storage_path, sha256, is_current, version, uploaded_by)
       values ($1, 'NF', 'NF-10451.pdf', $2, 'application/pdf', $3, $4, true, 1, $5)`,
      [nf2Id, nf2Doc.sizeBytes, nf2Doc.storagePath, nf2Doc.sha256, adminId]
    );

    await client.query(
      `update public.invoices
          set forward_status = 'ENCAMINHADA',
              forwarded_at = '2026-02-09 14:15:00+00',
              forwarded_by = $2
        where id = $1`,
      [nf2Id, adminId]
    );

    // Pagamento 1: R$ 40.000,00 e Pagamento 2: R$ 40.000,00
    await client.query(
      `insert into public.payments (invoice_id, payment_date, amount, notes, created_by)
       values ($1, '2026-02-15', 40000.00, 'Pagamento 1/2', $2)`,
      [nf2Id, pagamentosId]
    );
    await client.query(
      `insert into public.payments (invoice_id, payment_date, amount, notes, created_by)
       values ($1, '2026-02-20', 40000.00, 'Quitação final 2/2', $2)`,
      [nf2Id, pagamentosId]
    );

    // NF 10452 (R$ 50.000,00 | FUMIP | Aguardando Pagamento com Comentário de Entrega Parcial)
    const nf3Doc = await uploadDocument(createSamplePdf('NF-10452'), 'NF', 'NF-10452.pdf', 'application/pdf');
    const nf3 = await client.query(
      `insert into public.invoices (invoice_number, supplier_id, process_id, supply_order_id, issue_date, amount, modality, notes, forward_status, created_by)
       values ('10452', $1, $2, $3, '2026-02-24', 50000.00, 'FUMIP', 'Nota emitida parcialmente. Faltam R$ 15.000,00 para completar a remessa prevista para a próxima semana.', 'RASCUNHO', $4)
       returning id`,
      [mzId, p1Id, of1Id, adminId]
    );
    const nf3Id = nf3.rows[0].id;

    await client.query(
      `insert into public.documents (invoice_id, kind, file_name, size_bytes, mime_type, storage_path, sha256, is_current, version, uploaded_by)
       values ($1, 'NF', 'NF-10452.pdf', $2, 'application/pdf', $3, $4, true, 1, $5)`,
      [nf3Id, nf3Doc.sizeBytes, nf3Doc.storagePath, nf3Doc.sha256, adminId]
    );

    await client.query(
      `update public.invoices
          set forward_status = 'ENCAMINHADA',
              forwarded_at = '2026-02-25 11:00:00+00',
              forwarded_by = $2
        where id = $1`,
      [nf3Id, adminId]
    );

    // -------------------------------------------------------------------------
    // PROCESSO 2: Material de Consumo e Expediente (Nacional)
    // -------------------------------------------------------------------------
    const p2 = await client.query(
      `insert into public.administrative_processes (process_number, description, created_by)
       values ('002/2026', 'Fornecimento continuado de material de expediente, papelaria e informática para a sede do COZAM', $1)
       returning id`,
      [adminId]
    );
    const p2Id = p2.rows[0].id;

    const of2Doc = await uploadDocument(createSamplePdf('OF-2026-002'), 'OF', 'OF-2026-002.pdf', 'application/pdf');
    const of2 = await client.query(
      `insert into public.supply_orders (process_id, supplier_id, of_number, issue_date, total_value, created_by)
       values ($1, $2, '2026/002', '2026-02-10', 48000.00, $3)
       returning id`,
      [p2Id, nacId, adminId]
    );
    const of2Id = of2.rows[0].id;

    await client.query(
      `insert into public.documents (supply_order_id, kind, file_name, size_bytes, mime_type, storage_path, sha256, is_current, version, uploaded_by)
       values ($1, 'OF', 'OF-2026-002.pdf', $2, 'application/pdf', $3, $4, true, 1, $5)`,
      [of2Id, of2Doc.sizeBytes, of2Doc.storagePath, of2Doc.sha256, adminId]
    );

    // NF 30120 (R$ 32.500,00 | COMPRA COMPARTILHADA | Parcialmente Paga)
    const nf4Doc = await uploadDocument(createSamplePdf('NF-30120'), 'NF', 'NF-30120.pdf', 'application/pdf');
    const nf4 = await client.query(
      `insert into public.invoices (invoice_number, supplier_id, process_id, supply_order_id, issue_date, amount, modality, notes, forward_status, created_by)
       values ('30120', $1, $2, $3, '2026-02-18', 32500.00, 'COMPRA_COMPARTILHADA', 'Papéis A4 e toners para secretarias dos municípios consorciados.', 'RASCUNHO', $4)
       returning id`,
      [nacId, p2Id, of2Id, adminId]
    );
    const nf4Id = nf4.rows[0].id;

    await client.query(
      `insert into public.documents (invoice_id, kind, file_name, size_bytes, mime_type, storage_path, sha256, is_current, version, uploaded_by)
       values ($1, 'NF', 'NF-30120.pdf', $2, 'application/pdf', $3, $4, true, 1, $5)`,
      [nf4Id, nf4Doc.sizeBytes, nf4Doc.storagePath, nf4Doc.sha256, adminId]
    );

    await client.query(
      `update public.invoices
          set forward_status = 'ENCAMINHADA',
              forwarded_at = '2026-02-19 16:00:00+00',
              forwarded_by = $2
        where id = $1`,
      [nf4Id, adminId]
    );

    await client.query(
      `insert into public.payments (invoice_id, payment_date, amount, notes, created_by)
       values ($1, '2026-02-25', 15000.00, '1º Pagamento parcial', $2)`,
      [nf4Id, pagamentosId]
    );

    // NF 30121 (R$ 15.500,00 | RASCUNHO em Compras - não encaminhada)
    const nf5Doc = await uploadDocument(createSamplePdf('NF-30121'), 'NF', 'NF-30121.pdf', 'application/pdf');
    const nf5 = await client.query(
      `insert into public.invoices (invoice_number, supplier_id, process_id, supply_order_id, issue_date, amount, modality, notes, forward_status, created_by)
       values ('30121', $1, $2, $3, '2026-03-01', 15500.00, 'FUMIP', 'Em conferência pelo setor de Compras.', 'RASCUNHO', $4)
       returning id`,
      [nacId, p2Id, of2Id, adminId]
    );
    await client.query(
      `insert into public.documents (invoice_id, kind, file_name, size_bytes, mime_type, storage_path, sha256, is_current, version, uploaded_by)
       values ($1, 'NF', 'NF-30121.pdf', $2, 'application/pdf', $3, $4, true, 1, $5)`,
      [nf5.rows[0].id, nf5Doc.sizeBytes, nf5Doc.storagePath, nf5Doc.sha256, adminId]
    );

    // -------------------------------------------------------------------------
    // PROCESSO 3: EPIs e Uniformes (Múltiplos Fornecedores: MZ e Nacional)
    // -------------------------------------------------------------------------
    const p3 = await client.query(
      `insert into public.administrative_processes (process_number, description, created_by)
       values ('003/2026', 'Aquisição de Equipamentos de Proteção Individual (EPIs) para agentes de vigilância sanitária', $1)
       returning id`,
      [adminId]
    );
    const p3Id = p3.rows[0].id;

    // OF MZ Bernardi (R$ 75.000,00)
    const of3Doc = await uploadDocument(createSamplePdf('OF-2026-003'), 'OF', 'OF-2026-003.pdf', 'application/pdf');
    const of3 = await client.query(
      `insert into public.supply_orders (process_id, supplier_id, of_number, issue_date, total_value, created_by)
       values ($1, $2, '2026/003', '2026-02-15', 75000.00, $3)
       returning id`,
      [p3Id, mzId, adminId]
    );
    const of3Id = of3.rows[0].id;
    await client.query(
      `insert into public.documents (supply_order_id, kind, file_name, size_bytes, mime_type, storage_path, sha256, is_current, version, uploaded_by)
       values ($1, 'OF', 'OF-2026-003.pdf', $2, 'application/pdf', $3, $4, true, 1, $5)`,
      [of3Id, of3Doc.sizeBytes, of3Doc.storagePath, of3Doc.sha256, adminId]
    );

    const nf6Doc = await uploadDocument(createSamplePdf('NF-10488'), 'NF', 'NF-10488.pdf', 'application/pdf');
    const nf6 = await client.query(
      `insert into public.invoices (invoice_number, supplier_id, process_id, supply_order_id, issue_date, amount, modality, notes, forward_status, created_by)
       values ('10488', $1, $2, $3, '2026-02-22', 75000.00, 'FUMIP', 'Máscaras N95, luvas descartáveis e protetores faciais.', 'RASCUNHO', $4)
       returning id`,
      [mzId, p3Id, of3Id, adminId]
    );
    await client.query(
      `insert into public.documents (invoice_id, kind, file_name, size_bytes, mime_type, storage_path, sha256, is_current, version, uploaded_by)
       values ($1, 'NF', 'NF-10488.pdf', $2, 'application/pdf', $3, $4, true, 1, $5)`,
      [nf6.rows[0].id, nf6Doc.sizeBytes, nf6Doc.storagePath, nf6Doc.sha256, adminId]
    );
    await client.query(
      `update public.invoices
          set forward_status = 'ENCAMINHADA',
              forwarded_at = '2026-02-23 10:00:00+00',
              forwarded_by = $2
        where id = $1`,
      [nf6.rows[0].id, adminId]
    );

    // OF Nacional (R$ 22.000,00)
    const of4Doc = await uploadDocument(createSamplePdf('OF-2026-004'), 'OF', 'OF-2026-004.pdf', 'application/pdf');
    const of4 = await client.query(
      `insert into public.supply_orders (process_id, supplier_id, of_number, issue_date, total_value, created_by)
       values ($1, $2, '2026/004', '2026-02-16', 22000.00, $3)
       returning id`,
      [p3Id, nacId, adminId]
    );
    const of4Id = of4.rows[0].id;
    await client.query(
      `insert into public.documents (supply_order_id, kind, file_name, size_bytes, mime_type, storage_path, sha256, is_current, version, uploaded_by)
       values ($1, 'OF', 'OF-2026-004.pdf', $2, 'application/pdf', $3, $4, true, 1, $5)`,
      [of4Id, of4Doc.sizeBytes, of4Doc.storagePath, of4Doc.sha256, adminId]
    );

    const nf7Doc = await uploadDocument(createSamplePdf('NF-30190'), 'NF', 'NF-30190.pdf', 'application/pdf');
    const nf7 = await client.query(
      `insert into public.invoices (invoice_number, supplier_id, process_id, supply_order_id, issue_date, amount, modality, notes, forward_status, created_by)
       values ('30190', $1, $2, $3, '2026-02-25', 22000.00, 'COMPRA_COMPARTILHADA', 'Botas de segurança e coletes reflexivos.', 'RASCUNHO', $4)
       returning id`,
      [nacId, p3Id, of4Id, adminId]
    );
    await client.query(
      `insert into public.documents (invoice_id, kind, file_name, size_bytes, mime_type, storage_path, sha256, is_current, version, uploaded_by)
       values ($1, 'NF', 'NF-30190.pdf', $2, 'application/pdf', $3, $4, true, 1, $5)`,
      [nf7.rows[0].id, nf7Doc.sizeBytes, nf7Doc.storagePath, nf7Doc.sha256, adminId]
    );
    await client.query(
      `update public.invoices
          set forward_status = 'ENCAMINHADA',
              forwarded_at = '2026-02-26 15:00:00+00',
              forwarded_by = $2
        where id = $1`,
      [nf7.rows[0].id, adminId]
    );
    await client.query(
      `insert into public.payments (invoice_id, payment_date, amount, notes, created_by)
       values ($1, '2026-02-28', 22000.00, 'Pagamento integral', $2)`,
      [nf7.rows[0].id, pagamentosId]
    );

    // -------------------------------------------------------------------------
    // 4. NOTA HISTÓRICA NÃO VERIFICADA (Cenário G / Pendências Históricas)
    // -------------------------------------------------------------------------
    const pHist = await client.query(
      `insert into public.administrative_processes (process_number, description, created_by)
       values ('HIST/2025', 'Regularização de fornecimento do exercício fiscal de 2025', $1)
       returning id`,
      [adminId]
    );
    const pHistId = pHist.rows[0].id;

    const nfHistDoc = await uploadDocument(createSamplePdf('NF-HIST-9015'), 'NF', 'NF-9015-digitalizada.pdf', 'application/pdf');
    const nfHist = await client.query(
      `insert into public.invoices (
         invoice_number, supplier_id, process_id, issue_date, amount, modality, notes,
         is_historical, verified, forward_status, forwarded_at, forwarded_by, created_by
       )
       values (
         '9015', $1, $2, '2025-11-20', 38000.00, 'FUMIP',
         'Nota cadastrada como pendência histórica sem Ordem de Fornecimento prévia. Aguardando termo de ateste.',
         true, false, 'ENCAMINHADA', now(), $3, $3
       )
       returning id`,
      [mzId, pHistId, adminId]
    );
    const nfHistId = nfHist.rows[0].id;

    await client.query(
      `insert into public.historical_statuses (invoice_id, reported_status, informed_by, notes, created_by)
       values ($1, 'PENDENTE', 'Levantamento de arquivos físicos 2025', 'Aguardando termo de ateste da comissão fiscal', $2)`,
      [nfHistId, adminId]
    );

    await client.query(
      `insert into public.documents (invoice_id, kind, file_name, size_bytes, mime_type, storage_path, sha256, is_current, version, uploaded_by)
       values ($1, 'NF', 'NF-9015-digitalizada.pdf', $2, 'application/pdf', $3, $4, true, 1, $5)`,
      [nfHistId, nfHistDoc.sizeBytes, nfHistDoc.storagePath, nfHistDoc.sha256, adminId]
    );

    await client.exec('commit');
    console.log('[COZAM SEED] Carga de dados concluída com sucesso!');
    console.log('  - 3 Processos Administrativos regulares + 1 Histórico');
    console.log('  - 4 Ordens de Fornecimento com PDFs originais');
    console.log('  - 7 Notas Fiscais (FUMIP e COMPRA COMPARTILHADA, parciais e totais)');
    console.log('  - 1 Nota Histórica Não Verificada (fila de pendências)');
    console.log('  - 5 Pagamentos com comprovantes bancários');
  } catch (err) {
    await client.exec('rollback');
    console.error('[COZAM SEED] Falha na carga:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Execução direta via CLI
if (process.argv[1]?.endsWith('seed-demo.ts') || process.argv[1]?.endsWith('seed-demo.js')) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
