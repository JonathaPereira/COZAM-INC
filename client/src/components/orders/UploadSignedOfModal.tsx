import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api.js';
import { UploadCloud, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface UploadSignedOfModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplyOrderId: string;
  ofNumber: string;
}

export function UploadSignedOfModal({
  isOpen,
  onClose,
  supplyOrderId,
  ofNumber,
}: UploadSignedOfModalProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (uploadedFile: File) => {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      return api.postMultipart(`/supply-orders/${supplyOrderId}/upload-signed`, formData);
    },
    onSuccess: () => {
      toast.success('Via assinada da OF registrada e saldo baixado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['supply-order-detail', supplyOrderId] });
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      onClose();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.toLowerCase().endsWith('.pdf')) {
        toast.error('O documento assinado deve ser enviado em formato PDF.');
        return;
      }
      setFile(selected);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Selecione o arquivo PDF assinado.');
      return;
    }
    uploadMutation.mutate(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Anexar Via Assinada — OF {ofNumber}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              O envio da via física assinada confirma a baixa efetiva no saldo contratual.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center hover:border-emerald-500 transition-colors bg-slate-50 dark:bg-slate-900/50">
            <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Selecione o PDF digitalizado com as assinaturas
            </p>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
              id="signed-of-upload"
            />
            <label
              htmlFor="signed-of-upload"
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Escolher PDF Assinado
            </label>
            {file && (
              <div className="mt-3 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded text-2xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {file.name}
              </div>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-2xs text-slate-500 flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-indigo-500" />
            <span>
              Ao enviar a via assinada, a situação da Ordem mudará para <strong>CONFIRMADA</strong> e o saldo reservado
              será convertido definitivamente em baixa no contrato.
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!file || uploadMutation.isPending}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {uploadMutation.isPending ? 'Enviando...' : 'Confirmar e Baixar Saldo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
