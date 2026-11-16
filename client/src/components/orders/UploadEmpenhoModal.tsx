import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../lib/api.js';
import { Modal } from '../ui/Modal.js';
import { Input, Textarea } from '../ui/Input.js';
import { Button } from '../ui/Button.js';
import { FileDropzone } from '../ui/FileDropzone.js';

interface UploadEmpenhoModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplyOrderId: string;
  ofNumber: string;
  currentEmpenhoNumber?: string | null;
  hasExistingEmpenho?: boolean;
  onSuccess?: (result: { document: any; empenho_number: string | null }) => void;
}

export function UploadEmpenhoModal({
  isOpen,
  onClose,
  supplyOrderId,
  ofNumber,
  currentEmpenhoNumber,
  hasExistingEmpenho = false,
  onSuccess,
}: UploadEmpenhoModalProps) {
  const queryClient = useQueryClient();
  const [empenhoNumber, setEmpenhoNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEmpenhoNumber(currentEmpenhoNumber || '');
      setFile(null);
      setReason('');
    }
  }, [isOpen, currentEmpenhoNumber]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error('Selecione o arquivo da Nota de Empenho (PDF, PNG ou JPG).');
      }
      const formData = new FormData();
      formData.append('file', file);
      if (empenhoNumber.trim()) {
        formData.append('empenho_number', empenhoNumber.trim());
      } else {
        formData.append('empenho_number', '');
      }
      if (hasExistingEmpenho && reason.trim()) {
        formData.append('reason', reason.trim());
      }
      return api.postMultipart<{ success: boolean; document: any; empenho_number: string | null }>(
        `/supply-orders/${supplyOrderId}/empenho`,
        formData
      );
    },
    onSuccess: (res) => {
      toast.success(`Empenho anexado à ${ofNumber} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['supply-order-detail', supplyOrderId] });
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onSuccess?.(res);
      onClose();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Selecione o arquivo do Empenho antes de salvar.');
      return;
    }
    uploadMutation.mutate();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${hasExistingEmpenho ? 'Substituir' : 'Anexar'} Empenho — ${ofNumber}`}
      subtitle="Anexe a Nota de Empenho vinculada a esta Ordem de Fornecimento (Material Elétrico ou Uso do COZAM)."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Número do Empenho (opcional)"
          value={empenhoNumber}
          onChange={(e) => setEmpenhoNumber(e.target.value)}
          placeholder="Ex: 2026NE00145"
          helperText="Ajuda a identificar rapidamente o empenho na listagem de ordens e relatórios."
        />

        <FileDropzone
          label="Arquivo do Empenho *"
          accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
          helperText="Aceita PDF ou imagem (PNG/JPG) até 20 MB"
          selectedFile={file}
          onFileSelect={setFile}
          required
        />

        {hasExistingEmpenho && (
          <Textarea
            label="Motivo da substituição (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Empenho retificado / reforço de empenho..."
            rows={2}
          />
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={uploadMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={uploadMutation.isPending}
            disabled={!file}
            icon={hasExistingEmpenho ? <UploadCloud className="w-4 h-4" /> : <FileCheck2 className="w-4 h-4" />}
          >
            {hasExistingEmpenho ? 'Salvar Novo Empenho' : 'Anexar Empenho'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
