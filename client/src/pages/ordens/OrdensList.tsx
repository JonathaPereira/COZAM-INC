import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus, Search, Building2, Calendar, Eye, ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api.js';
import type { SupplyOrderRow } from '@cozam/shared';
import { formatBRL, formatDateBR, formatDateTimeBR } from '@cozam/shared';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Textarea } from '../../components/ui/Input.js';
import { FileDropzone } from '../../components/ui/FileDropzone.js';
import { DocumentActions } from '../../components/ui/DocumentViewerModal.js';
import { DeleteConfirmModal } from '../../components/ui/DeleteConfirmModal.js';
import { useAuth } from '../../contexts/AuthContext.js';

export function OrdensList() {
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SupplyOrderRow | null>(null);
  const { profile, can } = useAuth();
  const canWrite = can('supply_orders.write');

  const { data: ofs, isLoading, refetch } = useQuery({
    queryKey: ['supply-orders', search],
    queryFn: () => api.get<SupplyOrderRow[]>('/supply-orders', { search }),
  });

  const handleDeleteOf = async (reason: string) => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/supply-orders/${deleteTarget.id}`, { data: { reason } });
      toast.success(`Ordem de Fornecimento nº ${deleteTarget.of_number} excluída com sucesso.`);
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir OF.');
    }
  };

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
          <Link to="/lancamento">
            <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
              Nova Ordem de Fornecimento
            </Button>
          </Link>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar nº de OF, fornecedor ou processo..."
          className="w-full bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-600 focus:outline-none"
        />
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
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{o.of_number}</td>
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
                        {profile?.role === 'admin' && o.invoices_count === 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() => setDeleteTarget(o)}
                            title="Excluir OF anexada por engano"
                          />
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
        description="Tem certeza que deseja excluir esta Ordem de Fornecimento anexada por engano? Esta operação removerá a OF e os arquivos associados. Todos os dados serão registrados na auditoria."
        confirmButtonText="Sim, excluir OF"
      />
    </div>
  );
}

export function OrdemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceReason, setReplaceReason] = useState('');
  const [replacing, setReplacing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['supply-order-detail', id],
    queryFn: () =>
      api.get<{
        supply_order: SupplyOrderRow;
        documents: any[];
        invoices: any[];
      }>(`/supply-orders/${id}`),
    enabled: Boolean(id),
  });

  const handleDeleteDetailOf = async (reason: string) => {
    try {
      await api.delete(`/supply-orders/${id}`, { data: { reason } });
      toast.success('Ordem de Fornecimento excluída com sucesso.');
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

  if (isLoading || !data) {
    return <div className="text-center py-12 text-xs text-slate-500">Carregando OF...</div>;
  }

  const { supply_order, documents, invoices } = data;
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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
              OF nº {supply_order.of_number}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Fornecedor: <span className="font-semibold text-slate-800 dark:text-slate-200">{supply_order.supplier_name}</span> · Processo: {supply_order.process_number}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {profile?.role === 'admin' && invoices.length === 0 && (
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => setDeleteModalOpen(true)}
              className="bg-rose-700 hover:bg-rose-800 font-bold shadow-xs"
            >
              Excluir OF
            </Button>
          )}

          <Link to="/lancamento">
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
              Nova Nota Fiscal para esta OF
            </Button>
          </Link>
        </div>
      </div>

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
        description="Tem certeza que deseja excluir esta Ordem de Fornecimento anexada por engano? Esta operação removerá a OF e os arquivos associados. Todos os dados serão registrados na auditoria."
        confirmButtonText="Sim, excluir OF"
      />
    </div>
  );
}
