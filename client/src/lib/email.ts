export const COZAM_GMAIL_SENDER = 'comprascozam@gmail.com';

export interface SupplyOrderEmailItem {
  description: string;
  unit?: string | null;
  quantity: number;
}

export interface SupplyOrderEmailParams {
  ofNumber: string;
  supplierName: string;
  supplierEmail: string;
  senderEmail?: string;
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
  const authUser = (params.senderEmail || COZAM_GMAIL_SENDER).trim();
  const subjectParts = [`Ordem de Fornecimento ${params.ofNumber}`, params.supplierName];
  if (params.contractNumber) {
    subjectParts.push(`Contrato ${params.contractNumber}`);
  }
  const subject = subjectParts.join(' - ');

  const lines: string[] = [
    'Prezados, Boa tarde',
    '',
    '  Segue em anexo, ordem de Fornecimento para o COZAM, salientando que nosso endereço se encontra na Av. Comendador Gustavo Paiva, 3692 - Mangabeiras, Maceió - AL, 57037-035 - 5ª andar. Quaisquer dúvidas estamos à disposição.',
    'Horário de Funcionamento',
    '',
    'Seg a Qui - 8:30 as 17:00',
    'Sexta - 8:30 a 12:00',
    '',
    'Atenciosamente,',
    '',
    'Jonatha Pereira',
    'Setor de Compras',
    '',
    '___ FAVOR CONFIRMAR RECEBIMENTO___',
  ];

  const body = lines.join('\n');

  const gmailUrl = `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(authUser)}&view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return {
    to,
    authUser,
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
