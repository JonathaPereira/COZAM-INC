/**
 * Pacote compartilhado entre API e interface:
 * enums, rótulos em português, cores de situação e matriz de permissões.
 *
 * Mantê-lo como fonte única de verdade evita divergência entre o que a
 * interface exibe/habilita e o que o servidor efetivamente autoriza.
 */

export type * from './types.js';

// ---------------------------------------------------------------------------
// Enums (espelham os tipos do PostgreSQL)
// ---------------------------------------------------------------------------
export const USER_ROLES = ['admin', 'pagamentos', 'admin_secundario'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const MODALITIES = ['FUMIP', 'COMPRA_COMPARTILHADA'] as const;
export type Modality = (typeof MODALITIES)[number];

export const INVOICE_STATUSES = [
  'AGUARDANDO_PAGAMENTO',
  'PARCIALMENTE_PAGA',
  'TOTALMENTE_PAGA',
  'NAO_VERIFICADA',
  'CANCELADA',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const FORWARD_STATUSES = ['RASCUNHO', 'ENCAMINHADA', 'EM_ATENDIMENTO'] as const;
export type ForwardStatus = (typeof FORWARD_STATUSES)[number];

export const PROCESS_STATUSES = ['EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO'] as const;
export type ProcessStatus = (typeof PROCESS_STATUSES)[number];

export const PAYMENT_STATUSES = ['VALIDO', 'CANCELADO'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DOCUMENT_KINDS = ['OF', 'NF', 'COMPROVANTE'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const HISTORICAL_REPORT_STATUSES = ['SEM_INFORMACAO', 'PENDENTE', 'PARCIALMENTE_PAGA', 'PAGA'] as const;
export type HistoricalReportStatus = (typeof HISTORICAL_REPORT_STATUSES)[number];

// ---------------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------------
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador — Compras',
  pagamentos: 'Pagamentos',
  admin_secundario: 'Administrador Secundário',
};

export const MODALITY_LABELS: Record<Modality, string> = {
  FUMIP: 'FUMIP',
  COMPRA_COMPARTILHADA: 'Compra Compartilhada',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  AGUARDANDO_PAGAMENTO: 'Aguardando Pagamento',
  PARCIALMENTE_PAGA: 'Parcialmente Paga',
  TOTALMENTE_PAGA: 'Totalmente Paga',
  NAO_VERIFICADA: 'Sem Informação / Não Verificada',
  CANCELADA: 'Cancelada',
};

/** Cores consistentes de situação (seção 16 da especificação). */
export const INVOICE_STATUS_TONES: Record<InvoiceStatus, 'yellow' | 'orange' | 'green' | 'gray' | 'red'> = {
  AGUARDANDO_PAGAMENTO: 'yellow',
  PARCIALMENTE_PAGA: 'orange',
  TOTALMENTE_PAGA: 'green',
  NAO_VERIFICADA: 'gray',
  CANCELADA: 'red',
};

export const FORWARD_STATUS_LABELS: Record<ForwardStatus, string> = {
  RASCUNHO: 'Não encaminhada',
  ENCAMINHADA: 'Encaminhada',
  EM_ATENDIMENTO: 'Em atendimento',
};

export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  VALIDO: 'Válido',
  CANCELADO: 'Cancelado',
};

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  OF: 'Ordem de Fornecimento',
  NF: 'Nota Fiscal',
  COMPROVANTE: 'Comprovante de pagamento',
};

export const HISTORICAL_REPORT_LABELS: Record<HistoricalReportStatus, string> = {
  SEM_INFORMACAO: 'Sem informação / não verificada',
  PENDENTE: 'Pendente (nenhum pagamento)',
  PARCIALMENTE_PAGA: 'Parcialmente paga',
  PAGA: 'Paga (confirmado)',
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  EM_ELABORACAO: 'Em Elaboração',
  AGUARDANDO_CONFERENCIA: 'Aguardando Conferência',
  ATIVO: 'Ativo',
  PROXIMO_VENCIMENTO: 'Próximo do Vencimento',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
  VENCIDO: 'Vencido',
  RESCINDIDO: 'Rescindido',
};

export const CONTRACT_STATUS_TONES: Record<ContractStatus, 'yellow' | 'orange' | 'green' | 'gray' | 'red'> = {
  EM_ELABORACAO: 'gray',
  AGUARDANDO_CONFERENCIA: 'yellow',
  ATIVO: 'green',
  PROXIMO_VENCIMENTO: 'orange',
  SUSPENSO: 'red',
  ENCERRADO: 'gray',
  VENCIDO: 'red',
  RESCINDIDO: 'red',
};

export const SUPPLY_ORDER_STATUS_LABELS: Record<SupplyOrderStatus, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_ASSINATURA: 'Aguardando Assinatura',
  CONFIRMADA: 'Assinada / Confirmada',
  PARCIALMENTE_ATENDIDA: 'Parcialmente Atendida',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

export const PROCUREMENT_MODALITY_LABELS: Record<ProcurementModality, string> = {
  PREGAO_ELETRONICO: 'Pregão Eletrônico',
  CONCORRENCIA: 'Concorrência',
  DISPENSA: 'Dispensa de Licitação',
  INEXIGIBILIDADE: 'Inexigibilidade',
  OUTRA: 'Outro Procedimento',
};

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  MATERIAL_CONSUMO: 'Material de Consumo',
  MATERIAL_EXPEDIENTE: 'Material de Expediente',
  AGUA_CAFE: 'Água e Café',
  MATERIAL_ELETRICO: 'Material Elétrico',
  EPIS: 'Equipamentos de Proteção (EPIs)',
  SERVICOS: 'Serviços',
  LOCACAO: 'Locação de Veículos / Equipamentos',
  OUTROS: 'Outros',
};

export const AMENDMENT_TYPE_LABELS: Record<AmendmentType, string> = {
  PRAZO: 'Prorrogação de Prazo',
  QUANTITATIVO_ACRESCIMO: 'Acréscimo de Quantitativo / Valor',
  QUANTITATIVO_SUPRESSAO: 'Supressão de Quantitativo / Valor',
  REAJUSTE: 'Reajuste / Repactuação de Preço',
  OUTRO: 'Outro',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  PROCESSO_CADASTRADO: 'Processo cadastrado',
  PROCESSO_ALTERADO: 'Processo alterado',
  OF_CADASTRADA: 'OF cadastrada',
  OF_ALTERADA: 'OF alterada',
  NF_CADASTRADA: 'NF cadastrada',
  NF_HISTORICA_CADASTRADA: 'NF histórica cadastrada',
  NF_ALTERADA: 'NF alterada',
  NF_ENCAMINHADA: 'NF encaminhada para Pagamentos',
  NF_ATENDIMENTO_INICIADO: 'Atendimento iniciado por Pagamentos',
  NF_VERIFICADA: 'NF verificada',
  NF_CANCELADA: 'NF cancelada',
  PAGAMENTO_REGISTRADO: 'Pagamento registrado',
  PAGAMENTO_CORRIGIDO: 'Pagamento corrigido',
  PAGAMENTO_CANCELADO: 'Pagamento cancelado',
  DOCUMENTO_ANEXADO: 'Documento anexado',
  DOCUMENTO_SUBSTITUIDO: 'Documento substituído',
  HISTORICO_INFORMADO: 'Situação histórica informada',
  USUARIO_CRIADO: 'Usuário criado',
  USUARIO_ALTERADO: 'Usuário alterado',
  SENHA_REDEFINIDA_ADMIN: 'Senha redefinida e autorizada pelo administrador',
  SENHA_DEFINIDA_ADMIN: 'Nova senha definida pelo administrador',
  FORNECEDOR_CADASTRADO: 'Fornecedor cadastrado',
  FORNECEDOR_ALTERADO: 'Fornecedor alterado',
};

// ---------------------------------------------------------------------------
// Permissões
// ---------------------------------------------------------------------------
export const PERMISSIONS = [
  'dashboard.view',
  'reports.view',
  'processes.view',
  'processes.write',
  'supply_orders.write',
  'invoices.view_drafts',
  'invoices.write',
  'invoices.forward',
  'invoices.cancel',
  'documents.replace',
  'payments.view',
  'payments.register',
  'payments.manage_any',
  'historical.write',
  'suppliers.manage',
  'users.manage',
  'audit.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard.view': 'Ver dashboard',
  'reports.view': 'Ver e exportar relatórios',
  'processes.view': 'Consultar processos',
  'processes.write': 'Cadastrar/editar processos',
  'supply_orders.write': 'Cadastrar/editar Ordens de Fornecimento',
  'invoices.view_drafts': 'Ver NFs ainda não encaminhadas',
  'invoices.write': 'Cadastrar/editar Notas Fiscais',
  'invoices.forward': 'Encaminhar NFs para Pagamentos',
  'invoices.cancel': 'Cancelar Notas Fiscais',
  'documents.replace': 'Substituir documentos (OF/NF)',
  'payments.view': 'Consultar pagamentos',
  'payments.register': 'Registrar pagamentos',
  'payments.manage_any': 'Corrigir/cancelar pagamentos de qualquer usuário',
  'historical.write': 'Informar pendências históricas',
  'suppliers.manage': 'Gerenciar fornecedores',
  'users.manage': 'Gerenciar usuários e permissões',
  'audit.view': 'Consultar auditoria',
};

const PAGAMENTOS_BASE: Permission[] = [
  'dashboard.view',
  'reports.view',
  'processes.view',
  'payments.view',
  'payments.register',
  'historical.write',
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: PERMISSIONS,
  pagamentos: PAGAMENTOS_BASE,
  // Administrador secundário: base de consulta + permissões extras concedidas
  // individualmente pelo administrador (campo extra_permissions do perfil).
  admin_secundario: ['dashboard.view', 'reports.view', 'processes.view', 'payments.view', 'invoices.view_drafts'],
};

/** Permissões que podem ser concedidas a um administrador secundário. */
export const GRANTABLE_PERMISSIONS: Permission[] = PERMISSIONS.filter(
  (p) => p !== 'users.manage',
) as Permission[];

export interface ProfileLike {
  role: UserRole;
  extra_permissions?: string[] | null;
  active?: boolean;
}

export function permissionsOf(profile: ProfileLike | null | undefined): Set<Permission> {
  if (!profile || profile.active === false) return new Set();
  const set = new Set<Permission>(ROLE_PERMISSIONS[profile.role] ?? []);
  if (profile.role === 'admin_secundario') {
    for (const p of profile.extra_permissions ?? []) {
      if ((GRANTABLE_PERMISSIONS as string[]).includes(p)) set.add(p as Permission);
    }
  }
  return set;
}

export function can(profile: ProfileLike | null | undefined, permission: Permission): boolean {
  return permissionsOf(profile).has(permission);
}

// ---------------------------------------------------------------------------
// Dinheiro e datas (padrão brasileiro)
// ---------------------------------------------------------------------------
/** Converte valor decimal para centavos inteiros sem erro de ponto flutuante. */
export function toCents(value: number | string): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export function formatBRL(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return BRL.format(Number(value));
}

/** "2026-11-10" -> "10/11/2026" (sem conversão de fuso horário). */
export function formatDateBR(value: string | null | undefined): string {
  if (!value) return '—';
  const [datePart] = value.split('T');
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function formatDateTimeBR(value: string | null | undefined): string {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString('pt-BR', { timeZone: 'America/Maceio', dateStyle: 'short', timeStyle: 'short' });
}

// ---------------------------------------------------------------------------
// Relatórios
// ---------------------------------------------------------------------------
export const REPORT_TYPES = [
  'notas',
  'notas_aguardando',
  'notas_parciais',
  'notas_pagas',
  'notas_nao_verificadas',
  'pagamentos_periodo',
  'pagamentos_fornecedor',
  'pagamentos_modalidade',
  'saldo_fornecedor',
  'historico_nf',
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_LABELS: Record<ReportType, string> = {
  notas: 'Relação de todas as Notas Fiscais',
  notas_aguardando: 'Notas aguardando pagamento',
  notas_parciais: 'Notas parcialmente pagas',
  notas_pagas: 'Notas totalmente pagas',
  notas_nao_verificadas: 'Notas sem situação verificada',
  pagamentos_periodo: 'Pagamentos realizados por período',
  pagamentos_fornecedor: 'Pagamentos por fornecedor',
  pagamentos_modalidade: 'Pagamentos por modalidade',
  saldo_fornecedor: 'Saldo devedor por fornecedor',
  historico_nf: 'Histórico individual de uma Nota Fiscal',
};

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_MIME_TYPES: Record<DocumentKind, string[]> = {
  OF: ['application/pdf'],
  NF: ['application/pdf'],
  COMPROVANTE: ['application/pdf', 'image/jpeg', 'image/png'],
};

// ---------------------------------------------------------------------------
// Retenção Tributária (IRRF 1,2%)
// ---------------------------------------------------------------------------
export const DEFAULT_TAX_RATE = 0.012; // 1,2%

export interface PaymentTaxCalculation {
  grossAmount: number;
  taxRate: number;
  taxAmount: number;
  netAmount: number;
  isTaxExempt: boolean;
}

export function calculatePaymentTaxes(
  grossAmount: number,
  isTaxExempt: boolean,
  taxRate: number = DEFAULT_TAX_RATE,
): PaymentTaxCalculation {
  const gross = Math.max(0, Number(grossAmount) || 0);
  if (isTaxExempt || gross === 0) {
    return {
      grossAmount: gross,
      taxRate: 0,
      taxAmount: 0,
      netAmount: gross,
      isTaxExempt: true,
    };
  }
  const tax = Math.round(gross * taxRate * 100) / 100;
  const net = Math.round((gross - tax) * 100) / 100;
  return {
    grossAmount: gross,
    taxRate,
    taxAmount: tax,
    netAmount: net,
    isTaxExempt: false,
  };
}
