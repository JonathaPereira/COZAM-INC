import React, { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../lib/api.js';
import type { InvoiceRow, Modality } from '@cozam/shared';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { Input, Textarea, Select } from '../ui/Input.js';
import { CurrencyInput } from '../ui/CurrencyInput.js';
import { MunicipalitySelect } from '../ui/MunicipalitySelect.js';

interface EditInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: InvoiceRow | null;
}

export function EditInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  invoice,
}: EditInvoiceModalProps) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [modality, setModality] = useState<Modality | ''>('');
  const [municipality, setMunicipality] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      setInvoiceNumber(invoice.invoice_number || '');
      setIssueDate(invoice.issue_date ? invoice.issue_date.slice(0, 10) : '');
      setAmount(invoice.amount !== null ? Number(invoice.amount) : null);
      setModality(invoice.modality || '');
      setMunicipality(invoice.municipality || '');
      setNotes(invoice.notes || '');
      setReason('');
    }
  }, [invoice, isOpen]);

  if (!isOpen || !invoice) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim()) {
      toast.error('O número da Nota Fiscal é obrigatório.');
      return;
    }
    if (!issueDate) {
      toast.error('A data de emissão é obrigatória.');
      return;
    }
    if (amount === null || amount <= 0) {
      toast.error('O valor da Nota Fiscal deve ser maior que zero.');
      return;
    }
    if (!modality) {
      toast.error('Selecione a modalidade da Nota Fiscal.');
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/invoices/${invoice.id}`, {
        invoice_number: invoiceNumber.trim(),
        issue_date: issueDate,
        amount,
        modality,
        municipality: municipality.trim() || null,
        notes: notes.trim() || null,
        reason: reason.trim() || undefined,
      });

      toast.success(`Nota Fiscal nº ${invoiceNumber} atualizada com sucesso.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Erro ao atualizar dados da NF.');
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
          <span>Editar Dados da Nota Fiscal</span>
        </div>
      }
      subtitle={`Fornecedor: ${invoice.supplier_name || '—'} · Situação: ${invoice.status}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Número da NF <span className="text-rose-500">*</span>
            </label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ex: 001.234"
              required
            />
          </div>

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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Valor da NF (R$) <span className="text-rose-500">*</span>
            </label>
            <CurrencyInput
              value={amount}
              onChange={setAmount}
              placeholder="0,00"
              required
            />
          </div>

          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Modalidade <span className="text-rose-500">*</span>
            </label>
            <Select
              value={modality}
              onChange={(e) => setModality(e.target.value as Modality)}
              required
            >
              <option value="">Selecione...</option>
              <option value="FUMIP">FUMIP</option>
              <option value="COMPRA_COMPARTILHADA">Compra Compartilhada</option>
            </Select>
          </div>
        </div>

        <div>
          <MunicipalitySelect
            value={municipality}
            onChange={setMunicipality}
            label="Município Consorciado"
          />
        </div>

        <div>
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
            Observações Administrativas
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações complementares sobre a NF..."
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
            placeholder="Ex: Correção de valor ou dados digitados incorretamente..."
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
