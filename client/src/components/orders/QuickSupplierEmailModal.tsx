import React, { useEffect, useState } from 'react';
import { Mail, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../lib/api.js';
import { openGmailCompose, type SupplyOrderEmailParams } from '../../lib/email.js';
import { Modal } from '../ui/Modal.js';
import { Input } from '../ui/Input.js';
import { Button } from '../ui/Button.js';

export interface QuickSupplierEmailTarget {
  supplierId: string;
  supplierName: string;
  currentEmail?: string | null;
  orderId: string;
  ofNumber: string;
  contractNumber?: string | null;
  totalValue?: number | null;
  issueDate?: string | null;
  destinationName?: string | null;
  municipality?: string | null;
  deliveryDeadlineDays?: number | null;
  items?: SupplyOrderEmailParams['items'];
  notes?: string | null;
}

interface QuickSupplierEmailModalProps {
  target: QuickSupplierEmailTarget | null;
  onClose: () => void;
  onEmailSaved?: (supplierId: string, email: string) => void;
  onDownloadPdf?: (orderId: string, ofNumber: string) => Promise<void> | void;
}

export function QuickSupplierEmailModal({
  target,
  onClose,
  onEmailSaved,
  onDownloadPdf,
}: QuickSupplierEmailModalProps) {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [alsoDownloadPdf, setAlsoDownloadPdf] = useState(true);

  useEffect(() => {
    setEmail(target?.currentEmail || '');
  }, [target]);

  if (!target) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      toast.error('Informe o e-mail do fornecedor.');
      return;
    }

    setSaving(true);
    try {
      if (cleanEmail !== (target.currentEmail || '').trim()) {
        await api.patch(`/suppliers/${target.supplierId}`, { email: cleanEmail });
        onEmailSaved?.(target.supplierId, cleanEmail);
        toast.success(`E-mail salvo no cadastro de ${target.supplierName}!`);
      }

      if (alsoDownloadPdf && onDownloadPdf) {
        await onDownloadPdf(target.orderId, target.ofNumber);
      }

      const { opened } = openGmailCompose({
        ofNumber: target.ofNumber,
        supplierName: target.supplierName,
        supplierEmail: cleanEmail,
        contractNumber: target.contractNumber,
        totalValue: target.totalValue,
        issueDate: target.issueDate,
        destinationName: target.destinationName,
        municipality: target.municipality,
        deliveryDeadlineDays: target.deliveryDeadlineDays,
        items: target.items,
        notes: target.notes,
      });

      if (!opened) {
        toast.info('Libere pop-ups no navegador se o Gmail não abriu automaticamente.');
      }
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(target)}
      onClose={onClose}
      title={`Enviar ${target.ofNumber} via Gmail`}
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-700 dark:text-slate-200 space-y-1">
          <p>
            <span className="font-semibold">Fornecedor:</span> {target.supplierName}
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            O e-mail ficará salvo no cadastro do fornecedor. Ao confirmar, o Gmail abrirá na conta{' '}
            <strong>comprascozam@gmail.com</strong> com o texto institucional pré-preenchido para você anexar os arquivos e enviar.
          </p>
        </div>

        <Input
          label="E-mail do fornecedor *"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="compras@fornecedor.com.br"
          required
          autoFocus
        />

        {onDownloadPdf && (
          <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 cursor-pointer text-xs text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={alsoDownloadPdf}
              onChange={(e) => setAlsoDownloadPdf(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              <span className="font-semibold inline-flex items-center gap-1">
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                Baixar o PDF da OF automaticamente agora
              </span>
              <span className="block text-slate-500 mt-0.5">
                Facilita anexar o arquivo direto na janela do Gmail que será aberta.
              </span>
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={saving}
            icon={<Mail className="w-4 h-4" />}
          >
            Salvar e Abrir Gmail <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
