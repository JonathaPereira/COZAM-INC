import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../lib/api.js';

const ITEM_CATEGORIES = [
  { value: 'MATERIAL_CONSUMO', label: 'Material de Consumo / Limpeza' },
  { value: 'MATERIAL_EXPEDIENTE', label: 'Material de Expediente' },
  { value: 'AGUA_CAFE', label: 'Água / Café / Alimentação' },
  { value: 'MATERIAL_ELETRICO', label: 'Material Elétrico / Iluminação' },
  { value: 'EPIS', label: 'EPIs / Segurança' },
  { value: 'SERVICOS', label: 'Serviços' },
  { value: 'LOCACAO', label: 'Locação' },
  { value: 'OUTROS', label: 'Outros' },
];

interface EditarItemContratoModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  item: any | null; // null = adicionar novo item
  nextSuggestedCode?: string;
}

export function EditarItemContratoModal({
  isOpen,
  onClose,
  contractId,
  item,
  nextSuggestedCode = '01',
}: EditarItemContratoModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!item;

  const [itemCode, setItemCode] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('MATERIAL_CONSUMO');
  const [unit, setUnit] = useState('UN');
  const [originalQuantity, setOriginalQuantity] = useState<string>('1');
  const [unitPrice, setUnitPrice] = useState<string>('0');
  const [recalculateTotal, setRecalculateTotal] = useState(true);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setItemCode(item.item_code || '');
        setDescription(item.description || '');
        setCategory(item.category || 'MATERIAL_CONSUMO');
        setUnit(item.unit || 'UN');
        setOriginalQuantity(String(item.original_quantity ?? 1));
        setUnitPrice(String(item.unit_price ?? 0));
        setRecalculateTotal(true);
      } else {
        setItemCode(nextSuggestedCode);
        setDescription('');
        setCategory('MATERIAL_CONSUMO');
        setUnit('UN');
        setOriginalQuantity('1');
        setUnitPrice('0');
        setRecalculateTotal(true);
      }
    }
  }, [isOpen, item, nextSuggestedCode]);

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      isEditing
        ? api.patch(`/contracts/${contractId}/items/${item.id}`, payload)
        : api.post(`/contracts/${contractId}/items`, payload),
    onSuccess: () => {
      toast.success(isEditing ? 'Item contratual corrigido com sucesso!' : 'Novo item adicionado ao contrato!');
      queryClient.invalidateQueries({ queryKey: ['contract-detail', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-items-search'] });
      onClose();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  if (!isOpen) return null;

  const qtyNum = Number(originalQuantity || 0);
  const priceNum = Number(unitPrice || 0);
  const lineTotal = Math.round(qtyNum * priceNum * 100) / 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemCode.trim() || !description.trim() || !unit.trim()) {
      toast.error('Preencha código, descrição e unidade do item.');
      return;
    }
    if (qtyNum <= 0 || priceNum <= 0) {
      toast.error('Quantidade e valor unitário devem ser maiores que zero.');
      return;
    }

    saveMutation.mutate({
      item_code: itemCode.trim(),
      description: description.trim(),
      category,
      unit: unit.trim(),
      original_quantity: qtyNum,
      unit_price: priceNum,
      recalculate_contract_total: recalculateTotal,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {isEditing ? `Corrigir Item ${item.item_code}` : 'Adicionar Item ao Contrato'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ajuste manual caso algum item da tabela tenha ficado fora de esquadro ou incompleto.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Código / Nº Item</label>
              <input
                type="text"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Unidade (UND)</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Ex: Pacote, UN, Caixa, Litro"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
              >
                {ITEM_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">
              Descrição Completa do Material / Serviço
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Quantidade Contratada</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={originalQuantity}
                onChange={(e) => setOriginalQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Valor Unitário (R$)</label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Total Calculado</label>
              <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg font-bold text-emerald-700 dark:text-emerald-300">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lineTotal)}
              </div>
            </div>
          </div>

          {isEditing && (Number(item.reserved_quantity || 0) > 0 || Number(item.requested_quantity || 0) > 0) && (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2 text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Este item já possui <strong>{Number(item.reserved_quantity || 0) + Number(item.requested_quantity || 0)} {item.unit}</strong> consumidos/reservados em OFs. O saldo disponível será recalculado proporcionalmente.
              </span>
            </div>
          )}

          <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={recalculateTotal}
              onChange={(e) => setRecalculateTotal(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600"
            />
            <span>Ajustar o valor global do contrato automaticamente com a diferença deste item</span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Salvando...' : isEditing ? 'Salvar Correção' : 'Adicionar Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
