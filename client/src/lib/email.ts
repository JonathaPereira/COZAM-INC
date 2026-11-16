import { formatBRL } from '@cozam/shared';

export interface SupplyOrderEmailItem {
  description: string;
  unit?: string | null;
  quantity: number;
}

export interface SupplyOrderEmailParams {
  ofNumber: string;
  supplierName: string;
  supplierEmail: string;
  contractNumber?: string | null;
  totalValue?: number | null;
  issueDate?: string | null;
  destinationName?: string | null;
  municipality?: string | null;
  deliveryDeadlineDays?: number | null;
  items?: SupplyOrderEmailItem[];
  notes?: string | null;
}

export function buildSupplyOrderEmailContent(params: SupplyOrderEmailParams) {
  const to = params.supplierEmail.trim();
  const subjectParts = [`Ordem de Fornecimento ${params.ofNumber}`, params.supplierName];
  if (params.contractNumber) {
    subjectParts.push(`Contrato ${params.contractNumber}`);
  }
  const subject = subjectParts.join(' - ');

  const location = [params.destinationName, params.municipality].filter(Boolean).join(' / ');
  const deadlineText =
    params.deliveryDeadlineDays && params.deliveryDeadlineDays > 0
      ? `${params.deliveryDeadlineDays} dias corridos`
      : '(a combinar / conforme contrato)';

  const lines: string[] = [
    `Prezado(a) ${params.supplierName},`,
    '',
    `Segue em anexo a Ordem de Fornecimento ${params.ofNumber}${
      params.contractNumber ? `, vinculada ao Contrato ${params.contractNumber}` : ''
    }${params.totalValue != null ? `, no valor total de ${formatBRL(params.totalValue)}` : ''}.`,
    '',
    'Detalhes para entrega (completar antes do envio):',
    `- Local / Destino: ${location || '(informar endereço / local de entrega)'}`,
    `- Prazo de entrega: ${deadlineText}`,
    `- Observações da entrega: ${params.notes?.trim() || '(inserir detalhes sobre entrega, horário ou responsável pelo recebimento)'}`,
  ];

  if (params.items && params.items.length > 0) {
    lines.push('', 'Resumo dos itens solicitados:');
    const maxItems = 10;
    const shown = params.items.slice(0, maxItems);
    for (const item of shown) {
      const desc = item.description.replace(/\s+/g, ' ').trim();
      const shortDesc = desc.length > 75 ? `${desc.slice(0, 72)}...` : desc;
      const qtyStr = Number(item.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
      const unitStr = item.unit ? ` ${item.unit}` : '';
      lines.push(`- ${qtyStr}${unitStr} x ${shortDesc}`);
    }
    if (params.items.length > maxItems) {
      lines.push(`- ... e mais ${params.items.length - maxItems} item(ns) — confira o PDF completo em anexo.`);
    }
  }

  lines.push(
    '',
    'OBS.: Por favor, anexar o PDF da Ordem de Fornecimento antes de enviar.',
    'Solicitamos a gentileza de confirmar o recebimento deste e-mail.',
    '',
    'Atenciosamente,',
    'Jonatha Pereira de Jesus',
    'Supervisor de Compras — COZAM'
  );

  let body = lines.join('\n');
  if (body.length > 1700) {
    body = `${body.slice(0, 1650)}\n...\n\nAtenciosamente,\nJonatha Pereira de Jesus\nSupervisor de Compras — COZAM`;
  }

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return {
    to,
    subject,
    body,
    gmailUrl,
  };
}

export function openGmailCompose(params: SupplyOrderEmailParams): { gmailUrl: string; opened: boolean } {
  const { gmailUrl } = buildSupplyOrderEmailContent(params);
  const win = window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  return { gmailUrl, opened: Boolean(win) };
}
