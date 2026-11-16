import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  Pencil,
  PenTool,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../lib/api.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { downloadSupplyOrderPdf, downloadSupplyOrderXlsx } from '../../lib/documents.js';
import { EditarItemContratoModal } from '../../components/contracts/EditarItemContratoModal.js';

interface ContractSearchItem {
  id: string;
  contract_id: string;
  contract_number: string;
  contract_year: number;
  contract_object: string;
  contract_end_date: string;
  supplier_id: string;
  supplier_name: string;
  supplier_cnpj?: string | null;
  item_code: string;
  description: string;
  category: string;
  unit: string;
  original_quantity: number;
  current_quantity: number;
  reserved_quantity: number;
  requested_quantity: number;
  available_quantity: number;
  unit_price: number;
}

interface SelectedBatchItem {
  item: ContractSearchItem;
  quantity: number;
}

const CONTRACT_BADGE_COLORS = [
  'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
  'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
  'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
];

export function LancamentoMultiploPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, can } = useAuth();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Busca de itens
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [quickQtyMap, setQuickQtyMap] = useState<Record<string, number>>({});

  // Lista de itens adicionados ao lançamento
  const [cart, setCart] = useState<SelectedBatchItem[]>([]);

  // Dados comuns do pedido
  const [selectedDestinationId, setSelectedDestinationId] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [useElectronicSignature, setUseElectronicSignature] = useState(true);

  // Resultado após finalizar
  const [createdOrders, setCreatedOrders] = useState<any[] | null>(null);
  const [downloadingBatchProgress, setDownloadingBatchProgress] = useState<string | null>(null);

  // Modal de correção manual de item caso algum item do contrato esteja fora de esquadro
  const [fixingItem, setFixingItem] = useState<ContractSearchItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data: destinations = [] } = useQuery<any[]>({
    queryKey: ['destinations-active'],
    queryFn: () => api.get('/destinations', { active_only: true }),
  });

  const { data: searchResults = [], isFetching: isSearching } = useQuery<ContractSearchItem[]>({
    queryKey: ['contract-items-search', debouncedTerm],
    queryFn: () =>
      api.get('/contracts/items/search', {
        q: debouncedTerm,
        only_available: 1,
        limit: 60,
      }),
  });

  const batchMutation = useMutation({
    mutationFn: (payload: any) => api.post<{ success: boolean; count: number; orders: any[] }>('/supply-orders/batch', payload),
    onSuccess: (res) => {
      setCreatedOrders(res.orders || []);
      toast.success(
        `${res.count} ${res.count === 1 ? 'Ordem de Fornecimento gerada' : 'Ordens de Fornecimento geradas'} com sucesso!`
      );
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-items-search'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const handleDestinationSelect = (destId: string) => {
    setSelectedDestinationId(destId);
    const dest = destinations.find((d) => d.id === destId);
    if (dest) {
      setMunicipality(dest.city || dest.name);
    } else if (!destId) {
      setMunicipality('');
    }
  };

  // Mapeia cada contract_id a uma cor fixa na sessão
  const contractColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    for (const c of cart) {
      if (!map.has(c.item.contract_id)) {
        map.set(c.item.contract_id, CONTRACT_BADGE_COLORS[idx % CONTRACT_BADGE_COLORS.length]);
        idx++;
      }
    }
    for (const r of searchResults) {
      if (!map.has(r.contract_id)) {
        map.set(r.contract_id, CONTRACT_BADGE_COLORS[idx % CONTRACT_BADGE_COLORS.length]);
        idx++;
      }
    }
    return map;
  }, [cart, searchResults]);

  const handleAddItem = (item: ContractSearchItem) => {
    const requestedQty = Number(quickQtyMap[item.id] ?? 1);
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
      toast.error('Informe uma quantidade maior que zero para adicionar.');
      return;
    }

    const existingIdx = cart.findIndex((c) => c.item.id === item.id);
    const alreadyInCart = existingIdx >= 0 ? cart[existingIdx].quantity : 0;
    const totalRequested = Math.round((alreadyInCart + requestedQty) * 1000) / 1000;

    if (totalRequested > item.available_quantity) {
      toast.error(
        `Saldo insuficiente para "${item.description.slice(0, 40)}...". Disponível: ${item.available_quantity} ${item.unit}.`
      );
      return;
    }

    if (existingIdx >= 0) {
      setCart((prev) =>
        prev.map((c, i) => (i === existingIdx ? { ...c, quantity: totalRequested } : c))
      );
      toast.success(`Quantidade atualizada para ${totalRequested} ${item.unit}.`);
    } else {
      setCart((prev) => [...prev, { item, quantity: requestedQty }]);
      toast.success(`Item adicionado ao lançamento (Contrato ${item.contract_number}/${item.contract_year}).`);
    }

    setQuickQtyMap((prev) => ({ ...prev, [item.id]: 1 }));
  };

  const handleUpdateCartQuantity = (itemId: string, newQty: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.item.id !== itemId) return c;
        if (newQty > c.item.available_quantity) {
          toast.error(`Quantidade excede o saldo disponível (${c.item.available_quantity} ${c.item.unit}).`);
          return c;
        }
        return { ...c, quantity: Math.max(0, newQty) };
      })
    );
  };

  const handleRemoveCartItem = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  };

  // Agrupamento em tempo real por Contrato (pré-visualização das OFs individuais)
  const groupedPreview = useMemo(() => {
    const map = new Map<
      string,
      {
        contract_id: string;
        contract_number: string;
        contract_year: number;
        supplier_name: string;
        items: SelectedBatchItem[];
        subtotal: number;
      }
    >();

    for (const entry of cart) {
      if (entry.quantity <= 0) continue;
      let grp = map.get(entry.item.contract_id);
      if (!grp) {
        grp = {
          contract_id: entry.item.contract_id,
          contract_number: entry.item.contract_number,
          contract_year: entry.item.contract_year,
          supplier_name: entry.item.supplier_name,
          items: [],
          subtotal: 0,
        };
        map.set(entry.item.contract_id, grp);
      }
      grp.items.push(entry);
      grp.subtotal = Math.round((grp.subtotal + entry.quantity * entry.item.unit_price) * 100) / 100;
    }

    return Array.from(map.values());
  }, [cart]);

  const grandTotal = useMemo(
    () => groupedPreview.reduce((acc, g) => acc + g.subtotal, 0),
    [groupedPreview]
  );

  const validCartItems = cart.filter((c) => c.quantity > 0);

  const handleSubmitBatch = () => {
    if (validCartItems.length === 0) {
      toast.error('Adicione pelo menos um item com quantidade positiva.');
      return;
    }
    for (const entry of validCartItems) {
      if (entry.quantity > entry.item.available_quantity) {
        toast.error(
          `Saldo insuficiente no item "${entry.item.description}". Disponível: ${entry.item.available_quantity}.`
        );
        return;
      }
    }

    batchMutation.mutate({
      destination_id: selectedDestinationId || undefined,
      municipality: municipality.trim() || undefined,
      issue_date: issueDate,
      notes: notes.trim() || undefined,
      use_electronic_signature: useElectronicSignature,
      items: validCartItems.map((entry) => ({
        contract_item_id: entry.item.id,
        quantity: entry.quantity,
      })),
    });
  };

  const handleDownloadAllPdfs = async () => {
    if (!createdOrders || createdOrders.length === 0) return;
    try {
      for (let i = 0; i < createdOrders.length; i++) {
        const ord = createdOrders[i];
        setDownloadingBatchProgress(`Baixando ${i + 1} de ${createdOrders.length} (${ord.of_number})...`);
        await downloadSupplyOrderPdf(ord.id, ord.of_number, ord.supplier_name, ord.total_value);
        if (i < createdOrders.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 450));
        }
      }
      toast.success(`Todas as ${createdOrders.length} Ordens de Fornecimento foram baixadas em PDF!`);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Erro ao baixar um dos PDFs. Você pode baixar individualmente abaixo.');
    } finally {
      setDownloadingBatchProgress(null);
    }
  };

  const handleResetAll = () => {
    setCart([]);
    setCreatedOrders(null);
    setNotes('');
    setSearchTerm('');
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  // Tela de Sucesso (Após emissão em lote)
  if (createdOrders) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700 shadow-xs space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {createdOrders.length}{' '}
              {createdOrders.length === 1
                ? 'Ordem de Fornecimento Gerada!'
                : 'Ordens de Fornecimento Geradas Individualmente!'}
            </h1>
            <p className="text-xs text-slate-500 max-w-xl mx-auto">
              Cada contrato recebeu sua própria Ordem de Fornecimento padrão com baixa de saldo validada atomicamente.
              {useElectronicSignature && ' Todas já estão assinadas eletronicamente com sua identificação e prontas para download.'}
            </p>
          </div>

          {/* Botão principal: Baixar tudo com 1 clique */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleDownloadAllPdfs}
              disabled={!!downloadingBatchProgress}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-all cursor-pointer disabled:opacity-60"
            >
              {downloadingBatchProgress ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {downloadingBatchProgress}
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Baixar Todas as {createdOrders.length} OFs em PDF (1 Clique)
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleResetAll}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo Lançamento Múltiplo
            </button>
          </div>

          {/* Cards individuais de cada OF gerada */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Ordens Geradas neste Lançamento ({createdOrders.length})
            </h2>

            {createdOrders.map((ord) => (
              <div
                key={ord.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {ord.of_number}
                    </span>
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {ord.status === 'CONFIRMADA' ? '✓ Assinada & Confirmada' : ord.status}
                    </span>
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                      Contrato {ord.contract_number}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Fornecedor: <strong>{ord.supplier_name}</strong> • {ord.items_count}{' '}
                    {ord.items_count === 1 ? 'item' : 'itens'} • Total:{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(ord.total_value)}
                    </strong>
                  </p>
                  {ord.electronic_signature_hash && (
                    <p className="text-[11px] text-slate-400 font-mono">
                      Autenticidade Eletrônica: {ord.electronic_signature_hash}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadSupplyOrderPdf(ord.id, ord.of_number, ord.supplier_name, ord.total_value)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSupplyOrderXlsx(ord.id, ord.of_number, ord.supplier_name, ord.total_value)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> XLSX
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/ordens/${ord.id}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir OF
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => navigate('/ordens')}
              className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
            >
              Ir para Listagem de Ordens de Fornecimento →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Cabeçalho e Voltar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button
            onClick={() => navigate('/ordens')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer mb-1"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para Ordens de Fornecimento
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Lançamento Múltiplo de Itens (Mix de Contratos)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pesquise itens de vários contratos (expediente, limpeza, café, elétrico) em um único pedido. Ao finalizar, cada grupo gera sua OF individual já assinada.
          </p>
        </div>

        <Link
          to="/ordens/nova"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 shrink-0"
        >
          <FileText className="w-4 h-4 text-slate-500" /> Usar Emissão Individual Tradicional
        </Link>
      </div>

      {/* Card 1: Dados Gerais do Pedido + Assinatura */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="md:col-span-2">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Município / Destinatário (Opcional)
            </label>
            <select
              value={selectedDestinationId}
              onChange={(e) => handleDestinationSelect(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
            >
              <option value="">Uso Interno COZAM / Sem município específico...</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.city}/{d.state})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Data de Emissão
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Local / Setor Solicitante
            </label>
            <input
              type="text"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
              placeholder="Ex: Sede COZAM ou Município..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-1">
          <div className="text-xs">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Observação Geral (Opcional — aplicada às OFs deste lançamento)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Atendimento de requisição interna - Limpeza, Café e Expediente..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
            />
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 flex items-center justify-between gap-3">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={useElectronicSignature}
                onChange={(e) => setUseElectronicSignature(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600"
              />
              <div>
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Já emitir com minha assinatura eletrônica
                </span>
                <span className="text-2xs text-slate-600 dark:text-slate-300 block mt-0.5">
                  {profile?.signature_data_url
                    ? 'Sua assinatura gráfica cadastrada no Perfil será estampada nos PDFs e o saldo será baixado imediatamente.'
                    : 'As OFs sairão assinadas nominalmente. Para incluir sua rubrica desenhada no PDF, configure em Meu Perfil.'}
                </span>
              </div>
            </label>

            <Link
              to="/perfil"
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-lg text-2xs font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 shrink-0"
            >
              {profile?.signature_data_url ? 'Ver Assinatura' : 'Cadastrar Rubrica'}
            </Link>
          </div>
        </div>
      </div>

      {/* Área Principal em 2 colunas: Pesquisa/Itens e Lista + Agrupamento */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda (7 cols): Pesquisa de Itens em Contratos Vigentes */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Pesquisar Itens em Todos os Contratos Ativos
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Digite o produto, código, contrato ou fornecedor (ex: água sanitária, café, grampeador)..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                {isSearching && (
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                )}
              </div>
            </div>

            {/* Lista de Resultados da Pesquisa */}
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {searchResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  {isSearching
                    ? 'Pesquisando itens nos contratos ativos...'
                    : 'Nenhum item com saldo disponível encontrado para esta busca.'}
                </div>
              ) : (
                searchResults.map((item) => {
                  const badgeCls =
                    contractColorMap.get(item.contract_id) || CONTRACT_BADGE_COLORS[0];
                  const qtyInput = quickQtyMap[item.id] ?? 1;
                  const inCart = cart.find((c) => c.item.id === item.id);

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-900/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-2xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                            Item {item.item_code}
                          </span>
                          <span className={`text-2xs font-bold px-2 py-0.5 rounded-full border ${badgeCls}`}>
                            Contrato {item.contract_number}/{item.contract_year} • {item.supplier_name}
                          </span>
                          {inCart && (
                            <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                              Na lista: {inCart.quantity} {item.unit}
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
                          {item.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                            Saldo: {item.available_quantity} {item.unit}
                          </span>
                          <span className="text-slate-500">
                            Unitário: <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(item.unit_price)}</strong>
                          </span>
                          {can('contracts.write') && (
                            <button
                              type="button"
                              onClick={() => setFixingItem(item)}
                              className="inline-flex items-center gap-1 text-2xs text-slate-400 hover:text-indigo-600 cursor-pointer"
                              title="Corrigir descrição, unidade, saldo ou preço deste item no contrato"
                            >
                              <Pencil className="w-3 h-3" /> Corrigir item
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min={0.001}
                          max={item.available_quantity}
                          step="any"
                          value={qtyInput}
                          onChange={(e) =>
                            setQuickQtyMap((prev) => ({
                              ...prev,
                              [item.id]: Number(e.target.value),
                            }))
                          }
                          className="w-20 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-center text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddItem(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Adicionar Item
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita (5 cols): Itens Selecionados + Prévia das OFs por Contrato */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Itens no Pedido ({validCartItems.length})
              </h2>
              <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(grandTotal)}
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <p>Nenhum item adicionado ainda.</p>
                <p className="text-2xs">
                  Pesquise ao lado e clique em <strong>"+ Adicionar Item"</strong> para montar o pedido misto.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {cart.map((entry, idx) => {
                  const badgeCls =
                    contractColorMap.get(entry.item.contract_id) || CONTRACT_BADGE_COLORS[0];
                  const lineSubtotal = Math.round(entry.quantity * entry.item.unit_price * 100) / 100;
                  const exceedsBalance = entry.quantity > entry.item.available_quantity;

                  return (
                    <div
                      key={entry.item.id}
                      className={`p-3 rounded-xl border text-xs space-y-2 ${
                        exceedsBalance
                          ? 'border-rose-300 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/20'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="font-mono text-[10px] text-slate-400">#{idx + 1}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeCls}`}>
                              Contrato {entry.item.contract_number}/{entry.item.contract_year}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-900 dark:text-white line-clamp-2">
                            {entry.item.description}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {entry.item.supplier_name} • Saldo: {entry.item.available_quantity} {entry.item.unit}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveCartItem(entry.item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                          title="Remover item da lista"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
                        <div className="flex items-center gap-1.5">
                          <span className="text-2xs text-slate-500">Qtd:</span>
                          <input
                            type="number"
                            min={0.001}
                            max={entry.item.available_quantity}
                            step="any"
                            value={entry.quantity}
                            onChange={(e) => handleUpdateCartQuantity(entry.item.id, Number(e.target.value))}
                            className="w-20 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-center font-bold text-xs"
                          />
                          <span className="text-2xs text-slate-500">{entry.item.unit}</span>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 mr-1.5">
                            x {formatCurrency(entry.item.unit_price)}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatCurrency(lineSubtotal)}
                          </span>
                        </div>
                      </div>

                      {exceedsBalance && (
                        <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Excede saldo disponível!
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Botão "Adicionar Mais Itens" abaixo da lista conforme pedido */}
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                searchInputRef.current?.focus();
                searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="w-full py-2 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Adicionar Mais Itens na Pesquisa
            </button>

            {/* Pré-visualização automática da separação por OF */}
            {groupedPreview.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Separação Automática ao Encerrar ({groupedPreview.length}{' '}
                  {groupedPreview.length === 1 ? 'OF individual' : 'OFs individuais'}):
                </p>

                <div className="space-y-1.5">
                  {groupedPreview.map((grp, idx) => {
                    const badgeCls =
                      contractColorMap.get(grp.contract_id) || CONTRACT_BADGE_COLORS[0];
                    return (
                      <div
                        key={grp.contract_id}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              Ordem {idx + 1}:
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeCls}`}>
                              Contrato {grp.contract_number}/{grp.contract_year}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {grp.supplier_name} • {grp.items.length} {grp.items.length === 1 ? 'item' : 'itens'}
                          </p>
                        </div>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                          {formatCurrency(grp.subtotal)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={validCartItems.length === 0 || batchMutation.isPending}
              onClick={handleSubmitBatch}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {batchMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando Ordens Individualmente...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Encerrar e Gerar {groupedPreview.length || 0}{' '}
                  {groupedPreview.length === 1 ? 'Ordem Assinada' : 'Ordens Assinadas'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de correção manual direta caso algum item esteja fora de esquadro */}
      {fixingItem && (
        <EditarItemContratoModal
          isOpen={!!fixingItem}
          onClose={() => setFixingItem(null)}
          contractId={fixingItem.contract_id}
          item={fixingItem}
        />
      )}
    </div>
  );
}
