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
  if (!str) return undefined;
  // Matches dd/mm/yyyy isolado, evitando fragmentos de dotações orçamentárias (ex: 3.3.3.9.0.30.99.99.00.0000)
  const m = str.match(/(?<![\d\.])(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})(?![\d\.])/);
  if (m) {
    const dia = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10);
    const ano = parseInt(m[3], 10);

    if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 2000 || ano > 2100) {
      return undefined;
    }

    const d = new Date(Date.UTC(ano, mes - 1, dia));
    if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
      return undefined;
    }

    const diaStr = String(dia).padStart(2, '0');
    const mesStr = String(mes).padStart(2, '0');
    return `${ano}-${mesStr}-${diaStr}`;
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
 * Extrai itens estruturados de planilhas de contratos públicos e dispensas/pregões.
 * Suporta quebras de página, descrições extensas em múltiplas linhas, colunas de marca
 * (ignorando a marca e mantendo somente descrição limpa, código, unidade, quantidade, vlr unitário e total).
 */
function extractTableItemsFromPdf(text: string): ExtractedContractItem[] {
  const planIdx = text.search(/(?:PLANILHA\s+(?:DOS|DE)\s+ITENS|RELA[ÇC][ÃA]O\s+D(?:OS|E)\s+ITENS|TABELA\s+D(?:OS|E)\s+ITENS|ITEM\s+[\t\|;\s]+(?:ESPECIFICA[ÇC][ÃA]O|DESCRI[ÇC][ÃA]O))/i);
  if (planIdx === -1) return [];

  const sub = text.slice(planIdx);
  const endMatch = sub.search(/\n\s*(?:1\.3\.|2\.\s+CL[ÁA]USULA|CL[ÁA]USULA\s+(?:SEGUNDA|TERCEIRA|QUARTA|QUINTA)|DO\s+PAGAMENTO)/i);
  const tableText = endMatch !== -1 ? sub.slice(0, endMatch) : sub;

  const rawLines = tableText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const cleanLines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (/^PLANILHA\s+(?:DOS|DE)\s+ITENS/i.test(line)) continue;
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) continue;
    if (/^CONSÓRCIO\s+INTERMUNICIPAL/i.test(line)) continue;
    if (/^Av\.\s+Desembargador/i.test(line)) continue;
    if (/^Fone:\s*\d+/i.test(line)) continue;
    if (/^ITEM\s+(?:ESPECIFICAÇÃO|DESCRIÇÃO)/i.test(line)) continue;

    const prev = rawLines[i - 1] || '';
    const next = rawLines[i + 1] || '';
    if (/^\d{1,3}$/.test(line)) {
      if (/--\s*\d+\s+of\s+\d+\s*--/.test(prev) || /CONSÓRCIO/i.test(next) || /cozamcpl@/i.test(prev)) {
        continue;
      }
    }

    cleanLines.push(line);
  }

  const knownUnits = [
    'Pacote', 'Unidade', 'UN', 'UND', 'Pct', 'Peça', 'Pç', 'CX', 'Caixa',
    'KG', 'Quilo', 'L', 'Litro', 'Metro', 'M', 'Par', 'Rolo', 'Galão',
    'Galao', 'Frasco', 'Kit', 'Fardo', 'Resma'
  ];

  interface RawItem {
    item_code: string;
    descParts: string[];
    unit: string;
    original_quantity: number;
    unit_price: number;
    total_price: number;
  }

  const items: RawItem[] = [];
  let current: RawItem | null = null;

  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];

    const isStartMatch = line.match(/^([0-9]{1,3}(?:-[0-9]{1,3})?)\b(?:\s+(.*))?$/);

    if (isStartMatch && (/^[0-9]{1,3}$/.test(line) || !current || (current && current.total_price > 0))) {
      current = {
        item_code: isStartMatch[1].padStart(2, '0'),
        descParts: [],
        unit: 'UN',
        original_quantity: 0,
        unit_price: 0,
        total_price: 0,
      };
      if (isStartMatch[2]) {
        current.descParts.push(isStartMatch[2].trim());
      }
      items.push(current);
      continue;
    }

    if (line.includes('\t') || /\bR\$\s*[0-9\.,]+/.test(line)) {
      const parts = line.includes('\t')
        ? line.split('\t').map((s) => s.trim()).filter(Boolean)
        : line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);

      if (parts.length >= 3) {
        const lastPart = parts[parts.length - 1];
        const secondToLast = parts[parts.length - 2];
        const thirdToLast = parts[parts.length - 3];

        const totalVal = parsePtBrNumber(lastPart);
        const unitPriceVal = parsePtBrNumber(secondToLast);
        const qtyVal = parsePtBrNumber(thirdToLast);

        if (!isNaN(totalVal) && !isNaN(unitPriceVal) && totalVal > 0 && unitPriceVal > 0) {
          if (current) {
            current.original_quantity = !isNaN(qtyVal) && qtyVal > 0 ? qtyVal : 1;
            current.unit_price = unitPriceVal;
            current.total_price = totalVal;

            const preValParts = parts.slice(0, parts.length - 3);
            let extractedUnit = 'UN';
            let descPrefix = '';

            if (preValParts.length === 1) {
              const p = preValParts[0];
              const unitFound = knownUnits.find((u) => new RegExp(`\\b${u}\\b`, 'i').test(p));
              if (unitFound) {
                extractedUnit = unitFound;
                descPrefix = p.replace(new RegExp(`\\b${unitFound}\\b`, 'i'), '').trim();
              }
            } else if (preValParts.length >= 2) {
              const possibleUnit = preValParts[preValParts.length - 1];
              const unitFound = knownUnits.find((u) => new RegExp(`^${u}$`, 'i').test(possibleUnit));
              if (unitFound) {
                extractedUnit = unitFound;
              } else {
                extractedUnit = possibleUnit;
              }
              descPrefix = preValParts.slice(0, preValParts.length - 1).join(' ');
            }

            current.unit = extractedUnit;

            if (descPrefix) {
              const words = descPrefix.split(/\s+/);
              if (words.length <= 2 && words.every((w) => /^[A-ZÁÀÂÃÉÈÍÓÔÕÚÇ0-9]{2,}$/.test(w))) {
                // marca isolada: ignora conforme solicitado
              } else {
                if (words.length > 1 && /^[A-ZÁÀÂÃÉÈÍÓÔÕÚÇ0-9]{2,}$/.test(words[words.length - 1])) {
                  words.pop();
                }
                const cleanP = words.join(' ').trim();
                if (cleanP) current.descParts.push(cleanP);
              }
            }
          }
          continue;
        }
      }
    }

    if (current) {
      const nextLine = cleanLines[i + 1] || '';
      if ((nextLine.includes('\t') || /\bR\$\s*[0-9\.,]+/.test(nextLine)) && /^[A-ZÁÀÂÃÉÈÍÓÔÕÚÇ0-9]{2,}$/.test(line)) {
        continue; // ignora marca em linha isolada
      }
      current.descParts.push(line);
    }
  }

  const validItems: RawItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.total_price > 0 && it.original_quantity > 0) {
      validItems.push(it);
    } else if (validItems.length > 0) {
      const prev = validItems[validItems.length - 1];
      const mergedText = `${it.item_code} ${it.descParts.join(' ')}`.trim();
      prev.descParts.push(mergedText);
    }
  }

  return validItems.map((it) => {
    let fullDesc = it.descParts.join(' ').replace(/\s+/g, ' ').trim();
    fullDesc = fullDesc.replace(/^[–\-—]\s*/, '').trim();

    const calculated = Math.round(it.original_quantity * it.unit_price * 100) / 100;
    const diff = Math.abs(calculated - it.total_price);
    const hasDivergence = diff > 0.05;

    return {
      item_code: it.item_code,
      description: fullDesc,
      category: 'MATERIAL_CONSUMO',
      unit: it.unit || 'UN',
      original_quantity: it.original_quantity,
      unit_price: it.unit_price,
      total_price: it.total_price,
      has_divergence: hasDivergence,
      divergence_message: hasDivergence
        ? `Cálculo divergente: ${it.original_quantity} x R$ ${it.unit_price.toFixed(2)} = R$ ${calculated.toFixed(2)}, mas no documento constou R$ ${it.total_price.toFixed(2)}`
        : undefined,
    };
  });
}

/**
 * Parses a contract PDF buffer and extracts metadata and contract items.
 * Validates math: quantity * unit_price == total_price.
 */
export async function parseContractPdf(buffer: Buffer): Promise<ExtractedContractData> {
  let text = '';
  try {
    text = await extractTextFromPdf(buffer);
  } catch (err: any) {
    console.warn('[PDF Parser] Falha ao extrair texto do PDF:', err?.message);
    return {
      alerts: [
        'Atenção: Não foi possível extrair o texto deste PDF automaticamente (o arquivo pode estar protegido, digitalizado como imagem ou em formato não padrão). Preencha os campos de conferência manualmente.',
      ],
      items: [],
      raw_text: '',
    };
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const result: ExtractedContractData = {
    alerts: [],
    items: [],
    raw_text: text.slice(0, 3000), // First 3000 chars for preview
  };

  if (!text || text.trim().length === 0) {
    result.alerts.push(
      'Aviso: O arquivo PDF não contém texto pesquisável (possivelmente foi digitalizado como foto/imagem). Você pode preencher os dados e itens manualmente abaixo.'
    );
  }

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
  const totalMatch = text.match(/(?:valor\s+total(?:\s+da\s+contrata[çc][ãa]o)?|valor\s+global|montante|dá-se\s+ao\s+presente\s+contrato\s+o\s+valor(?:\s+total)?)\s*(?:ser[áa])?\s*(?:de)?\s*(?:R\$\s*)?([0-9\.,]+)/i);
  if (totalMatch) {
    const val = parsePtBrNumber(totalMatch[1]);
    if (!isNaN(val) && val > 0) {
      result.total_amount = val;
    }
  }

  // 6. Dates & Vigência
  const datesFound: string[] = [];
  const dateRegex = /(?<![\d\.])(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4})(?![\d\.])/g;
  let dMatch;
  while ((dMatch = dateRegex.exec(text)) !== null) {
    const prefix = text.slice(Math.max(0, dMatch.index - 30), dMatch.index);
    if (/lei|decreto|portaria|resolu[çc][ãa]o/i.test(prefix)) continue;

    const iso = parsePtBrDate(dMatch[1]);
    if (iso && !datesFound.includes(iso)) {
      datesFound.push(iso);
    }
  }

  const ptMonths: Record<string, string> = {
    janeiro: '01', fevereiro: '02', 'março': '03', marco: '03', abril: '04',
    maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09',
    outubro: '10', novembro: '11', dezembro: '12',
  };

  // 6.1. Busca explícita na linha de encerramento / assinatura (ex: "Maceió/AL, ______ de novembro de 2026")
  const signMatch = text.match(/(?:[a-zA-ZÀ-ÿ\s]+(?:\/[A-Z]{2})?)\s*,\s*(\d{1,2}|1º|_+)\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i);
  if (signMatch) {
    const rawDay = signMatch[1].replace('º', '').replace(/_+/g, '').trim();
    const dia = rawDay ? parseInt(rawDay, 10) : 1;
    const mStr = signMatch[2].toLowerCase();
    const mes = ptMonths[mStr];
    const ano = parseInt(signMatch[3], 10);
    if (mes && dia >= 1 && dia <= 31 && ano >= 2000 && ano <= 2100) {
      const iso = `${ano}-${mes}-${String(dia).padStart(2, '0')}`;
      if (!datesFound.includes(iso)) {
        datesFound.unshift(iso); // Prioridade máxima para data de celebração do contrato
      }
    }
  }

  // 6.2. Busca datas textuais no corpo do contrato (exceto citações legais)
  const ptDateRegex = /(?:em\s+|de\s+)?(\d{1,2}|1º)\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/gi;
  let ptm;
  while ((ptm = ptDateRegex.exec(text)) !== null) {
    const prefix = text.slice(Math.max(0, ptm.index - 40), ptm.index);
    if (/lei|decreto|portaria|resolu[çc][ãa]o/i.test(prefix)) continue;

    const rawDay = ptm[1].replace('º', '');
    const dia = parseInt(rawDay, 10);
    const mStr = ptm[2].toLowerCase();
    const mes = ptMonths[mStr];
    const ano = parseInt(ptm[3], 10);
    if (mes && dia >= 1 && dia <= 31 && ano >= 2000 && ano <= 2100) {
      const iso = `${ano}-${mes}-${String(dia).padStart(2, '0')}`;
      if (!datesFound.includes(iso)) {
        datesFound.push(iso);
      }
    }
  }

  // 6.3. Detecção da duração da vigência em meses (ex: "prazo de vigência da contratação é de 12 (doze) meses")
  let vigenciaMonths = 12;
  const vigMatch = text.match(/vig[êe]ncia[\s\S]{1,100}?(\d{1,3})\s*(?:\([a-zA-Z\s]+\))?\s*meses/i);
  if (vigMatch) {
    const parsedMonths = parseInt(vigMatch[1], 10);
    if (parsedMonths > 0 && parsedMonths <= 120) {
      vigenciaMonths = parsedMonths;
    }
  }

  if (datesFound.length > 0) {
    result.signing_date = datesFound[0];
    result.start_date = datesFound[0];

    // Calcula end_date somando a vigência em meses a partir de start_date
    const [sY, sM, sD] = result.start_date.split('-').map(Number);
    const startObj = new Date(Date.UTC(sY, sM - 1, sD));
    startObj.setUTCMonth(startObj.getUTCMonth() + vigenciaMonths);
    const eY = startObj.getUTCFullYear();
    const eM = String(startObj.getUTCMonth() + 1).padStart(2, '0');
    const eD = String(startObj.getUTCDate()).padStart(2, '0');
    result.end_date = `${eY}-${eM}-${eD}`;
  }

  // 7. Extração estruturada de itens em tabelas de licitações e contratos públicos
  // Detecta planilhas multi-linhas, com colunas de especificações longas, marca ignorada e quebras de página
  const tableExtractedItems = extractTableItemsFromPdf(text);
  if (tableExtractedItems.length > 0) {
    result.items = tableExtractedItems;
  }

  // 8. Fallback: Tabular item pattern detection (formato pipe/tab em linha única)
  if (result.items.length === 0) {
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
        const hasDivergence = diff > 0.05;

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
  }

  // 9. Fallback: Verificação linha a linha separada por espaços múltiplos
  if (result.items.length === 0) {
    for (const line of lines) {
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
