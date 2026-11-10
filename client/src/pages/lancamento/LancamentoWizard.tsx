import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  FolderKanban,
  FileText,
  Receipt,
  CheckCircle2,
  Send,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Plus,
  Building2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../lib/api.js';
import type { Supplier, ProcessRow, SupplyOrderRow, Modality } from '@cozam/shared';
import { formatBRL, formatDateBR, MODALITY_LABELS } from '@cozam/shared';
import { Button } from '../../components/ui/Button.js';
import { Input, Textarea, Select } from '../../components/ui/Input.js';
import { CurrencyInput } from '../../components/ui/CurrencyInput.js';
import { FileDropzone } from '../../components/ui/FileDropzone.js';
import { Card } from '../../components/ui/Card.js';
import { MunicipalitySelect } from '../../components/ui/MunicipalitySelect.js';

export function LancamentoWizard() {
  const navigate = useNavigate();

  // Etapa atual: 1 (Processo) -> 2 (OF) -> 3 (NF) -> 4 (Revisão)
  const [step, setStep] = useState(1);

  // Dados dos fornecedores
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<Supplier[]>('/suppliers'),
  });

  // ---------------------------------------------------------------------------
  // Etapa 1: Processo
  // ---------------------------------------------------------------------------
  const [processMode, setProcessMode] = useState<'existing' | 'new'>('existing');
  const [selectedProcessId, setSelectedProcessId] = useState('');
  const [newProcessNumber, setNewProcessNumber] = useState('');
  const [newProcessDate, setNewProcessDate] = useState(new Date().toISOString().slice(0, 10));
  const [newProcessDesc, setNewProcessDesc] = useState('');

  const { data: processes } = useQuery({
    queryKey: ['processes-list'],
    queryFn: () => api.get<{ data: ProcessRow[] }>('/processes?pageSize=100'),
  });

  // ---------------------------------------------------------------------------
  // Etapa 2: Ordem de Fornecimento
  // ---------------------------------------------------------------------------
  const [ofMode, setOfMode] = useState<'existing' | 'new'>('new');
  const [selectedOfId, setSelectedOfId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [ofNumber, setOfNumber] = useState('');
  const [ofDate, setOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [ofTotalValue, setOfTotalValue] = useState<number | null>(null);
  const [ofNotes, setOfNotes] = useState('');
  const [ofFile, setOfFile] = useState<File | null>(null);

  // Busca OFs do processo selecionado quando em modo 'existing'
  const { data: existingOfs } = useQuery({
    queryKey: ['ofs-by-process', selectedProcessId],
    queryFn: () =>
      selectedProcessId
        ? api.get<SupplyOrderRow[]>(`/supply-orders?process_id=${selectedProcessId}`)
        : Promise.resolve([]),
    enabled: Boolean(selectedProcessId && ofMode === 'existing'),
  });

  // ---------------------------------------------------------------------------
  // Etapa 3: Nota Fiscal
  // ---------------------------------------------------------------------------
  const [nfNumber, setNfNumber] = useState('');
  const [nfDate, setNfDate] = useState(new Date().toISOString().slice(0, 10));
  const [nfAmount, setNfAmount] = useState<number | null>(null);
  const [modality, setModality] = useState<Modality | ''>('');
  const [municipality, setMunicipality] = useState('Santana do Mundaú');
  const [nfNotes, setNfNotes] = useState('');
  const [nfFile, setNfFile] = useState<File | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Verificação de duplicidade de NF por fornecedor
  useEffect(() => {
    if (!nfNumber.trim() || !supplierId) {
      setDuplicateWarning(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const check = await api.get<{ exists: boolean; invoice?: any }>('/invoices/check-duplicate', {
          supplier_id: supplierId,
          invoice_number: nfNumber.trim(),
        });
        if (check.exists) {
          setDuplicateWarning(`Atenção: Já existe uma Nota Fiscal nº "${nfNumber.trim()}" cadastrada para este fornecedor.`);
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        // silencioso
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [nfNumber, supplierId]);

  // Se o usuário selecionou uma OF existente, atualiza o fornecedor selecionado automaticamente
  useEffect(() => {
    if (ofMode === 'existing' && selectedOfId && existingOfs) {
      const ofFound = existingOfs.find((o) => o.id === selectedOfId);
      if (ofFound) {
        setSupplierId(ofFound.supplier_id);
      }
    }
  }, [ofMode, selectedOfId, existingOfs]);

  // ---------------------------------------------------------------------------
  // Envio / Finalização
  // ---------------------------------------------------------------------------
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (forwardImmediate: boolean) => {
    setSubmitting(true);
    try {
      // 1. Processo: cria se for novo
      let effectiveProcessId = selectedProcessId;
      if (processMode === 'new') {
        const pRes = await api.post<ProcessRow>('/processes', {
          process_number: newProcessNumber.trim(),
          registered_at: newProcessDate,
          description: newProcessDesc.trim(),
        });
        effectiveProcessId = pRes.id;
      }

      // 2. OF: cria se for nova
      let effectiveOfId = selectedOfId;
      if (ofMode === 'new') {
        const ofFormData = new FormData();
        ofFormData.append('process_id', effectiveProcessId);
        ofFormData.append('supplier_id', supplierId);
        ofFormData.append('of_number', ofNumber.trim());
        ofFormData.append('issue_date', ofDate);
        if (ofTotalValue !== null) ofFormData.append('total_value', String(ofTotalValue));
        if (ofNotes.trim()) ofFormData.append('notes', ofNotes.trim());
        if (ofFile) ofFormData.append('file', ofFile);

        const ofRes = await api.postMultipart<SupplyOrderRow>('/supply-orders', ofFormData);
        effectiveOfId = ofRes.id;
      }

      // 3. NF
      if (!nfFile) throw new Error('O arquivo PDF da Nota Fiscal é obrigatório.');
      if (!modality) throw new Error('Selecione a modalidade da Nota Fiscal.');
      if (!nfAmount || nfAmount <= 0) throw new Error('Informe o valor da Nota Fiscal.');

      const nfFormData = new FormData();
      nfFormData.append('supply_order_id', effectiveOfId);
      nfFormData.append('invoice_number', nfNumber.trim());
      nfFormData.append('issue_date', nfDate);
      nfFormData.append('amount', String(nfAmount));
      nfFormData.append('modality', modality);
      if (municipality.trim()) nfFormData.append('municipality', municipality.trim());
      if (nfNotes.trim()) nfFormData.append('notes', nfNotes.trim());
      if (forwardImmediate) nfFormData.append('forward', 'true');
      nfFormData.append('file', nfFile);

      const invRes = await api.postMultipart<any>('/invoices', nfFormData);

      if (forwardImmediate) {
        toast.success(`Nota Fiscal nº ${nfNumber} encaminhada com sucesso para o setor de Pagamentos!`);
      } else {
        toast.success(`Nota Fiscal nº ${nfNumber} salva como rascunho com sucesso.`);
      }

      navigate(`/notas/${invRes.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Nome do fornecedor ativo
  const currentSupplier = suppliers?.find((s) => s.id === supplierId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
          Novo Lançamento Integrado
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Cadastre o processo, a Ordem de Fornecimento e a Nota Fiscal em fluxo contínuo
        </p>
      </div>

      {/* Indicador de etapas */}
      <div className="grid grid-cols-4 gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
        {[
          { num: 1, title: 'Processo Adm.', icon: <FolderKanban className="w-4 h-4" /> },
          { num: 2, title: 'Ordem Fornecimento', icon: <FileText className="w-4 h-4" /> },
          { num: 3, title: 'Nota Fiscal', icon: <Receipt className="w-4 h-4" /> },
          { num: 4, title: 'Revisão & Envio', icon: <Send className="w-4 h-4" /> },
        ].map((s) => (
          <div
            key={s.num}
            className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
              step === s.num
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800'
                : step > s.num
                ? 'text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900'
                : 'text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                step === s.num
                  ? 'bg-emerald-700 text-white'
                  : step > s.num
                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              {step > s.num ? '✓' : s.num}
            </div>
            <span className="text-xs hidden sm:inline truncate">{s.title}</span>
          </div>
        ))}
      </div>

      {/* ETAPA 1: Processo */}
      {step === 1 && (
        <Card title="Etapa 1: Processo Administrativo">
          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="processMode"
                  checked={processMode === 'existing'}
                  onChange={() => setProcessMode('existing')}
                  className="accent-emerald-700"
                />
                Vincular a processo já cadastrado
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="processMode"
                  checked={processMode === 'new'}
                  onChange={() => setProcessMode('new')}
                  className="accent-emerald-700"
                />
                Cadastrar novo processo administrativo
              </label>
            </div>

            {processMode === 'existing' ? (
              <Select
                label="Selecione o processo administrativo"
                value={selectedProcessId}
                onChange={(e) => setSelectedProcessId(e.target.value)}
                required
              >
                <option value="">Selecione um processo...</option>
                {processes?.data.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.process_number} — {p.description.slice(0, 60)}...
                  </option>
                ))}
              </Select>
            ) : (
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Input
                      label="Número do processo administrativo"
                      value={newProcessNumber}
                      onChange={(e) => setNewProcessNumber(e.target.value)}
                      placeholder="Ex: PROC-2026/045"
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Data de cadastro"
                      type="date"
                      value={newProcessDate}
                      onChange={(e) => setNewProcessDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Textarea
                  label="Descrição ou objeto do processo"
                  value={newProcessDesc}
                  onChange={(e) => setNewProcessDesc(e.target.value)}
                  placeholder="Descreva o objeto da contratação ou aquisição..."
                  rows={2}
                  required
                />
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                variant="primary"
                onClick={() => {
                  if (processMode === 'existing' && !selectedProcessId) {
                    toast.error('Selecione um processo cadastrado.');
                    return;
                  }
                  if (processMode === 'new' && (!newProcessNumber.trim() || !newProcessDesc.trim())) {
                    toast.error('Informe o número e a descrição do novo processo.');
                    return;
                  }
                  setStep(2);
                }}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Avançar para Ordem de Fornecimento
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ETAPA 2: Ordem de Fornecimento */}
      {step === 2 && (
        <Card title="Etapa 2: Ordem de Fornecimento (OF)">
          <div className="space-y-4">
            {processMode === 'existing' && existingOfs && existingOfs.length > 0 && (
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="ofMode"
                    checked={ofMode === 'new'}
                    onChange={() => setOfMode('new')}
                    className="accent-emerald-700"
                  />
                  Cadastrar nova Ordem de Fornecimento
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="ofMode"
                    checked={ofMode === 'existing'}
                    onChange={() => setOfMode('existing')}
                    className="accent-emerald-700"
                  />
                  Usar OF existente deste processo
                </label>
              </div>
            )}

            {ofMode === 'existing' ? (
              <Select
                label="Selecione a Ordem de Fornecimento"
                value={selectedOfId}
                onChange={(e) => setSelectedOfId(e.target.value)}
                required
              >
                <option value="">Selecione uma OF...</option>
                {existingOfs?.map((o) => (
                  <option key={o.id} value={o.id}>
                    OF nº {o.of_number} — {o.supplier_name} ({formatDateBR(o.issue_date)})
                  </option>
                ))}
              </Select>
            ) : (
              <div className="space-y-3">
                {/* Seleção de Fornecedor: MZ Bernardi primeiro, sem seleção automática */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Fornecedor <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    required
                  >
                    <option value="">Selecione o fornecedor (obrigatório)...</option>
                    {suppliers?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.cnpj ? `— CNPJ: ${s.cnpj}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Regra fundamental: cada Ordem de Fornecimento pertence a um único fornecedor.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Input
                      label="Número da OF"
                      value={ofNumber}
                      onChange={(e) => setOfNumber(e.target.value)}
                      placeholder="Ex: OF-2026/012"
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Data de emissão"
                      type="date"
                      value={ofDate}
                      onChange={(e) => setOfDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <CurrencyInput
                      label="Valor total previsto (opcional)"
                      value={ofTotalValue}
                      onChange={setOfTotalValue}
                      placeholder="R$ 0,00"
                    />
                  </div>
                </div>

                <Textarea
                  label="Observações da OF (opcional)"
                  value={ofNotes}
                  onChange={(e) => setOfNotes(e.target.value)}
                  placeholder="Informações contratuais adicionais..."
                  rows={2}
                />

                <FileDropzone
                  label="Arquivo PDF da Ordem de Fornecimento (obrigatório para encaminhar)"
                  accept="application/pdf"
                  onFileSelect={setOfFile}
                  selectedFile={ofFile}
                  helperText="Anexe o arquivo oficial em PDF da Ordem de Fornecimento"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setStep(1)} icon={<ArrowLeft className="w-4 h-4" />}>
                Voltar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (ofMode === 'existing' && !selectedOfId) {
                    toast.error('Selecione uma Ordem de Fornecimento.');
                    return;
                  }
                  if (ofMode === 'new') {
                    if (!supplierId) {
                      toast.error('Selecione o fornecedor da Ordem de Fornecimento.');
                      return;
                    }
                    if (!ofNumber.trim() || !ofDate) {
                      toast.error('Informe o número e a data de emissão da OF.');
                      return;
                    }
                  }
                  setStep(3);
                }}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Avançar para Nota Fiscal
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ETAPA 3: Nota Fiscal */}
      {step === 3 && (
        <Card title="Etapa 3: Dados da Nota Fiscal (NF)">
          <div className="space-y-4">
            {/* Fornecedor travado e identificado */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-2xs font-semibold uppercase text-slate-500">Fornecedor Vinculado</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{currentSupplier?.name || 'Fornecedor da OF'}</p>
              </div>
              <span className="text-xs text-slate-500 italic">Herdado da Ordem de Fornecimento</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Input
                  label="Número da Nota Fiscal"
                  value={nfNumber}
                  onChange={(e) => setNfNumber(e.target.value)}
                  placeholder="Ex: 004821"
                  required
                />
              </div>
              <div>
                <Input
                  label="Data de emissão da NF"
                  type="date"
                  value={nfDate}
                  onChange={(e) => setNfDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <CurrencyInput
                  label="Valor da Nota Fiscal (R$)"
                  value={nfAmount}
                  onChange={setNfAmount}
                  placeholder="R$ 0,00"
                  required
                />
              </div>
            </div>

            {duplicateWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>{duplicateWarning}</span>
              </div>
            )}

            {/* Município Consorciado */}
            <MunicipalitySelect
              value={municipality}
              onChange={setMunicipality}
              label="Município Consorciado de Destino"
              required
            />

            {/* Modalidade de Pagamento: Cards de seleção única */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Modalidade de Pagamento <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setModality('FUMIP')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    modality === 'FUMIP'
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">FUMIP</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Fundo Municipal de Iluminação Pública e custeios vinculados
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setModality('COMPRA_COMPARTILHADA')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    modality === 'COMPRA_COMPARTILHADA'
                      ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/30'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Compra Compartilhada</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Aquisição em lote conjunto entre os municípios consorciados
                  </p>
                </button>
              </div>
            </div>

            {/* Comentário Opcional com Exemplos */}
            <div>
              <Textarea
                label="Comentários sobre a Nota Fiscal (opcional — visível para Pagamentos)"
                value={nfNotes}
                onChange={(e) => setNfNotes(e.target.value)}
                placeholder="Exemplo: Nota emitida parcialmente. Faltam R$ 2.520,00 para completar o valor previsto."
                rows={2}
                helperText="Importante: comentários sobre valores faltantes de fornecimento não alteram o saldo financeiro da NF."
              />
            </div>

            {/* PDF da NF */}
            <FileDropzone
              label="Arquivo PDF da Nota Fiscal (obrigatório)"
              accept="application/pdf"
              onFileSelect={setNfFile}
              selectedFile={nfFile}
              required
              helperText="Anexe o arquivo PDF original da Nota Fiscal emitida pelo fornecedor"
            />

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setStep(2)} icon={<ArrowLeft className="w-4 h-4" />}>
                Voltar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (!nfNumber.trim()) {
                    toast.error('Informe o número da Nota Fiscal.');
                    return;
                  }
                  if (!nfDate) {
                    toast.error('Informe a data de emissão da Nota Fiscal.');
                    return;
                  }
                  if (!nfAmount || nfAmount <= 0) {
                    toast.error('Informe o valor válido da Nota Fiscal.');
                    return;
                  }
                  if (!modality) {
                    toast.error('Selecione a modalidade: FUMIP ou Compra Compartilhada.');
                    return;
                  }
                  if (!nfFile) {
                    toast.error('Anexe o arquivo PDF da Nota Fiscal.');
                    return;
                  }
                  setStep(4);
                }}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Revisar Lançamento
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ETAPA 4: Revisão e Encaminhamento */}
      {step === 4 && (
        <Card title="Etapa 4: Conferência e Encaminhamento">
          <div className="space-y-6">
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
                Resumo do Lançamento
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Fornecedor</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{currentSupplier?.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Ordem de Fornecimento</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {ofMode === 'new' ? ofNumber : 'OF Vinculada'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Nota Fiscal nº</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{nfNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Valor da NF</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums text-sm">
                    {formatBRL(nfAmount)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Modalidade</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {modality ? MODALITY_LABELS[modality] : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Município</span>
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                    {municipality || 'Não informado'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Data de Emissão</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDateBR(nfDate)}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Documentos</span>
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                    {ofFile ? 'OF (PDF) e ' : ''}NF (PDF) anexados
                  </span>
                </div>
              </div>

              {nfNotes && (
                <div className="text-xs pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                  <span className="text-slate-500 dark:text-slate-400 block">Comentário de Compras</span>
                  <span className="italic text-slate-700 dark:text-slate-300">"{nfNotes}"</span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">O que acontece ao encaminhar?</h5>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 mt-1 list-disc list-inside">
                <li>O registro entrará imediatamente na fila de trabalho do setor de Pagamentos.</li>
                <li>Os arquivos da OF e da NF ficarão disponíveis para download e impressão direta.</li>
                <li>O status do encaminhamento será gravado com data, hora e responsável no histórico de auditoria.</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setStep(3)} icon={<ArrowLeft className="w-4 h-4" />}>
                Voltar para edição
              </Button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => handleSubmit(false)}
                  loading={submitting}
                  className="flex-1 sm:flex-initial"
                >
                  Salvar Rascunho
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSubmit(true)}
                  loading={submitting}
                  className="flex-1 sm:flex-initial font-bold bg-emerald-700 hover:bg-emerald-800"
                  icon={<Send className="w-4 h-4" />}
                >
                  ENCAMINHAR PARA PAGAMENTOS
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
