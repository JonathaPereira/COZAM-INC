import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, KeyRound, Shield, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext.js';
import { getSupabase } from '../../lib/supabase.js';
import { ROLE_LABELS, PERMISSION_LABELS } from '@cozam/shared';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

export function PerfilPage() {
  const { profile, permissions } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas digitadas não coincidem.');
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = await getSupabase();
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      }
      toast.success('Sua senha de acesso foi alterada com sucesso!');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao alterar senha.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-heading">
          Meu Perfil Funcional
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Identificação do usuário autenticado e segurança de acesso
        </p>
      </div>

      {/* Dados do usuário */}
      <Card title="Informações Pessoais e Setor">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block uppercase font-semibold text-2xs">Nome Completo</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">{profile.full_name}</span>
          </div>
          <div>
            <span className="text-slate-500 block uppercase font-semibold text-2xs">E-mail Institucional</span>
            <span className="font-medium text-slate-800 mt-0.5 block">{profile.email}</span>
          </div>
          <div>
            <span className="text-slate-500 block uppercase font-semibold text-2xs">Função Atribuída</span>
            <span className="font-semibold text-emerald-800 mt-0.5 block">{ROLE_LABELS[profile.role]}</span>
          </div>
          <div>
            <span className="text-slate-500 block uppercase font-semibold text-2xs">Situação Cadastral</span>
            <span className="font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Conta ativa e autorizada
            </span>
          </div>
        </div>

        {/* Permissões ativas */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Permissões vigentes no seu perfil ({permissions.size})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700">
            {Array.from(permissions).map((p) => (
              <div key={p} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <span>{PERMISSION_LABELS[p] || p}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Alterar Senha */}
      <Card title="Segurança: Alterar Senha de Acesso">
        <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
          <Input
            label="Nova senha (mínimo 6 caracteres)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <Input
            label="Confirme a nova senha"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <Button type="submit" variant="primary" loading={savingPassword} icon={<KeyRound className="w-4 h-4" />}>
            Salvar Nova Senha
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight font-heading">404</h2>
      <p className="text-base font-semibold text-slate-700 mt-2">Página não encontrada</p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">
        O endereço solicitado não existe ou você não possui autorização para visualizá-lo.
      </p>
      <div className="mt-6">
        <Link to="/">
          <Button variant="primary">Voltar ao Início</Button>
        </Link>
      </div>
    </div>
  );
}
