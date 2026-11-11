import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Shield,
  Mail,
  KeyRound,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Check,
  Edit2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../lib/api.js';
import type { Profile, UserRole, PasswordResetRequest } from '@cozam/shared';
import { ROLE_LABELS, GRANTABLE_PERMISSIONS, PERMISSION_LABELS } from '@cozam/shared';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Modal } from '../../components/ui/Modal.js';
import { Input } from '../../components/ui/Input.js';
import { useAuth } from '../../contexts/AuthContext.js';

export function UsuariosPage() {
  const { profile: currentProfile } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'solicitacoes' ? 'solicitacoes' : 'usuarios';

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  // Formulário criação
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('pagamentos');
  const [newPassword, setNewPassword] = useState('');
  const [newPermissions, setNewPermissions] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Formulário edição
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('pagamentos');
  const [editActive, setEditActive] = useState(true);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);

  // Modal Definir Senha Diretamente
  const [setPasswordModalOpen, setSetPasswordModalOpen] = useState(false);
  const [userForPassword, setUserForPassword] = useState<Profile | null>(null);
  const [directPassword, setDirectPassword] = useState('');
  const [directReason, setDirectReason] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Solicitações de Senha
  const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveUseTemporary, setApproveUseTemporary] = useState(false);
  const [approveTemporaryPassword, setApproveTemporaryPassword] = useState('Cozam@2026');
  const [approveNotes, setApproveNotes] = useState('');
  const [approving, setApproving] = useState(false);

  // Recusa de solicitação
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Queries
  const { data: users, isLoading: loadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get<Profile[]>('/users'),
  });

  const { data: requests, isLoading: loadingRequests, refetch: refetchRequests } = useQuery({
    queryKey: ['password-reset-requests'],
    queryFn: () => api.get<PasswordResetRequest[]>('/password-reset-requests'),
    enabled: currentProfile?.role === 'admin',
    refetchInterval: 15000,
  });

  const { data: pendingData } = useQuery({
    queryKey: ['pending-password-resets-count'],
    queryFn: () => api.get<{ pendingCount: number }>('/password-reset-requests/pending-count'),
    enabled: currentProfile?.role === 'admin',
    refetchInterval: 15000,
  });

  const pendingCount = pendingData?.pendingCount || 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/users', {
        full_name: newName.trim(),
        email: newEmail.trim(),
        role: newRole,
        password: newPassword || undefined,
        extra_permissions: newRole === 'admin_secundario' ? newPermissions : [],
      });
      toast.success(`Usuário ${newName} cadastrado com sucesso!`);
      setCreateModalOpen(false);
      resetCreateForm();
      refetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setEditing(true);
    try {
      await api.patch(`/users/${selectedUser.id}`, {
        full_name: editName.trim(),
        role: editRole,
        active: editActive,
        extra_permissions: editRole === 'admin_secundario' ? editPermissions : [],
      });
      toast.success('Usuário atualizado com sucesso!');
      setEditModalOpen(false);
      refetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setEditing(false);
    }
  };

  const handleSetDirectPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForPassword) return;
    if (directPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>(`/users/${userForPassword.id}/set-password`, {
        password: directPassword,
        reason: directReason.trim() || undefined,
      });
      toast.success(res.message || 'Senha definida com sucesso!');
      setSetPasswordModalOpen(false);
      setDirectPassword('');
      setDirectReason('');
      setUserForPassword(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleApproveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setApproving(true);
    try {
      const payload: { temporary_password?: string; admin_notes?: string } = {
        admin_notes: approveNotes.trim() || undefined,
      };

      if (approveUseTemporary || !selectedRequest.has_proposed_password) {
        if (!approveTemporaryPassword || approveTemporaryPassword.length < 6) {
          toast.error('A senha provisória deve ter no mínimo 6 caracteres.');
          setApproving(false);
          return;
        }
        payload.temporary_password = approveTemporaryPassword;
      }

      const res = await api.post<{ success: boolean; message: string; passwordActive?: string }>(
        `/password-reset-requests/${selectedRequest.id}/approve`,
        payload
      );

      toast.success(res.message || 'Solicitação autorizada com sucesso!');
      setApproveModalOpen(false);
      setSelectedRequest(null);
      queryClient.invalidateQueries({ queryKey: ['password-reset-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-password-resets-count'] });
      refetchRequests();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setApproving(false);
    }
  };

  const handleRejectRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setRejecting(true);
    try {
      await api.post(`/password-reset-requests/${selectedRequest.id}/reject`, {
        reason: rejectReason.trim() || undefined,
      });
      toast.success('Solicitação recusada com sucesso.');
      setRejectModalOpen(false);
      setSelectedRequest(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['password-reset-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-password-resets-count'] });
      refetchRequests();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRejecting(false);
    }
  };

  const resetCreateForm = () => {
    setNewName('');
    setNewEmail('');
    setNewRole('pagamentos');
    setNewPassword('');
    setNewPermissions([]);
  };

  const openEdit = (user: Profile) => {
    setSelectedUser(user);
    setEditName(user.full_name);
    setEditRole(user.role);
    setEditActive(user.active);
    setEditPermissions(user.extra_permissions || []);
    setEditModalOpen(true);
  };

  const openDirectPasswordModal = (user: Profile) => {
    setUserForPassword(user);
    setDirectPassword('Cozam@2026');
    setDirectReason('Redefinição direta autorizada pelo Administrador.');
    setSetPasswordModalOpen(true);
  };

  const openApprove = (req: PasswordResetRequest) => {
    setSelectedRequest(req);
    setApproveUseTemporary(!req.has_proposed_password);
    setApproveTemporaryPassword('Cozam@2026');
    setApproveNotes('Solicitação aprovada pelo Administrador.');
    setApproveModalOpen(true);
  };

  const openReject = (req: PasswordResetRequest) => {
    setSelectedRequest(req);
    setRejectReason('Solicitação não reconhecida ou dados divergentes.');
    setRejectModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
            Gestão de Usuários e Segurança de Acesso
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Controle de acessos, autorização de senhas funcionais e permissões dos setores
          </p>
        </div>

        {activeTab === 'usuarios' && (
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              resetCreateForm();
              setCreateModalOpen(true);
            }}
          >
            Novo Usuário
          </Button>
        )}
      </div>

      {/* Navegação entre Abas */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'usuarios' })}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'usuarios'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuários do Sistema</span>
          {users && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-2xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
              {users.length}
            </span>
          )}
        </button>

        {currentProfile?.role === 'admin' && (
          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'solicitacoes' })}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'solicitacoes'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Solicitações de Redefinição de Senha</span>
            {pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-2xs font-extrabold bg-amber-500 text-white animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ABA 1: Usuários Cadastrados */}
      {activeTab === 'usuarios' && (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-2xs">
                  <th className="py-3 px-4 font-semibold">Nome Completo</th>
                  <th className="py-3 px-4 font-semibold">E-mail Funcional (Login)</th>
                  <th className="py-3 px-4 font-semibold">Função de Acesso</th>
                  <th className="py-3 px-4 font-semibold">Permissões Específicas</th>
                  <th className="py-3 px-4 font-semibold text-center">Situação</th>
                  <th className="py-3 px-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users && users.length > 0 ? (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {u.full_name}
                        {u.id === currentProfile?.id && (
                          <span className="ml-2 text-2xs font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            Você
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{ROLE_LABELS[u.role]}</span>
                      </td>
                      <td className="py-3 px-4 text-2xs text-slate-500 dark:text-slate-400">
                        {u.role === 'admin'
                          ? 'Acesso irrestrito a todas as funções'
                          : u.role === 'pagamentos'
                          ? 'Padrão do Setor de Pagamentos'
                          : u.extra_permissions?.length
                          ? `${u.extra_permissions.length} permissão(ões) concedida(s)`
                          : 'Acesso padrão de consulta'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-2xs font-bold ${
                            u.active
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                          }`}
                        >
                          {u.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="px-2.5 py-1 text-2xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer transition-colors"
                          >
                            Editar
                          </button>
                          {currentProfile?.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => openDirectPasswordModal(u)}
                              title="Definir nova senha diretamente"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded cursor-pointer transition-colors border border-emerald-200 dark:border-emerald-800/60"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Definir Senha</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      {loadingUsers ? 'Carregando usuários...' : 'Nenhum usuário cadastrado.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ABA 2: Solicitações de Redefinição de Senha */}
      {activeTab === 'solicitacoes' && currentProfile?.role === 'admin' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <KeyRound className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Mecanismo Institucional de Redefinição de Senhas</p>
              <p className="mt-0.5 text-2xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Como os e-mails são institucionais e funcionam como identificadores funcionais (sem caixa de entrada externa), quando o gerente de pagamentos ou operador esquece a senha, ele envia a solicitação diretamente para você. Ao autorizar, a senha é ativada de imediato no sistema.
              </p>
            </div>
          </div>

          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-2xs">
                    <th className="py-3 px-4 font-semibold">Data da Solicitação</th>
                    <th className="py-3 px-4 font-semibold">Usuário Solicitante</th>
                    <th className="py-3 px-4 font-semibold">Função / Setor</th>
                    <th className="py-3 px-4 font-semibold">Motivo Informado</th>
                    <th className="py-3 px-4 font-semibold">Senha Solicitada</th>
                    <th className="py-3 px-4 font-semibold text-center">Situação</th>
                    <th className="py-3 px-4 font-semibold text-right">Ação do Administrador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {requests && requests.length > 0 ? (
                    requests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 text-2xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(req.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{req.full_name}</p>
                          <p className="text-2xs text-slate-500 dark:text-slate-400">{req.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {ROLE_LABELS[req.role] || req.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300 max-w-xs truncate" title={req.request_reason || ''}>
                          {req.request_reason || '—'}
                        </td>
                        <td className="py-3 px-4 text-2xs text-slate-600 dark:text-slate-300">
                          {req.has_proposed_password ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Proposta pelo usuário
                            </span>
                          ) : (
                            <span className="text-slate-400">Não informada (aguarda provisória)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold ${
                              req.status === 'APROVADA'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : req.status === 'REJEITADA'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                            }`}
                          >
                            {req.status === 'APROVADA' && <CheckCircle2 className="w-3 h-3" />}
                            {req.status === 'PENDENTE' && <Clock className="w-3 h-3" />}
                            {req.status === 'REJEITADA' && <XCircle className="w-3 h-3" />}
                            {req.status === 'APROVADA'
                              ? 'Aprovada'
                              : req.status === 'REJEITADA'
                              ? 'Recusada'
                              : 'Pendente'}
                          </span>
                          {req.approved_by_name && (
                            <p className="text-3xs text-slate-400 mt-0.5">por {req.approved_by_name}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {req.status === 'PENDENTE' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<Check className="w-3.5 h-3.5" />}
                                onClick={() => openApprove(req)}
                              >
                                Autorizar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openReject(req)}
                                className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              >
                                Recusar
                              </Button>
                            </div>
                          ) : (
                            <span className="text-2xs text-slate-400 italic">Finalizado</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {loadingRequests ? 'Carregando solicitações...' : 'Nenhuma solicitação de senha pendente.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Autorizar Solicitação de Senha */}
      <Modal
        isOpen={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        size="md"
        title="Autorizar Nova Senha Funcional"
        subtitle={`Solicitante: ${selectedRequest?.full_name} (${selectedRequest?.email})`}
      >
        <form onSubmit={handleApproveRequest} className="space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5">
            <p className="text-2xs font-bold text-slate-500 uppercase">Dados da Solicitação</p>
            <p className="text-slate-800 dark:text-slate-200">
              <strong>Setor / Função:</strong> {selectedRequest ? ROLE_LABELS[selectedRequest.role] : ''}
            </p>
            <p className="text-slate-800 dark:text-slate-200">
              <strong>Motivo informado:</strong> {selectedRequest?.request_reason || 'Não informado'}
            </p>
          </div>

          {selectedRequest?.has_proposed_password ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                Opção de Ativação de Senha
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 cursor-pointer">
                  <input
                    type="radio"
                    name="approveOption"
                    checked={!approveUseTemporary}
                    onChange={() => setApproveUseTemporary(false)}
                    className="accent-emerald-700"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      Ativar a senha cadastrada pelo próprio usuário na solicitação
                    </p>
                    <p className="text-2xs text-slate-500">
                      O usuário já digitou e confirmou a senha desejada ao solicitar.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 cursor-pointer">
                  <input
                    type="radio"
                    name="approveOption"
                    checked={approveUseTemporary}
                    onChange={() => setApproveUseTemporary(true)}
                    className="accent-emerald-700"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      Definir uma senha provisória manual
                    </p>
                    <p className="text-2xs text-slate-500">
                      Você define uma senha provisória e repassa ao colaborador.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-600 dark:text-slate-400">
              O colaborador não enviou uma nova senha na solicitação. Defina uma senha provisória abaixo:
            </div>
          )}

          {(approveUseTemporary || !selectedRequest?.has_proposed_password) && (
            <Input
              label="Senha Provisória a Ativar (mínimo 6 caracteres)"
              value={approveTemporaryPassword}
              onChange={(e) => setApproveTemporaryPassword(e.target.value)}
              placeholder="Ex: Cozam@2026"
              required
            />
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Observações Administrativas (Opcional)
            </label>
            <Input
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              placeholder="Ex: Aprovado após confirmação telefônica com o gerente."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setApproveModalOpen(false)} disabled={approving}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" loading={approving} icon={<Check className="w-4 h-4" />}>
              Autorizar e Ativar Senha
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Recusar Solicitação de Senha */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        size="md"
        title="Recusar Solicitação de Senha"
        subtitle={`Solicitante: ${selectedRequest?.full_name} (${selectedRequest?.email})`}
      >
        <form onSubmit={handleRejectRequest} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Motivo da Recusa
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Ex: Não reconheço este pedido de acesso / Usuário deve confirmar com a gerência..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setRejectModalOpen(false)} disabled={rejecting}>
              Cancelar
            </Button>
            <Button variant="danger" type="submit" loading={rejecting}>
              Confirmar Recusa
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Definir Senha Diretamente (Admin -> Qualquer Usuário) */}
      <Modal
        isOpen={setPasswordModalOpen}
        onClose={() => setSetPasswordModalOpen(false)}
        size="md"
        title={`Definir Nova Senha: ${userForPassword?.full_name}`}
        subtitle={`E-mail funcional: ${userForPassword?.email}`}
      >
        <form onSubmit={handleSetDirectPassword} className="space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-2xs text-slate-600 dark:text-slate-300">
            Como Administrador Geral, você pode definir a senha diretamente sem necessidade de envio de e-mails. A nova senha entra em vigor imediatamente.
          </div>

          <div className="space-y-1">
            <Input
              label="Nova Senha Funcional (mínimo 6 caracteres)"
              type="text"
              value={directPassword}
              onChange={(e) => setDirectPassword(e.target.value)}
              placeholder="Ex: Cozam@2026"
              required
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDirectPassword('Cozam@2026')}
                className="text-2xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Padrão: Cozam@2026
              </button>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <button
                type="button"
                onClick={() => {
                  const rnd = 'Cozam#' + Math.floor(1000 + Math.random() * 9000);
                  setDirectPassword(rnd);
                }}
                className="text-2xs font-semibold text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
              >
                Gerar Senha Aleatória
              </button>
            </div>
          </div>

          <Input
            label="Motivo / Justificativa Administrativa"
            value={directReason}
            onChange={(e) => setDirectReason(e.target.value)}
            placeholder="Ex: Colaborador esqueceu a senha anterior do setor."
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setSetPasswordModalOpen(false)} disabled={savingPassword}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" loading={savingPassword}>
              Salvar e Ativar Nova Senha
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Criar Usuário */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        size="md"
        title="Cadastrar Novo Usuário"
        subtitle="O usuário terá acesso às rotas de acordo com a função atribuída"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Nome completo"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex: Maria das Graças Silva"
            required
          />

          <Input
            label="E-mail funcional"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="maria.silva@cozam.al.gov.br"
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Função de Acesso
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            >
              <option value="admin">Administrador — Compras (Acesso Total)</option>
              <option value="pagamentos">Operador — Pagamentos (Consulta e Liquidação)</option>
              <option value="admin_secundario">Administrador Secundário (Permissões Configuráveis)</option>
            </select>
          </div>

          <Input
            label="Senha provisória (mínimo 6 caracteres)"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Deixe em branco para senha padrão Cozam@2026"
          />

          {newRole === 'admin_secundario' && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
              <p className="text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                Conceder Permissões Específicas
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {GRANTABLE_PERMISSIONS.map((perm) => {
                  const checked = newPermissions.includes(perm);
                  return (
                    <label key={perm} className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setNewPermissions(
                            checked
                              ? newPermissions.filter((p) => p !== perm)
                              : [...newPermissions, perm]
                          );
                        }}
                        className="accent-emerald-700"
                      />
                      <span className="text-2xs">{PERMISSION_LABELS[perm]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" loading={creating}>
              Criar Usuário
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Editar Usuário */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        size="md"
        title={`Editar Usuário: ${selectedUser?.full_name}`}
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <Input
            label="Nome completo"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Função de Acesso
            </label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as UserRole)}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              disabled={selectedUser?.id === currentProfile?.id}
            >
              <option value="admin">Administrador — Compras</option>
              <option value="pagamentos">Operador — Pagamentos</option>
              <option value="admin_secundario">Administrador Secundário</option>
            </select>
            {selectedUser?.id === currentProfile?.id && (
              <p className="text-2xs text-slate-400 mt-1 italic">
                Você não pode alterar sua própria função para evitar auto-bloqueio.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="userActive"
              checked={editActive}
              onChange={(e) => setEditActive(e.target.checked)}
              disabled={selectedUser?.id === currentProfile?.id}
              className="accent-emerald-700"
            />
            <label htmlFor="userActive" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
              Conta de usuário ativa no sistema
            </label>
          </div>

          {editRole === 'admin_secundario' && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
              <p className="text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                Permissões Adicionais Concedidas
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {GRANTABLE_PERMISSIONS.map((perm) => {
                  const checked = editPermissions.includes(perm);
                  return (
                    <label key={perm} className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setEditPermissions(
                            checked
                              ? editPermissions.filter((p) => p !== perm)
                              : [...editPermissions, perm]
                          );
                        }}
                        className="accent-emerald-700"
                      />
                      <span className="text-2xs">{PERMISSION_LABELS[perm]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setEditModalOpen(false)} disabled={editing}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" loading={editing}>
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
