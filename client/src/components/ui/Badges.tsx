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
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'bg-purple-50 text-purple-700 border border-purple-200'
      }`}
    >
      {MODALITY_LABELS[modality]}
    </span>
  );
}

export function ForwardBadge({ forwardStatus }: { forwardStatus: ForwardStatus }) {
  const styles: Record<ForwardStatus, { bg: string; text: string; border: string }> = {
    RASCUNHO: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
    ENCAMINHADA: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    EM_ATENDIMENTO: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  };

  const s = styles[forwardStatus] || styles.RASCUNHO;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${s.bg} ${s.text} ${s.border}`}>
      {FORWARD_STATUS_LABELS[forwardStatus]}
    </span>
  );
}
