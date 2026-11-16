import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, CheckCircle2, PenTool, UploadCloud, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext.js';
import { getSupabase } from '../../lib/supabase.js';
import { api, getErrorMessage } from '../../lib/api.js';
import { ROLE_LABELS, PERMISSION_LABELS } from '@cozam/shared';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

export function PerfilPage() {
  const { profile, permissions, refreshProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Assinatura digital
  const [jobTitle, setJobTitle] = useState(profile?.job_title || 'SUPERVISOR DE COMPRAS — COZAM');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(profile?.signature_data_url || null);
  const [savingSignature, setSavingSignature] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    if (profile) {
      setJobTitle(profile.job_title || 'SUPERVISOR DE COMPRAS — COZAM');
      setSignatureDataUrl(profile.signature_data_url || null);
    }
  }, [profile]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawingRef.current = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasDrawn) {
      setSignatureDataUrl(canvas.toDataURL('image/png'));
    }
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
    setSignatureDataUrl(null);
  };

  const handleSignatureImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem PNG ou JPG da sua assinatura.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 480;
        const maxH = 160;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const ctx = off.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          setSignatureDataUrl(off.toDataURL('image/png'));
          toast.success('Imagem da assinatura carregada. Clique em "Salvar Minha Assinatura" para aplicar.');
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSignature = async (clear = false) => {
    setSavingSignature(true);
    try {
      const sigToSave = clear ? null : signatureDataUrl;
      await api.put('/me/signature', {
        job_title: jobTitle.trim() || null,
        signature_data_url: sigToSave,
      });
      if (clear) {
        handleClearCanvas();
      }
      await refreshProfile();
      toast.success(clear ? 'Assinatura removida do perfil.' : 'Assinatura salva! Ela já será usada automaticamente nas próximas OFs emitidas.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingSignature(false);
    }
  };

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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
          Meu Perfil Funcional
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Identificação do usuário autenticado, assinatura eletrônica e segurança de acesso
        </p>
      </div>

      {/* Dados do usuário */}
      <Card title="Informações Pessoais e Setor">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400 dark:text-slate-500 block uppercase font-semibold text-2xs">Nome Completo</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5 block">{profile.full_name}</span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500 block uppercase font-semibold text-2xs">E-mail Institucional</span>
            <span className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block">{profile.email}</span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500 block uppercase font-semibold text-2xs">Função Atribuída</span>
            <span className="font-semibold text-emerald-800 dark:text-emerald-400 mt-0.5 block">{ROLE_LABELS[profile.role]}</span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500 block uppercase font-semibold text-2xs">Situação Cadastral</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Conta ativa e autorizada
            </span>
          </div>
        </div>

        {/* Permissões ativas */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Permissões vigentes no seu perfil ({permissions.size})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700 dark:text-slate-300">
            {Array.from(permissions).map((p) => (
              <div key={p} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                <span>{PERMISSION_LABELS[p] || p}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Assinatura Digital para Emissões */}
      <Card title="Assinatura Eletrônica para Ordens de Fornecimento">
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure sua assinatura para que as Ordens de Fornecimento (incluindo o Lançamento Múltiplo) já sejam emitidas e baixadas em PDF assinadas automaticamente.
          </p>

          <Input
            label="Cargo / Subtítulo na Assinatura do PDF"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Ex: SUPERVISOR DE COMPRAS — COZAM"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quadro para desenhar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-indigo-500" /> Desenhar Assinatura Aqui
                </span>
                <button
                  type="button"
                  onClick={handleClearCanvas}
                  className="text-2xs text-slate-500 hover:text-rose-600 font-medium cursor-pointer"
                >
                  Limpar quadro
                </button>
              </div>
              <canvas
                ref={canvasRef}
                width={420}
                height={140}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className="w-full h-36 bg-white border-2 border-dashed border-slate-300 rounded-xl cursor-crosshair touch-none"
              />
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleSignatureImageUpload(f);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<UploadCloud className="w-3.5 h-3.5" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Ou Enviar Imagem (PNG/JPG)
                </Button>
              </div>
            </div>

            {/* Pré-visualização no carimbo do documento */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Prévia no Rodapé do PDF
              </span>
              <div className="h-36 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center justify-end text-center">
                {signatureDataUrl ? (
                  <img
                    src={signatureDataUrl}
                    alt="Assinatura cadastrada"
                    className="max-h-16 max-w-[200px] object-contain mb-1 bg-white/90 px-2 rounded"
                  />
                ) : (
                  <span className="text-2xs text-slate-400 italic mb-3">
                    (Apenas assinatura eletrônica nominal / sem rubrica gráfica)
                  </span>
                )}
                <div className="w-52 border-t border-slate-400 pt-1">
                  <p className="text-2xs font-bold text-slate-800 dark:text-slate-200 uppercase truncate">
                    {profile.full_name}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {jobTitle || 'SUPERVISOR DE COMPRAS — COZAM'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              type="button"
              variant="primary"
              loading={savingSignature}
              icon={<Save className="w-4 h-4" />}
              onClick={() => handleSaveSignature(false)}
            >
              Salvar Minha Assinatura
            </Button>
            {signatureDataUrl && (
              <Button
                type="button"
                variant="secondary"
                disabled={savingSignature}
                icon={<Trash2 className="w-4 h-4 text-rose-500" />}
                onClick={() => handleSaveSignature(true)}
              >
                Remover Imagem
              </Button>
            )}
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
