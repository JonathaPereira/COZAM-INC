import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api.js';
import { FilePlus2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface NovoAditivoModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  contractNumber: string;
  currentEndDate?: string;
}

export function NovoAditivoModal({
  isOpen,
  onClose,
  contractId,
  contractNumber,
  currentEndDate,
}: NovoAditivoModalProps) {
  const queryClient = useQueryClient();

  const [amendmentNumber, setAmendmentNumber] = useState('');
  const [amendmentType, setAmendmentType] = useState('PRAZO');
  const [signingDate, setSigningDate] = useState(new Date().toISOString().slice(0, 10));
  const [newEndDate, setNewEndDate] = useState('');
  const [additionalAmount, setAdditionalAmount] = useState(0);
  const [justification, setJustification] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/contracts/${contractId}/amendments`, data),
    onSuccess: () => {
      toast.success('Termo aditivo registrado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['contract-detail', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      onClose();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amendmentNumber.trim() || !justification.trim()) {
      toast.error('Informe a identificação do aditivo e a justificativa legal.');
      return;
    }

    if (amendmentType === 'PRAZO' && !newEndDate) {
      toast.error('Informe a nova data de encerramento da vigência.');
      return;
    }

    createMutation.mutate({
      amendment_number: amendmentNumber.trim(),
      amendment_type: amendmentType,
      signing_date: signingDate,
      new_end_date: amendmentType === 'PRAZO' ? newEndDate : undefined,
      additional_amount: Number(additionalAmount || 0),
      justification: justification.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FilePlus2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Novo Termo Aditivo — Contrato nº {contractNumber}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Prorrogação de prazo, acréscimo ou supressão de quantitativos e reajuste contratual.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Identificação do Aditivo *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: 1º Termo Aditivo"
                value={amendmentNumber}
                onChange={(e) => setAmendmentNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tipo de Alteração
              </label>
              <select
                value={amendmentType}
                onChange={(e) => setAmendmentType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              >
                <option value="PRAZO">Prorrogação de Prazo / Vigência</option>
                <option value="QUANTITATIVO_ACRESCIMO">Acréscimo de Quantitativo (até 25%)</option>
                <option value="QUANTITATIVO_SUPRESSAO">Supressão de Quantitativo</option>
                <option value="REAJUSTE">Reajuste de Preços</option>
                <option value="OUTRO">Outra Alteração Contratual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data de Assinatura do Aditivo
              </label>
              <input
                type="date"
                required
                value={signingDate}
                onChange={(e) => setSigningDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nova Data Final de Vigência
              </label>
              <input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                placeholder={currentEndDate}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {amendmentType !== 'PRAZO' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valor Adicional ou Ajuste Financeiro (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={additionalAmount}
                onChange={(e) => setAdditionalAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Justificativa Legal e Motivação *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Descreva a fundamentação legal (ex: art. 107 da Lei 14.133/2021) e os motivos..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white resize-none"
            />
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
              {createMutation.isPending ? 'Gravando Aditivo...' : 'Registrar Termo Aditivo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
