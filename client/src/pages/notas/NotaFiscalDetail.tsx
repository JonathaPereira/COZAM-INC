import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Receipt,
  FileText,
  DollarSign,
  Calendar,
  Building2,
  FolderKanban,
  Send,
  Plus,
  AlertCircle,
  HelpCircle,
  XCircle,
  Clock,
  CheckCircle2,
  ArrowLeft,
  FileUp,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../lib/api.js';
import type { InvoiceDetail, PaymentRow, DocumentRef } from '@cozam/shared';
import {
  formatBRL,
  formatDateBR,
  formatDateTimeBR,
  MODALITY_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@cozam/shared';
import { Card, ProgressBar } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { ModalityBadge, ForwardBadge } from '../../components/ui/Badges.js';
import { DocumentActions } from '../../components/ui/DocumentViewerModal.js';
import { Modal, ConfirmDialog } from '../../components/ui/Modal.js';
import { CurrencyInput } from '../../components/ui/CurrencyInput.js';
import { Input, Textarea } from '../../components/ui/Input.js';
import { FileDropzone } from '../../components/ui/FileDropzone.js';
import { useAuth } from '../../contexts/AuthContext.js';

export function NotaFiscalDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile, can } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoice-detail', id],
    queryFn: () => api.get<InvoiceDetail>(`/invoices/${id}`),
    enabled: Boolean(id),
  });

  // Modais de ação
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNotes, setPayNotes] = useState('');
  const [payReceipt, setPayReceipt] = useState<File | null>(null);
  const [payRequestId, setPayRequestId] = useState('');
  const [paying, setPaying] = useState(false);

  // Modal de substituição de documento da NF
  const [replaceNfOpen, setReplaceNfOpen] = useState(false);
  const [replaceNfFile, setReplaceNfFile] = useState<File | null>(null);
  const [replaceNfReason, setReplaceNfReason] = useState('');
  const [replacingNf, setReplacingNf] = useState(false);

  // Modal de cancelamento de NF
  const [cancelNfOpen, setCancelNfOpen] = useState(false);
  const [cancelingNf, setCancelingNf] = useState(false);

  // Modal de correção/cancelamento de pagamento individual
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [editPayOpen, setEditPayOpen] = useState(false);
  const [editAmount, setEditAmount] = useState<number | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editingPay, setEditingPay] = useState(false);

  const [cancelPayOpen, setCancelPayOpen] = useState(false);
  const [cancelingPay, setCancelingPay] = useState(false);

  // Modal para verificar/atualizar NF histórica não verificada
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyAmount, setVerifyAmount] = useState<number | null>(null);
  const [verifyInformedBy, setVerifyInformedBy] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'PENDENTE' | 'PARCIALMENTE_PAGA' | 'PAGA'>('PENDENTE');
  const [verifyPaid, setVerifyPaid] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);

  if (isLoading || !data) {
    return <div className="text-center py-12 text-xs text-slate-500">Carregando detalhes da Nota Fiscal...</div>;
  }

  const { invoice, payments, documents, historical, audit } = data;

  const currentNfDoc = documents.find((d) => d.kind === 'NF' && d.is_current);
  const currentOfDoc = documents.find((d) => d.kind === 'OF' && d.is_current);

  const availableBalance = invoice.balance ?? (invoice.amount ? invoice.amount - invoice.total_paid : 0);

  // Abertura do modal de pagamento com UUID de idempotência
  const handleOpenPayModal = () => {
    setPayRequestId(crypto.randomUUID());
    setPayAmount(availableBalance > 0 ? availableBalance : null);
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNotes('');
    setPayReceipt(null);
    setPayModalOpen(true);
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || payAmount <= 0) {
      toast.error('Informe um valor de pagamento válido.');
      return;
    }
    if (payAmount > availableBalance) {
      toast.error(`O valor do pagamento (${formatBRL(payAmount)}) não pode exceder o saldo devedor (${formatBRL(availableBalance)}).`);
      return;
    }

    setPaying(true);
    try {
      const formData = new FormData();
      formData.append('amount', String(payAmount));
      formData.append('payment_date', payDate);
      if (payNotes.trim()) formData.append('notes', payNotes.trim());
      formData.append('client_request_id', payRequestId);
      if (payReceipt) formData.append('receipt', payReceipt);

      const res = await api.postMultipart<any>(`/invoices/${invoice.id}/payments`, formData);

      if (res.invoice?.status === 'TOTALMENTE_PAGA') {
        toast.success(`Pagamento registrado! Nota Fiscal nº ${invoice.invoice_number} totalmente quitada.`);
      } else {
        toast.success(`Pagamento de ${formatBRL(payAmount)} registrado com sucesso.`);
      }

      setPayModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPaying(false);
    }
  };

  const handleForward = async () => {
    try {
      await api.post(`/invoices/${invoice.id}/forward`);
      toast.success('Nota Fiscal encaminhada com sucesso para o setor de Pagamentos!');
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleAttend = async () => {
    try {
      await api.post(`/invoices/${invoice.id}/attend`);
      toast.success('Atendimento iniciado pelo setor de Pagamentos.');
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleCancelInvoice = async (reason: string) => {
    setCancelingNf(true);
    try {
      await api.post(`/invoices/${invoice.id}/cancel`, { reason });
      toast.success('Nota Fiscal cancelada com sucesso.');
      setCancelNfOpen(false);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCancelingNf(false);
    }
  };

  const handleReplaceNfDoc = async () => {
    if (!replaceNfFile || !replaceNfReason.trim()) return;
    setReplacingNf(true);
    try {
      const formData = new FormData();
      formData.append('file', replaceNfFile);
      formData.append('reason', replaceNfReason.trim());
      await api.postMultipart(`/invoices/${invoice.id}/document`, formData);
      toast.success('Documento da Nota Fiscal substituído com sucesso!');
      setReplaceNfOpen(false);
      setReplaceNfFile(null);
      setReplaceNfReason('');
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReplacingNf(false);
    }
  };

  const handleEditPayment = async () => {
    if (!selectedPayment) return;
    if (!editReason.trim()) {
      toast.error('A justificativa da alteração é obrigatória.');
      return;
    }
    setEditingPay(true);
    try {
      await api.patch(`/payments/${selectedPayment.id}`, {
        amount: editAmount ?? selectedPayment.amount,
        payment_date: editDate || selectedPayment.payment_date,
        notes: editNotes,
        reason: editReason.trim(),
      });
      toast.success('Pagamento corrigido com sucesso.');
      setEditPayOpen(false);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setEditingPay(false);
    }
  };

  const handleCancelPayment = async (reason: string) => {
    if (!selectedPayment) return;
    setCancelingPay(true);
    try {
      await api.post(`/payments/${selectedPayment.id}/cancel`, { reason });
      toast.success('Pagamento cancelado com sucesso.');
      setCancelPayOpen(false);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCancelingPay(false);
    }
  };

  const handleVerifyHistorical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyAmount || verifyAmount <= 0) {
      toast.error('Informe o valor documentado da Nota Fiscal.');
      return;
    }
    if (!verifyInformedBy.trim()) {
      toast.error('Informe quem forneceu a confirmação dos dados.');
      return;
    }

    setVerifying(true);
    try {
      await api.post(`/invoices/${invoice.id}/historical`, {
        reported_status: verifyStatus,
        informed_by: verifyInformedBy.trim(),
        amount: verifyAmount,
        known_paid_amount: verifyStatus === 'PAGA' ? verifyAmount : verifyPaid,
      });
      toast.success('Situação da Nota Fiscal histórica confirmada e atualizada com sucesso!');
      setVerifyOpen(false);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  const canRegisterPayment = can('payments.register');
  const canForward = can('invoices.forward');
  const canCancelInvoice = can('invoices.cancel');

  return (
    <div className="space-y-6">
      {/* Botão de retorno e cabeçalho principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/notas">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
              Notas Fiscais
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-heading">
                Nota Fiscal nº {invoice.invoice_number}
              </h1>
              <StatusBadge status={invoice.status} />
              <ForwardBadge forwardStatus={invoice.forward_status} />
              {invoice.is_historical && (
                <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  Histórica
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Fornecedor: <span className="font-semibold text-slate-800">{invoice.supplier_name}</span> · Processo: {invoice.process_number || '—'} · OF: {invoice.of_number || '—'}
            </p>
          </div>
        </div>

        {/* Botões de Ação de Alto Nível */}
        <div className="flex items-center gap-2 flex-wrap">
          {invoice.forward_status === 'RASCUNHO' && canForward && (
            <Button
              variant="primary"
              size="sm"
              icon={<Send className="w-4 h-4" />}
              onClick={handleForward}
              className="bg-emerald-700 hover:bg-emerald-800 font-bold"
            >
              Encaminhar para Pagamentos
            </Button>
          )}

          {invoice.forward_status === 'ENCAMINHADA' && profile?.role === 'pagamentos' && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Clock className="w-4 h-4" />}
              onClick={handleAttend}
            >
              Iniciar Atendimento
            </Button>
          )}

          {invoice.status !== 'TOTALMENTE_PAGA' && invoice.status !== 'CANCELADA' && invoice.verified && canRegisterPayment && (
            <Button
              variant="success"
              size="sm"
              icon={<DollarSign className="w-4 h-4" />}
              onClick={handleOpenPayModal}
              className="font-bold shadow-sm"
            >
              Registrar Pagamento
            </Button>
          )}

          {invoice.status !== 'CANCELADA' && canCancelInvoice && invoice.total_paid === 0 && (
            <Button
              variant="danger"
              size="sm"
              icon={<XCircle className="w-4 h-4" />}
              onClick={() => setCancelNfOpen(true)}
            >
              Cancelar NF
            </Button>
          )}
        </div>
      </div>

      {/* Banner de Nota Não Verificada (Pendência Histórica) */}
      {!invoice.verified && (
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-6 h-6 text-slate-600 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Nota Fiscal Sem Informação / Não Verificada
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Esta nota é oriunda de levantamento de pendências antigas. O registro de pagamentos fica bloqueado até que os dados sejam confirmados.
              </p>
            </div>
          </div>
          {can('historical.write') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setVerifyAmount(invoice.amount || null);
                setVerifyOpen(true);
              }}
              className="shrink-0 bg-white"
            >
              Informar Situação e Valor
            </Button>
          )}
        </div>
      )}

      {/* Linha do Tempo da Tramitação Documental */}
      <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
        <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Fluxo de Tramitação entre Setores
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-2xs shrink-0 mt-0.5">
              ✓
            </div>
            <div>
              <p className="font-semibold text-slate-900">1. Cadastrada</p>
              <p className="text-2xs text-slate-500 mt-0.5">
                Por {invoice.created_by_name || 'Compras'} em {formatDateTimeBR(invoice.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-2xs shrink-0 mt-0.5 ${
                invoice.forwarded_at ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {invoice.forwarded_at ? '✓' : '2'}
            </div>
            <div>
              <p className={`font-semibold ${invoice.forwarded_at ? 'text-slate-900' : 'text-slate-400'}`}>
                2. Encaminhada
              </p>
              <p className="text-2xs text-slate-500 mt-0.5">
                {invoice.forwarded_at
                  ? `Por ${invoice.forwarded_by_name || 'Compras'} em ${formatDateTimeBR(invoice.forwarded_at)}`
                  : 'Aguardando encaminhamento'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-2xs shrink-0 mt-0.5 ${
                invoice.attended_at ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {invoice.attended_at ? '✓' : '3'}
            </div>
            <div>
              <p className={`font-semibold ${invoice.attended_at ? 'text-slate-900' : 'text-slate-400'}`}>
                3. Em Atendimento
              </p>
              <p className="text-2xs text-slate-500 mt-0.5">
                {invoice.attended_at
                  ? `Por ${invoice.attended_by_name || 'Pagamentos'} em ${formatDateTimeBR(invoice.attended_at)}`
                  : 'Fila de Pagamentos'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-2xs shrink-0 mt-0.5 ${
                invoice.status === 'TOTALMENTE_PAGA' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {invoice.status === 'TOTALMENTE_PAGA' ? '✓' : '4'}
            </div>
            <div>
              <p className={`font-semibold ${invoice.status === 'TOTALMENTE_PAGA' ? 'text-emerald-700' : 'text-slate-400'}`}>
                4. Totalmente Quitada
              </p>
              <p className="text-2xs text-slate-500 mt-0.5">
                {invoice.status === 'TOTALMENTE_PAGA'
                  ? `Quitada em ${formatDateBR(invoice.last_payment_date)}`
                  : 'Saldo pendente'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comentário de Compras (Destaque visual importante para Pagamentos) */}
      {invoice.notes && (
        <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-xl flex items-start gap-3">
          <MessageSquare className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Observação do Setor de Compras
            </h4>
            <p className="text-sm text-amber-950 mt-1 italic font-medium">
              "{invoice.notes}"
            </p>
            <p className="text-2xs text-amber-800 mt-1">
              Nota sobre fornecimento parcial ou complementar. O saldo devedor financeiro é calculado exclusivamente com base no valor faturado da NF menos os pagamentos registrados.
            </p>
          </div>
        </div>
      )}

      {/* Resumo Financeiro da NF */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Valor Documentado da NF</span>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatBRL(invoice.amount)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <ModalityBadge modality={invoice.modality} />
            <span className="text-2xs text-slate-400">Emissão: {formatDateBR(invoice.issue_date)}</span>
          </div>
        </div>

        <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="text-xs font-semibold text-emerald-800 uppercase">Total Efetivamente Pago</span>
          <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {formatBRL(invoice.total_paid)}
          </p>
          <p className="text-2xs text-emerald-800/80 mt-2">
            {invoice.payments_count} pagamento(s) registrado(s)
          </p>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase">Saldo Devedor Atual</span>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${availableBalance > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
              {formatBRL(availableBalance)}
            </p>
          </div>
          <div className="mt-3">
            <ProgressBar value={invoice.total_paid} max={invoice.amount || 1} label="Percentual Liquidado" />
          </div>
        </div>
      </div>

      {/* DOIS DOCUMENTOS INDEPENDENTES: Ordem de Fornecimento e Nota Fiscal (PDF) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Documento 1: Ordem de Fornecimento */}
        <Card
          title="1. Ordem de Fornecimento (OF)"
          subtitle="Documento de autorização do fornecimento emitido por Compras"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <FileText className="w-5 h-5 text-slate-600 shrink-0" />
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {currentOfDoc ? currentOfDoc.file_name : 'Arquivo da OF não vinculado'}
                  </p>
                  <p className="text-2xs text-slate-500">
                    OF nº {invoice.of_number || '—'} · {currentOfDoc ? `Versão ${currentOfDoc.version}` : 'Pendente de upload'}
                  </p>
                </div>
              </div>

              <DocumentActions
                documentId={currentOfDoc?.id}
                fileName={currentOfDoc?.file_name}
                kindName="Ordem de Fornecimento"
                compact
              />
            </div>
            <p className="text-2xs text-slate-400">
              O setor de Pagamentos pode visualizar, baixar e imprimir a OF sem precisar solicitá-la a Compras.
            </p>
          </div>
        </Card>

        {/* Documento 2: Nota Fiscal */}
        <Card
          title="2. Nota Fiscal (NF)"
          subtitle="Documento fiscal original emitido pelo fornecedor"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <Receipt className="w-5 h-5 text-emerald-700 shrink-0" />
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {currentNfDoc ? currentNfDoc.file_name : 'Arquivo da NF não anexado'}
                  </p>
                  <p className="text-2xs text-slate-500">
                    NF nº {invoice.invoice_number} · {currentNfDoc ? `Versão ${currentNfDoc.version}` : 'Pendente de upload'}
                  </p>
                </div>
              </div>

              <DocumentActions
                documentId={currentNfDoc?.id}
                fileName={currentNfDoc?.file_name}
                kindName="Nota Fiscal"
                onReplace={() => setReplaceNfOpen(true)}
                compact
              />
            </div>
            <div className="flex justify-between items-center text-2xs text-slate-400">
              <span>Arquivo original utilizado para impressão direta</span>
              {can('documents.replace') && (
                <button
                  type="button"
                  onClick={() => setReplaceNfOpen(true)}
                  className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                >
                  Substituir PDF com justificativa
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Histórico Financeiro: Pagamentos Registrados */}
      <Card
        title={`Histórico de Pagamentos (${payments.length})`}
        subtitle="Registros imutáveis de liquidação financeira com trilha de auditoria"
        actions={
          invoice.status !== 'TOTALMENTE_PAGA' && invoice.status !== 'CANCELADA' && invoice.verified && canRegisterPayment && (
            <Button
              variant="success"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleOpenPayModal}
            >
              Novo Pagamento
            </Button>
          )
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-2xs">
                <th className="pb-2 font-semibold">Data do Pagto</th>
                <th className="pb-2 font-semibold text-right">Valor Pago</th>
                <th className="pb-2 font-semibold">Registrado Por</th>
                <th className="pb-2 font-semibold">Data/Hora Registro</th>
                <th className="pb-2 font-semibold">Comprovante</th>
                <th className="pb-2 font-semibold">Observações / Motivo</th>
                <th className="pb-2 font-semibold text-center">Situação</th>
                <th className="pb-2 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length > 0 ? (
                payments.map((p) => {
                  const isCancelled = p.status === 'CANCELADO';
                  const isOwner = p.created_by === profile?.id;
                  const canManage = isOwner || can('payments.manage_any');

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isCancelled ? 'opacity-60 bg-rose-50/20 line-through' : ''
                      }`}
                    >
                      <td className="py-3 font-medium text-slate-900">{formatDateBR(p.payment_date)}</td>
                      <td className="py-3 text-right font-bold text-emerald-700 tabular-nums">
                        {formatBRL(p.amount)}
                      </td>
                      <td className="py-3 text-slate-700">{p.created_by_name || '—'}</td>
                      <td className="py-3 text-2xs text-slate-500">{formatDateTimeBR(p.created_at)}</td>
                      <td className="py-3 no-underline">
                        {p.receipt_document_id ? (
                          <DocumentActions
                            documentId={p.receipt_document_id}
                            fileName={`Comprovante_${p.id.slice(0, 8)}.pdf`}
                            kindName="Comprovante"
                            compact
                          />
                        ) : (
                          <span className="text-2xs text-slate-400 italic">Sem comprovante</span>
                        )}
                      </td>
                      <td className="py-3 text-slate-600 max-w-xs no-underline">
                        {p.notes && <p className="truncate" title={p.notes}>{p.notes}</p>}
                        {p.edit_reason && (
                          <p className="text-2xs text-blue-700 mt-0.5">
                            Correção: "{p.edit_reason}"
                          </p>
                        )}
                        {p.cancel_reason && (
                          <p className="text-2xs text-rose-700 mt-0.5 font-semibold">
                            Cancelamento: "{p.cancel_reason}" por {p.cancelled_by_name}
                          </p>
                        )}
                      </td>
                      <td className="py-3 text-center no-underline">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-2xs font-bold ${
                            p.status === 'VALIDO'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {PAYMENT_STATUS_LABELS[p.status]}
                        </span>
                      </td>
                      <td className="py-3 text-right no-underline">
                        {!isCancelled && canManage && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPayment(p);
                                setEditAmount(p.amount);
                                setEditDate(p.payment_date || '');
                                setEditNotes(p.notes || '');
                                setEditReason('');
                                setEditPayOpen(true);
                              }}
                              className="px-2 py-1 text-2xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              Corrigir
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPayment(p);
                                setCancelPayOpen(true);
                              }}
                              className="px-2 py-1 text-2xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Nenhum pagamento registrado para esta Nota Fiscal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Trilha de Auditoria desta Nota Fiscal */}
      <Card title="Trilha de Auditoria da Nota Fiscal" subtitle="Histórico oficial de todas as inclusões, alterações e pagamentos">
        <div className="space-y-2">
          {audit.map((a) => (
            <div key={a.id} className="text-xs p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{a.action} — {a.summary}</p>
                {a.reason && <p className="text-slate-700 italic mt-0.5">Motivo: "{a.reason}"</p>}
                <p className="text-2xs text-slate-400 mt-1">
                  Por {a.actor_name || 'Sistema'} ({a.actor_role})
                </p>
              </div>
              <span className="text-2xs text-slate-400 shrink-0">{formatDateTimeBR(a.occurred_at)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* MODAL: Registrar Pagamento */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title={`Registrar Pagamento — NF nº ${invoice.invoice_number}`}
        subtitle={`Saldo devedor disponível: ${formatBRL(availableBalance)}`}
      >
        <form onSubmit={handleRegisterPayment} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">
                Valor do Pagamento (R$) <span className="text-rose-500">*</span>
              </label>
              {availableBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setPayAmount(availableBalance)}
                  className="text-2xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                >
                  Pagar saldo total ({formatBRL(availableBalance)})
                </button>
              )}
            </div>
            <CurrencyInput
              value={payAmount}
              onChange={setPayAmount}
              placeholder="R$ 0,00"
              required
            />
          </div>

          <Input
            label="Data efetiva do pagamento"
            type="date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
            required
          />

          <Textarea
            label="Observação do pagamento (opcional)"
            value={payNotes}
            onChange={(e) => setPayNotes(e.target.value)}
            placeholder="Ex: Pagamento referente à 1ª parcela conforme extrato bancário..."
            rows={2}
          />

          <FileDropzone
            label="Comprovante de pagamento (opcional)"
            accept="application/pdf,image/jpeg,image/png"
            onFileSelect={setPayReceipt}
            selectedFile={payReceipt}
            helperText="Comprovante bancário em PDF, JPEG ou PNG (opcional)"
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setPayModalOpen(false)} disabled={paying}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" loading={paying} className="font-bold">
              Confirmar Pagamento
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Corrigir Pagamento */}
      <Modal
        isOpen={editPayOpen}
        onClose={() => setEditPayOpen(false)}
        title="Corrigir Pagamento"
        subtitle="Ajuste o valor ou data informando a justificativa obrigatória para auditoria"
      >
        <div className="space-y-4">
          <CurrencyInput
            label="Novo valor do pagamento"
            value={editAmount}
            onChange={setEditAmount}
            required
          />
          <Input
            label="Data do pagamento"
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            required
          />
          <Textarea
            label="Observações"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={2}
          />
          <Textarea
            label="Justificativa da correção (obrigatória)"
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            placeholder="Ex: Erro de digitação no valor registrado..."
            rows={2}
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setEditPayOpen(false)} disabled={editingPay}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleEditPayment} loading={editingPay}>
              Salvar Correção
            </Button>
          </div>
        </div>
      </Modal>

      {/* ConfirmDialog: Cancelar Pagamento */}
      <ConfirmDialog
        isOpen={cancelPayOpen}
        onClose={() => setCancelPayOpen(false)}
        onConfirm={handleCancelPayment}
        title="Cancelar Pagamento"
        description="O registro não será excluído, mas seu valor será estornado do saldo da NF e ficará registrado como cancelado na auditoria."
        requireReason
        reasonPlaceholder="Informe o motivo do cancelamento (ex: TED devolvida pelo banco)..."
        confirmLabel="Confirmar Cancelamento"
        variant="danger"
        loading={cancelingPay}
      />

      {/* ConfirmDialog: Cancelar Nota Fiscal */}
      <ConfirmDialog
        isOpen={cancelNfOpen}
        onClose={() => setCancelNfOpen(false)}
        onConfirm={handleCancelInvoice}
        title={`Cancelar Nota Fiscal nº ${invoice.invoice_number}`}
        description="Esta ação desativa a Nota Fiscal no sistema. Somente notas sem pagamentos válidos podem ser canceladas."
        requireReason
        reasonPlaceholder="Informe a justificativa do cancelamento da NF..."
        confirmLabel="Confirmar Cancelamento da NF"
        variant="danger"
        loading={cancelingNf}
      />

      {/* Modal: Substituir Documento da NF */}
      {replaceNfOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Substituir PDF da Nota Fiscal</h3>
            <p className="text-xs text-slate-500">
              A versão anterior será mantida no histórico de versões para auditoria.
            </p>
            <FileDropzone
              label="Novo arquivo PDF da NF"
              onFileSelect={setReplaceNfFile}
              selectedFile={replaceNfFile}
              required
            />
            <Textarea
              label="Justificativa da substituição (obrigatória)"
              value={replaceNfReason}
              onChange={(e) => setReplaceNfReason(e.target.value)}
              placeholder="Ex: Arquivo anterior continha páginas ilegíveis..."
              rows={3}
              required
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setReplaceNfOpen(false)} disabled={replacingNf}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleReplaceNfDoc}
                loading={replacingNf}
                disabled={!replaceNfFile || !replaceNfReason.trim()}
              >
                Confirmar Substituição
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Verificar Pendência Histórica */}
      {verifyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <form onSubmit={handleVerifyHistorical} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Confirmar Dados da Nota Histórica</h3>
            <p className="text-xs text-slate-500">
              Informe os dados apurados para retirar a nota da situação "Sem Informação / Não Verificada".
            </p>

            <CurrencyInput
              label="Valor apurado da Nota Fiscal"
              value={verifyAmount}
              onChange={setVerifyAmount}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Situação Apurada
              </label>
              <select
                value={verifyStatus}
                onChange={(e) => setVerifyStatus(e.target.value as any)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300"
              >
                <option value="PENDENTE">Pendente (nenhum pagamento realizado)</option>
                <option value="PARCIALMENTE_PAGA">Parcialmente paga</option>
                <option value="PAGA">Totalmente paga (confirmado)</option>
              </select>
            </div>

            {verifyStatus === 'PARCIALMENTE_PAGA' && (
              <CurrencyInput
                label="Valor conhecido já pago"
                value={verifyPaid}
                onChange={setVerifyPaid}
                required
              />
            )}

            <Input
              label="Quem forneceu a confirmação?"
              value={verifyInformedBy}
              onChange={(e) => setVerifyInformedBy(e.target.value)}
              placeholder="Ex: Conciliação bancária 2024 / Setor Financeiro"
              required
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setVerifyOpen(false)} disabled={verifying}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" loading={verifying}>
                Salvar Verificação
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
