import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { Landmark, Plus, Search, Building, MapPin, Phone, Mail, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Destination {
  id: string;
  name: string;
  code?: string;
  entity_type?: string;
  city: string;
  state: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  address?: string;
  active: boolean;
  notes?: string;
  created_at: string;
}

export function DestinatariosPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('PREFEITURA');
  const [city, setCity] = useState('');
  const [state, setState] = useState('AL');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const { data: destinations = [], isLoading } = useQuery<Destination[]>({
    queryKey: ['destinations', search],
    queryFn: () => api.get('/destinations', { search }),
  });

  const createMutation = useMutation({
    mutationFn: (newDest: any) => api.post('/destinations', newDest),
    onSuccess: () => {
      toast.success('Destinatário cadastrado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/destinations/${id}`, { active }),
    onSuccess: () => {
      toast.success('Situação do destinatário atualizada!');
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const resetForm = () => {
    setName('');
    setEntityType('PREFEITURA');
    setCity('');
    setState('AL');
    setContactName('');
    setContactPhone('');
    setContactEmail('');
    setAddress('');
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !city.trim()) {
      toast.error('Informe ao menos o nome do destinatário e o município.');
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      entity_type: entityType,
      city: city.trim(),
      state: state.trim() || 'AL',
      contact_name: contactName.trim() || undefined,
      contact_phone: contactPhone.trim() || undefined,
      contact_email: contactEmail.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Landmark className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Municípios e Destinatários
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Cadastro de municípios consorciados, prefeituras e secretarias destinatárias das Ordens de Fornecimento.
          </p>
        </div>
        {can('destinations.manage') && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Novo Município / Destinatário
          </button>
        )}
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por município ou órgão..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Lista / Tabela */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Carregando destinatários...</div>
        ) : destinations.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Nenhum município ou destinatário encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4">Município / Nome</th>
                  <th className="px-6 py-4">Tipo de Entidade</th>
                  <th className="px-6 py-4">Localização</th>
                  <th className="px-6 py-4">Contato / Responsável</th>
                  <th className="px-6 py-4">Situação</th>
                  {can('destinations.manage') && <th className="px-6 py-4 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {destinations.map((dest) => (
                  <tr key={dest.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Building className="w-4 h-4 text-slate-400" />
                        {dest.name}
                      </div>
                      {dest.notes && <div className="text-xs text-slate-400 mt-0.5">{dest.notes}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                        {dest.entity_type || 'PREFEITURA'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {dest.city}/{dest.state}
                      </div>
                      {dest.address && <div className="text-xs text-slate-400 mt-0.5">{dest.address}</div>}
                    </td>
                    <td className="px-6 py-4">
                      {dest.contact_name ? (
                        <div>
                          <div className="font-medium text-slate-800 dark:text-slate-200">{dest.contact_name}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            {dest.contact_phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {dest.contact_phone}
                              </span>
                            )}
                            {dest.contact_email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {dest.contact_email}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Sem contato cadastrado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {dest.active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3.5 h-3.5" /> Inativo
                        </span>
                      )}
                    </td>
                    {can('destinations.manage') && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => toggleMutation.mutate({ id: dest.id, active: !dest.active })}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white underline cursor-pointer"
                        >
                          {dest.active ? 'Desativar' : 'Ativar'}
                        </button>
                      </td>
                    )}
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
              Cadastrar Município / Destinatário
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Destinatário ou Município *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Santana do Mundaú ou Fundo Municipal de Saúde"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Entidade
                  </label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  >
                    <option value="PREFEITURA">Prefeitura Municipal</option>
                    <option value="SECRETARIA">Secretaria Municipal</option>
                    <option value="FUNDO">Fundo Municipal</option>
                    <option value="CONSORCIO">Consórcio / Sede</option>
                    <option value="OUTRO">Outro Órgão</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Município Sede *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Santana do Mundaú"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  >
                  </input>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Pessoa de Contato
                  </label>
                  <input
                    type="text"
                    placeholder="Nome do secretário / gestor"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Telefone de Contato
                  </label>
                  <input
                    type="text"
                    placeholder="(82) 99999-9999"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  E-mail Oficial
                </label>
                <input
                  type="email"
                  placeholder="compras@municipio.al.gov.br"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                />
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Salvando...' : 'Salvar Destinatário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
