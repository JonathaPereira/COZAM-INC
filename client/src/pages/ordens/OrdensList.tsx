import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Plus,
  Search,
  Building2,
  Calendar,
  Eye,
  ArrowLeft,
  Trash2,
  Pencil,
  Download,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  Clock,
  Layers,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api.js';
import type { SupplyOrderRow } from '@cozam/shared';
import { formatBRL, formatDateBR, formatDateTimeBR } from '@cozam/shared';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input, Select, Textarea } from '../../components/ui/Input.js';
import { CurrencyInput } from '../../components/ui/CurrencyInput.js';
import { MunicipalitySelect } from '../../components/ui/MunicipalitySelect.js';
import { Modal } from '../../components/ui/Modal.js';
import { FileDropzone } from '../../components/ui/FileDropzone.js';
import { DocumentActions } from '../../components/ui/DocumentViewerModal.js';
import { DeleteConfirmModal } from '../../components/ui/DeleteConfirmModal.js';
import { EditSupplyOrderModal } from '../../components/ordens/EditSupplyOrderModal.js';
import { UploadSignedOfModal } from '../../components/orders/UploadSignedOfModal.js';
import { downloadSupplyOrderPdf, downloadSupplyOrderXlsx } from '../../lib/documents.js';
import { useAuth } from '../../contexts/AuthContext.js';

export function OrdensList() {
  const [search, setSearch] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SupplyOrderRow | null>(null);
  const [editingOf, setEditingOf] = useState<SupplyOrderRow | null>(null);
  const { profile, can } = useAuth();
  const canWrite = can('supply_orders.write');

  const { data: municipalitiesData } = useQuery({
    queryKey: ['municipalities'],
    queryFn: () => api.get<{ municipalities: string[] }>('/invoices/municipalities'),
  });

  const { data: ofs, isLoading, refetch } = useQuery({
    queryKey: ['supply-orders', search, municipality],
    queryFn: () => api.get<SupplyOrderRow[]>('/supply-orders', { search, municipality }),
  });

  const handleDeleteOf = async (reason: string) => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/supply-orders/${deleteTarget.id}`, { data: { reason } });
      toast.success(
        deleteTarget.invoices_count > 0
          ? `Ordem nº ${deleteTarget.of_number} e ${deleteTarget.invoices_count} nota(s) vinculada(s) excluída(s) com sucesso.`
          : `Ordem de Fornecimento nº ${deleteTarget.of_number} excluída com sucesso.`
      );
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir OF.');
    }
  };

  const municipalitiesList = Array.from(
    new Set([
      'Santana do Mundaú',
      'Branquinha',
      'União dos Palmares',
      'Carneiros',
      ...(municipalitiesData?.municipalities || []),
    ])
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
            Ordens de Fornecimento (OF)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Controle do setor de Compras — cada OF pertence a apenas um fornecedor
          </p>
        </div>

        {canWrite && (
          <div className="flex items-center gap-2">
            <Link to="/lancamento">
              <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
                Nova Ordem de Fornecimento / Lançamento
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Barra de Filtros e Pesquisa */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
            Pesquisar por OF, Fornecedor, Processo ou Município
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Digite o número da OF, fornecedor, processo ou município..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
            Município Consorciado
          </label>
          <select
            value={municipality}
            onChange={(e) => setMunicipality(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Todos os municípios</option>
            {municipalitiesList.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-2xs">
                <th className="py-3 px-4 font-semibold">Número da OF</th>
                <th className="py-3 px-4 font-semibold">Fornecedor</th>
                <th className="py-3 px-4 font-semibold">Processo Adm.</th>
                <th className="py-3 px-4 font-semibold">Data Emissão</th>
                <th className="py-3 px-4 font-semibold text-right">Valor Previsto</th>
                <th className="py-3 px-4 font-semibold text-center">NFs Vinculadas</th>
                <th className="py-3 px-4 font-semibold text-right">Total Faturado</th>
                <th className="py-3 px-4 font-semibold text-center">Arquivo PDF</th>
                <th className="py-3 px-4 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {ofs && ofs.length > 0 ? (
                ofs.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{o.of_number}</span>
                      {(o.municipality || o.municipalities) && (
                        <span className="block mt-0.5 text-2xs font-semibold text-emerald-700 dark:text-emerald-400">
                          📍 {o.municipality || o.municipalities}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{o.supplier_name}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">{o.process_number}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{formatDateBR(o.issue_date)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {formatBRL(o.total_value)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                      {o.invoices_count}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatBRL(o.invoices_total)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <DocumentActions
                        documentId={o.document?.id}
                        fileName={o.document?.file_name}
                        kindName="Ordem de Fornecimento"
                        compact
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/ordens/${o.id}`}>
                          <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />}>
                            Ver
                          </Button>
                        </Link>
                        {profile?.role === 'admin' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                              icon={<Pencil className="w-3.5 h-3.5" />}
                              onClick={() => setEditingOf(o)}
                              title="Editar dados da OF"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              icon={<Trash2 className="w-3.5 h-3.5" />}
                              onClick={() => setDeleteTarget(o)}
                              title={
                                o.invoices_count > 0
                                  ? `Excluir OF e ${o.invoices_count} nota(s) vinculada(s)`
                                  : 'Excluir OF'
                              }
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Nenhuma Ordem de Fornecimento encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteOf}
        title="Excluir Ordem de Fornecimento"
        itemIdentifier={`OF nº ${deleteTarget?.of_number} · ${deleteTarget?.supplier_name}`}
        description={
          deleteTarget?.invoices_count && deleteTarget.invoices_count > 0
            ? `Tem certeza que deseja excluir esta Ordem de Fornecimento e todas as ${deleteTarget.invoices_count} Nota(s) Fiscal(is) vinculada(s)? Esta operação removerá a Ordem e todas as notas fiscais associadas da base e da fila de pagamentos. Todos os dados serão registrados na auditoria.`
            : 'Tem certeza que deseja excluir esta Ordem de Fornecimento? Esta operação removerá a OF e os arquivos associados. Todos os dados serão registrados na auditoria.'
        }
        confirmButtonText={
          deleteTarget?.invoices_count && deleteTarget.invoices_count > 0
            ? 'Sim, excluir OF e Notas Vinculadas'
            : 'Sim, excluir OF'
        }
      />

      <EditSupplyOrderModal
        isOpen={Boolean(editingOf)}
        onClose={() => setEditingOf(null)}
        onSuccess={refetch}
        supplyOrder={editingOf}
      />
    </div>
  );
}

interface AnexarNotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplyOrder: any;
  defaultAmount?: number | null;
  onSuccess: () => void;
}

function AnexarNotaModal({
  isOpen,
  onClose,
  supplyOrder,
  defaultAmount,
  onSuccess,
}: AnexarNotaModalProps) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<number | null>(defaultAmount || null);
  const [modality, setModality] = useState<'COMPRA_COMPARTILHADA' | 'FUMIP'>('COMPRA_COMPARTILHADA');
  const [municipality, setMunicipality] = useState(
    supplyOrder?.municipality || 'Santana do Mundaú'
  );
  const [notes, setNotes] = useState('');
  const [forward, setForward] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceNumber.trim() || !supplyOrder?.supplier_id) {
      setDuplicateWarning(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ exists: boolean; invoice?: any }>(
          '/invoices/check-duplicate',
          {
            supplier_id: supplyOrder.supplier_id,
            invoice_number: invoiceNumber.trim(),
          }
        );
        if (res.exists) {
          setDuplicateWarning(
            `Atenção: Já existe uma NF nº ${invoiceNumber} para este fornecedor no sistema.`
          );
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        // ignore
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [invoiceNumber, supplyOrder?.supplier_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim()) {
      toast.error('Informe o número da Nota Fiscal.');
      return;
    }
    if (!issueDate) {
      toast.error('Informe a data de emissão.');
      return;
    }
    if (!amount || amount <= 0) {
      toast.error('Informe o valor da Nota Fiscal.');
      return;
    }
    if (!file) {
      toast.error('Anexe o arquivo PDF da Nota Fiscal.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('supply_order_id', supplyOrder.id);
      formData.append('invoice_number', invoiceNumber.trim());
      formData.append('issue_date', issueDate);
      formData.append('amount', String(amount));
      formData.append('modality', modality);
      if (municipality) formData.append('municipality', municipality);
      if (notes.trim()) formData.append('notes', notes.trim());
      formData.append('forward', String(forward));
      formData.append('file', file);

      await api.postMultipart('/invoices', formData);
      toast.success(
        `Nota Fiscal nº ${invoiceNumber} anexada com sucesso à OF nº ${supplyOrder.of_number}!`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao anexar Nota Fiscal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Anexar Nota Fiscal à Ordem de Fornecimento"
      subtitle={`OF nº ${supplyOrder?.of_number} · Fornecedor: ${supplyOrder?.supplier_name}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {duplicateWarning && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            {duplicateWarning}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Número da Nota Fiscal"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="Ex: 001.234"
            required
            autoFocus
          />
          <Input
            label="Data de Emissão da NF"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CurrencyInput
            label="Valor da Nota Fiscal (R$)"
            value={amount}
            onChange={setAmount}
            required
          />
          <Select
            label="Modalidade"
            value={modality}
            onChange={(e) => setModality(e.target.value as any)}
            required
          >
            <option value="COMPRA_COMPARTILHADA">Compra Compartilhada (Padrão)</option>
            <option value="FUMIP">FUMIP (Exclusivo Santana do Mundaú)</option>
          </Select>
        </div>

        <MunicipalitySelect
          value={municipality}
          onChange={setMunicipality}
          required
        />

        <FileDropzone
          label="Arquivo da Nota Fiscal (PDF)"
          onFileSelect={setFile}
          selectedFile={file}
          required
        />

        <Textarea
          label="Observações (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: Entrega de materiais conforme empenho..."
          rows={2}
        />

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={forward}
              onChange={(e) => setForward(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Encaminhar diretamente para o setor de Pagamentos
            </span>
          </label>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 ml-7">
            Se marcado, a NF já aparecerá na fila do setor de Pagamentos para conferência e liquidação.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={saving} type="button">
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={saving}
            disabled={!invoiceNumber.trim() || !amount || !file}
            icon={<Receipt className="w-4 h-4" />}
          >
            Salvar e Anexar Nota Fiscal
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function OrdemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [signedModalOpen, setSignedModalOpen] = useState(false);
  const [attachInvoiceOpen, setAttachInvoiceOpen] = useState(false);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceReason, setReplaceReason] = useState('');
  const [replacing, setReplacing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['supply-order-detail', id],
    queryFn: () =>
      api.get<{
        supply_order: SupplyOrderRow & { status?: string; contract_number?: string; tracking_code?: string };
        items?: any[];
        documents: any[];
        invoices: any[];
      }>(`/supply-orders/${id}`),
    enabled: Boolean(id),
  });

  const handleDeleteDetailOf = async (reason: string) => {
    try {
      await api.delete(`/supply-orders/${id}`, { data: { reason } });
      toast.success(
        data?.invoices && data.invoices.length > 0
          ? `Ordem de Fornecimento e ${data.invoices.length} nota(s) vinculada(s) excluída(s) com sucesso.`
          : 'Ordem de Fornecimento excluída com sucesso.'
      );
      navigate('/ordens');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir OF.');
    }
  };

  const handleReplaceDocument = async () => {
    if (!replaceFile) return;
    if (!replaceReason.trim()) return;

    setReplacing(true);
    try {
      const formData = new FormData();
      formData.append('file', replaceFile);
      formData.append('reason', replaceReason.trim());

      await api.postMultipart(`/supply-orders/${id}/document`, formData);
      toast.success('Documento da Ordem de Fornecimento substituído com sucesso!');
      setReplaceModalOpen(false);
      setReplaceFile(null);
      setReplaceReason('');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao substituir documento.');
    } finally {
      setReplacing(false);
    }
  };

  const [confirmingDigital, setConfirmingDigital] = useState(false);

  const handleConfirmDigitalSign = async () => {
    try {
      setConfirmingDigital(true);
      await api.post(`/supply-orders/${id}/confirm-sign`, {});
      toast.success('Ordem de Fornecimento confirmada e assinada digitalmente com sucesso!');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao assinar digitalmente a OF.');
    } finally {
      setConfirmingDigital(false);
    }
  };

  if (isLoading || !data) {
    return <div className="text-center py-12 text-xs text-slate-500">Carregando OF...</div>;
  }

  const { supply_order, items = [], documents, invoices } = data;
  const currentDoc = documents.find((d) => d.is_current);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/ordens">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
              Ordens de Fornecimento
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
                OF nº {supply_order.of_number}
              </h1>
              <span
                className={`inline-flex items-center gap-1 text-2xs font-bold px-2.5 py-0.5 rounded-full ${
                  supply_order.status === 'CONFIRMADA'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : supply_order.status === 'CANCELADA'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
              >
                {supply_order.status === 'CONFIRMADA' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                {supply_order.status || 'CONFIRMADA'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Fornecedor: <span className="font-semibold text-slate-800 dark:text-slate-200">{supply_order.supplier_name}</span>
              {supply_order.contract_number && ` · Contrato: ${supply_order.contract_number}`}
              {supply_order.municipality && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  📍 {supply_order.municipality}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Ações de Download Oficial */}
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-3.5 h-3.5 text-indigo-600" />}
            onClick={async () => {
              try {
                toast.loading('Gerando PDF Oficial...', { id: 'pdf-dl-detail' });
                await downloadSupplyOrderPdf(id!, supply_order.of_number);
                toast.success('Download do PDF Oficial concluído!', { id: 'pdf-dl-detail' });
              } catch (e: any) {
                toast.error(e.message || 'Erro ao baixar PDF.', { id: 'pdf-dl-detail' });
              }
            }}
          >
            PDF Oficial
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
            onClick={async () => {
              try {
                toast.loading('Gerando Planilha XLSX...', { id: 'xlsx-dl-detail' });
                await downloadSupplyOrderXlsx(id!, supply_order.of_number);
                toast.success('Download da Planilha XLSX concluído!', { id: 'xlsx-dl-detail' });
              } catch (e: any) {
                toast.error(e.message || 'Erro ao baixar XLSX.', { id: 'xlsx-dl-detail' });
              }
            }}
          >
            Planilha XLSX
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<UploadCloud className="w-3.5 h-3.5" />}
            onClick={() => setSignedModalOpen(true)}
          >
            Anexar Via Assinada
          </Button>

          {profile?.role === 'admin' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<Pencil className="w-4 h-4" />}
                onClick={() => setEditModalOpen(true)}
              >
                Editar OF
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => setDeleteModalOpen(true)}
                className="bg-rose-700 hover:bg-rose-800 font-bold shadow-xs"
              >
                Excluir OF
              </Button>
            </>
          )}

          {invoices.length === 0 ? (
            <Button
              variant="primary"
              size="sm"
              icon={<Receipt className="w-4 h-4" />}
              onClick={() => setAttachInvoiceOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 font-bold shadow-xs"
            >
              Anexar Nota Fiscal
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setAttachInvoiceOpen(true)}
            >
              Adicionar Outra Nota Fiscal
            </Button>
          )}
        </div>
      </div>

      {/* Banner de Aguardando Assinatura */}
      {supply_order.status === 'AGUARDANDO_ASSINATURA' && (
        <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-bold">Aguardando Confirmação e Assinatura</p>
              <p className="text-2xs text-amber-700 dark:text-amber-300 mt-0.5">
                Você pode confirmar e aplicar a assinatura digital do Supervisor de Compras (Jonatha Pereira de Jesus) com 1 clique, ou anexar a via física digitalizada.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="primary"
              size="sm"
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              onClick={handleConfirmDigitalSign}
              loading={confirmingDigital}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Assinar e Confirmar OF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<UploadCloud className="w-3.5 h-3.5" />}
              onClick={() => setSignedModalOpen(true)}
            >
              Anexar Via Externa
            </Button>
          </div>
        </div>
      )}

      {/* Alerta de OF emitida aguardando entrega e NF */}
      {invoices.length === 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Ordem emitida — Aguardando recebimento e Nota Fiscal
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
                {items && items.length > 0
                  ? 'Os produtos desta OF já foram reservados e debitados do saldo do contrato. Assim que a mercadoria e a NF chegarem, anexe a NF para dar seguimento ao pagamento.'
                  : 'Esta OF foi gerada sem Nota Fiscal vinculada. Anexe a NF assim que emitida para encaminhamento ao setor de pagamentos.'}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Receipt className="w-4 h-4" />}
            onClick={() => setAttachInvoiceOpen(true)}
            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-bold"
          >
            Anexar Nota Fiscal Agora
          </Button>
        </div>
      )}

      {/* Tabela de Itens Solicitados nesta OF */}
      {items.length > 0 && (
        <Card title={`Itens Solicitados nesta Ordem de Fornecimento (${items.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider text-2xs">
                  <th className="py-2.5 px-3 w-16">Item</th>
                  <th className="py-2.5 px-3">Descrição do Material</th>
                  <th className="py-2.5 px-3 w-20 text-center">UND</th>
                  <th className="py-2.5 px-3 w-24 text-center">Qtd Solicitada</th>
                  <th className="py-2.5 px-3 w-28 text-right">Valor Unitário</th>
                  <th className="py-2.5 px-3 w-32 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((it: any) => (
                  <tr key={it.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {it.item_code}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                      {it.description}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-500">{it.unit}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                      {it.quantity}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300">
                      {formatBRL(it.unit_price)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                      {formatBRL(it.total_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Cartão de Arquivo da OF */}
      <Card title="Arquivo Oficial da Ordem de Fornecimento (PDF)">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <p className="text-sm font-bold text-slate-900">
              {currentDoc ? currentDoc.file_name : 'Nenhum PDF anexado à OF'}
            </p>
            {currentDoc && (
              <p className="text-xs text-slate-500 mt-0.5">
                Versão {currentDoc.version} · Enviado por {currentDoc.uploaded_by_name || 'Sistema'} em {formatDateTimeBR(currentDoc.uploaded_at)}
              </p>
            )}
          </div>

          <DocumentActions
            documentId={currentDoc?.id}
            fileName={currentDoc?.file_name}
            kindName="Ordem de Fornecimento"
            onReplace={() => setReplaceModalOpen(true)}
          />
        </div>

        {/* Histórico de versões se houver mais de 1 */}
        {documents.length > 1 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Histórico de versões anteriores
            </p>
            <div className="space-y-2">
              {documents.filter((d) => !d.is_current).map((oldDoc) => (
                <div key={oldDoc.id} className="text-xs p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-700">{oldDoc.file_name} (v{oldDoc.version})</span>
                    <p className="text-2xs text-slate-500">Substituído em {formatDateTimeBR(oldDoc.replaced_at)}: "{oldDoc.replace_reason}"</p>
                  </div>
                  <DocumentActions documentId={oldDoc.id} fileName={oldDoc.file_name} compact />
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Notas Fiscais Vinculadas a esta OF */}
      <Card title={`Notas Fiscais Vinculadas (${invoices.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-2xs">
                <th className="pb-2 font-semibold">Nº NF</th>
                <th className="pb-2 font-semibold">Emissão</th>
                <th className="pb-2 font-semibold">Modalidade</th>
                <th className="pb-2 font-semibold text-right">Valor</th>
                <th className="pb-2 font-semibold text-right">Total Pago</th>
                <th className="pb-2 font-semibold text-right">Saldo</th>
                <th className="pb-2 font-semibold text-center">Situação</th>
                <th className="pb-2 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 font-bold text-slate-900">{inv.invoice_number}</td>
                  <td className="py-2.5 text-slate-600">{formatDateBR(inv.issue_date)}</td>
                  <td className="py-2.5">{inv.modality || '—'}</td>
                  <td className="py-2.5 text-right font-medium text-slate-900 tabular-nums">
                    {formatBRL(inv.amount)}
                  </td>
                  <td className="py-2.5 text-right font-bold text-emerald-700 tabular-nums">
                    {formatBRL(inv.total_paid)}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-orange-700 tabular-nums">
                    {formatBRL(inv.balance)}
                  </td>
                  <td className="py-2.5 text-center">
                    <span className="font-semibold">{inv.status}</span>
                  </td>
                  <td className="py-2.5 text-right">
                    <Link to={`/notas/${inv.id}`}>
                      <Button variant="ghost" size="sm">Ver NF</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal para substituir documento com justificativa */}
      {replaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Substituir PDF da Ordem de Fornecimento</h3>
            <p className="text-xs text-slate-500">
              O arquivo anterior será preservado no histórico de versões para fins de auditoria.
            </p>

            <FileDropzone
              label="Novo arquivo PDF"
              onFileSelect={setReplaceFile}
              selectedFile={replaceFile}
              required
            />

            <Textarea
              label="Justificativa da substituição (obrigatória)"
              value={replaceReason}
              onChange={(e) => setReplaceReason(e.target.value)}
              placeholder="Ex: Correção de erro material no termo de referência..."
              rows={3}
              required
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setReplaceModalOpen(false)} disabled={replacing}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleReplaceDocument}
                loading={replacing}
                disabled={!replaceFile || !replaceReason.trim()}
              >
                Confirmar Substituição
              </Button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteDetailOf}
        title="Excluir Ordem de Fornecimento"
        itemIdentifier={`OF nº ${supply_order.of_number} · ${supply_order.supplier_name}`}
        description={
          invoices.length > 0
            ? `Tem certeza que deseja excluir esta Ordem de Fornecimento e todas as ${invoices.length} Nota(s) Fiscal(is) vinculada(s)? Esta operação removerá a Ordem e as notas vinculadas da base e da fila de pagamentos. Todos os dados serão registrados na auditoria.`
            : 'Tem certeza que deseja excluir esta Ordem de Fornecimento anexada por engano? Esta operação removerá a OF e os arquivos associados. Todos os dados serão registrados na auditoria.'
        }
        confirmButtonText={
          invoices.length > 0
            ? 'Sim, excluir OF e Notas Vinculadas'
            : 'Sim, excluir OF'
        }
      />

      <EditSupplyOrderModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={refetch}
        supplyOrder={supply_order}
      />

      <UploadSignedOfModal
        isOpen={signedModalOpen}
        onClose={() => setSignedModalOpen(false)}
        supplyOrderId={id || supply_order.id}
        ofNumber={supply_order.of_number}
      />

      <AnexarNotaModal
        isOpen={attachInvoiceOpen}
        onClose={() => setAttachInvoiceOpen(false)}
        supplyOrder={supply_order}
        defaultAmount={supply_order.total_value}
        onSuccess={refetch}
      />
    </div>
  );
}
