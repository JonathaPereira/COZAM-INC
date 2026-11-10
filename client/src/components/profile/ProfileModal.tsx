import React, { useState } from 'react';
import { User, KeyRound, Shield, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext.js';
import { getSupabase } from '../../lib/supabase.js';
import { ROLE_LABELS, PERMISSION_LABELS } from '@cozam/shared';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { profile, permissions } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  if (!isOpen || !profile) return null;

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
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao alterar senha.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                Meu Perfil e Senha
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Informações funcionais e alteração de senha
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Informações Pessoais */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 uppercase font-semibold text-2xs block">Nome Completo</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">{profile.full_name}</span>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold text-2xs block">E-mail Institucional</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 mt-0.5 block truncate">{profile.email}</span>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold text-2xs block">Setor / Função</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5 block">{ROLE_LABELS[profile.role]}</span>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold text-2xs block">Situação Cadastral</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
              </span>
            </div>
          </div>

          {/* Formulário de Alteração de Senha */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Alterar Senha de Acesso
            </h4>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <Input
                label="Nova senha (mínimo 6 caracteres)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a nova senha..."
                required
              />

              <Input
                label="Confirmar nova senha"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha..."
                required
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={savingPassword}
                  icon={<KeyRound className="w-4 h-4" />}
                >
                  Salvar Nova Senha
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
