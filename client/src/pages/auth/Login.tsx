import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext.js';
import { BRAND } from '../../config/brand.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginDev } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Informe seu e-mail e sua senha.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success('Sessão iniciada com sucesso!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Falha na autenticação.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (role: 'admin' | 'pagamentos') => {
    setLoading(true);
    try {
      await loginDev(role);
      toast.success(`Acesso rápido autenticado como ${role === 'admin' ? 'Compras (Administrador)' : 'Pagamentos'}.`);
      navigate(role === 'admin' ? '/' : '/pagamentos');
    } catch (err: any) {
      toast.error(err.message || 'Falha no acesso rápido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white">
      {/* Painel Institucional Esquerdo */}
      <div className="md:w-5/12 lg:w-1/2 bg-gradient-to-br from-emerald-900 via-emerald-800 to-green-950 p-8 md:p-12 lg:p-16 flex flex-col justify-between text-white relative overflow-hidden">
        {/* Elemento de iluminação suave de fundo */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-lime-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Marca oficial no topo */}
        <div className="relative z-10">
          <img
            src={BRAND.logos.horizontalWhite}
            alt={BRAND.name}
            className="h-14 md:h-16 object-contain"
          />
        </div>

        {/* Texto central */}
        <div className="relative z-10 my-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold tracking-wide border border-emerald-400/20 mb-4">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Ambiente Seguro & Auditado
          </span>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight font-heading">
            Gestão Integrada de Compras e Pagamentos
          </h1>
          <p className="mt-4 text-emerald-100/90 text-sm md:text-base leading-relaxed max-w-lg">
            Plataforma institucional do Consórcio Intermunicipal COZAM para tramitação digital de processos, emissão de Ordens de Fornecimento, controle de Notas Fiscais e liquidação de pagamentos.
          </p>

          <div className="mt-8 space-y-3 text-xs text-emerald-200/90">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />
              <span>Eliminação da circulação manual de documentos físicos</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />
              <span>Controle financeiro de saldos parciais e totais em tempo real</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />
              <span>Rastreabilidade completa e trilha de auditoria transparente</span>
            </div>
          </div>
        </div>

        {/* Rodapé institucional */}
        <div className="relative z-10 pt-6 border-t border-emerald-700/60 text-2xs text-emerald-300/80">
          COZAM · Consórcio Intermunicipal da Zona da Mata Alagoana e Serviços Públicos
        </div>
      </div>

      {/* Painel de Formulário Direito */}
      <div className="md:w-7/12 lg:w-1/2 flex items-center justify-center p-6 md:p-12 lg:p-16 bg-slate-50/50">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight font-heading">
              Acesso ao Sistema
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Informe suas credenciais funcionais para continuar
            </p>
          </div>

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

            <div>
              <Input
                label="Senha de acesso"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                leftIcon={<Lock className="w-4 h-4" />}
              />
              <div className="flex justify-end mt-1.5">
                <Link
                  to="/recuperar-senha"
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2 font-semibold"
              loading={loading}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Entrar no Sistema
            </Button>
          </form>

          {/* Atalhos de Demonstração / Ambiente sem Supabase Configurado */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-2xs font-semibold text-slate-400 uppercase tracking-wider text-center mb-3">
              Acesso rápido para testes de homologação
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100 transition-colors text-center cursor-pointer"
              >
                Setor de Compras
                <span className="block text-2xs text-emerald-700 font-normal">Administrador</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('pagamentos')}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 transition-colors text-center cursor-pointer"
              >
                Setor de Pagamentos
                <span className="block text-2xs text-slate-500 font-normal">Operador</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
