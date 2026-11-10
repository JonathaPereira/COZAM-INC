import React, { useState } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { Button } from './Button.js';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  title: string;
  description: string;
  itemIdentifier?: string;
  confirmButtonText?: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemIdentifier,
  confirmButtonText = 'Confirmar Exclusão',
}: DeleteConfirmModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rose-100 dark:border-rose-950 bg-rose-50/60 dark:bg-rose-950/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold text-sm">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                {title}
              </h3>
              {itemIdentifier && (
                <p className="text-2xs font-semibold text-rose-700 dark:text-rose-400">
                  {itemIdentifier}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              {description}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Justificativa da Exclusão <span className="font-normal text-slate-400 lowercase">(opcional para auditoria)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Anexada por engano no processo errado / Documento duplicado..."
              rows={3}
              className="w-full text-xs p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-colors resize-none"
            />
            <p className="text-2xs text-slate-400 dark:text-slate-500 mt-1">
              Esta ação será gravada na trilha de auditoria e ficará visível aos setores de Compras e Pagamentos.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={loading}
              onClick={handleConfirm}
              icon={<Trash2 className="w-4 h-4" />}
            >
              {confirmButtonText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
