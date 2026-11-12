import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  FileSpreadsheet,
  Package,
  Search,
  Sparkles,
  Layers,
  Clock,
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
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const paramContractId = searchParams.get('contract_id') || '';

  // Etapa atual: 1 (Contrato/Processo) -> 2 (OF & Itens) -> 3 (NF) -> 4 (Revisão)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // ---------------------------------------------------------------------------
  // Tipo de Lançamento: Com Contrato/Ata (com itens e saldo) vs Sem Contrato (Despesa Direta)
  // ---------------------------------------------------------------------------
  const [launchType, setLaunchType] = useState<'contract' | 'direct'>('contract');

  // ---------------------------------------------------------------------------
  // Etapa 1: Seleção de Contrato / Ata
  // ---------------------------------------------------------------------------
  const [contractSearch, setContractSearch] = useState('');
  const [selectedContractId, setSelectedContractId] = useState(paramContractId);

  const { data: contractsData, isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts-list-active'],
    queryFn: () => api.get<any>('/contracts', { active_only: true }),
  });

  const contractsList: any[] = Array.isArray(contractsData)
    ? contractsData
    : contractsData?.data || [];

  const filteredContracts = contractsList.filter((c: any) => {
    if (!contractSearch.trim()) return true;
    const term = contractSearch.toLowerCase();
    return (
      (c.contract_number && c.contract_number.toLowerCase().includes(term)) ||
      (c.supplier_name && c.supplier_name.toLowerCase().includes(term)) ||
      (c.object && c.object.toLowerCase().includes(term)) ||
      (c.description && c.description.toLowerCase().includes(term))
    );
  });

  // Detalhes do contrato selecionado (inclui itens com saldo)
  const { data: contractDetail, isLoading: loadingContractDetail } = useQuery({
    queryKey: ['contract-detail', selectedContractId],
    queryFn: () => api.get<any>(`/contracts/${selectedContractId}`),
    enabled: Boolean(selectedContractId),
  });

  // ---------------------------------------------------------------------------
  // Etapa 1 Alternativa: Despesa Direta (Processo Administrativo)
  // ---------------------------------------------------------------------------
  const [processMode, setProcessMode] = useState<'existing' | 'new'>('existing');
  const [selectedProcessId, setSelectedProcessId] = useState('');
  const [newProcessNumber, setNewProcessNumber] = useState('');
  const [newProcessDate, setNewProcessDate] = useState(new Date().toISOString().slice(0, 10));
  const [newProcessDesc, setNewProcessDesc] = useState('');

  const { data: processes } = useQuery({
    queryKey: ['processes-list'],
    queryFn: () => api.get<{ data: ProcessRow[] }>('/processes?pageSize=100'),
    enabled: launchType === 'direct',
  });

  // ---------------------------------------------------------------------------
  // Fornecedores
  // ---------------------------------------------------------------------------
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<Supplier[]>('/suppliers'),
  });

  const [supplierId, setSupplierId] = useState('');

  // ---------------------------------------------------------------------------
  // Etapa 2: Ordem de Fornecimento & Itens do Contrato
  // ---------------------------------------------------------------------------
  const [ofNumber, setOfNumber] = useState('');
  const [ofDate, setOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [ofTotalValue, setOfTotalValue] = useState<number | null>(null);
  const [ofMunicipality, setOfMunicipality] = useState('Santana do Mundaú');
  const [ofNotes, setOfNotes] = useState('');
  const [ofFile, setOfFile] = useState<File | null>(null);

  // Mapa de quantidades solicitadas: contract_item_id -> quantidade
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [savingOfOnly, setSavingOfOnly] = useState(false);
  const [autoSignOf, setAutoSignOf] = useState(true);

  // Modo OF existente quando despesa direta
  const [ofMode, setOfMode] = useState<'existing' | 'new'>('new');
  const [selectedOfId, setSelectedOfId] = useState('');

  const { data: existingOfs } = useQuery({
    queryKey: ['ofs-by-process', selectedProcessId],
    queryFn: () =>
      selectedProcessId
        ? api.get<SupplyOrderRow[]>(`/supply-orders?process_id=${selectedProcessId}`)
        : Promise.resolve([]),
    enabled: Boolean(selectedProcessId && ofMode === 'existing' && launchType === 'direct'),
  });

  // ---------------------------------------------------------------------------
  // Etapa 3: Nota Fiscal
  // ---------------------------------------------------------------------------
  const [nfNumber, setNfNumber] = useState('');
  const [nfDate, setNfDate] = useState(new Date().toISOString().slice(0, 10));
  const [nfAmount, setNfAmount] = useState<number | null>(null);
  const [modality, setModality] = useState<Modality | ''>('COMPRA_COMPARTILHADA');
  const [municipality, setMunicipality] = useState('Santana do MundaÚ');
  const [nfNotes, setNfNotes] = useState('');
  const [nfFile, setNfFile] = useState<File | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [forwardDirectly, setForwardDirectly] = useState(true);

  // Sincroniza fornecedor e processo quando seleciona contrato
  useEffect(() => {
    if (launchType === 'contract' && contractDetail) {
      const contract = contractDetail.contract || contractDetail;
      if (contract.supplier_id) {
        setSupplierId(contract.supplier_id);
      }
      if (contract.procurement_id) {
        setSelectedProcessId(contract.procurement_id);
      }
    }
  }, [launchType, contractDetail]);

  // Lista de itens do contrato selecionado
  const contractItems: any[] = contractDetail?.items || [];

  // Calcula total dos itens selecionados em tempo real
  const itemsTotal = contractItems.reduce((acc, it) => {
    const qty = Number(itemQuantities[it.id] || 0);
    return acc + qty * Number(it.unit_price || 0);
  }, 0);

  // Lista de itens formatada para submissão
  const requestedItemsList = Object.entries(itemQuantities)
    .filter(([_, qty]) => Number(qty) > 0)
    .map(([contractItemId, qty]) => {
      const it = contractItems.find((i) => i.id === contractItemId);
      return {
        contract_item_id: contractItemId,
        quantity: Number(qty),
        unit_price: Number(it?.unit_price || 0),
        total_price: Number(qty) * Number(it?.unit_price || 0),
        description: it?.description || '',
        unit: it?.unit || 'UN',
        item_code: it?.item_code || '',
      };
    });

  // Atualiza quantidade solicitada com validação defensiva
  const handleItemQuantityChange = (itemId: string, valStr: string, availableMax: number) => {
    const rawVal = parseFloat(valStr.replace(',', '.'));
    if (isNaN(rawVal) || rawVal <= 0) {
      setItemQuantities((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      return;
    }

    if (rawVal > availableMax) {
      toast.error(
        `Quantidade solicitada (${rawVal}) ultrapassa o saldo disponível em estoque (${availableMax}).`
      );
      return;
    }

    setItemQuantities((prev) => ({
      ...prev,
      [itemId]: rawVal,
    }));
  };

  // Verificação de duplicidade de NF
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
          setDuplicateWarning(
            `Atenção: Já existe uma Nota Fiscal nº "${nfNumber.trim()}" cadastrada para este fornecedor.`
          );
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        // silencioso
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [nfNumber, supplierId]);

  // Se o usuário selecionou uma OF existente no modo direto
  useEffect(() => {
    if (launchType === 'direct' && ofMode === 'existing' && selectedOfId && existingOfs) {
      const ofFound = existingOfs.find((o) => o.id === selectedOfId);
      if (ofFound) {
        setSupplierId(ofFound.supplier_id);
      }
    }
  }, [launchType, ofMode, selectedOfId, existingOfs]);

  // ---------------------------------------------------------------------------
  // FLUXO DE 2 TEMPOS: Emitir somente a OF agora (sem NF)
  // O setor requisitou materiais: gera OF, debita saldo e redireciona para a OF
  // ---------------------------------------------------------------------------
  const handleSaveOfOnly = async () => {
    if (launchType === 'contract') {
      if (!selectedContractId) {
        toast.error('Selecione um Contrato ou Ata de Registro de Preços.');
        return;
      }
      if (requestedItemsList.length === 0) {
        toast.error('Informe a quantidade de pelo menos um produto a ser solicitado nesta Ordem.');
        return;
      }
    }

    if (!supplierId) {
      toast.error('Fornecedor não identificado.');
      return;
    }

    setSavingOfOnly(true);
    try {
      const formData = new FormData();
      formData.append('supplier_id', supplierId);
      if (selectedProcessId) formData.append('process_id', selectedProcessId);
      if (selectedContractId) formData.append('contract_id', selectedContractId);
      if (ofNumber.trim()) formData.append('of_number', ofNumber.trim());
      formData.append('issue_date', ofDate);
      formData.append('municipality', ofMunicipality || 'Santana do Mundaú');
      if (ofNotes.trim()) formData.append('notes', ofNotes.trim());
      if (autoSignOf) formData.append('confirm_and_sign', 'true');

      if (launchType === 'contract') {
        const itemsPayload = requestedItemsList.map((it) => ({
          contract_item_id: it.contract_item_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
        }));
        formData.append('items', JSON.stringify(itemsPayload));
        formData.append('total_value', String(itemsTotal));
      } else if (ofTotalValue) {
        formData.append('total_value', String(ofTotalValue));
      }

      if (ofFile) {
        formData.append('file', ofFile);
      }

      const res = await api.postMultipart<any>('/supply-orders', formData);
      toast.success(
        `Ordem de Fornecimento nº ${res.of_number || 'emitida'} salva com sucesso! Os itens foram debitados do saldo do contrato.`
      );
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      navigate(`/ordens/${res.id}`);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingOfOnly(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Submissão Completa (OF + NF em 1 só lançamento)
  // ---------------------------------------------------------------------------
  const createFullLaunchMutation = useMutation({
    mutationFn: async () => {
      let finalProcessId = selectedProcessId;

      // Se for despesa direta e novo processo
      if (launchType === 'direct' && processMode === 'new') {
        const pRes = await api.post<ProcessRow>('/processes', {
          process_number: newProcessNumber.trim(),
          year: new Date(newProcessDate).getFullYear(),
          description: newProcessDesc.trim(),
        });
        finalProcessId = pRes.id;
      }

      // 1. Cria ou reutiliza a OF
      let finalOfId = selectedOfId;
      if (ofMode === 'new' || launchType === 'contract') {
        const ofFormData = new FormData();
        ofFormData.append('supplier_id', supplierId);
        if (finalProcessId) ofFormData.append('process_id', finalProcessId);
        if (selectedContractId) ofFormData.append('contract_id', selectedContractId);
        if (ofNumber.trim()) ofFormData.append('of_number', ofNumber.trim());
        ofFormData.append('issue_date', ofDate);
        ofFormData.append('municipality', ofMunicipality || municipality || 'Santana do Mundaú');
        if (ofNotes.trim()) ofFormData.append('notes', ofNotes.trim());
        if (autoSignOf) ofFormData.append('confirm_and_sign', 'true');

        if (launchType === 'contract') {
          const itemsPayload = requestedItemsList.map((it) => ({
            contract_item_id: it.contract_item_id,
            quantity: it.quantity,
            unit_price: it.unit_price,
          }));
          ofFormData.append('items', JSON.stringify(itemsPayload));
          ofFormData.append('total_value', String(itemsTotal));
        } else if (ofTotalValue) {
          ofFormData.append('total_value', String(ofTotalValue));
        }

        if (ofFile) {
          ofFormData.append('file', ofFile);
        }

        const ofRes = await api.postMultipart<SupplyOrderRow>('/supply-orders', ofFormData);
        finalOfId = ofRes.id;
      }

      // 2. Cria a Nota Fiscal vinculada à OF
      if (!nfFile) {
        throw new Error('O arquivo PDF da Nota Fiscal é obrigatório.');
      }

      const nfFormData = new FormData();
      nfFormData.append('supply_order_id', finalOfId);
      nfFormData.append('invoice_number', nfNumber.trim());
      nfFormData.append('issue_date', nfDate);
      nfFormData.append('amount', String(nfAmount || itemsTotal));
      nfFormData.append('modality', modality || 'COMPRA_COMPARTILHADA');
      nfFormData.append('municipality', municipality || ofMunicipality || 'Santana do Mundaú');
      if (nfNotes.trim()) nfFormData.append('notes', nfNotes.trim());
      nfFormData.append('forward', String(forwardDirectly));
      nfFormData.append('file', nfFile);

      const invRes = await api.postMultipart<any>('/invoices', nfFormData);
      return { invoiceId: invRes.id, ofId: finalOfId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success(
        forwardDirectly
          ? 'Lançamento concluído com sucesso e encaminhado para o setor de Pagamentos!'
          : 'Lançamento salvo com sucesso como Rascunho!'
      );
      navigate(`/notas/${data.invoiceId}`);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Validações para avançar de etapa
  const canGoToStep2 = () => {
    if (launchType === 'contract') {
      return Boolean(selectedContractId);
    }
    if (processMode === 'existing') {
      return Boolean(selectedProcessId);
    }
    return Boolean(newProcessNumber.trim() && newProcessDesc.trim());
  };

  const canGoToStep3 = () => {
    if (launchType === 'contract') {
      return requestedItemsList.length > 0;
    }
    if (ofMode === 'existing') {
      return Boolean(selectedOfId);
    }
    return Boolean(supplierId && ofTotalValue && ofTotalValue > 0);
  };

  const canGoToStep4 = () => {
    return Boolean(
      nfNumber.trim() &&
        (nfAmount || itemsTotal) &&
        modality &&
        municipality &&
        nfFile
    );
  };

  // Quando avança da etapa 2 para a etapa 3, pré-preenche o valor da NF com o valor dos itens
  const handleAdvanceToStep3 = () => {
    if (launchType === 'contract' && itemsTotal > 0 && (!nfAmount || nfAmount === 0)) {
      setNfAmount(itemsTotal);
    }
    if (ofMunicipality && !municipality) {
      setMunicipality(ofMunicipality);
    }
    setStep(3);
  };

  const selectedContract = contractDetail?.contract || contractDetail;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
          Novo Lançamento & Ordem de Fornecimento
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Emita Ordens de Fornecimento com controle de estoque e baixa de saldo de contratos em tempo real, com assinatura digital automática e vinculação de Nota Fiscal (imediata ou posterior).
        </p>
      </div>

      {/* Indicador de Etapas */}
      <div className="grid grid-cols-4 gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
        {[
          { num: 1, label: launchType === 'contract' ? 'Contrato / Ata' : 'Processo Adm.', icon: <FolderKanban className="w-4 h-4" /> },
          { num: 2, label: 'Ordem & Produtos', icon: <Package className="w-4 h-4" /> },
          { num: 3, label: 'Nota Fiscal', icon: <Receipt className="w-4 h-4" /> },
          { num: 4, label: 'Revisão & Envio', icon: <CheckCircle2 className="w-4 h-4" /> },
        ].map((s) => (
          <div
            key={s.num}
            className={`flex items-center gap-2 p-2 rounded-xl transition-all ${
              step === s.num
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800'
                : step > s.num
                ? 'text-slate-700 dark:text-slate-300 font-medium'
                : 'text-slate-400 dark:text-slate-600'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                step === s.num
                  ? 'bg-emerald-600 text-white font-bold'
                  : step > s.num
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}
            >
              {s.num}
            </div>
            <span className="text-xs truncate hidden sm:inline">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* ETAPA 1: Seleção de Contrato / Ata ou Despesa Direta */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Seletor de Modalidade de Lançamento */}
          <Card>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Tipo de Lançamento
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Escolha se a compra está amparada por Contrato/Ata ou se é uma despesa direta/avulsa
                </p>
              </div>

              <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setLaunchType('contract')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                    launchType === 'contract'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Com Contrato / Ata (Materiais & Estoque)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLaunchType('direct')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                    launchType === 'direct'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  <span>Sem Contrato (Despesa Direta / Avulsa)</span>
                </button>
              </div>
            </div>
          </Card>

          {/* Lançamento COM CONTRATO / ATA */}
          {launchType === 'contract' && (
            <Card
              title="Selecione o Contrato ou Ata de Registro de Preços"
              subtitle="O lançamento de produtos debitará automaticamente as quantidades do saldo disponível no contrato"
            >
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={contractSearch}
                    onChange={(e) => setContractSearch(e.target.value)}
                    placeholder="Pesquisar por número do contrato, ata, fornecedor ou material..."
                    className="w-full bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-slate-100 pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {loadingContracts ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Carregando contratos vigentes...
                  </div>
                ) : filteredContracts.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2.5 max-h-96 overflow-y-auto pr-1">
                    {filteredContracts.map((c: any) => {
                      const isSelected = selectedContractId === c.id;
                      const balance = c.remaining_amount ?? c.balance_available ?? c.total_amount;
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedContractId(c.id);
                            if (c.supplier_id) setSupplierId(c.supplier_id);
                            if (c.procurement_id) setSelectedProcessId(c.procurement_id);
                          }}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-mono">
                                  {c.contract_number}
                                </span>
                                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {c.status || 'ATIVO'}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5" />
                                {c.supplier_name || 'Fornecedor'}
                              </p>
                              <p className="text-2xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                {c.object || c.description}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-2xs uppercase tracking-wider text-slate-400 block font-semibold">
                                Saldo Disponível
                              </span>
                              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                {formatBRL(balance)}
                              </span>
                              {c.end_date && (
                                <span className="text-2xs text-slate-400 block mt-1">
                                  Vigência até {formatDateBR(c.end_date)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    Nenhum contrato ativo encontrado. Cadastre um contrato em{' '}
                    <Link to="/contratos" className="text-emerald-600 font-semibold underline">
                      Contratos & Licitações
                    </Link>{' '}
                    ou escolha "Sem Contrato" para despesas avulsas.
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Lançamento SEM CONTRATO (Processo Administrativo Direto) */}
          {launchType === 'direct' && (
            <Card
              title="Vincular a Processo Administrativo"
              subtitle="Para despesas diretas como energia, aluguel ou compras fora de ata"
            >
              <div className="space-y-4">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="processMode"
                      value="existing"
                      checked={processMode === 'existing'}
                      onChange={() => setProcessMode('existing')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    Processo Existente
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="processMode"
                      value="new"
                      checked={processMode === 'new'}
                      onChange={() => setProcessMode('new')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    Criar Novo Processo
                  </label>
                </div>

                {processMode === 'existing' ? (
                  <Select
                    label="Selecione o Processo Administrativo"
                    value={selectedProcessId}
                    onChange={(e) => setSelectedProcessId(e.target.value)}
                    required
                  >
                    <option value="">Selecione um processo...</option>
                    {processes?.data?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.process_number} — {p.description.slice(0, 70)}...
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Número do Processo"
                        value={newProcessNumber}
                        onChange={(e) => setNewProcessNumber(e.target.value)}
                        placeholder="Ex: 042/2026"
                        required
                      />
                      <Input
                        label="Data de Abertura"
                        type="date"
                        value={newProcessDate}
                        onChange={(e) => setNewProcessDate(e.target.value)}
                        required
                      />
                    </div>
                    <Textarea
                      label="Descrição / Objeto do Processo"
                      value={newProcessDesc}
                      onChange={(e) => setNewProcessDesc(e.target.value)}
                      placeholder="Ex: Despesas de consumo de energia elétrica das unidades consorciadas..."
                      rows={2}
                      required
                    />
                  </div>
                )}
              </div>
            </Card>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              disabled={!canGoToStep2()}
              onClick={() => setStep(2)}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Avançar para Ordem de Fornecimento
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 2: Ordem de Fornecimento & Grade Interativa de Produtos/Saldo */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Se com contrato: Resumo do Contrato Vinculado */}
          {launchType === 'contract' && selectedContract && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-bold text-slate-400">
                    Contrato Vinculado
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {selectedContract.contract_number}
                  </span>
                </div>
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 mt-0.5">
                  Fornecedor: {selectedContract.supplier_name}
                </p>
              </div>

              <div className="text-right">
                <span className="text-2xs text-slate-400 block font-semibold uppercase">
                  Saldo Restante no Contrato
                </span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatBRL(selectedContract.remaining_amount ?? selectedContract.total_amount)}
                </span>
              </div>
            </div>
          )}

          {/* Dados Gerais da Ordem */}
          <Card title="Dados da Ordem de Fornecimento (OF)">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Número da OF"
                value={ofNumber}
                onChange={(e) => setOfNumber(e.target.value)}
                placeholder="Ex: 015/2026 (ou deixe vazio p/ auto)"
              />
              <Input
                label="Data de Emissão"
                type="date"
                value={ofDate}
                onChange={(e) => setOfDate(e.target.value)}
                required
              />
              <MunicipalitySelect
                label="Município / Destino"
                value={ofMunicipality}
                onChange={setOfMunicipality}
                required
              />
            </div>

            <div className="mt-4">
              <Textarea
                label="Observações / Instruções de Entrega (Opcional)"
                value={ofNotes}
                onChange={(e) => setOfNotes(e.target.value)}
                placeholder="Ex: Entregar na sede do município / secretaria ou instrução específica..."
                rows={2}
              />
            </div>

            {launchType === 'direct' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Select
                  label="Fornecedor da Despesa"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  required
                >
                  <option value="">Selecione o fornecedor...</option>
                  {suppliers?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.cnpj})
                    </option>
                  ))}
                </Select>
                <CurrencyInput
                  label="Valor Previsto da OF (R$)"
                  value={ofTotalValue}
                  onChange={setOfTotalValue}
                  required
                />
              </div>
            )}
          </Card>

          {/* GRADE DE PRODUTOS / ESTOQUE DO CONTRATO */}
          {launchType === 'contract' && (
            <Card
              title={`Produtos do Contrato Disponíveis em Estoque (${contractItems.length})`}
              subtitle="Informe a quantidade que está sendo solicitada nesta Ordem de Fornecimento. O saldo restante será debitado em tempo real."
            >
              {loadingContractDetail ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Carregando catálogo e saldos de produtos do contrato...
                </div>
              ) : contractItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider text-2xs">
                        <th className="py-2.5 px-3 w-16">Item</th>
                        <th className="py-2.5 px-3">Descrição do Material</th>
                        <th className="py-2.5 px-3 w-20 text-center">UND</th>
                        <th className="py-2.5 px-3 w-24 text-right">Preço Unit.</th>
                        <th className="py-2.5 px-3 w-28 text-center">Saldo em Estoque</th>
                        <th className="py-2.5 px-3 w-32 text-center">Qtd a Pedir</th>
                        <th className="py-2.5 px-3 w-28 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {contractItems.map((it: any) => {
                        const available = it.available_quantity ?? (it.current_quantity - (it.ordered_quantity || 0));
                        const currentRequested = itemQuantities[it.id] ?? '';
                        const lineSubtotal = (Number(currentRequested) || 0) * Number(it.unit_price || 0);

                        return (
                          <tr
                            key={it.id}
                            className={`transition-colors ${
                              Number(currentRequested) > 0
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                                : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                              {it.item_code || it.item_number}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                              {it.description}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-500 uppercase font-mono text-2xs">
                              {it.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                              {formatBRL(it.unit_price)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-bold ${
                                  available > 0
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {available} {it.unit}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max={available}
                                step="any"
                                value={currentRequested}
                                disabled={available <= 0}
                                onChange={(e) =>
                                  handleItemQuantityChange(it.id, e.target.value, available)
                                }
                                placeholder="0"
                                className="w-24 text-center font-bold px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:opacity-50"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                              {formatBRL(lineSubtotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 font-bold">
                        <td colSpan={5} className="py-3 px-3 text-right text-slate-800 dark:text-slate-200 uppercase tracking-wider text-2xs">
                          Total Geral dos Produtos Solicitados:
                        </td>
                        <td colSpan={2} className="py-3 px-3 text-right text-base tabular-nums text-emerald-700 dark:text-emerald-400 font-bold">
                          {formatBRL(itemsTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Este contrato ainda não possui itens cadastrados no catálogo.
                </div>
              )}
            </Card>
          )}

          {/* Upload do Arquivo PDF da OF (Opcional, pois sistema gera PDF oficial) */}
          <Card title="Arquivo da Ordem de Fornecimento (Opcional)">
            <FileDropzone
              label="Arquivo da Ordem (PDF assinado ou minuta externa)"
              onFileSelect={setOfFile}
              selectedFile={ofFile}
            />
          </Card>

          {/* Opção de Assinatura Digital Automática do Supervisor */}
          <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-center justify-between gap-3">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSignOf}
                onChange={(e) => setAutoSignOf(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <div>
                <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                  Assinar e confirmar digitalmente como Supervisor de Compras (Jonatha Pereira de Jesus)
                </p>
                <p className="text-2xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                  A OF já sairá assinada automaticamente com a sua assinatura oficial nos downloads de PDF e Excel, com baixa automática de saldo.
                </p>
              </div>
            </label>
          </div>

          {/* AÇÕES DA ETAPA 2: FLUXO DE 2 TEMPOS */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="ghost"
              onClick={() => setStep(1)}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Voltar
            </Button>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {/* Botão Secundário: Salva e emite a OF sem NF (para enviar ao fornecedor) */}
              <Button
                variant="secondary"
                onClick={handleSaveOfOnly}
                loading={savingOfOnly}
                disabled={!canGoToStep3()}
                icon={<Clock className="w-4 h-4 text-emerald-600" />}
                className="border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                title="Emite a OF assinada imediatamente, debitando o saldo do contrato, permitindo anexar a NF quando a mercadoria chegar"
              >
                Emitir e Assinar Ordem (sem NF por enquanto)
              </Button>

              {/* Botão Primário: Avançar para anexar a NF imediatamente */}
              <Button
                variant="primary"
                onClick={handleAdvanceToStep3}
                disabled={!canGoToStep3()}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Avançar para Nota Fiscal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 3: Dados da Nota Fiscal */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div className="space-y-6">
          <Card
            title="Dados da Nota Fiscal"
            subtitle="Preencha os dados e anexe a NF recebida do fornecedor"
          >
            <div className="space-y-4">
              {duplicateWarning && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>{duplicateWarning}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Número da Nota Fiscal"
                  value={nfNumber}
                  onChange={(e) => setNfNumber(e.target.value)}
                  placeholder="Ex: 001.234"
                  required
                  autoFocus
                />
                <Input
                  label="Data de Emissão da NF"
                  type="date"
                  value={nfDate}
                  onChange={(e) => setNfDate(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CurrencyInput
                  label="Valor da Nota Fiscal (R$)"
                  value={nfAmount ?? (itemsTotal > 0 ? itemsTotal : null)}
                  onChange={setNfAmount}
                  required
                  helperText={
                    itemsTotal > 0
                      ? `Valor sugerido com base nos produtos solicitados da OF: ${formatBRL(itemsTotal)}`
                      : undefined
                  }
                />
                <Select
                  label="Modalidade"
                  value={modality}
                  onChange={(e) => setModality(e.target.value as Modality)}
                  required
                >
                  <option value="COMPRA_COMPARTILHADA">Compra Compartilhada (Padrão)</option>
                  <option value="FUMIP">FUMIP (Exclusivo Santana do Mundaú)</option>
                </Select>
              </div>

              <MunicipalitySelect
                label="Município Consorciado"
                value={municipality}
                onChange={setMunicipality}
                required
              />

              <FileDropzone
                label="Arquivo PDF da Nota Fiscal (obrigatório)"
                onFileSelect={setNfFile}
                selectedFile={nfFile}
                required
              />

              <Textarea
                label="Observações da Nota Fiscal (opcional)"
                value={nfNotes}
                onChange={(e) => setNfNotes(e.target.value)}
                placeholder="Ex: Faturamento parcial correspondente à primeira entrega..."
                rows={2}
              />

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forwardDirectly}
                    onChange={(e) => setForwardDirectly(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Encaminhar diretamente para o setor de Pagamentos
                  </span>
                </label>
                <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 ml-7">
                  Se desmarcado, a nota ficará salva como rascunho no setor de Compras para conferência posterior.
                </p>
              </div>
            </div>
          </Card>

          <div className="flex justify-between pt-2">
            <Button
              variant="ghost"
              onClick={() => setStep(2)}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Voltar
            </Button>
            <Button
              variant="primary"
              disabled={!canGoToStep4()}
              onClick={() => setStep(4)}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Avançar para Revisão
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 4: Revisão & Conclusão */}
      {/* ========================================================================= */}
      {step === 4 && (
        <div className="space-y-6">
          <Card title="Resumo do Lançamento Completo">
            <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {/* Contrato / Processo */}
              <div className="pt-2">
                <span className="text-2xs uppercase tracking-wider font-bold text-slate-400 block mb-1">
                  {launchType === 'contract' ? 'Contrato / Ata' : 'Processo Administrativo'}
                </span>
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  {launchType === 'contract'
                    ? selectedContract?.contract_number
                    : processMode === 'existing'
                    ? processes?.data?.find((p) => p.id === selectedProcessId)?.process_number
                    : newProcessNumber}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  {launchType === 'contract'
                    ? selectedContract?.object || selectedContract?.description
                    : processMode === 'existing'
                    ? processes?.data?.find((p) => p.id === selectedProcessId)?.description
                    : newProcessDesc}
                </p>
              </div>

              {/* Ordem de Fornecimento */}
              <div className="pt-3">
                <span className="text-2xs uppercase tracking-wider font-bold text-slate-400 block mb-1">
                  Ordem de Fornecimento
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <span className="text-slate-400">Número da OF:</span>
                    <p className="font-semibold">{ofNumber || 'Automático'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Data de Emissão:</span>
                    <p className="font-semibold">{formatDateBR(ofDate)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Município Destino:</span>
                    <p className="font-semibold">{ofMunicipality || municipality}</p>
                  </div>
                </div>

                {/* Itens solicitados se houver */}
                {requestedItemsList.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-2xs uppercase tracking-wider font-bold text-emerald-800 dark:text-emerald-400 block mb-2">
                      Produtos Solicitados ({requestedItemsList.length})
                    </span>
                    <div className="space-y-1">
                      {requestedItemsList.map((it) => (
                        <div key={it.contract_item_id} className="flex justify-between text-2xs">
                          <span>
                            #{it.item_code} · {it.description} ({it.quantity} {it.unit})
                          </span>
                          <span className="font-bold tabular-nums">
                            {formatBRL(it.total_price)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-xs">
                      <span>Total dos Produtos:</span>
                      <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatBRL(itemsTotal)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Nota Fiscal */}
              <div className="pt-3">
                <span className="text-2xs uppercase tracking-wider font-bold text-slate-400 block mb-1">
                  Nota Fiscal
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="text-slate-400">Número da NF:</span>
                    <p className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {nfNumber}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Emissão:</span>
                    <p className="font-semibold">{formatDateBR(nfDate)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Valor da NF:</span>
                    <p className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatBRL(nfAmount || itemsTotal)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Modalidade:</span>
                    <p className="font-semibold">{MODALITY_LABELS[modality as Modality] || modality}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex justify-between pt-2">
            <Button
              variant="ghost"
              onClick={() => setStep(3)}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Voltar
            </Button>
            <Button
              variant="primary"
              loading={createFullLaunchMutation.isPending}
              onClick={() => createFullLaunchMutation.mutate()}
              icon={<Send className="w-4 h-4" />}
              className="bg-emerald-600 hover:bg-emerald-700 font-bold"
            >
              Confirmar e Concluir Lançamento
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
