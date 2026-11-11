import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api.js';
import { Plus, Trash2, AlertCircle, FileText, Calculator } from 'lucide-react';
import { toast } from 'sonner';

interface NovoContratoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  onOpenImportPdf?: () => void;
}

export function NovoContratoModal({ isOpen, onClose, initialData, onOpenImportPdf }: NovoContratoModalProps) {
  const queryClient = useQueryClient();

  const [contractNumber, setContractNumber] = useState(initialData?.contract_number || '');
  const [year, setYear] = useState(initialData?.year || new Date().getFullYear());
  const [supplierId, setSupplierId] = useState(initialData?.supplier_id || '');
  const [procurementId, setProcurementId] = useState(initialData?.procurement_id || '');
  const [object, setObject] = useState(initialData?.object || '');
  const [legalFramework, setLegalFramework] = useState(initialData?.legal_framework || 'Lei 14.133/2021');
  const [signingDate, setSigningDate] = useState(initialData?.signing_date || new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState(initialData?.start_date || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initialData?.end_date || '');
  const [deliveryDays, setDeliveryDays] = useState(initialData?.delivery_deadline_days || 15);

  // Estados para processo licitatório customizado / inline
  const [isNewProcurement, setIsNewProcurement] = useState(false);
  const [procProcessNumber, setProcProcessNumber] = useState('');
  const [biddingNumber, setBiddingNumber] = useState('');
  const [procModality, setProcModality] = useState('PREGAO_ELETRONICO');

  // Estados para cadastro rápido de fornecedor inline
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [newSupName, setNewSupName] = useState('');
  const [newSupLegalName, setNewSupLegalName] = useState('');
  const [newSupCnpj, setNewSupCnpj] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupEmail, setNewSupEmail] = useState('');
  const [newSupCity, setNewSupCity] = useState('');
  const [newSupIsSimples, setNewSupIsSimples] = useState(false);

  const createSupplierMutation = useMutation({
    mutationFn: async (supData: any) => api.post<any>('/suppliers', supData),
    onSuccess: (newSupplier) => {
      toast.success(`Fornecedor ${newSupplier.name} cadastrado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['suppliers-list'] });
      setSupplierId(newSupplier.id);
      setIsCreatingSupplier(false);
      setNewSupName('');
      setNewSupLegalName('');
      setNewSupCnpj('');
      setNewSupPhone('');
      setNewSupEmail('');
      setNewSupCity('');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const [items, setItems] = useState<any[]>(
    initialData?.items?.length
      ? initialData.items
      : [
          {
            item_code: '1-1',
            item_group: '',
            description: '',
            category: 'MATERIAL_CONSUMO',
            unit: 'Unidade',
            original_quantity: 1,
            unit_price: 0,
            total_price: 0,
          },
        ]
  );

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ['suppliers-list'],
    queryFn: () => api.get('/suppliers'),
  });

  const { data: procurements = [] } = useQuery<any[]>({
    queryKey: ['procurements-list'],
    queryFn: () => api.get('/procurements'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/contracts', data),
    onSuccess: () => {
      toast.success('Contrato e itens cadastrados com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contracts-list'] });
      onClose();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  if (!isOpen) return null;

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      const it = { ...next[index], [field]: value };
      if (field === 'original_quantity' || field === 'unit_price') {
        const q = Number(it.original_quantity || 0);
        const u = Number(it.unit_price || 0);
        it.total_price = Math.round(q * u * 100) / 100;
      }
      next[index] = it;
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        item_code: `${prev.length + 1}-1`,
        item_group: '',
        description: '',
        category: 'MATERIAL_CONSUMO',
        unit: 'Unidade',
        original_quantity: 1,
        unit_price: 0,
        total_price: 0,
      },
    ]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalContract = items.reduce((acc, it) => acc + Number(it.total_price || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractNumber.trim() || !supplierId || !object.trim() || !startDate || !endDate) {
      toast.error('Preencha os campos obrigatórios (Número, Fornecedor, Objeto e Vigência).');
      return;
    }

    if (items.some((it) => !it.description.trim() || Number(it.original_quantity) <= 0 || Number(it.unit_price) <= 0)) {
      toast.error('Todos os itens devem ter descrição, quantidade positiva e valor unitário.');
      return;
    }

    createMutation.mutate({
      contract_number: contractNumber.trim(),
      year: Number(year),
      procurement_id: isNewProcurement ? undefined : (procurementId || undefined),
      procurement_process_number: isNewProcurement ? procProcessNumber.trim() : undefined,
      bidding_number: isNewProcurement ? biddingNumber.trim() : undefined,
      procurement_modality: isNewProcurement ? procModality : undefined,
      supplier_id: supplierId,
      object: object.trim(),
      legal_framework: legalFramework.trim(),
      signing_date: signingDate,
      start_date: startDate,
      end_date: endDate,
      delivery_deadline_days: Number(deliveryDays),
      total_amount: totalContract,
      status: 'ATIVO',
      items: items.map((it, idx) => ({
        item_code: it.item_code?.trim() || `${idx + 1}`,
        item_group: it.item_group?.trim() || undefined,
        description: it.description.trim(),
        category: it.category || 'MATERIAL_CONSUMO',
        unit: it.unit?.trim() || 'Unidade',
        original_quantity: Number(it.original_quantity),
        unit_price: Number(it.unit_price),
        total_price: Number(it.total_price),
      })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-4xl w-full p-6 border border-slate-200 dark:border-slate-700 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Cadastrar Novo Contrato
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro do contrato administrativo com amarração matemática de saldo por item.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {onOpenImportPdf && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenImportPdf();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                Preencher via PDF
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xl">
              &times;
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Dados do Contrato */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Número do Contrato *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: 012/2026"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ano *</label>
              <input
                type="number"
                required
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Fornecedor Contratado *
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingSupplier(!isCreatingSupplier)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                >
                  {isCreatingSupplier ? '← Selecionar da lista' : '+ Cadastrar Novo Fornecedor'}
                </button>
              </div>

              {isCreatingSupplier ? (
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 rounded-xl space-y-2.5 animate-in fade-in">
                  <p className="text-2xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
                    Cadastro Rápido de Fornecedor
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nome Fantasia *"
                      required={isCreatingSupplier}
                      value={newSupName}
                      onChange={(e) => setNewSupName(e.target.value)}
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Razão Social"
                      value={newSupLegalName}
                      onChange={(e) => setNewSupLegalName(e.target.value)}
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="CNPJ (ex: 00.000.000/0001-00)"
                      value={newSupCnpj}
                      onChange={(e) => setNewSupCnpj(e.target.value)}
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Cidade / UF (ex: Satuba/AL)"
                      value={newSupCity}
                      onChange={(e) => setNewSupCity(e.target.value)}
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Telefone"
                      value={newSupPhone}
                      onChange={(e) => setNewSupPhone(e.target.value)}
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded text-xs"
                    />
                    <input
                      type="email"
                      placeholder="E-mail de Contato"
                      value={newSupEmail}
                      onChange={(e) => setNewSupEmail(e.target.value)}
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-2xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newSupIsSimples}
                        onChange={(e) => setNewSupIsSimples(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      Optante pelo Simples Nacional
                    </label>
                    <button
                      type="button"
                      disabled={!newSupName.trim() || createSupplierMutation.isPending}
                      onClick={() => {
                        createSupplierMutation.mutate({
                          name: newSupName.trim(),
                          legal_name: newSupLegalName.trim() || undefined,
                          cnpj: newSupCnpj.trim() || undefined,
                          city: newSupCity.trim() || undefined,
                          phone: newSupPhone.trim() || undefined,
                          email: newSupEmail.trim() || undefined,
                          is_simples_nacional: newSupIsSimples,
                        });
                      }}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                    >
                      {createSupplierMutation.isPending ? 'Salvando...' : 'Salvar Fornecedor'}
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  required
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                >
                  <option value="">Selecione o Fornecedor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.cnpj ? `(${s.cnpj})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Processo Licitatório
                </label>
                <button
                  type="button"
                  onClick={() => setIsNewProcurement(!isNewProcurement)}
                  className="text-2xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                >
                  {isNewProcurement ? '← Selecionar existente' : '+ Informar novo'}
                </button>
              </div>

              {isNewProcurement ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Nº Processo (ex: 004/2026) *"
                    required={isNewProcurement}
                    value={procProcessNumber}
                    onChange={(e) => setProcProcessNumber(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Licitação (ex: PE 02/2026)"
                    value={biddingNumber}
                    onChange={(e) => setBiddingNumber(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <select
                    value={procModality}
                    onChange={(e) => setProcModality(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  >
                    <option value="PREGAO_ELETRONICO">Pregão Eletrônico</option>
                    <option value="PREGAO_PRESENCIAL">Pregão Presencial</option>
                    <option value="CONCORRENCIA">Concorrência</option>
                    <option value="DISPENSA">Dispensa de Licitação</option>
                    <option value="INEXIGIBILIDADE">Inexigibilidade</option>
                    <option value="ADESAO_ATA">Adesão a Ata (Carona)</option>
                    <option value="OUTRO">Outro Procedimento</option>
                  </select>
                </div>
              ) : (
                <select
                  value={procurementId}
                  onChange={(e) => setProcurementId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                >
                  <option value="">Selecione (Opcional)...</option>
                  {procurements.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.process_number}/{p.year} {p.bidding_number ? `— ${p.bidding_number}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fundamentação Legal
              </label>
              <input
                type="text"
                value={legalFramework}
                onChange={(e) => setLegalFramework(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Prazo de Entrega (Dias)
              </label>
              <input
                type="number"
                min={1}
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Objeto Contratual *
            </label>
            <textarea
              required
              rows={2}
              placeholder="Descreva o objeto contratual..."
              value={object}
              onChange={(e) => setObject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Vigência */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data de Assinatura
              </label>
              <input
                type="date"
                required
                value={signingDate}
                onChange={(e) => setSigningDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Início da Vigência *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fim da Vigência *
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Itens do Contrato */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Itens Contratados (Saldo Inicial)
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Item
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 sticky top-0">
                  <tr>
                    <th className="p-2 w-16">Item</th>
                    <th className="p-2">Descrição</th>
                    <th className="p-2 w-28">Categoria</th>
                    <th className="p-2 w-20">Unidade</th>
                    <th className="p-2 w-20 text-center">Qtd</th>
                    <th className="p-2 w-24 text-right">Vlr Unit (R$)</th>
                    <th className="p-2 w-28 text-right">Total (R$)</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.item_code}
                          onChange={(e) => handleItemChange(idx, 'item_code', e.target.value)}
                          className="w-full px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-center"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          required
                          placeholder="Descrição do material ou serviço"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          className="w-full px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={item.category}
                          onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                          className="w-full px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs"
                        >
                          <option value="MATERIAL_CONSUMO">Consumo</option>
                          <option value="MATERIAL_EXPEDIENTE">Expediente</option>
                          <option value="AGUA_CAFE">Água/Café</option>
                          <option value="MATERIAL_ELETRICO">Elétrico</option>
                          <option value="EPIS">EPIs</option>
                          <option value="SERVICOS">Serviços</option>
                          <option value="LOCACAO">Locação</option>
                          <option value="OUTROS">Outros</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          className="w-full px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-center"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          value={item.original_quantity}
                          onChange={(e) => handleItemChange(idx, 'original_quantity', e.target.value)}
                          className="w-full px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-center"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                          className="w-full px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-right"
                        />
                      </td>
                      <td className="p-2 text-right font-semibold text-slate-800 dark:text-slate-200">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          item.total_price || 0
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-rose-500 hover:text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totalizador */}
            <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900 p-3 rounded-lg mt-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                TOTAL GLOBAL DO CONTRATO:
              </span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalContract)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {createMutation.isPending ? 'Salvando Contrato...' : 'Salvar Contrato e Itens'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
