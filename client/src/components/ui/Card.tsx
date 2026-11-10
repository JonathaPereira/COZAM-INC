import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatBRL } from '@cozam/shared';

export function Card({
  children,
  className,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className={twMerge(clsx('bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden', className))}>
      {(title || actions) && (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            {typeof title === 'string' ? (
              <h3 className="font-semibold text-slate-800 text-sm tracking-tight">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function StatCard({
  title,
  value,
  isCurrency = false,
  subtitle,
  icon,
  tone = 'default',
  badge,
}: {
  title: string;
  value: number | string;
  isCurrency?: boolean;
  subtitle?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'green' | 'amber' | 'orange' | 'rose' | 'muted';
  badge?: string;
}) {
  const tones = {
    default: 'text-slate-900',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    orange: 'text-orange-700',
    rose: 'text-rose-700',
    muted: 'text-slate-500',
  };

  const bgTones = {
    default: 'bg-white border-slate-200/80',
    green: 'bg-emerald-50/40 border-emerald-200/60',
    amber: 'bg-amber-50/40 border-amber-200/60',
    orange: 'bg-orange-50/40 border-orange-200/60',
    rose: 'bg-rose-50/40 border-rose-200/60',
    muted: 'bg-slate-50 border-slate-200/60',
  };

  const iconTones = {
    default: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    orange: 'bg-orange-100 text-orange-800',
    rose: 'bg-rose-100 text-rose-800',
    muted: 'bg-slate-200 text-slate-600',
  };

  const displayVal = typeof value === 'number' && isCurrency ? formatBRL(value) : String(value);

  return (
    <div className={`p-4 rounded-xl border shadow-2xs transition-all hover:shadow-xs ${bgTones[tone]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-bold tracking-tight tabular-nums ${tones[tone]}`}>
              {displayVal}
            </span>
            {badge && (
              <span className="text-2xs font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {icon && <div className={`p-2.5 rounded-lg shrink-0 ${iconTones[tone]}`}>{icon}</div>}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>{label}</span>
          <span className="font-semibold tabular-nums">{pct}%</span>
        </div>
      )}
      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-orange-500' : 'bg-slate-300'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
