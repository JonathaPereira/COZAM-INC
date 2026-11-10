import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabase } from '../../lib/supabase.js';
import { BRAND } from '../../config/brand.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

export function RecuperarSenha() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const supabase = await getSupabase();
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (error) throw error;
      }
      setSent(true);
      toast.success('Instruções enviadas para seu e-mail.');
    } catch (err: any) {
      toast.error(err.message || 'Não foi possível solicitar a redefinição.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <img src={BRAND.logos.icon} alt={BRAND.acronym} className="w-8 h-8 object-contain" />
          <span className="font-bold text-slate-900 tracking-tight font-heading">{BRAND.acronym}</span>
        </div>

        {sent ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">E-mail enviado!</h2>
            <p className="text-xs text-slate-600 mt-2">
              Se houver uma conta cadastrada para <span className="font-semibold text-slate-800">{email}</span>, você receberá um link seguro para cadastrar uma nova senha.
            </p>
            <div className="mt-6">
              <Link to="/login">
                <Button variant="outline" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
                  Voltar para o login
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight font-heading">
              Recuperação de Senha
            </h2>
            <p className="text-xs text-slate-500 mt-1 mb-6">
              Informe seu e-mail institucional para receber as instruções de recuperação.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="E-mail funcional"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.nome@cozam.al.gov.br"
                required
                leftIcon={<Mail className="w-4 h-4" />}
              />

              <Button type="submit" variant="primary" className="w-full" loading={loading}>
                Enviar instruções
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export function RedefinirSenha() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const supabase = await getSupabase();
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      }
      setSuccess(true);
      toast.success('Senha atualizada com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao redefinir a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        {success ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Senha cadastrada!</h2>
            <p className="text-xs text-slate-600 mt-2">
              Sua nova senha foi salva. Você já pode acessar a plataforma.
            </p>
            <div className="mt-6">
              <Link to="/login">
                <Button variant="primary" size="sm">
                  Ir para o login
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight font-heading">
              Criar Nova Senha
            </h2>
            <p className="text-xs text-slate-500 mt-1 mb-6">
              Defina sua nova senha funcional de acesso ao COZAM.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
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

              <Button type="submit" variant="primary" className="w-full" loading={loading}>
                Atualizar Senha
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
