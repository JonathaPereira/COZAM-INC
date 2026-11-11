import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, ShieldAlert, KeyRound, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { BRAND } from '../../config/brand.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { api, getErrorMessage } from '../../lib/api.js';

interface RequestStatusResponse {
  request: {
    id: string;
    status: 'PENDENTE' | 'APROVADA' | 'REJEITADA';
    request_reason?: string | null;
    temporary_password?: string | null;
    created_at: string;
    resolved_at?: string | null;
    approved_by_name?: string | null;
    admin_notes?: string | null;
  } | null;
}

export function RecuperarSenha() {
  const [tab, setTab] = useState<'solicitar' | 'consultar'>('solicitar');

  // Formulário Solicitar
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Consulta de Status
  const [searchEmail, setSearchEmail] = useState('');
  const [statusResult, setStatusResult] = useState<RequestStatusResponse['request'] | undefined>(undefined);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (newPassword && newPassword.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error('A confirmação da senha não coincide.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>('/auth/request-password-reset', {
        email: email.trim(),
        proposed_password: newPassword ? newPassword : undefined,
        reason: reason.trim() || undefined,
      });

      setSubmitted(true);
      toast.success(res.message || 'Solicitação enviada com sucesso ao Administrador!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;

    setCheckingStatus(true);
    try {
      const data = await api.get<RequestStatusResponse>('/auth/password-reset-status', {
        email: searchEmail.trim(),
      });
      setStatusResult(data.request);
      if (!data.request) {
        toast.info('Nenhuma solicitação encontrada para este e-mail funcional.');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="flex items-center gap-2.5 mb-6">
          <img src={BRAND.logos.icon} alt={BRAND.acronym} className="w-9 h-9 object-contain" />
          <div>
            <span className="font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading text-lg">
              {BRAND.acronym}
            </span>
            <p className="text-2xs text-slate-500 dark:text-slate-400">Recuperação de Acesso Institucional</p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => setTab('solicitar')}
            className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer ${
              tab === 'solicitar'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Solicitar Nova Senha
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('consultar');
              if (email && !searchEmail) setSearchEmail(email);
            }}
            className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer ${
              tab === 'consultar'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Consultar Andamento
          </button>
        </div>

        {tab === 'solicitar' ? (
          submitted ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Solicitação Enviada!</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  A solicitação para <span className="font-semibold text-slate-800 dark:text-slate-200">{email}</span> foi encaminhada ao <strong className="text-slate-900 dark:text-slate-100">Administrador Geral</strong>.
                </p>
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-left text-2xs text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>Mecanismo de Segurança COZAM</span>
                  </div>
                  <p>
                    Como os e-mails são institucionais e funcionam como chave de acesso funcional (sem envio de e-mails externos), a nova senha é ativada mediante <strong>autorização direta do Administrador no painel de controle</strong>.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchEmail(email);
                    setTab('consultar');
                  }}
                >
                  Verificar Andamento
                </Button>
                <Link to="/login">
                  <Button variant="primary" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
                    Voltar para o login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
                  Solicitar Autorização de Senha
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Preencha seus dados para que o Administrador autorize a redefinição de acesso do seu setor.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="E-mail funcional cadastrado"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ex: pagamentos@cozam.al.gov.br"
                  required
                  leftIcon={<Mail className="w-4 h-4" />}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Nova senha desejada"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    leftIcon={<KeyRound className="w-4 h-4" />}
                  />
                  <Input
                    label="Confirmar nova senha"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    leftIcon={<KeyRound className="w-4 h-4" />}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Motivo / Identificação (Opcional)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Ex: Esqueci a senha de acesso ao setor de pagamentos / Sou o novo responsável..."
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-2xs text-slate-600 dark:text-slate-400">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-0.5">Como funciona a autorização?</p>
                  O Administrador receberá um alerta imediato na barra superior. Ao aprovar, sua nova senha será ativada instantaneamente sem depender de caixa de entrada externa.
                </div>

                <Button type="submit" variant="primary" className="w-full" loading={loading}>
                  Enviar Solicitação ao Administrador
                </Button>

                <div className="text-center pt-2">
                  <Link
                    to="/login"
                    className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
                  </Link>
                </div>
              </form>
            </div>
          )
        ) : (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
                Consultar Andamento da Solicitação
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Verifique se o Administrador já autorizou sua solicitação de redefinição de senha.
              </p>
            </div>

            <form onSubmit={handleCheckStatus} className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    label="E-mail funcional"
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="pagamentos@cozam.al.gov.br"
                    required
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary" loading={checkingStatus} className="h-10">
                    Consultar
                  </Button>
                </div>
              </div>
            </form>

            {statusResult !== undefined && (
              <div className="mt-5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                {statusResult ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Situação:</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          statusResult.status === 'APROVADA'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : statusResult.status === 'REJEITADA'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {statusResult.status === 'APROVADA' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {statusResult.status === 'PENDENTE' && <Clock className="w-3.5 h-3.5" />}
                        {statusResult.status === 'REJEITADA' && <AlertCircle className="w-3.5 h-3.5" />}
                        {statusResult.status === 'APROVADA'
                          ? 'Aprovada pelo Administrador'
                          : statusResult.status === 'REJEITADA'
                          ? 'Não Autorizada'
                          : 'Aguardando Autorização'}
                      </span>
                    </div>

                    <div className="text-2xs text-slate-500 dark:text-slate-400">
                      Solicitado em: {new Date(statusResult.created_at).toLocaleString('pt-BR')}
                    </div>

                    {statusResult.status === 'APROVADA' && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                        <p className="font-bold">✓ Acesso Liberado!</p>
                        {statusResult.temporary_password ? (
                          <p>
                            O administrador definiu a seguinte senha provisória:{' '}
                            <code className="bg-emerald-200 dark:bg-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold text-emerald-950 dark:text-emerald-100">
                              {statusResult.temporary_password}
                            </code>
                          </p>
                        ) : (
                          <p>A nova senha solicitada por você já está ativa e validada.</p>
                        )}
                        {statusResult.approved_by_name && (
                          <p className="text-2xs text-emerald-700 dark:text-emerald-400">
                            Autorizado por: {statusResult.approved_by_name}
                          </p>
                        )}
                        <div className="pt-2">
                          <Link to="/login">
                            <Button variant="primary" size="sm" className="w-full">
                              Ir para o Login com a Nova Senha
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}

                    {statusResult.status === 'PENDENTE' && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 rounded-lg text-2xs text-amber-800 dark:text-amber-300">
                        O Administrador já recebeu a notificação no painel dele. Aguarde a validação ou solicite verbalmente ao gestor para aprovar no sistema.
                      </div>
                    )}

                    {statusResult.status === 'REJEITADA' && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 rounded-lg text-2xs text-rose-800 dark:text-rose-300 space-y-1">
                        <p className="font-bold">Solicitação recusada pelo Administrador.</p>
                        {statusResult.admin_notes && (
                          <p>Motivo informado: {statusResult.admin_notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-500 py-3">
                    Nenhuma solicitação encontrada para o e-mail informado.
                  </p>
                )}
              </div>
            )}

            <div className="text-center pt-5">
              <Link
                to="/login"
                className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RedefinirSenha() {
  return <RecuperarSenha />;
}
