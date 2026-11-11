import * as pdfParseModule from 'pdf-parse';

export interface ExtractedContractItem {
  item_code?: string;
  item_group?: string;
  description: string;
  category?: string;
  unit: string;
  original_quantity: number;
  unit_price: number;
  total_price: number;
  has_divergence: boolean;
  divergence_message?: string;
}

export interface ExtractedContractData {
  contract_number?: string;
  year?: number;
  supplier_cnpj?: string;
  supplier_name?: string;
  object?: string;
  legal_framework?: string;
  signing_date?: string;
  start_date?: string;
  end_date?: string;
  delivery_deadline_days?: number;
  total_amount?: number;
  items: ExtractedContractItem[];
  raw_text?: string;
  alerts: string[];
}

export function cleanCnpj(val: string): string {
  return val.replace(/\D/g, '');
}

export function formatCnpj(val: string): string {
  const digits = cleanCnpj(val);
  if (digits.length !== 14) return val;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function parsePtBrNumber(str: string): number {
  if (!str) return 0;
  // Handle 1.234,56 or 1234.56
  const clean = str.replace(/\s+/g, '').replace(/R\$/g, '');
  if (clean.includes(',') && clean.includes('.')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  }
  if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.'));
  }
  return parseFloat(clean);
}

function parsePtBrDate(str: string): string | undefined {
  // Matches dd/mm/yyyy
  const m = str.match(/(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
  if (m) {
    const dia = m[1].padStart(2, '0');
    const mes = m[2].padStart(2, '0');
    const ano = m[3];
    return `${ano}-${mes}-${dia}`;
  }
  return undefined;
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const mod: any = pdfParseModule;
  if (mod.PDFParse) {
    const parser = new mod.PDFParse({ data: buffer });
    await parser.load();
    const res = await parser.getText();
    if (typeof parser.destroy === 'function') {
      try { await parser.destroy(); } catch {}
    }
    return typeof res === 'string' ? res : (res?.text || '');
  }
  const parseFn = typeof mod === 'function' ? mod : mod.default;
  if (typeof parseFn === 'function') {
    const res = await parseFn(buffer);
    return res.text || '';
  }
  return '';
}

/**
 * Parses a contract PDF buffer and extracts metadata and contract items.
 * Validates math: quantity * unit_price == total_price.
 */
export async function parseContractPdf(buffer: Buffer): Promise<ExtractedContractData> {
  const text: string = await extractTextFromPdf(buffer);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const result: ExtractedContractData = {
    alerts: [],
    items: [],
    raw_text: text.slice(0, 3000), // First 3000 chars for preview
  };

  // 1. Contract number and Year (e.g., Contrato nº 012/2026, Contrato Administrativo nº 45/2026)
  const numMatch = text.match(/contrato(?:\s+administrativo)?(?:\s+n[ºo°\.])?\s*([0-9]{1,6})\s*[\/_-]\s*([0-9]{4})/i);
  if (numMatch) {
    result.contract_number = numMatch[1].padStart(3, '0');
    result.year = parseInt(numMatch[2], 10);
  }

  // 2. CNPJ
  const cnpjMatch = text.match(/(?:cnpj|inscrita no cnpj|sob o nº)\s*(?:sob o nº)?\s*([0-9]{2}[\.\s]?[0-9]{3}[\.\s]?[0-9]{3}[\/\s]?[0-9]{4}[-\s]?[0-9]{2})/i);
  if (cnpjMatch) {
    result.supplier_cnpj = formatCnpj(cnpjMatch[1]);
  }

  // 3. Objeto
  const objMatch = text.match(/(?:do\s+objeto|cl[áa]usula\s+primeira[\s\-–—:]*objeto|objeto\s*:)([\s\S]*?)(?:cl[áa]usula|2\.|valor|preço|vigência|$)/i);
  if (objMatch) {
    const rawObj = objMatch[1].replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (rawObj.length > 5) {
      result.object = rawObj.slice(0, 500);
    }
  }

  // 4. Fundamentação Legal
  const legalMatch = text.match(/(lei(?:\s+federal)?\s+(?:n[ºo°\.]\s*)?(?:14\.133\/2021|8\.666\/93|10\.520\/2002)[^;\.\n]*)/i);
  if (legalMatch) {
    result.legal_framework = legalMatch[1].trim();
  }

  // 5. Total Amount
  const totalMatch = text.match(/(?:valor\s+total|valor\s+global|montante|dá-se\s+ao\s+presente\s+contrato\s+o\s+valor(?:\s+total)?)\s*(?:de)?\s*(?:R\$\s*)?([0-9\.,]+)/i);
  if (totalMatch) {
    const val = parsePtBrNumber(totalMatch[1]);
    if (!isNaN(val) && val > 0) {
      result.total_amount = val;
    }
  }

  // 6. Dates & Vigência
  const datesFound: string[] = [];
  const dateRegex = /\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4})\b/g;
  let dMatch;
  while ((dMatch = dateRegex.exec(text)) !== null) {
    const iso = parsePtBrDate(dMatch[1]);
    if (iso && !datesFound.includes(iso)) {
      datesFound.push(iso);
    }
  }

  if (datesFound.length > 0) {
    result.signing_date = datesFound[0];
    result.start_date = datesFound[0];
    if (datesFound.length > 1) {
      result.end_date = datesFound[datesFound.length - 1];
    }
  }

  // 7. Tabular item pattern detection
  // Typical line formats:
  // "1 | Café em pó tradicional 250g | Unidade | 100 | 20,00 | 2.000,00"
  // "01 Café tradicional PCT 100 20,00 2.000,00"
  const itemLinePattern = /(?:^|\n)\s*([0-9]{1,4}(?:-[0-9]{1,4})?)\s*[\t\|;]\s*([^\|\t;]+?)\s*[\t\|;]\s*([a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ\.\s]{2,15}?)\s*[\t\|;]\s*([0-9\.,]+)\s*[\t\|;]\s*(?:R\$\s*)?([0-9\.,]+)\s*[\t\|;]\s*(?:R\$\s*)?([0-9\.,]+)/g;

  let itMatch;
  while ((itMatch = itemLinePattern.exec(text)) !== null) {
    const itemCode = itMatch[1].trim();
    const desc = itMatch[2].trim();
    const unit = itMatch[3].trim();
    const qty = parsePtBrNumber(itMatch[4]);
    const unitPrice = parsePtBrNumber(itMatch[5]);
    const totalPrice = parsePtBrNumber(itMatch[6]);

    if (!isNaN(qty) && !isNaN(unitPrice) && !isNaN(totalPrice) && qty > 0) {
      const calculated = Math.round(qty * unitPrice * 100) / 100;
      const diff = Math.abs(calculated - totalPrice);
      const hasDivergence = diff > 0.05; // tolerância para pequenos arredondamentos

      result.items.push({
        item_code: itemCode,
        description: desc,
        unit: unit || 'UN',
        original_quantity: qty,
        unit_price: unitPrice,
        total_price: totalPrice,
        has_divergence: hasDivergence,
        divergence_message: hasDivergence
          ? `Cálculo divergente: ${qty} x R$ ${unitPrice.toFixed(2)} = R$ ${calculated.toFixed(2)}, mas o documento indicou R$ ${totalPrice.toFixed(2)}`
          : undefined,
      });
    }
  }

  // If no items matched tabular pipe/tab delimiter, check whitespace-separated lines
  if (result.items.length === 0) {
    for (const line of lines) {
      // e.g. "1   Fita isolante 19mmx10m   Unidade   25   27,84   696,00"
      const matchWs = line.match(/^([0-9]{1,4}(?:-[0-9]{1,4})?)\s{2,}(.+?)\s{2,}([A-Za-zÀ-ÿ]{2,10})\s{2,}([0-9\.,]+)\s{2,}(?:R\$\s*)?([0-9\.,]+)\s{2,}(?:R\$\s*)?([0-9\.,]+)$/);
      if (matchWs) {
        const qty = parsePtBrNumber(matchWs[4]);
        const unitPrice = parsePtBrNumber(matchWs[5]);
        const totalPrice = parsePtBrNumber(matchWs[6]);

        if (!isNaN(qty) && !isNaN(unitPrice) && !isNaN(totalPrice) && qty > 0) {
          const calculated = Math.round(qty * unitPrice * 100) / 100;
          const diff = Math.abs(calculated - totalPrice);
          const hasDivergence = diff > 0.05;

          result.items.push({
            item_code: matchWs[1].trim(),
            description: matchWs[2].trim(),
            unit: matchWs[3].trim(),
            original_quantity: qty,
            unit_price: unitPrice,
            total_price: totalPrice,
            has_divergence: hasDivergence,
            divergence_message: hasDivergence
              ? `Cálculo divergente: ${qty} x R$ ${unitPrice.toFixed(2)} = R$ ${calculated.toFixed(2)}, mas no documento constou R$ ${totalPrice.toFixed(2)}`
              : undefined,
          });
        }
      }
    }
  }

  // Calculation validation: total items sum vs total contract amount
  if (result.items.length > 0) {
    const sumItems = result.items.reduce((acc, it) => acc + it.total_price, 0);
    if (!result.total_amount) {
      result.total_amount = Math.round(sumItems * 100) / 100;
    } else {
      const diffTot = Math.abs(result.total_amount - sumItems);
      if (diffTot > 0.05) {
        result.alerts.push(
          `Divergência de total: a soma dos itens extraídos (R$ ${sumItems.toFixed(2)}) difere do valor total global do contrato (R$ ${result.total_amount.toFixed(2)}).`
        );
      }
    }
  }

  if (result.items.some((it) => it.has_divergence)) {
    result.alerts.push(
      'Atenção: um ou mais itens apresentam divergência matemática entre (Quantidade x Valor Unitário) e o Valor Total extraído do PDF.'
    );
  }

  return result;
}
