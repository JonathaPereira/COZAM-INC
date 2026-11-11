import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api.js';
import { Plus, Trash2, AlertCircle, FileText, Calculator } from 'lucide-react';
import { toast } from 'sonner';

interface NovoContratoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
}

export function NovoContratoModal({ isOpen, onClose, initialData }: NovoContratoModalProps) {
  const queryClient = useQueryClient();

  const [contractNumber, setContractNumber] = useState(initialData?.contract_number || '');
  const [year, setYear] = useState(initialData?.year || new Date().getFullYear());
  const [supplierId, setSupplierId] = useState(initialData?.supplier_id || '');
  const [procurementId, setProcurementId] = useState(initialData?.procurement_id || '');
  const [object, setObject] = useState(initialData?.object || '');
  const [legalFramework, setLegalFramework] = useState(initialData?.legal_framework || 'Lei 14.133/2021');
  const [signingDate, setSigningDate] = useState(initialData?.signing_date || new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState(initialData?.start_date || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initialData?.end_date || '');
  const [deliveryDays, setDeliveryDays] = useState(initialData?.delivery_deadline_days || 15);

  const [items, setItems] = useState<any[]>(
    initialData?.items?.length
      ? initialData.items
      : [
          {
            item_code: '1-1',
            item_group: '',
            description: '',
            category: 'MATERIAL_CONSUMO',
            unit: 'Unidade',
            original_quantity: 1,
            unit_price: 0,
            total_price: 0,
          },
        ]
  );

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ['suppliers-list'],
    queryFn: () => api.get('/suppliers'),
  });

  const { data: procurements = [] } = useQuery<any[]>({
    queryKey: ['procurements-list'],
    queryFn: () => api.get('/procurements'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/contracts', data),
    onSuccess: () => {
      toast.success('Contrato e itens cadastrados com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contracts-list'] });
      onClose();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  if (!isOpen) return null;

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      const it = { ...next[index], [field]: value };
      if (field === 'original_quantity' || field === 'unit_price') {
        const q = Number(it.original_quantity || 0);
        const u = Number(it.unit_price || 0);
        it.total_price = Math.round(q * u * 100) / 100;
      }
      next[index] = it;
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        item_code: `${prev.length + 1}-1`,
        item_group: '',
        description: '',
        category: 'MATERIAL_CONSUMO',
        unit: 'Unidade',
        original_quantity: 1,
        unit_price: 0,
        total_price: 0,
      },
    ]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalContract = items.reduce((acc, it) => acc + Number(it.total_price || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractNumber.trim() || !supplierId || !object.trim() || !startDate || !endDate) {
      toast.error('Preencha os campos obrigatórios (Número, Fornecedor, Objeto e Vigência).');
      return;
    }

    if (items.some((it) => !it.description.trim() || Number(it.original_quantity) <= 0 || Number(it.unit_price) <= 0)) {
      toast.error('Todos os itens devem ter descrição, quantidade positiva e valor unitário.');
      return;
    }

    createMutation.mutate({
      contract_number: contractNumber.trim(),
      year: Number(year),
      procurement_id: procurementId || undefined,
      supplier_id: supplierId,
      object: object.trim(),
      legal_framework: legalFramework.trim(),
      signing_date: signingDate,
      start_date: startDate,
      end_date: endDate,
      delivery_deadline_days: Number(deliveryDays),
      total_amount: totalContract,
      status: 'ATIVO',
      items: items.map((it, idx) => ({
        item_code: it.item_code?.trim() || `${idx + 1}`,
        item_group: it.item_group?.trim() || undefined,
        description: it.description.trim(),
        category: it.category || 'MATERIAL_CONSUMO',
        unit: it.unit?.trim() || 'Unidade',
        original_quantity: Number(it.original_quantity),
        unit_price: Number(it.unit_price),
        total_price: Number(it.total_price),
      })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-4xl w-full p-6 border border-slate-200 dark:border-slate-700 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Cadastrar Novo Contrato
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro do contrato administrativo com amarração matemática de saldo por item.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Dados do Contrato */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Número do Contrato *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: 012/2026"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ano *</label>
              <input
                type="number"
                required
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fornecedor Contratado *
              </label>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              >
                <option value="">Selecione o Fornecedor...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.cnpj ? `(${s.cnpj})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Processo Licitatório Vinculado
              </label>
              <select
                value={procurementId}
                onChange={(e) => setProcurementId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              >
                <option value="">Selecione (Opcional)...</option>
                {procurements.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.process_number}/{p.year} {p.bidding_number ? `— ${p.bidding_number}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fundamentação Legal
              </label>
              <input
                type="text"
                value={legalFramework}
                onChange={(e) => setLegalFramework(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Prazo de Entrega (Dias)
              </label>
              <input
                type="number"
                min={1}
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Objeto Contratual *
            </label>
            <textarea
              required
              rows={2}
              placeholder="Descreva o objeto contratual..."
              value={object}
              onChange={(e) => setObject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Vigência */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data de Assinatura
              </label>
              <input
                type="date"
                required
                value={signingDate}
                onChange={(e) => setSigningDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Início da Vigência *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fim da Vigência *
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Itens do Contrato */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Itens Contratados (Saldo Inicial)
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Item
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 sticky top-0">
                  <tr>
                    <th className="p-2 w-16">Item</th>
                    <th className="p-2">Descrição</th>
                    <th className="p-2 w-28">Categoria</th>
                    <th className="p-2 w-20">Unidade</th>
                    <th className="p-2 w-20 text-center">Qtd</th>
                    <th className="p-2 w-24 text-right">Vlr Unit (R$)</th>
                    <th className="p-2 w-28 text-right">Total (R$)</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.item_code}
                          onChange={(e) => handleItemChange(idx, 'item_code', e.target.value)}
                          className="w-full px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-center"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          required
                          placeholder="Descrição do material ou serviço"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          className="w-full px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={item.category}
                          onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                          className="w-full px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs"
                        >
                          <option value="MATERIAL_CONSUMO">Consumo</option>
                          <option value="MATERIAL_EXPEDIENTE">Expediente</option>
                          <option value="AGUA_CAFE">Água/Café</option>
                          <option value="MATERIAL_ELETRICO">Elétrico</option>
                          <option value="EPIS">EPIs</option>
                          <option value="SERVICOS">Serviços</option>
                          <option value="LOCACAO">Locação</option>
                          <option value="OUTROS">Outros</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          className="w-full px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-center"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          value={item.original_quantity}
                          onChange={(e) => handleItemChange(idx, 'original_quantity', e.target.value)}
                          className="w-full px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-center"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                          className="w-full px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-right"
                        />
                      </td>
                      <td className="p-2 text-right font-semibold text-slate-800 dark:text-slate-200">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          item.total_price || 0
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-rose-500 hover:text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totalizador */}
            <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900 p-3 rounded-lg mt-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                TOTAL GLOBAL DO CONTRATO:
              </span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalContract)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {createMutation.isPending ? 'Salvando Contrato...' : 'Salvar Contrato e Itens'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
