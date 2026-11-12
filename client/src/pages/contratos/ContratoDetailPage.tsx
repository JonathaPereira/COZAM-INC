import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useAuth } from '../../contexts/AuthContext.js';
import {
  FileSpreadsheet,
  Building,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Plus,
  ArrowLeft,
  FileText,
  History,
  Layers,
  FilePlus2,
  Download,
} from 'lucide-react';
import { NovoAditivoModal } from '../../components/contracts/NovoAditivoModal.js';

export function ContratoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();

  const [activeTab, setActiveTab] = useState<'itens' | 'ordens' | 'aditivos' | 'movimentacoes'>('itens');
  const [isAditivoModalOpen, setIsAditivoModalOpen] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['contract-detail', id],
    queryFn: () => api.get(`/contracts/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="p-12 text-center text-slate-500">Carregando detalhes do contrato...</div>;
  }

  if (!data?.contract) {
    return (
      <div className="p-12 text-center text-slate-500">
        <p>Contrato não encontrado.</p>
        <button onClick={() => navigate('/contratos')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg">
          Voltar para Lista
        </button>
      </div>
    );
  }

  const { contract, items = [], amendments = [], supply_orders = [] } = data;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const percentUsed =
    contract.total_amount > 0
      ? Math.min(100, Math.round((contract.requested_amount / contract.total_amount) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <button
        onClick={() => navigate('/contratos')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para Contratos
      </button>

      {/* Cabeçalho do Contrato */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Contrato nº {contract.contract_number}/{contract.year}
              </h1>
              {contract.computed_status === 'ATIVO' ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                </span>
              ) : contract.computed_status === 'PROXIMO_VENCIMENTO' ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <Clock className="w-3.5 h-3.5" /> Vence em {contract.days_to_expire} dias
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertCircle className="w-3.5 h-3.5" /> {contract.computed_status}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1 flex items-center gap-2">
              <Building className="w-4 h-4 text-slate-400" />
              {contract.supplier_name} {contract.supplier_cnpj && `(${contract.supplier_cnpj})`}
            </p>
            <p className="text-xs text-slate-500 mt-2 max-w-3xl leading-relaxed">{contract.object}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {can('contracts.write') && (
              <button
                onClick={() => setIsAditivoModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
              >
                <FilePlus2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Novo Termo Aditivo
              </button>
            )}
            <button
              onClick={() => navigate(`/lancamento?contract_id=${contract.id}`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Emitir Nova Ordem (OF)
            </button>
          </div>
        </div>

        {/* Metadados e Datas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Fundamentação Legal</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{contract.legal_framework}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Início da Vigência</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {new Date(contract.start_date).toLocaleDateString('pt-BR')}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Encerramento da Vigência</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {new Date(contract.end_date).toLocaleDateString('pt-BR')}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Prazo de Entrega</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {contract.delivery_deadline_days || 15} dias corridos
            </span>
          </div>
        </div>
      </div>

      {/* Cards de Saldo Contratual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Valor Total Contratado
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(contract.total_amount)}
          </div>
          <span className="text-2xs text-slate-500 mt-1 block">
            {items.length} {items.length === 1 ? 'item adjudicado' : 'itens adjudicados'}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Solicitado em OFs Confirmadas
            </span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{percentUsed}%</span>
          </div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatCurrency(contract.requested_amount)}
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-2">
            <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${percentUsed}%` }} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Saldo Contratual Disponível
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(contract.remaining_amount)}
          </div>
          <span className="text-2xs text-emerald-600 dark:text-emerald-400 mt-1 block font-medium">
            Disponível para novas Ordens de Fornecimento
          </span>
        </div>
      </div>

      {/* Navegação de Abas */}
      <div className="border-b border-slate-200 dark:border-slate-700 flex gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('itens')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'itens'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="w-4 h-4" /> Itens Contratados ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('ordens')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'ordens'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <FileText className="w-4 h-4" /> Ordens de Fornecimento ({supply_orders.length})
        </button>
        <button
          onClick={() => setActiveTab('aditivos')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'aditivos'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Calendar className="w-4 h-4" /> Termos Aditivos ({amendments.length})
        </button>
      </div>

      {/* Conteúdo da Aba 1: Itens Contratados e Saldos */}
      {activeTab === 'itens' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-5 py-3.5 w-16">Item</th>
                  <th className="px-5 py-3.5">Descrição do Material / Serviço</th>
                  <th className="px-5 py-3.5 w-20 text-center">UND</th>
                  <th className="px-5 py-3.5 w-24 text-center">Qtd Contratada</th>
                  <th className="px-5 py-3.5 w-24 text-center">Reservada (OFs)</th>
                  <th className="px-5 py-3.5 w-24 text-center">Solicitada (Baixas)</th>
                  <th className="px-5 py-3.5 w-24 text-center text-emerald-600 dark:text-emerald-400">
                    Saldo Disponível
                  </th>
                  <th className="px-5 py-3.5 w-28 text-right">Vlr Unitário</th>
                  <th className="px-5 py-3.5 w-32 text-right">Vlr Restante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {items.map((it: any) => (
                  <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-center">{it.item_code}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900 dark:text-white">{it.description}</div>
                      <div className="text-2xs text-slate-400 mt-0.5">{it.category}</div>
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs text-slate-500">{it.unit}</td>
                    <td className="px-5 py-3.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                      {it.original_quantity}
                    </td>
                    <td className="px-5 py-3.5 text-center font-medium text-amber-600 dark:text-amber-400">
                      {it.reserved_quantity || 0}
                    </td>
                    <td className="px-5 py-3.5 text-center font-medium text-indigo-600 dark:text-indigo-400">
                      {it.requested_quantity || 0}
                    </td>
                    <td className="px-5 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                      {it.available_quantity}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs">{formatCurrency(it.unit_price)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(it.remaining_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 2: Ordens de Fornecimento */}
      {activeTab === 'ordens' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
          {supply_orders.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Nenhuma Ordem de Fornecimento emitida para este contrato.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-3.5">Número da OF</th>
                    <th className="px-6 py-3.5">Data de Emissão</th>
                    <th className="px-6 py-3.5 text-right">Valor Total</th>
                    <th className="px-6 py-3.5">Situação</th>
                    <th className="px-6 py-3.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {supply_orders.map((ofItem: any) => (
                    <tr
                      key={ofItem.id}
                      onClick={() => navigate(`/ordens/${ofItem.id}`)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-white">
                        {ofItem.of_number}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                        {new Date(ofItem.issue_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-3.5 text-right font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(ofItem.total_value)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-2xs font-semibold px-2.5 py-0.5 rounded-full ${
                            ofItem.status === 'CONFIRMADA'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : ofItem.status === 'CANCELADA'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          {ofItem.status || 'CONFIRMADA'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                          Abrir OF
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Conteúdo da Aba 3: Termos Aditivos */}
      {activeTab === 'aditivos' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
          {amendments.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Nenhum termo aditivo registrado para este contrato.</div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {amendments.map((am: any) => (
                <div key={am.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-base">
                        {am.amendment_number}
                      </span>
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {am.amendment_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{am.justification}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                      <span>Celebrado em: {new Date(am.signing_date).toLocaleDateString('pt-BR')}</span>
                      {am.new_end_date && (
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          Nova Vigência: até {new Date(am.new_end_date).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                  {Number(am.additional_amount) > 0 && (
                    <div className="text-right">
                      <span className="text-2xs text-slate-400 block">Acréscimo Financeiro</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        + {formatCurrency(am.additional_amount)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Novo Aditivo */}
      <NovoAditivoModal
        isOpen={isAditivoModalOpen}
        onClose={() => setIsAditivoModalOpen(false)}
        contractId={contract.id}
        contractNumber={`${contract.contract_number}/${contract.year}`}
        currentEndDate={contract.end_date}
      />
    </div>
  );
}
