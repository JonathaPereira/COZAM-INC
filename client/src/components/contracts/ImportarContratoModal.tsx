import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api.js';
import { UploadCloud, CheckCircle2, AlertTriangle, FileText, Check, ArrowRight, RefreshCw, Plus, Building } from 'lucide-react';
import { toast } from 'sonner';

interface ImportarContratoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessOpenManual?: (data: any) => void;
}

export function ImportarContratoModal({ isOpen, onClose }: ImportarContratoModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Consulta fornecedores cadastrados
  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ['suppliers-list'],
    queryFn: () => api.get('/suppliers'),
  });

  // Cadastro rápido do fornecedor do PDF se não existir
  const quickRegisterSupplierMutation = useMutation({
    mutationFn: async (supplierData: any) => api.post<any>('/suppliers', supplierData),
    onSuccess: (newSupplier) => {
      toast.success(`Fornecedor ${newSupplier.name} cadastrado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['suppliers-list'] });
      setExtractedData((prev: any) => ({
        ...prev,
        matched_supplier: newSupplier,
      }));
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Parse mutation
  const parseMutation = useMutation({
    mutationFn: async (uploadedFile: File) => {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      return api.postMultipart<any>('/contracts/parse-pdf', formData);
    },
    onSuccess: (res) => {
      setExtractedData(res.extracted_data);
      setIsReviewing(true);
      toast.success('Dados do contrato extraídos com sucesso! Revise os campos antes de confirmar.');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Dispara a leitura do PDF imediatamente ao selecionar o arquivo
  const processAndAnalyzeFile = (selected: File) => {
    if (!selected.name.toLowerCase().endsWith('.pdf') && selected.type !== 'application/pdf') {
      toast.error('Por favor, selecione um arquivo em formato PDF.');
      return;
    }
    if (selected.size > 25 * 1024 * 1024) {
      toast.error('O arquivo PDF ultrapassa o limite de 25MB.');
      return;
    }
    setFile(selected);
    parseMutation.mutate(selected);
  };

  // Final contract creation mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/contracts', payload),
    onSuccess: () => {
      toast.success('Contrato importado e confirmado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contracts-list'] });
      handleClose();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  if (!isOpen) return null;

  const handleClose = () => {
    setFile(null);
    setExtractedData(null);
    setIsReviewing(false);
    setIsDragging(false);
    parseMutation.reset();
    onClose();
  };

  const handleConfirmContract = () => {
    if (!extractedData) return;

    if (!extractedData.matched_supplier?.id) {
      toast.error('O fornecedor extraído não foi encontrado no cadastro. Cadastre o fornecedor previamente.');
      return;
    }

    if (!extractedData.contract_number || !extractedData.start_date || !extractedData.end_date) {
      toast.error('Preencha os campos obrigatórios (Número e Vigência).');
      return;
    }

    const payload = {
      contract_number: extractedData.contract_number,
      year: Number(extractedData.year || new Date().getFullYear()),
      supplier_id: extractedData.matched_supplier.id,
      object: extractedData.object || 'Contrato importado via PDF',
      legal_framework: extractedData.legal_framework || 'Lei 14.133/2021',
      signing_date: extractedData.signing_date || new Date().toISOString().slice(0, 10),
      start_date: extractedData.start_date,
      end_date: extractedData.end_date,
      delivery_deadline_days: Number(extractedData.delivery_deadline_days || 15),
      total_amount: Number(extractedData.total_amount || 0),
      status: 'ATIVO',
      items: (extractedData.items || []).map((it: any, idx: number) => ({
        item_code: it.item_code || `${idx + 1}`,
        description: it.description,
        category: it.category || 'MATERIAL_CONSUMO',
        unit: it.unit || 'UN',
        original_quantity: Number(it.original_quantity),
        unit_price: Number(it.unit_price),
        total_price: Number(it.total_price),
      })),
    };

    createMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-3xl w-full p-6 border border-slate-200 dark:border-slate-700 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UploadCloud className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Importação de Contrato em PDF
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Extração automática de cláusulas, fornecedor e tabela de itens com conferência humana obrigatória.
            </p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xl">
            &times;
          </button>
        </div>

        {!isReviewing ? (
          /* Etapa 1: Upload e Análise Automática do Arquivo */
          <div className="space-y-6 mt-6">
            {parseMutation.isPending ? (
              <div className="p-10 flex flex-col items-center justify-center text-center space-y-4 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-2xl border-2 border-indigo-300 dark:border-indigo-700 animate-pulse">
                <div className="relative">
                  <RefreshCw className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Analisando Contrato em PDF...
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-md">
                    Processando texto, identificando fornecedor e extraindo quantitativos e valores com validação matemática.
                  </p>
                </div>
                {file && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-full text-xs font-semibold text-indigo-700 dark:text-indigo-300 shadow-xs">
                    <FileText className="w-3.5 h-3.5" />
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
            ) : (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) processAndAnalyzeFile(dropped);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/50 scale-[1.01]'
                      : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500 bg-slate-50 dark:bg-slate-900/50 hover:bg-indigo-50/30'
                  }`}
                >
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-full w-14 h-14 mx-auto mb-3 shadow-xs flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Arraste o arquivo PDF aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-slate-500 mt-1.5">
                    O sistema analisará e extrairá as cláusulas e itens automaticamente assim que o arquivo for selecionado.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Suporta arquivos PDF de até 25MB.
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onClick={(e) => {
                      (e.target as HTMLInputElement).value = '';
                    }}
                    onChange={(e) => {
                      const selected = e.target.files?.[0];
                      if (selected) processAndAnalyzeFile(selected);
                    }}
                  />

                  <div className="mt-5">
                    <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-transform active:scale-95">
                      <FileText className="w-4 h-4" /> Selecionar Arquivo PDF do Computador
                    </span>
                  </div>

                  {file && (
                    <div className="mt-4 p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>

                {parseMutation.isError && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-800 dark:text-rose-200 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                      Não foi possível analisar este arquivo PDF
                    </div>
                    <p className="text-xs text-rose-700 dark:text-rose-300">
                      {getErrorMessage(parseMutation.error)}
                    </p>
                    <div className="pt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          parseMutation.reset();
                          fileInputRef.current?.click();
                        }}
                        className="px-3 py-1.5 text-xs bg-rose-600 text-white rounded font-bold hover:bg-rose-700 transition"
                      >
                        Tentar com outro arquivo PDF
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 flex gap-3 text-xs text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-semibold">Conferência Humana Obrigatória</p>
                    <p className="mt-0.5">
                      Nenhum contrato é gravado no banco sem a sua validação. Após o processamento do PDF,
                      você poderá conferir o CNPJ, as datas, os itens e os valores antes de salvar.
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={handleClose}
                disabled={parseMutation.isPending}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              {file && !parseMutation.isPending && (
                <button
                  type="button"
                  onClick={() => processAndAnalyzeFile(file)}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-xs"
                >
                  Reanalisar Documento <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Etapa 2: Conferência Humana e Validação de Cálculos */
          <div className="space-y-6 mt-4">
            {/* Alertas do Parser */}
            {extractedData?.alerts?.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 space-y-1">
                {extractedData.alerts.map((alert: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{alert}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Cabeçalho Extraído com Inputs Editáveis */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-slate-600 dark:text-slate-400">Contrato Nº</label>
                <input
                  type="text"
                  value={extractedData.contract_number || ''}
                  onChange={(e) => setExtractedData({ ...extractedData, contract_number: e.target.value })}
                  className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border rounded text-xs"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1 text-slate-600 dark:text-slate-400">Ano</label>
                <input
                  type="number"
                  value={extractedData.year || new Date().getFullYear()}
                  onChange={(e) => setExtractedData({ ...extractedData, year: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border rounded text-xs"
                />
              </div>
              <div className="md:col-span-2">
                <label className="font-semibold block mb-1 text-slate-600 dark:text-slate-400">
                  Fornecedor Contratado (CNPJ: {extractedData.supplier_cnpj || 'Não identificado'})
                </label>
                {extractedData.matched_supplier ? (
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded text-emerald-800 dark:text-emerald-200 font-semibold">
                    <span className="flex items-center gap-1.5 truncate">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      {extractedData.matched_supplier.name} (Vinculado)
                    </span>
                    <button
                      type="button"
                      onClick={() => setExtractedData({ ...extractedData, matched_supplier: null })}
                      className="text-2xs text-slate-500 hover:text-slate-700 underline shrink-0 ml-2"
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded text-amber-800 dark:text-amber-200">
                      <span className="text-2xs font-medium">CNPJ não encontrado na base</span>
                      <button
                        type="button"
                        onClick={() => {
                          const supName = prompt('Informe a Razão Social ou Nome do Fornecedor:', extractedData.supplier_cnpj ? `Fornecedor ${extractedData.supplier_cnpj}` : 'Novo Fornecedor');
                          if (supName && supName.trim()) {
                            quickRegisterSupplierMutation.mutate({
                              name: supName.trim(),
                              cnpj: extractedData.supplier_cnpj || null,
                              legal_name: supName.trim(),
                            });
                          }
                        }}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-2xs font-bold shadow-xs transition-colors shrink-0"
                      >
                        + Cadastrar Este Fornecedor
                      </button>
                    </div>
                    <div>
                      <select
                        onChange={(e) => {
                          const found = suppliers.find((s) => s.id === e.target.value);
                          if (found) {
                            setExtractedData({ ...extractedData, matched_supplier: found });
                          }
                        }}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-slate-200"
                      >
                        <option value="">Ou selecione um fornecedor existente...</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.cnpj ? `(${s.cnpj})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="font-semibold block mb-1 text-slate-600 dark:text-slate-400">Início Vigência</label>
                <input
                  type="date"
                  value={extractedData.start_date || ''}
                  onChange={(e) => setExtractedData({ ...extractedData, start_date: e.target.value })}
                  className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border rounded text-xs"
                />
              </div>
              <div className="md:col-span-2">
                <label className="font-semibold block mb-1 text-slate-600 dark:text-slate-400">Fim Vigência</label>
                <input
                  type="date"
                  value={extractedData.end_date || ''}
                  onChange={(e) => setExtractedData({ ...extractedData, end_date: e.target.value })}
                  className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border rounded text-xs"
                />
              </div>

              <div className="md:col-span-4">
                <label className="font-semibold block mb-1 text-slate-600 dark:text-slate-400">Objeto Contratual</label>
                <textarea
                  rows={2}
                  value={extractedData.object || ''}
                  onChange={(e) => setExtractedData({ ...extractedData, object: e.target.value })}
                  className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border rounded text-xs resize-none"
                />
              </div>
            </div>

            {/* Tabela de Itens Extraídos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Itens Contratados Extraídos ({extractedData.items?.length || 0})
                </h3>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(extractedData.total_amount || 0)}
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-2 w-14">Item</th>
                      <th className="p-2">Descrição</th>
                      <th className="p-2 w-16 text-center">UND</th>
                      <th className="p-2 w-16 text-center">Qtd</th>
                      <th className="p-2 w-24 text-right">Vlr Unit</th>
                      <th className="p-2 w-28 text-right">Total</th>
                      <th className="p-2 w-16 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {(extractedData.items || []).map((item: any, idx: number) => (
                      <tr key={idx} className={item.has_divergence ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                        <td className="p-2 font-mono text-center">{item.item_code}</td>
                        <td className="p-2 font-medium">{item.description}</td>
                        <td className="p-2 text-center text-slate-500">{item.unit}</td>
                        <td className="p-2 text-center font-semibold">{item.original_quantity}</td>
                        <td className="p-2 text-right">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.unit_price)}
                        </td>
                        <td className="p-2 text-right font-bold text-slate-900 dark:text-white">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total_price)}
                        </td>
                        <td className="p-2 text-center">
                          {item.has_divergence ? (
                            <span className="text-amber-600 dark:text-amber-400" title={item.divergence_message}>
                              ⚠️ Diverg.
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">✓ Correto</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsReviewing(false)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white underline cursor-pointer"
              >
                Voltar e enviar outro arquivo
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={createMutation.isPending || !extractedData.matched_supplier}
                  onClick={handleConfirmContract}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Gravando Contrato...' : 'Aprovar e Criar Contrato'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
