import React, { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../lib/api.js';
import type { SupplyOrderRow } from '@cozam/shared';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { Input, Textarea } from '../ui/Input.js';
import { CurrencyInput } from '../ui/CurrencyInput.js';
import { MunicipalitySelect } from '../ui/MunicipalitySelect.js';

interface EditSupplyOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplyOrder: SupplyOrderRow | null;
}

export function EditSupplyOrderModal({
  isOpen,
  onClose,
  onSuccess,
  supplyOrder,
}: EditSupplyOrderModalProps) {
  const [ofNumber, setOfNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [totalValue, setTotalValue] = useState<number | null>(null);
  const [municipality, setMunicipality] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (supplyOrder) {
      setOfNumber(supplyOrder.of_number || '');
      setIssueDate(supplyOrder.issue_date ? supplyOrder.issue_date.slice(0, 10) : '');
      setTotalValue(supplyOrder.total_value !== null ? Number(supplyOrder.total_value) : null);
      setMunicipality(supplyOrder.municipality || '');
      setNotes(supplyOrder.notes || '');
      setReason('');
    }
  }, [supplyOrder, isOpen]);

  if (!isOpen || !supplyOrder) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ofNumber.trim()) {
      toast.error('O número da Ordem de Fornecimento é obrigatório.');
      return;
    }
    if (!issueDate) {
      toast.error('A data de emissão é obrigatória.');
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/supply-orders/${supplyOrder.id}`, {
        of_number: ofNumber.trim(),
        issue_date: issueDate,
        total_value: totalValue,
        municipality: municipality.trim() || null,
        notes: notes.trim() || null,
        reason: reason.trim() || undefined,
      });

      toast.success(`Ordem de Fornecimento nº ${ofNumber} atualizada com sucesso.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Erro ao atualizar dados da OF.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Pencil className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>Editar Dados da Ordem de Fornecimento</span>
        </div>
      }
      subtitle={`Fornecedor: ${supplyOrder.supplier_name} · Processo: ${supplyOrder.process_number || '—'}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
            Número da OF <span className="text-rose-500">*</span>
          </label>
          <Input
            value={ofNumber}
            onChange={(e) => setOfNumber(e.target.value)}
            placeholder="Ex: OF-012/2026"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Data de Emissão <span className="text-rose-500">*</span>
            </label>
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Valor Total Previsto (R$)
            </label>
            <CurrencyInput
              value={totalValue}
              onChange={setTotalValue}
              placeholder="0,00"
            />
          </div>
        </div>

        <MunicipalitySelect
          value={municipality}
          onChange={setMunicipality}
          label="Município Consorciado"
        />

        <div>
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
            Observações Administrativas
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações complementares sobre a OF..."
            rows={2}
          />
        </div>

        <div>
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
            Justificativa da Alteração <span className="text-slate-400 font-normal lowercase">(opcional para auditoria)</span>
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Correção de data ou valor digitado incorretamente..."
            rows={2}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Salvar Alterações
          </Button>
        </div>
      </form>
    </Modal>
  );
}
