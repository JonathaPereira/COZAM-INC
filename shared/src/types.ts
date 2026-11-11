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
