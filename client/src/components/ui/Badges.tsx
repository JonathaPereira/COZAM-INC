import React from 'react';
import type { Modality, ForwardStatus } from '@cozam/shared';
import { MODALITY_LABELS, FORWARD_STATUS_LABELS } from '@cozam/shared';

export function ModalityBadge({ modality }: { modality: Modality | null | undefined }) {
  if (!modality) return <span className="text-slate-400 text-xs">—</span>;

  const isFumip = modality === 'FUMIP';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
        isFumip
          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/70'
          : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/70'
      }`}
    >
      {MODALITY_LABELS[modality]}
    </span>
  );
}

export function ForwardBadge({ forwardStatus }: { forwardStatus: ForwardStatus }) {
  const styles: Record<ForwardStatus, { bg: string; text: string; border: string }> = {
    RASCUNHO: {
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
    },
    ENCAMINHADA: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/60',
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-200 dark:border-indigo-800/70',
    },
    EM_ATENDIMENTO: {
      bg: 'bg-teal-50 dark:bg-teal-950/60',
      text: 'text-teal-700 dark:text-teal-300',
      border: 'border-teal-200 dark:border-teal-800/70',
    },
  };

  const s = styles[forwardStatus] || styles.RASCUNHO;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${s.bg} ${s.text} ${s.border}`}>
      {FORWARD_STATUS_LABELS[forwardStatus]}
    </span>
  );
}
