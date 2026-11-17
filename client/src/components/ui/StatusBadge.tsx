import React from 'react';
import type { InvoiceStatus } from '@cozam/shared';
import { INVOICE_STATUS_LABELS } from '@cozam/shared';

export interface StatusBadgeProps {
  status: InvoiceStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const styles: Record<InvoiceStatus, { bg: string; text: string; dot: string; border: string }> = {
    AGUARDANDO_PAGAMENTO: {
      bg: 'bg-amber-50 dark:bg-amber-950/50',
      text: 'text-amber-800 dark:text-amber-300',
      dot: 'bg-amber-500 dark:bg-amber-400',
      border: 'border-amber-200 dark:border-amber-800/70',
    },
    PARCIALMENTE_PAGA: {
      bg: 'bg-orange-50 dark:bg-orange-950/50',
      text: 'text-orange-800 dark:text-orange-300',
      dot: 'bg-orange-500 dark:bg-orange-400',
      border: 'border-orange-200 dark:border-orange-800/70',
    },
    TOTALMENTE_PAGA: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
      text: 'text-emerald-800 dark:text-emerald-300',
      dot: 'bg-emerald-500 dark:bg-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-800/70',
    },
    NAO_VERIFICADA: {
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-700 dark:text-slate-300',
      dot: 'bg-slate-400 dark:bg-slate-400',
      border: 'border-slate-300 dark:border-slate-700',
    },
    CANCELADA: {
      bg: 'bg-rose-50 dark:bg-rose-950/50',
      text: 'text-rose-800 dark:text-rose-300',
      dot: 'bg-rose-500 dark:bg-rose-400',
      border: 'border-rose-200 dark:border-rose-800/70',
    },
  };

  const style = styles[status] || styles.NAO_VERIFICADA;
  const label = INVOICE_STATUS_LABELS[status] || status;

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      <span>{label}</span>
    </span>
  );
}
