import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api.js';
import {
  FileText,
  Building,
  Landmark,
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

export function NovaOrdemWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedContractId, setSelectedContractId] = useState('');
  const [selectedDestinationId, setSelectedDestinationId] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Items selection: map of contract_item_id -> quantity to order
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});

  // Created OF result for Step 4
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);

  // Data fetching
  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ['suppliers-list'],
    queryFn: () => api.get('/suppliers'),
  });

  const { data: contracts = [] } = useQuery<any[]>({
    queryKey: ['contracts-by-supplier', selectedSupplierId],
    queryFn: () => api.get('/contracts', { supplier_id: selectedSupplierId, active_only: true }),
    enabled: !!selectedSupplierId,
  });

  const { data: contractDetail } = useQuery<any>({
    queryKey: ['contract-detail', selectedContractId],
    queryFn: () => api.get(`/contracts/${selectedContractId}`),
    enabled: !!selectedContractId,
  });

  const { data: destinations = [] } = useQuery<any[]>({
    queryKey: ['destinations-active'],
    queryFn: () => api.get('/destinations', { active_only: true }),
  });

  const createOrderMutation = useMutation({
    mutationFn: (payload: any) => api.post('/supply-orders', payload),
    onSuccess: (res: any) => {
      setCreatedOrder(res);
      setStep(4);
      toast.success('Ordem de Fornecimento emitida com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const handleDestinationSelect = (destId: string) => {
    setSelectedDestinationId(destId);
    const dest = destinations.find((d) => d.id === destId);
    if (dest) {
      setMunicipality(dest.city || dest.name);
    }
  };

  const handleQuantityChange = (itemId: string, qty: number, maxAvailable: number) => {
    if (qty > maxAvailable) {
      toast.error(`Quantidade solicitada (${qty}) excede o saldo contratual disponível (${maxAvailable}).`);
      return;
    }
    setSelectedQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(0, qty),
    }));
  };

  const availableItems = contractDetail?.items || [];

  const itemsToSubmit = Object.entries(selectedQuantities)
    .filter(([_, qty]) => qty > 0)
    .map(([contract_item_id, quantity]) => ({
      contract_item_id,
      quantity,
    }));

  const totalCalculated = itemsToSubmit.reduce((acc, it) => {
    const orig = availableItems.find((i: any) => i.id === it.contract_item_id);
    return acc + (orig ? Number(orig.unit_price) * it.quantity : 0);
  }, 0);

  const handleSubmit = () => {
    if (itemsToSubmit.length === 0) {
      toast.error('Selecione ao menos um item com quantidade positiva.');
      return;
    }

    createOrderMutation.mutate({
      contract_id: selectedContractId,
      supplier_id: selectedSupplierId,
      destination_id: selectedDestinationId || undefined,
      municipality: municipality.trim() || undefined,
      issue_date: issueDate,
      notes: notes.trim() || undefined,
      items: itemsToSubmit,
    });
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Botão Voltar */}
      <button
        onClick={() => navigate('/ordens')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para Ordens de Fornecimento
      </button>

      {/* Indicador de Passos */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              1
            </span>
            <span>Contrato & Fornecedor</span>
          </div>
          <div className="h-0.5 w-12 bg-slate-200 dark:bg-slate-700" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              2
            </span>
            <span>Destino & Município</span>
          </div>
          <div className="h-0.5 w-12 bg-slate-200 dark:bg-slate-700" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              3
            </span>
            <span>Seleção de Itens</span>
          </div>
          <div className="h-0.5 w-12 bg-slate-200 dark:bg-slate-700" />
          <div className={`flex items-center gap-2 ${step === 4 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 4 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              4
            </span>
            <span>Documentos Gerados</span>
          </div>
        </div>
      </div>

      {/* Passo 1: Contrato & Fornecedor */}
      {step === 1 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              1. Selecione o Fornecedor e o Contrato Vigente
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              A Ordem de Fornecimento deve estar obrigatoriamente vinculada a um contrato ativo com saldo disponível.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fornecedor *
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  setSelectedSupplierId(e.target.value);
                  setSelectedContractId('');
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              >
                <option value="">Selecione o Fornecedor...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.cnpj ? `— CNPJ: ${s.cnpj}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedSupplierId && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contrato Ativo *
                </label>
                {contracts.length === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-200">
                    Nenhum contrato ativo encontrado para este fornecedor. Cadastre um contrato previamente.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {contracts.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setSelectedContractId(c.id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${
                          selectedContractId === c.id
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            Contrato nº {c.contract_number}/{c.year}
                          </span>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            Saldo: {formatCurrency(c.remaining_amount)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-1">{c.object}</p>
                        <div className="flex items-center gap-4 text-2xs text-slate-400 mt-2">
                          <span>Vigência até: {new Date(c.end_date).toLocaleDateString('pt-BR')}</span>
                          <span>Prazo de Entrega: {c.delivery_deadline_days || 15} dias</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              disabled={!selectedContractId}
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              Avançar para Destino <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Passo 2: Destino & Município */}
      {step === 2 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              2. Identifique o Município e a Entidade Destinatária
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Essa informação constará no cabeçalho oficial da Ordem de Fornecimento e nos relatórios de repasses.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Destinatário Consorciado Cadastrado
              </label>
              <select
                value={selectedDestinationId}
                onChange={(e) => handleDestinationSelect(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              >
                <option value="">Selecione o Município ou Destinatário...</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.city}/{d.state})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Município (como sairá na OF) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Santana do Mundaú"
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data de Emissão da OF *
                </label>
                <input
                  type="date"
                  required
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Observações ou Instruções de Entrega (Opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Entregar no Almoxarifado Central da Secretaria de Obras até 17h..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white resize-none"
              />
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={!municipality.trim()}
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              Avançar para Seleção de Itens <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Passo 3: Seleção de Itens e Quantidades */}
      {step === 3 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              3. Defina as Quantidades a Solicitar
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Informe a quantidade para os itens desejados. O sistema bloqueará qualquer solicitação que exceda o saldo disponível.
            </p>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 sticky top-0">
                <tr>
                  <th className="p-3 w-16">Item</th>
                  <th className="p-3">Descrição do Material</th>
                  <th className="p-3 w-16 text-center">UND</th>
                  <th className="p-3 w-24 text-center">Saldo Disponível</th>
                  <th className="p-3 w-24 text-right">Vlr Unitário</th>
                  <th className="p-3 w-28 text-center">Quantidade nesta OF</th>
                  <th className="p-3 w-28 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {availableItems.map((it: any) => {
                  const qty = selectedQuantities[it.id] || 0;
                  const maxAvail = Number(it.available_quantity || 0);
                  const subtotal = qty * Number(it.unit_price || 0);

                  return (
                    <tr key={it.id} className={qty > 0 ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''}>
                      <td className="p-3 font-mono text-center">{it.item_code}</td>
                      <td className="p-3 font-medium text-slate-900 dark:text-white">{it.description}</td>
                      <td className="p-3 text-center text-slate-500">{it.unit}</td>
                      <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {maxAvail}
                      </td>
                      <td className="p-3 text-right">{formatCurrency(it.unit_price)}</td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min={0}
                          max={maxAvail}
                          value={qty || ''}
                          placeholder="0"
                          disabled={maxAvail <= 0}
                          onChange={(e) =>
                            handleQuantityChange(it.id, Number(e.target.value), maxAvail)
                          }
                          className="w-20 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-center text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                        {formatCurrency(subtotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Resumo Financeiro */}
          <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 block">Itens selecionados:</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {itemsToSubmit.length} {itemsToSubmit.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">VALOR TOTAL DA ORDEM:</span>
              <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                {formatCurrency(totalCalculated)}
              </span>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={itemsToSubmit.length === 0 || createOrderMutation.isPending}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors shadow-xs"
            >
              {createOrderMutation.isPending ? 'Gerando Ordem...' : 'Emitir Ordem de Fornecimento'}
            </button>
          </div>
        </div>
      )}

      {/* Passo 4: Conclusão & Download dos Documentos */}
      {step === 4 && createdOrder && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 shadow-md text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Ordem de Fornecimento Emitida com Sucesso!
            </h2>
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
              Identificação: {createdOrder.of_number} — Código: {createdOrder.tracking_code}
            </p>
            <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
              O saldo contratual foi reservado no sistema e aguarda a coleta da via física assinada para baixa definitiva.
            </p>
          </div>

          {/* Botões de Download em Alta Fidelidade */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <a
              href={`/api/supply-orders/${createdOrder.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" /> Download em PDF Oficial
            </a>
            <a
              href={`/api/supply-orders/${createdOrder.id}/xlsx`}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" /> Download Planilha XLSX Oficial
            </a>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-center gap-4">
            <button
              onClick={() => navigate(`/ordens/${createdOrder.id}`)}
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:underline"
            >
              Abrir detalhes desta OF
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => navigate('/ordens')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Ir para lista de Ordens de Fornecimento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
