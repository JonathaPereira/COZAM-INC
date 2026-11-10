import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Plus, Shield, Mail, KeyRound, UserCheck, UserX, Check } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../lib/api.js';
import type { Profile, UserRole } from '@cozam/shared';
import { ROLE_LABELS, GRANTABLE_PERMISSIONS, PERMISSION_LABELS } from '@cozam/shared';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Modal } from '../../components/ui/Modal.js';
import { Input } from '../../components/ui/Input.js';
import { useAuth } from '../../contexts/AuthContext.js';

export function UsuariosPage() {
  const { profile: currentProfile } = useAuth();
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

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get<Profile[]>('/users'),
  });

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
      refetch();
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
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setEditing(false);
    }
  };

  const handleResetPassword = async (user: Profile) => {
    try {
      await api.post(`/users/${user.id}/reset-password`);
      toast.success(`E-mail de recuperação enviado para ${user.email}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-heading">
            Gestão de Usuários e Permissões
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Controle de acessos dos setores de Compras, Pagamentos e Administrador Secundário
          </p>
        </div>

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
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 uppercase tracking-wider text-2xs">
                <th className="py-3 px-4 font-semibold">Nome Completo</th>
                <th className="py-3 px-4 font-semibold">E-mail Funcional</th>
                <th className="py-3 px-4 font-semibold">Função de Acesso</th>
                <th className="py-3 px-4 font-semibold">Permissões Específicas</th>
                <th className="py-3 px-4 font-semibold text-center">Situação</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users && users.length > 0 ? (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {u.full_name}
                      {u.id === currentProfile?.id && (
                        <span className="ml-2 text-2xs font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Você
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{ROLE_LABELS[u.role]}</span>
                    </td>
                    <td className="py-3 px-4 text-2xs text-slate-500">
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
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="px-2.5 py-1 text-2xs font-semibold text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetPassword(u)}
                          title="Enviar e-mail para redefinir senha"
                          className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Carregando usuários...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Função de Acesso
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
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
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <p className="text-2xs font-bold text-slate-700 uppercase">
                Conceder Permissões Específicas
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {GRANTABLE_PERMISSIONS.map((perm) => {
                  const checked = newPermissions.includes(perm);
                  return (
                    <label key={perm} className="flex items-center gap-2 cursor-pointer text-slate-700">
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

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
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
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Função de Acesso
            </label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as UserRole)}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
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
            <label htmlFor="userActive" className="text-xs font-semibold text-slate-800 cursor-pointer">
              Conta de usuário ativa no sistema
            </label>
          </div>

          {editRole === 'admin_secundario' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <p className="text-2xs font-bold text-slate-700 uppercase">
                Permissões Adicionais Concedidas
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {GRANTABLE_PERMISSIONS.map((perm) => {
                  const checked = editPermissions.includes(perm);
                  return (
                    <label key={perm} className="flex items-center gap-2 cursor-pointer text-slate-700">
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

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
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
