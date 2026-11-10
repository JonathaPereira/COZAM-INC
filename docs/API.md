# Contrato da API — COZAM Compras e Pagamentos

Base: `/api`. Todas as rotas (exceto `/api/config` e `/api/health`) exigem
`Authorization: Bearer <access_token do Supabase Auth>`.

Tipos de resposta: ver [`shared/src/types.ts`](../shared/src/types.ts).
Valores monetários: `number` com 2 casas (ex.: `15000.5`). Datas: `"AAAA-MM-DD"`.

## Erros

```json
{ "error": { "code": "PAGAMENTO_EXCEDE_SALDO", "message": "Mensagem amigável em português", "details": {} } }
```

| HTTP | Quando |
|------|--------|
| 400 | `VALIDACAO` — campos inválidos (`details.fields` = `{campo: mensagem}`) |
| 401 | `NAO_AUTENTICADO` — token ausente/expirado |
| 403 | `ACESSO_NEGADO` — função sem permissão / usuário inativo |
| 404 | `NAO_ENCONTRADO` |
| 409 | `DUPLICADO` (ex.: NF com mesmo número para o mesmo fornecedor; `details.existing` traz a NF) |
| 422 | Regra de negócio (código = HINT do banco, ex.: `PAGAMENTO_EXCEDE_SALDO`, `NF_SEM_PDF`, `OF_SEM_PDF`, `FORNECEDOR_DIVERGENTE_OF`, `JUSTIFICATIVA_OBRIGATORIA`, `NF_COM_PAGAMENTOS`, `NF_NAO_VERIFICADA`, `NF_NAO_ENCAMINHADA`) |

## Público

| Método | Rota | Resposta |
|---|---|---|
| GET | `/config` | `{ supabaseUrl, supabaseAnonKey, appName, environment }` |
| GET | `/health` | `{ ok: true }` |

## Sessão

| GET | `/me` | `MeResponse` |

## Fornecedores

| Método | Rota | Permissão | Corpo / Resposta |
|---|---|---|---|
| GET | `/suppliers?all=1` | autenticado | `Supplier[]` ordenado por `display_order` (MZ Bernardi primeiro). Sem `all`, só ativos |
| POST | `/suppliers` | `suppliers.manage` | `{ name, legal_name?, cnpj?, display_order? }` → `Supplier` |
| PATCH | `/suppliers/:id` | `suppliers.manage` | `{ name?, legal_name?, cnpj?, display_order?, active? }` → `Supplier` |

## Processos administrativos

| Método | Rota | Permissão | Corpo / Resposta |
|---|---|---|---|
| GET | `/processes?search=&status=&supplier_id=&date_from=&date_to=&page=1&pageSize=20` | `processes.view` | `Paginated<ProcessRow>` |
| GET | `/processes/:id` | `processes.view` | `{ process: ProcessRow, supply_orders: SupplyOrderRow[], invoices: InvoiceRow[], audit: AuditLogRow[] }` |
| POST | `/processes` | `processes.write` | `{ process_number, registered_at?, description, notes? }` → `ProcessRow` (409 se número já existe) |
| PATCH | `/processes/:id` | `processes.write` | `{ process_number?, registered_at?, description?, notes?, status?, reason? }` → `ProcessRow` |

## Ordens de Fornecimento

| Método | Rota | Permissão | Corpo / Resposta |
|---|---|---|---|
| GET | `/supply-orders?process_id=&supplier_id=&search=` | `processes.view` | `SupplyOrderRow[]` |
| GET | `/supply-orders/:id` | `processes.view` | `{ supply_order: SupplyOrderRow, documents: DocumentRef[], invoices: InvoiceRow[] }` |
| POST | `/supply-orders` (multipart) | `supply_orders.write` | campos `process_id, supplier_id, of_number, issue_date, total_value?, notes?` + arquivo `file` (PDF, opcional no cadastro, obrigatório para encaminhar NFs) → `SupplyOrderRow` |
| PATCH | `/supply-orders/:id` | `supply_orders.write` | `{ process_id?, supplier_id?, of_number?, issue_date?, total_value?, notes?, reason? }` |
| POST | `/supply-orders/:id/document` (multipart) | `documents.replace` (ou `supply_orders.write` se ainda não há PDF) | `file` + `reason` (obrigatório ao substituir) → `DocumentRef` |

## Notas Fiscais

| Método | Rota | Permissão | Corpo / Resposta |
|---|---|---|---|
| GET | `/invoices` | autenticado | filtros: `search` (nº NF, nº processo, fornecedor), `supplier_id`, `process_id`, `supply_order_id`, `modality`, `status` (pode repetir/CSV), `forward_status`, `date_from`, `date_to` (emissão), `historical=true\|false`, `queue=1` (somente encaminhadas — painel de Pagamentos), `page`, `pageSize`, `sort` (`issue_date_desc` padrão, `issue_date_asc`, `amount_desc`, `balance_desc`, `forwarded_desc`). Resposta: `Paginated<InvoiceRow> & { summary: MoneySummary }`. Pagamentos só recebe NFs encaminhadas ou históricas |
| GET | `/invoices/check-duplicate?supplier_id=&invoice_number=` | `invoices.write` ou `historical.write` | `{ exists: boolean, invoice?: InvoiceRow }` |
| GET | `/invoices/:id` | autenticado (visibilidade) | `InvoiceDetail` (documentos incluem todas as versões da NF, da OF vinculada e comprovantes) |
| POST | `/invoices` (multipart) | `invoices.write` | `supply_order_id, invoice_number, issue_date, amount, modality, notes?, forward? ("true")` + `file` (PDF **obrigatório**) → `InvoiceRow` |
| PATCH | `/invoices/:id` | `invoices.write` | `{ supply_order_id?, invoice_number?, issue_date?, amount?, modality?, notes?, reason? }` (`reason` obrigatório se já encaminhada) |
| POST | `/invoices/:id/forward` | `invoices.forward` | → `InvoiceRow` |
| POST | `/invoices/:id/attend` | `payments.register` | inicia atendimento → `InvoiceRow` |
| POST | `/invoices/:id/cancel` | `invoices.cancel` | `{ reason }` → `InvoiceRow` |
| POST | `/invoices/:id/document` (multipart) | `documents.replace` (ou `invoices.write` se não houver PDF) | `file` + `reason` |

### Pendências históricas

| POST | `/invoices/historical` (multipart) | `historical.write` | `supplier_id, invoice_number, reported_status, informed_by, issue_date?, amount?, modality?, supply_order_id?, notes?, known_paid_amount?, payment_date?, historical_notes?` + `file?`. Regras: `SEM_INFORMACAO` ⇒ NF fica "Não verificada" (valor opcional, nenhum pagamento). `PENDENTE` ⇒ valor obrigatório, sem pagamento. `PARCIALMENTE_PAGA` ⇒ valor e `known_paid_amount` (0 < pago < valor) obrigatórios. `PAGA` ⇒ `known_paid_amount` deve ser igual ao valor (confirmação explícita). O valor pago informado gera um pagamento marcado como **histórico** (data opcional). |
| POST | `/invoices/:id/historical` | `historical.write` | `{ reported_status, informed_by, amount?, known_paid_amount?, payment_date?, notes? }` — registra novo levantamento; se a NF estava não verificada e a situação deixar de ser `SEM_INFORMACAO`, ela passa a verificada |

## Pagamentos

| Método | Rota | Permissão | Corpo / Resposta |
|---|---|---|---|
| GET | `/payments?invoice_id=&supplier_id=&modality=&process_id=&date_from=&date_to=&status=&search=&page=&pageSize=` | `payments.view` | `Paginated<PaymentRow> & { summary: { total: number, count: number } }` |
| POST | `/invoices/:id/payments` (multipart) | `payments.register` | `amount, payment_date, notes?, client_request_id (uuid)` + `receipt?` (PDF/JPG/PNG) → `{ payment: PaymentRow, invoice: InvoiceRow }` |
| PATCH | `/payments/:id` | dono do registro ou `payments.manage_any` | `{ amount?, payment_date?, notes?, reason }` → `{ payment, invoice }` |
| POST | `/payments/:id/cancel` | dono do registro ou `payments.manage_any` | `{ reason }` → `{ payment, invoice }` |
| POST | `/payments/:id/receipt` (multipart) | dono ou `payments.manage_any` | `receipt` + `reason?` → `DocumentRef` |

## Documentos

| GET | `/documents/:id/content?download=1` | visibilidade do registro | Conteúdo binário original (inline ou attachment) |
| GET | `/documents/:id/signed-url?download=1` | idem | `{ url, expires_in }` (URL temporária de 60 s) |

## Dashboard e relatórios

| GET | `/dashboard?date_from=&date_to=&supplier_id=&modality=&status=&process_id=` | `dashboard.view` | `DashboardData` |
| GET | `/reports/:type?…filtros…&invoice_id=` | `reports.view` | `ReportResult` (`type` ∈ `REPORT_TYPES`) |

## Usuários (somente `users.manage`)

| GET | `/users` | `Profile[]` |
| POST | `/users` | `{ email, full_name, role, extra_permissions?, password? }` — sem senha, envia convite por e-mail |
| PATCH | `/users/:id` | `{ full_name?, role?, extra_permissions?, active? }` (não é possível desativar/rebaixar a si mesmo) |
| POST | `/users/:id/reset-password` | envia e-mail de recuperação |

## Auditoria (`audit.view`)

| GET | `/audit?entity_type=&action=&actor_id=&invoice_id=&date_from=&date_to=&search=&page=&pageSize=` | `Paginated<AuditLogRow>` |
