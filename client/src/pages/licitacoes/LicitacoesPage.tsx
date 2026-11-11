import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { Gavel, Plus, Search, Calendar, FileText, CheckCircle2, Building, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface ProcurementProcess {
  id: string;
  process_number: string;
  year: number;
  bidding_number?: string;
  modality: string;
  legal_framework: string;
  object: string;
  opening_date?: string;
  homologation_date?: string;
  status: string;
  contracts_count?: number;
  created_at: string;
}

const MODALITY_LABELS: Record<string, string> = {
  PREGAO_ELETRONICO: 'Pregão Eletrônico',
  PREGAO_PRESENCIAL: 'Pregão Presencial',
  CONCORRENCIA: 'Concorrência',
  DISPENSA: 'Dispensa de Licitação',
  INEXIGIBILIDADE: 'Inexigibilidade',
  ADESAO_ATA: 'Adesão a Ata (Carona)',
  OUTRO: 'Outro Procedimento',
};

export function LicitacoesPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [processNumber, setProcessNumber] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [biddingNumber, setBiddingNumber] = useState('');
  const [modality, setModality] = useState('PREGAO_ELETRONICO');
  const [legalFramework, setLegalFramework] = useState('Lei 14.133/2021');
  const [object, setObject] = useState('');
  const [openingDate, setOpeningDate] = useState('');
  const [homologationDate, setHomologationDate] = useState('');
  const [notes, setNotes] = useState('');

  const { data: processes = [], isLoading } = useQuery<ProcurementProcess[]>({
    queryKey: ['procurements', search],
    queryFn: () => api.get('/procurements', { search }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/procurements', data),
    onSuccess: () => {
      toast.success('Processo licitatório cadastrado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['procurements'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const resetForm = () => {
    setProcessNumber('');
    setYear(new Date().getFullYear());
    setBiddingNumber('');
    setModality('PREGAO_ELETRONICO');
    setLegalFramework('Lei 14.133/2021');
    setObject('');
    setOpeningDate('');
    setHomologationDate('');
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!processNumber.trim() || !object.trim()) {
      toast.error('Informe o número do processo e o objeto da licitação.');
      return;
    }
    createMutation.mutate({
      process_number: processNumber.trim(),
      year: Number(year),
      bidding_number: biddingNumber.trim() || undefined,
      modality,
      legal_framework: legalFramework.trim() || 'Lei 14.133/2021',
      object: object.trim(),
      opening_date: openingDate || undefined,
      homologation_date: homologationDate || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Gavel className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Processos Licitatórios e Atas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestão dos procedimentos licitatórios (Pregões, Dispensas, Adesões a Ata) que dão origem aos contratos do Consórcio.
          </p>
        </div>
        {can('procurements.write') && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Novo Processo Licitatório
          </button>
        )}
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por número, pregão ou objeto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Tabela de Licitações */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Carregando processos licitatórios...</div>
        ) : processes.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Nenhum processo licitatório encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4">Processo / Licitação</th>
                  <th className="px-6 py-4">Modalidade & Fundamento</th>
                  <th className="px-6 py-4">Objeto da Licitação</th>
                  <th className="px-6 py-4">Datas Chave</th>
                  <th className="px-6 py-4">Contratos Vinculados</th>
                  <th className="px-6 py-4">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {processes.map((proc) => (
                  <tr key={proc.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {proc.process_number}/{proc.year}
                      </div>
                      {proc.bidding_number && (
                        <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                          {proc.bidding_number}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {MODALITY_LABELS[proc.modality] || proc.modality}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{proc.legal_framework}</div>
                    </td>
                    <td className="px-6 py-4 max-w-sm">
                      <p className="line-clamp-2 text-xs text-slate-700 dark:text-slate-300">
                        {proc.object}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {proc.homologation_date ? (
                        <div>Homologado: {new Date(proc.homologation_date).toLocaleDateString('pt-BR')}</div>
                      ) : proc.opening_date ? (
                        <div>Abertura: {new Date(proc.opening_date).toLocaleDateString('pt-BR')}</div>
                      ) : (
                        <span className="text-slate-400">Sem datas cadastradas</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                        <FileText className="w-3.5 h-3.5" />
                        {proc.contracts_count || 0} {Number(proc.contracts_count) === 1 ? 'contrato' : 'contratos'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {proc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Criação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Novo Processo Licitatório
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Número do Processo Administrativo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: PROC-002/2026"
                    value={processNumber}
                    onChange={(e) => setProcessNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Ano *
                  </label>
                  <input
                    type="number"
                    required
                    min={2020}
                    max={2040}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Modalidade de Contratação
                  </label>
                  <select
                    value={modality}
                    onChange={(e) => setModality(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  >
                    <option value="PREGAO_ELETRONICO">Pregão Eletrônico</option>
                    <option value="PREGAO_PRESENCIAL">Pregão Presencial</option>
                    <option value="CONCORRENCIA">Concorrência</option>
                    <option value="DISPENSA">Dispensa de Licitação</option>
                    <option value="INEXIGIBILIDADE">Inexigibilidade</option>
                    <option value="ADESAO_ATA">Adesão a Ata</option>
                    <option value="OUTRO">Outro Procedimento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Número do Edital / Pregão
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Pregão Eletrônico 002/2026"
                    value={biddingNumber}
                    onChange={(e) => setBiddingNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fundamentação Legal
                </label>
                <input
                  type="text"
                  placeholder="Ex: Lei 14.133/2021"
                  value={legalFramework}
                  onChange={(e) => setLegalFramework(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Objeto da Contratação *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Descreva o objeto geral da licitação..."
                  value={object}
                  onChange={(e) => setObject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Data de Abertura
                  </label>
                  <input
                    type="date"
                    value={openingDate}
                    onChange={(e) => setOpeningDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Data de Homologação
                  </label>
                  <input
                    type="date"
                    value={homologationDate}
                    onChange={(e) => setHomologationDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Salvando...' : 'Cadastrar Processo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
