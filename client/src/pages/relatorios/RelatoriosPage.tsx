import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Search,
  Calendar,
  Building2,
  Receipt,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../lib/api.js';
import type { ReportType, ReportResult, Supplier } from '@cozam/shared';
import {
  REPORT_TYPES,
  REPORT_LABELS,
  formatBRL,
  formatDateBR,
  formatDateTimeBR,
} from '@cozam/shared';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { exportReportToPdf } from '../../lib/export/pdf.js';
import { exportReportToExcel } from '../../lib/export/excel.js';

export function RelatoriosPage() {
  const [selectedType, setSelectedType] = useState<ReportType>('notas');
  const [supplierId, setSupplierId] = useState('');
  const [modality, setModality] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [invoiceId, setInvoiceId] = useState('');

  // Busca fornecedores para filtro
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<Supplier[]>('/suppliers'),
  });

  // Busca NFs caso o relatório seja o histórico individual de uma NF
  const { data: invoicesList } = useQuery({
    queryKey: ['invoices-picker'],
    queryFn: () => api.get<{ data: any[] }>('/invoices?pageSize=100'),
    enabled: selectedType === 'historico_nf',
  });

  // Consulta dados do relatório selecionado
  const { data: report, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['report', selectedType, supplierId, modality, dateFrom, dateTo, invoiceId],
    queryFn: () =>
      api.get<ReportResult>(`/reports/${selectedType}`, {
        supplier_id: supplierId,
        modality,
        date_from: dateFrom,
        date_to: dateTo,
        invoice_id: invoiceId,
      }),
    enabled: selectedType !== 'historico_nf' || Boolean(invoiceId),
  });

  const handleExportPdf = () => {
    if (!report || report.rows.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }
    try {
      exportReportToPdf(report);
      toast.success('Relatório em PDF gerado com sucesso!');
    } catch (err) {
      toast.error('Erro ao gerar PDF do relatório.');
    }
  };

  const handleExportExcel = async () => {
    if (!report || report.rows.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }
    try {
      await exportReportToExcel(report);
      toast.success('Relatório em Excel gerado com sucesso!');
    } catch (err) {
      toast.error('Erro ao gerar planilha Excel.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-heading">
            Relatórios Administrativos & Financeiros
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Demonstrativos consolidados com exportação oficial para PDF e Excel
          </p>
        </div>

        {report && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-4 h-4 text-emerald-700" />}
              onClick={handleExportPdf}
            >
              Exportar PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<FileSpreadsheet className="w-4 h-4 text-emerald-700" />}
              onClick={handleExportExcel}
            >
              Exportar Excel
            </Button>
          </div>
        )}
      </div>

      {/* Seletor dos 10 Relatórios da Especificação */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {REPORT_TYPES.map((type) => {
          const isSelected = selectedType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                setSelectedType(type);
                if (type !== 'historico_nf') setInvoiceId('');
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-600/20 text-emerald-950 font-bold shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/70'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
                <span className="text-xs leading-snug line-clamp-2">{REPORT_LABELS[type]}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Painel de Filtros do Relatório */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        {selectedType === 'historico_nf' ? (
          <div className="sm:col-span-3">
            <label className="block text-2xs font-semibold text-slate-600 uppercase mb-1">
              Selecione a Nota Fiscal <span className="text-rose-500">*</span>
            </label>
            <select
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
            >
              <option value="">Selecione uma Nota Fiscal...</option>
              {invoicesList?.data.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  NF nº {inv.invoice_number} — {inv.supplier_name} ({formatBRL(inv.amount)})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 uppercase mb-1">Período inicial</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 uppercase mb-1">Período final</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 uppercase mb-1">Fornecedor</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="">Todos os fornecedores</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 uppercase mb-1">Modalidade</label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="">Todas</option>
                <option value="FUMIP">FUMIP</option>
                <option value="COMPRA_COMPARTILHADA">Compra Compartilhada</option>
              </select>
            </div>
          </>
        )}
      </div>

      {/* Visualização da Tabela do Relatório */}
      <Card
        title={report ? report.title : REPORT_LABELS[selectedType]}
        subtitle={
          report
            ? `Gerado em ${formatDateTimeBR(report.generated_at)} por ${report.generated_by} · ${report.rows.length} registro(s)`
            : 'Selecione os parâmetros e aguarde o processamento'
        }
        className="p-0"
      >
        {isLoading || isFetching ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
            <p className="text-xs">Consolidando dados do relatório...</p>
          </div>
        ) : report && report.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 uppercase tracking-wider text-2xs">
                  {report.columns.map((c) => (
                    <th
                      key={c.key}
                      className={`py-3 px-4 font-semibold ${
                        c.type === 'money' || c.type === 'number' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/70 transition-colors">
                    {report.columns.map((c) => {
                      const v = row[c.key];
                      return (
                        <td
                          key={c.key}
                          className={`py-2.5 px-4 ${
                            c.type === 'money'
                              ? 'text-right font-medium tabular-nums text-slate-900'
                              : c.type === 'number'
                              ? 'text-right tabular-nums text-slate-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {v === null || v === undefined
                            ? '—'
                            : c.type === 'money'
                            ? formatBRL(v as number)
                            : c.type === 'date'
                            ? formatDateBR(v as string)
                            : c.type === 'datetime'
                            ? formatDateTimeBR(v as string)
                            : String(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              {report.totals && Object.keys(report.totals).length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-bold text-xs text-slate-900">
                    {report.columns.map((c, idx) => (
                      <td
                        key={c.key}
                        className={`py-3 px-4 ${
                          c.type === 'money' || c.type === 'number' ? 'text-right tabular-nums' : 'text-left'
                        }`}
                      >
                        {idx === 0
                          ? 'TOTAL GERAL'
                          : report.totals[c.key] !== undefined
                          ? c.type === 'money'
                            ? formatBRL(report.totals[c.key])
                            : report.totals[c.key]
                          : ''}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs">
            {selectedType === 'historico_nf' && !invoiceId
              ? 'Selecione uma Nota Fiscal acima para carregar o histórico.'
              : 'Nenhum dado encontrado para o relatório com os filtros aplicados.'}
          </div>
        )}
      </Card>
    </div>
  );
}
