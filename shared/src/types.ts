/**
 * Formatos de dados trafegados pela API (contrato entre servidor e interface).
 * Valores monetários chegam como number com 2 casas; datas como "AAAA-MM-DD";
 * carimbos de tempo como ISO 8601.
 */
import type {
  DocumentKind,
  ForwardStatus,
  HistoricalReportStatus,
  InvoiceStatus,
  Modality,
  PaymentStatus,
  ProcessStatus,
  UserRole,
} from './index.js';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  extra_permissions: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MeResponse {
  profile: Profile;
  permissions: string[];
}

export interface Supplier {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  display_order: number;
  active: boolean;
  is_simples_nacional?: boolean;
}

export interface DocumentRef {
  id: string;
  kind: DocumentKind;
  supply_order_id: string | null;
  invoice_id: string | null;
  payment_id: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  version: number;
  is_current: boolean;
  uploaded_by: string;
  uploaded_by_name: string | null;
  uploaded_at: string;
  replaced_at: string | null;
  replace_reason: string | null;
}

export interface ProcessRow {
  id: string;
  process_number: string;
  registered_at: string;
  description: string;
  status: ProcessStatus;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  supply_orders_count: number;
  invoices_count: number;
  invoices_total: number;
  paid_total: number;
  supplier_names: string[];
  municipalities?: string | null;
}

export interface SupplyOrderRow {
  id: string;
  process_id: string;
  process_number: string;
  supplier_id: string;
  supplier_name: string;
  of_number: string;
  issue_date: string;
  total_value: number | null;
  notes: string | null;
  created_at: string;
  created_by_name: string | null;
  document: DocumentRef | null;
  invoices_count: number;
  invoices_total: number;
  municipality?: string | null;
  municipalities?: string | null;
  contract_id?: string | null;
  contract_number?: string | null;
  destination_id?: string | null;
  destination_name?: string | null;
  tracking_code?: string | null;
  delivery_deadline?: string | null;
  signed_document_id?: string | null;
  signed_at?: string | null;
  signed_by_name?: string | null;
  status?: SupplyOrderStatus;
  items_count?: number;
}

export interface InvoiceRow {
  id: string;
  supply_order_id: string | null;
  process_id: string | null;
  supplier_id: string;
  invoice_number: string;
  issue_date: string | null;
  amount: number | null;
  modality: Modality | null;
  notes: string | null;
  is_historical: boolean;
  verified: boolean;
  historical_source: string | null;
  total_paid: number;
  balance: number | null;
  status: InvoiceStatus;
  forward_status: ForwardStatus;
  forwarded_at: string | null;
  forwarded_by_name: string | null;
  attended_at: string | null;
  attended_by_name: string | null;
  cancelled_at: string | null;
  cancelled_by_name: string | null;
  cancel_reason: string | null;
  created_at: string;
  created_by_name: string | null;
  updated_at: string;
  version: number;
  supplier_name: string;
  of_number: string | null;
  process_number: string | null;
  process_description: string | null;
  nf_document_id: string | null;
  of_document_id: string | null;
  last_payment_date: string | null;
  payments_count: number;
  municipality: string | null;
  supplier_is_simples_nacional?: boolean | null;
}

export interface PaymentRow {
  id: string;
  invoice_id: string;
  amount: number;
  gross_amount?: number | null;
  tax_rate?: number | null;
  tax_amount?: number | null;
  net_amount?: number | null;
  is_tax_exempt?: boolean;
  payment_date: string | null;
  notes: string | null;
  is_historical: boolean;
  informed_by: string | null;
  status: PaymentStatus;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_by_name: string | null;
  updated_at: string;
  edit_reason: string | null;
  cancelled_at: string | null;
  cancelled_by_name: string | null;
  cancel_reason: string | null;
  version: number;
  invoice_number: string;
  supplier_id: string;
  supplier_name: string;
  modality: Modality | null;
  process_number: string | null;
  receipt_document_id: string | null;
  municipality?: string | null;
}

export interface HistoricalStatusRow {
  id: string;
  invoice_id: string;
  reported_status: HistoricalReportStatus;
  known_paid_amount: number | null;
  informed_by: string;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  invoice_id: string | null;
  summary: string | null;
  reason: string | null;
  changed_fields: string[] | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MoneySummary {
  amount: number;
  total_paid: number;
  balance: number;
}

export interface InvoiceDetail {
  invoice: InvoiceRow;
  payments: PaymentRow[];
  documents: DocumentRef[];
  historical: HistoricalStatusRow[];
  audit: AuditLogRow[];
}

export interface DashboardData {
  counts: {
    processes: number;
    invoices: number;
    aguardando: number;
    parciais: number;
    pagas: number;
    nao_verificadas: number;
    canceladas: number;
    fila_pagamentos: number;
    rascunhos: number;
  };
  totals: {
    registered: number; // NFs verificadas e não canceladas
    paid: number;
    balance: number;
    unverified_count: number;
    unverified_known_amount: number; // exibido separadamente — nunca somado
  };
  monthly: { month: string; paid: number; count: number }[];
  by_supplier: { supplier_id: string; name: string; amount: number; paid: number; balance: number; count: number }[];
  by_modality: { modality: Modality; amount: number; paid: number; balance: number; count: number }[];
  recent_payments: PaymentRow[];
}

export type ReportColumnType = 'text' | 'money' | 'date' | 'datetime' | 'number';

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportColumnType;
}

export interface ReportResult {
  type: string;
  title: string;
  generated_at: string;
  generated_by: string;
  filters_applied: { label: string; value: string }[];
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  totals: Record<string, number>;
  notes?: string[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export type PasswordResetStatus = 'PENDENTE' | 'APROVADA' | 'REJEITADA';

export interface PasswordResetRequest {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: PasswordResetStatus;
  request_reason?: string | null;
  has_proposed_password?: boolean;
  proposed_password?: string | null;
  temporary_password?: string | null;
  admin_notes?: string | null;
  approved_by?: string | null;
  approved_by_name?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export type SupplyOrderStatus = 'RASCUNHO' | 'AGUARDANDO_ASSINATURA' | 'CONFIRMADA' | 'PARCIALMENTE_ATENDIDA' | 'CONCLUIDA' | 'CANCELADA';

export type ContractStatus = 'EM_ELABORACAO' | 'AGUARDANDO_CONFERENCIA' | 'ATIVO' | 'PROXIMO_VENCIMENTO' | 'SUSPENSO' | 'ENCERRADO' | 'VENCIDO' | 'RESCINDIDO';

export type ProcurementModality = 'PREGAO_ELETRONICO' | 'CONCORRENCIA' | 'DISPENSA' | 'INEXIGIBILIDADE' | 'OUTRA';

export type AmendmentType = 'PRAZO' | 'QUANTITATIVO_ACRESCIMO' | 'QUANTITATIVO_SUPRESSAO' | 'REAJUSTE' | 'OUTRO';

export type ItemCategory = 'MATERIAL_CONSUMO' | 'MATERIAL_EXPEDIENTE' | 'AGUA_CAFE' | 'MATERIAL_ELETRICO' | 'EPIS' | 'SERVICOS' | 'LOCACAO' | 'OUTROS';

export type ContractMovementType = 'RESERVA' | 'BAIXA' | 'LIBERACAO' | 'ESTORNO' | 'ADITIVO_ACRESCIMO' | 'ADITIVO_SUPRESSAO';

export interface Destination {
  id: string;
  name: string;
  cnpj?: string | null;
  address?: string | null;
  city: string;
  state: string;
  contact_department?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProcurementProcess {
  id: string;
  process_number: string;
  year: number;
  bidding_number: string;
  modality: ProcurementModality;
  legal_framework: string;
  object: string;
  opening_date?: string | null;
  homologation_date?: string | null;
  manager_id?: string | null;
  manager_name?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  contracts_count?: number;
}

export interface ContractRow {
  id: string;
  contract_number: string;
  year: number;
  procurement_id?: string | null;
  procurement_bidding_number?: string | null;
  procurement_modality?: ProcurementModality | null;
  procurement_process_number?: string | null;
  supplier_id: string;
  supplier_name: string;
  supplier_cnpj?: string | null;
  supplier_legal_name?: string | null;
  supplier_is_simples_nacional?: boolean;
  object: string;
  legal_framework: string;
  signing_date: string;
  start_date: string;
  end_date: string;
  delivery_deadline_days: number;
  total_amount: number;
  status: ContractStatus;
  computed_status?: ContractStatus;
  days_to_expire?: number;
  contract_pdf_document_id?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  items_count?: number;
  requested_amount?: number;
  remaining_amount?: number;
}

export interface ContractAmendment {
  id: string;
  contract_id: string;
  amendment_number: string;
  amendment_type: AmendmentType;
  signing_date: string;
  new_end_date?: string | null;
  additional_amount: number;
  justification: string;
  document_id?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface ContractItemRow {
  id: string;
  contract_id: string;
  item_code: string;
  item_group?: string | null;
  description: string;
  category: ItemCategory;
  unit: string;
  original_quantity: number;
  current_quantity: number;
  unit_price: number;
  total_price: number;
  active: boolean;
  reserved_quantity?: number;
  requested_quantity?: number;
  available_quantity?: number;
  executed_amount?: number;
  remaining_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface SupplyOrderItemRow {
  id: string;
  supply_order_id: string;
  contract_item_id: string;
  item_code: string;
  description: string;
  unit: string;
  category: ItemCategory;
  quantity: number;
  unit_price: number;
  total_price: number;
  delivered_quantity: number;
  available_quantity?: number;
}

export interface ContractItemMovement {
  id: string;
  contract_item_id: string;
  supply_order_id?: string | null;
  movement_type: ContractMovementType;
  quantity: number;
  unit_price: number;
  total_amount: number;
  reason?: string | null;
  client_request_id?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  created_at: string;
}
