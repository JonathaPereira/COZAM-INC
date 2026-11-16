/**
 * Manipulação de documentos oficiais: visualização, download e impressão.
 * Conforme seção 9 da especificação:
 * "A impressão deverá utilizar arquivos originais, sem modificar o conteúdo dos documentos.
 * Disponibilizar uma visualização adequada para impressão e permitir que o usuário escolha
 * sua impressora pelo navegador ou sistema operacional."
 */

export async function fetchDocumentBlob(documentId: string): Promise<{ blob: Blob; url: string; mimeType: string }> {
  const token = localStorage.getItem('cozam_token');
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api/documents/${documentId}/content`, { headers });
  if (!res.ok) throw new Error('Não foi possível carregar o arquivo do documento.');

  const mimeType = res.headers.get('Content-Type') || 'application/pdf';
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return { blob, url, mimeType };
}

export async function downloadDocument(documentId: string, fileName: string): Promise<void> {
  const { blob } = await fetchDocumentBlob(documentId);
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export async function printDocument(documentId: string): Promise<void> {
  const { blob, mimeType } = await fetchDocumentBlob(documentId);
  const blobUrl = URL.createObjectURL(blob);

  if (mimeType === 'application/pdf') {
    // Para PDF: cria um iframe temporário escondido e aciona print() nativo do navegador
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;

    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        // Fallback: abre em nova aba para o usuário imprimir pelo visualizador padrão
        window.open(blobUrl, '_blank');
      } finally {
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(blobUrl);
        }, 60000);
      }
    };
  } else {
    // Para imagens (comprovantes): abre em janela popup para impressão
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <html>
          <head><title>Imprimir Comprovante</title></head>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;">
            <img src="${blobUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" onload="window.print();window.close();" />
          </body>
        </html>
      `);
      win.document.close();
    } else {
      window.open(blobUrl, '_blank');
    }
  }
}

import { buildSupplyOrderFilename } from '@cozam/shared';

function extractFilenameFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      // ignore decode failure
    }
  }
  const asciiMatch = headerValue.match(/filename="([^"]+)"/i) || headerValue.match(/filename=([^;]+)/i);
  return asciiMatch?.[1]?.trim() || null;
}

export async function downloadSupplyOrderPdf(
  orderId: string,
  ofNumber?: string,
  supplierName?: string,
  totalValue?: number | null
): Promise<void> {
  const token = localStorage.getItem('cozam_token');
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api/supply-orders/${orderId}/pdf`, { headers });
  if (!res.ok) throw new Error('Erro ao gerar o PDF oficial da Ordem de Fornecimento.');

  const serverFilename = extractFilenameFromHeader(res.headers.get('Content-Disposition'));
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download =
    serverFilename || buildSupplyOrderFilename(ofNumber || orderId, supplierName, totalValue, 'pdf');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export async function downloadSupplyOrderXlsx(
  orderId: string,
  ofNumber?: string,
  supplierName?: string,
  totalValue?: number | null
): Promise<void> {
  const token = localStorage.getItem('cozam_token');
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api/supply-orders/${orderId}/xlsx`, { headers });
  if (!res.ok) throw new Error('Erro ao gerar a planilha XLSX oficial da Ordem de Fornecimento.');

  const serverFilename = extractFilenameFromHeader(res.headers.get('Content-Disposition'));
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download =
    serverFilename || buildSupplyOrderFilename(ofNumber || orderId, supplierName, totalValue, 'xlsx');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
