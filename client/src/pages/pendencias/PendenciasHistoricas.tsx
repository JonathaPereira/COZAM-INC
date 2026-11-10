import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ClockAlert,
  Plus,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building2,
  DollarSign,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../lib/api.js';
import type { InvoiceRow, Paginated, Supplier, Modality, HistoricalReportStatus } from '@cozam/shared';
import { formatBRL, formatDateBR, HISTORICAL_REPORT_LABELS } from '@cozam/shared';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { ModalityBadge } from '../../components/ui/Badges.js';
import { Modal } from '../../components/ui/Modal.js';
import { Input, Textarea } from '../../components/ui/Input.js';
import { CurrencyInput } from '../../components/ui/CurrencyInput.js';
import { FileDropzone } from '../../components/ui/FileDropzone.js';
import { useAuth } from '../../contexts/AuthContext.js';

export function PendenciasHistoricas() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { can } = useAuth();
  const canWrite = can('historical.write');

  // Consulta fornecedores
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<Supplier[]>('/suppliers'),
  });

  // Lista de NFs históricas
  const { data: historicalInvoices, isLoading, refetch } = useQuery({
    queryKey: ['historical-invoices'],
    queryFn: () => api.get<Paginated<InvoiceRow>>('/invoices?historical=true&pageSize=50'),
  });

  // Formulário de Nova Pendência Histórica
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [reportedStatus, setReportedStatus] = useState<HistoricalReportStatus>('SEM_INFORMACAO');
  const [informedBy, setInformedBy] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [knownPaidAmount, setKnownPaidAmount] = useState<number | null>(null);
  const [paymentDate, setPaymentDate] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [modality, setModality] = useState<Modality | ''>('');
  const [notes, setNotes] = useState('');
  const [historicalNotes, setHistoricalNotes] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [confirmPaidCheckbox, setConfirmPaidCheckbox] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error('Selecione o fornecedor.');
      return;
    }
    if (!invoiceNumber.trim()) {
      toast.error('Informe o número da Nota Fiscal.');
      return;
    }
    if (!informedBy.trim()) {
      toast.error('Informe quem forneceu a informação.');
      return;
    }

    if (reportedStatus !== 'SEM_INFORMACAO' && (!amount || amount <= 0)) {
      toast.error('Informe o valor documentado da Nota Fiscal.');
      return;
    }

    if (reportedStatus === 'PARCIALMENTE_PAGA') {
      if (!knownPaidAmount || knownPaidAmount <= 0 || knownPaidAmount >= (amount || 0)) {
        toast.error('Para notas parcialmente pagas, o valor pago deve ser maior que zero e menor que o valor da NF.');
        return;
      }
    }

    if (reportedStatus === 'PAGA') {
      if (!confirmPaidCheckbox) {
        toast.error('Confirme a declaração de que a NF foi integralmente quitada.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('supplier_id', supplierId);
      formData.append('invoice_number', invoiceNumber.trim());
      formData.append('reported_status', reportedStatus);
      formData.append('informed_by', informedBy.trim());

      if (amount) formData.append('amount', String(amount));
      if (reportedStatus === 'PAGA') {
        formData.append('known_paid_amount', String(amount));
      } else if (knownPaidAmount) {
        formData.append('known_paid_amount', String(knownPaidAmount));
      }

      if (paymentDate) formData.append('payment_date', paymentDate);
      if (issueDate) formData.append('issue_date', issueDate);
      if (modality) formData.append('modality', modality);
      if (notes.trim()) formData.append('notes', notes.trim());
      if (historicalNotes.trim()) formData.append('historical_notes', historicalNotes.trim());
      if (pdfFile) formData.append('file', pdfFile);

      await api.postMultipart('/invoices/historical', formData);
      toast.success('Pendência histórica registrada com sucesso!');

      setCreateModalOpen(false);
      resetForm();
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSupplierId('');
    setInvoiceNumber('');
    setReportedStatus('SEM_INFORMACAO');
    setInformedBy('');
    setAmount(null);
    setKnownPaidAmount(null);
    setPaymentDate('');
    setIssueDate('');
    setModality('');
    setNotes('');
    setHistoricalNotes('');
    setPdfFile(null);
    setConfirmPaidCheckbox(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
            Controle de Pendências Históricas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Levantamento progressivo de notas antigas e confirmação de saldos existentes
          </p>
        </div>

        {canWrite && (
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              resetForm();
              setCreateModalOpen(true);
            }}
          >
            Informar Nota Antiga
          </Button>
        )}
      </div>

      {/* Orientações Oficiais da Seção 11 */}
      <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-2">
        <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          Diretrizes de Cadastramento Histórico
        </h4>
        <p className="text-xs text-emerald-900 dark:text-emerald-300 leading-relaxed">
          O cadastro de notas antigas é <span className="font-bold">opcional e progressivo</span>. Não é necessário cadastrar todas as pendências para que o sistema entre em produção.
        </p>
        <ul className="text-xs text-emerald-800 dark:text-emerald-400 space-y-1 list-disc list-inside">
          <li><strong>Sem Informação / Não Verificada:</strong> notas cuja situação física ainda não foi auditada. Ficam identificadas em cinza e não são presumidas como pagas.</li>
          <li><strong>Pendente:</strong> notas verificadas sem nenhum registro de pagamento.</li>
          <li><strong>Parcialmente / Totalmente Paga:</strong> requer informação expressa do responsável que confirmou os dados. Nunca invente datas ou valores.</li>
        </ul>
      </div>

      {/* Tabela de Notas Históricas */}
      <Card title={`Notas Fiscais de Exercícios Anteriores (${historicalInvoices?.data.length || 0})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 uppercase tracking-wider text-2xs">
                <th className="pb-2 font-semibold">Nº da NF</th>
                <th className="pb-2 font-semibold">Fornecedor</th>
                <th className="pb-2 font-semibold">Emissão</th>
                <th className="pb-2 font-semibold text-right">Valor Informado</th>
                <th className="pb-2 font-semibold text-right">Total Pago</th>
                <th className="pb-2 font-semibold text-right">Saldo Devedor</th>
                <th className="pb-2 font-semibold">Fonte da Informação</th>
                <th className="pb-2 font-semibold text-center">Situação</th>
                <th className="pb-2 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historicalInvoices?.data && historicalInvoices.data.length > 0 ? (
                historicalInvoices.data.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 font-bold text-slate-900">{inv.invoice_number}</td>
                    <td className="py-3 font-medium text-slate-800">{inv.supplier_name}</td>
                    <td className="py-3 text-slate-600">{formatDateBR(inv.issue_date)}</td>
                    <td className="py-3 text-right tabular-nums font-semibold text-slate-900">
                      {inv.amount !== null ? formatBRL(inv.amount) : 'Não informado'}
                    </td>
                    <td className="py-3 text-right tabular-nums font-bold text-emerald-700">
                      {formatBRL(inv.total_paid)}
                    </td>
                    <td className="py-3 text-right tabular-nums font-bold text-orange-700">
                      {inv.balance !== null ? formatBRL(inv.balance) : '—'}
                    </td>
                    <td className="py-3 text-slate-600 text-2xs max-w-xs truncate" title={inv.historical_source || ''}>
                      {inv.historical_source || '—'}
                    </td>
                    <td className="py-3 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="py-3 text-right">
                      <Link to={`/notas/${inv.id}`}>
                        <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />}>
                          Abrir
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Nenhuma pendência histórica cadastrada até o momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Informar Nota Antiga */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        size="lg"
        title="Cadastrar Pendência Histórica / Nota Antiga"
        subtitle="Alimentação controlada de informações de exercícios anteriores"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Fornecedor <span className="text-rose-500">*</span>
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                required
              >
                <option value="">Selecione o fornecedor...</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <Input
              label="Número da Nota Fiscal"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ex: 001928"
              required
            />
          </div>

          {/* Situação informada */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Situação Inicial Identificada <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { val: 'SEM_INFORMACAO', label: 'Sem Informação / Não Verificada', desc: 'Nota localizada em arquivo físico, mas dados não apurados' },
                { val: 'PENDENTE', label: 'Pendente (Nenhum pagamento)', desc: 'Nota verificada; nenhum pagamento realizado' },
                { val: 'PARCIALMENTE_PAGA', label: 'Parcialmente Paga', desc: 'Consta confirmação de pagamento de parte do valor' },
                { val: 'PAGA', label: 'Totalmente Paga', desc: 'Confirmação documental de quitação integral' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setReportedStatus(opt.val as any)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    reportedStatus === opt.val
                      ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">{opt.label}</p>
                  <p className="text-2xs text-slate-500 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <CurrencyInput
                label={reportedStatus === 'SEM_INFORMACAO' ? 'Valor da NF (se conhecido)' : 'Valor da Nota Fiscal *'}
                value={amount}
                onChange={setAmount}
                placeholder="R$ 0,00"
                required={reportedStatus !== 'SEM_INFORMACAO'}
              />
            </div>

            {reportedStatus === 'PARCIALMENTE_PAGA' && (
              <div>
                <CurrencyInput
                  label="Valor já pago conhecido *"
                  value={knownPaidAmount}
                  onChange={setKnownPaidAmount}
                  placeholder="R$ 0,00"
                  required
                />
              </div>
            )}

            <div>
              <Input
                label="Data de emissão (opcional)"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
          </div>

          {reportedStatus === 'PAGA' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <label className="flex items-start gap-2 text-xs font-semibold text-emerald-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmPaidCheckbox}
                  onChange={(e) => setConfirmPaidCheckbox(e.target.checked)}
                  className="mt-0.5 accent-emerald-700"
                  required
                />
                <span>
                  Confirmo que esta Nota Fiscal foi integralmente paga de acordo com os registros contábeis/bancários apurados.
                </span>
              </label>
            </div>
          )}

          <Input
            label="Quem forneceu a informação? *"
            value={informedBy}
            onChange={(e) => setInformedBy(e.target.value)}
            placeholder="Ex: Conciliação bancária 2023 / Servidor João da Silva"
            required
            helperText="Obrigatório para registrar a rastreabilidade da informação histórica"
          />

          <Textarea
            label="Observações sobre a pendência (opcional)"
            value={historicalNotes}
            onChange={(e) => setHistoricalNotes(e.target.value)}
            placeholder="Detalhes sobre documentos encontrados ou histórico do fornecimento..."
            rows={2}
          />

          <FileDropzone
            label="Arquivo PDF da Nota Fiscal antiga (opcional)"
            accept="application/pdf"
            onFileSelect={setPdfFile}
            selectedFile={pdfFile}
            helperText="Se houver cópia digitalizada da NF, anexe aqui (opcional em notas históricas)"
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Salvar Pendência Histórica
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
