import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { BRAND } from '../../config/brand.js';
import { getWelcomeGreeting, useAuth } from '../../contexts/AuthContext.js';
import { ROLE_LABELS } from '@cozam/shared';

const INTRO_EVENT = 'cozam:replay-intro';

export function triggerIntroReplay() {
  window.dispatchEvent(new CustomEvent(INTRO_EVENT));
}

export function WelcomeIntroOverlay() {
  const { profile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [playKey, setPlayKey] = useState(0);

  const [lastTriggerId, setLastTriggerId] = useState<string | null>(null);

  const startIntro = () => {
    setExiting(false);
    setVisible(true);
    setPlayKey((k) => k + 1);
  };

  useEffect(() => {
    if (!profile) return;
    const identityKey = `${profile.id}:${profile.role}`;
    if (lastTriggerId !== identityKey) {
      setLastTriggerId(identityKey);
      startIntro();
    }
  }, [profile?.id, profile?.role, lastTriggerId]);

  useEffect(() => {
    const onReplay = () => startIntro();
    window.addEventListener(INTRO_EVENT, onReplay);
    return () => window.removeEventListener(INTRO_EVENT, onReplay);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const exitDelay = prefersReduced ? 450 : 4050;
    const unmountDelay = prefersReduced ? 650 : 4500;

    const exitTimer = window.setTimeout(() => setExiting(true), exitDelay);
    const doneTimer = window.setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, unmountDelay);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExiting(true);
        window.setTimeout(() => setVisible(false), 260);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [visible, playKey]);

  if (!visible || !profile) return null;

  const greeting = getWelcomeGreeting(profile);
  const sectorLabel =
    profile.role === 'pagamentos' || greeting.includes('Felipe Góes')
      ? 'Setor de Pagamentos & Liquidação Financeira'
      : profile.role === 'admin'
      ? 'Setor de Compras, Contratos & Licitações'
      : ROLE_LABELS[profile.role];

  const handleSkip = () => {
    setExiting(true);
    window.setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, 240);
  };

  return (
    <div
      key={playKey}
      onClick={handleSkip}
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#060c14] text-white select-none transition-all duration-500 ease-out cursor-pointer ${
        exiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Fundo atmosférico sutil com grade técnica e brilhos radiais */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 20%, rgba(16, 185, 129, 0.22), transparent 45%), radial-gradient(circle at 78% 80%, rgba(245, 158, 11, 0.14), transparent 45%), linear-gradient(to right, rgba(148, 163, 184, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.05) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 44px 44px, 44px 44px',
        }}
      />

      {/* Palco central cinematográfico */}
      <div className="relative z-10 max-w-2xl w-full px-6 text-center flex flex-col items-center">
        {/* Emblema animado com anel orbital + light sweep */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="animate-intro-ring absolute -inset-4 rounded-full border border-dashed border-emerald-400/40" />
          <div className="animate-intro-logo relative w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-900/90 to-slate-900 border border-emerald-500/40 shadow-[0_0_40px_-8px_rgba(16,185,129,0.45)] flex items-center justify-center overflow-hidden">
            <img
              src={BRAND.logos.iconWhite}
              alt={BRAND.acronym}
              className="w-11 h-11 object-contain"
            />
            <div className="animate-intro-sheen pointer-events-none absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </div>
        </div>

        {/* Marca & Slogan Institucional */}
        <h1 className="animate-intro-wordmark font-heading text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white via-slate-100 to-emerald-300 bg-clip-text text-transparent">
          {BRAND.acronym}
        </h1>

        <p className="animate-intro-slogan mt-2 text-xs sm:text-sm font-medium tracking-wide text-slate-300 uppercase">
          {BRAND.systemName}
        </p>

        {/* Linha divisória expansiva */}
        <div className="animate-intro-line my-6 h-px w-48 bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />

        {/* Saudação Personalizada */}
        <div className="animate-intro-welcome space-y-2.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-xs font-semibold text-emerald-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{sectorLabel}</span>
          </div>

          <p className="font-heading text-2xl sm:text-4xl font-bold text-white tracking-tight">
            {greeting}
          </p>
        </div>

        {/* Barra de progresso minimalista */}
        <div className="mt-9 w-56 h-1 rounded-full bg-slate-800/90 overflow-hidden border border-slate-700/60">
          <div className="animate-intro-progress h-full w-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-400" />
        </div>
      </div>

      {/* Atalho discreto para pular */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleSkip();
        }}
        className="absolute bottom-6 right-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-medium text-slate-300 transition-colors cursor-pointer"
      >
        <span>Entrar agora</span>
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
