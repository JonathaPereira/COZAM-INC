import ExcelJS from 'exceljs';
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import { getCozamLogoBuffer, getJonathaSignatureBuffer } from '../assets/branding.js';

export interface SupplyOrderItemDoc {
  item_number?: string | number;
  description: string;
  unit_of_measure: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface SupplyOrderDocData {
  order_number: string;
  tracking_code: string;
  created_at: string | Date;
  status: string;
  // Destination
  destination_name?: string;
  destination_entity?: string;
  destination_city?: string;
  delivery_address?: string;
  // Contract info
  contract_number?: string;
  contract_year?: number;
  contract_object?: string;
  legal_framework?: string;
  celebration_date?: string;
  validity_date?: string;
  delivery_deadline_days?: number;
  // Bidding process info
  process_number?: string;
  process_modality?: string;
  bidding_number?: string;
  // Supplier info
  supplier_name: string;
  supplier_trade_name?: string;
  supplier_cnpj: string;
  supplier_address?: string;
  supplier_phone?: string;
  supplier_email?: string;
  // Responsible
  issuer_name?: string;
  issuer_role?: string;
  // Signature
  is_signed?: boolean;
  signed_at?: string | Date;
  // Items
  items: SupplyOrderItemDoc[];
  total_amount: number;
}

const DEFAULT_COZAM_DELIVERY_ADDRESS =
  'Av. Gustavo Paiva, 3692, Empresarial Centernorte, Mangabeiras, 5º andar, Maceió/AL';

export function formatDateExtenso(dateInput: string | Date): string {
  const d = new Date(dateInput);
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = meses[d.getMonth()] || 'janeiro';
  const ano = d.getFullYear();
  return `${dia} de ${mes} de ${ano}`;
}

export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function resolveDeliveryAddress(data: SupplyOrderDocData): string {
  if (data.delivery_address && data.delivery_address.trim().length > 0) {
    return data.delivery_address.trim();
  }
  const dest = (data.destination_name || '').toUpperCase();
  if (!dest || dest.includes('COZAM') || dest.includes('SEDE')) {
    return DEFAULT_COZAM_DELIVERY_ADDRESS;
  }
  const city = data.destination_city || data.destination_name;
  return `Sede do Município Consorciado de ${city}/AL - Em atenção à Ordem de Fornecimento nº ${data.order_number}`;
}

function resolveDestinationLabel(data: SupplyOrderDocData): string {
  const dest = (data.destination_name || '').trim();
  if (!dest || dest.toUpperCase().includes('COZAM')) {
    return 'DESTINADOS AO COZAM ';
  }
  return `DESTINADOS AO MUNICÍPIO DE ${dest.toUpperCase()}`;
}

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } }
};

function applyBoxBorders(ws: ExcelJS.Worksheet, startRow: number, startCol: number, endRow: number, endCol: number) {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r);
    for (let c = startCol; c <= endCol; c++) {
      const cell = row.getCell(c);
      cell.border = thinBorder;
    }
  }
}

/**
 * Generates an Excel workbook strictly matching MODELO_SUL_GÁS_SISTEMA.xlsx
 */
export async function generateSupplyOrderWorkbook(data: SupplyOrderDocData): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'COZAM — Consórcio Intermunicipal da Zona da Mata Alagoana';
  wb.created = new Date();

  const safeSheetName = (data.supplier_trade_name || data.supplier_name || 'ORDEM DE FORNECIMENTO')
    .slice(0, 31)
    .replace(/[\\/?*:[\]]/g, '');
  const ws = wb.addWorksheet(safeSheetName);

  // Column widths matching the official template exactly
  ws.columns = [
    { width: 16.14 }, // A: ITEM / Labels / Entrega
    { width: 40.57 }, // B: DESCRIÇÃO / Valores
    { width: 12.71 }, // C: UND / Fornecedor
    { width: 9.29 },  // D: QUANT
    { width: 16.57 }, // E: VALOR UNITÁRIO
    { width: 16.29 }  // F: VALOR TOTAL / OF Nº
  ];

  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.7,
      right: 0.7,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3
    }
  };

  // Row 1: Logo Row (Height 87.0)
  ws.mergeCells('A1:F1');
  ws.getRow(1).height = 87.0;
  applyBoxBorders(ws, 1, 1, 1, 6);

  // Embed Logo image centered
  const logoBuffer = getCozamLogoBuffer();
  const logoImageId = wb.addImage({
    buffer: logoBuffer as any,
    extension: 'png',
  });
  // Ancorado sobre a linha 1 (cerca de col 2.3 = meio de B e C)
  ws.addImage(logoImageId, {
    tl: { col: 2.2, row: 0.12 },
    ext: { width: 104, height: 98 }
  });

  // Row 2: ORDEM DE FORNECIMENTO
  ws.mergeCells('A2:F2');
  const r2 = ws.getCell('A2');
  r2.value = 'ORDEM DE FORNECIMENTO';
  r2.font = { name: 'Calibri', size: 14, bold: true };
  r2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 18.0;
  applyBoxBorders(ws, 2, 1, 2, 6);

  // Row 3: CONTRATO Nº 012/2026
  ws.mergeCells('A3:F3');
  const r3 = ws.getCell('A3');
  const contractTitle = data.contract_number
    ? `CONTRATO Nº ${data.contract_number}${data.contract_year ? `/${data.contract_year}` : ''}`
    : (data.bidding_number ? `PROCESSO Nº ${data.bidding_number}` : 'ORDEM DE FORNECIMENTO');
  r3.value = contractTitle.toUpperCase();
  r3.font = { name: 'Calibri', size: 11, bold: true };
  r3.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(3).height = 20.0;
  applyBoxBorders(ws, 3, 1, 3, 6);

  // Row 4: Objeto:
  const r4 = ws.getRow(4);
  r4.getCell(1).value = 'Objeto:';
  r4.getCell(1).font = { name: 'Calibri', size: 10, bold: true };
  r4.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('B4:F4');
  const r4Val = ws.getCell('B4');
  r4Val.value = data.contract_object || 'CONTRATAÇÃO DE FORNECIMENTO CONFORME EDITAL E CONTRATO AO COZAM.';
  r4Val.font = { name: 'Calibri', size: 10 };
  r4Val.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  const objLen = (r4Val.value as string).length;
  r4.height = Math.max(50.0, Math.min(100.0, Math.ceil(objLen / 70) * 18));
  applyBoxBorders(ws, 4, 1, 4, 6);

  // Row 5: Fundamentação Legal:
  const r5 = ws.getRow(5);
  r5.getCell(1).value = 'Fundamentação Legal:';
  r5.getCell(1).font = { name: 'Calibri', size: 10, bold: true };
  r5.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('B5:F5');
  const r5Val = ws.getCell('B5');
  r5Val.value = data.legal_framework || 'Lei 14.133/2021';
  r5Val.font = { name: 'Calibri', size: 10 };
  r5Val.alignment = { horizontal: 'left', vertical: 'middle' };
  r5.height = 25.5;
  applyBoxBorders(ws, 5, 1, 5, 6);

  // Row 6: Órgão Gerenciador:
  const r6 = ws.getRow(6);
  r6.getCell(1).value = 'Órgão Gerenciador:';
  r6.getCell(1).font = { name: 'Calibri', size: 10, bold: true };
  r6.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('B6:F6');
  const r6Val = ws.getCell('B6');
  r6Val.value = 'CONSÓRCIO INTERMUNICIPAL DA ZONA DA MATA ALAGOANA E SERVIÇOS PÚBLICOS CNPJ Nº 19.140.014/0001-39';
  r6Val.font = { name: 'Calibri', size: 10, bold: true };
  r6Val.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  r6.height = 25.5;
  applyBoxBorders(ws, 6, 1, 6, 6);

  // Row 7: Fornecedor Registrado:
  const r7 = ws.getRow(7);
  r7.getCell(1).value = 'Fornecedor Registrado: ';
  r7.getCell(1).font = { name: 'Calibri', size: 10, bold: true };
  r7.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('B7:F7');
  const r7Val = ws.getCell('B7');
  const supplierContactParts = [
    data.supplier_address ? `com sede na ${data.supplier_address}` : '',
    data.supplier_phone ? `Telefone ${data.supplier_phone}` : '',
    data.supplier_email ? `Email : ${data.supplier_email}` : ''
  ].filter(Boolean).join(' :   ');
  r7Val.value = `${data.supplier_name},  inscrita no CNPJ sob o nº${data.supplier_cnpj}${supplierContactParts ? ', ' + supplierContactParts : ''}`;
  r7Val.font = { name: 'Calibri', size: 10 };
  r7Val.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  const supLen = (r7Val.value as string).length;
  r7.height = Math.max(49.5, Math.ceil(supLen / 75) * 16);
  applyBoxBorders(ws, 7, 1, 7, 6);

  // Row 8: Celebração & Prazo de Vigência (decisão do usuário 1)
  ws.mergeCells('A8:B8');
  const r8a = ws.getCell('A8');
  r8a.value = `Celebração: ${data.celebration_date || 'Não informada'}`;
  r8a.font = { name: 'Calibri', size: 10, bold: true };
  r8a.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  ws.mergeCells('C8:F8');
  const r8b = ws.getCell('C8');
  r8b.value = `Prazo de Vigência: ${data.validity_date || 'Não informada'}`;
  r8b.font = { name: 'Calibri', size: 10, bold: true };
  r8b.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(8).height = 20.0;
  applyBoxBorders(ws, 8, 1, 8, 6);

  // Row 9: Cláusula de Autorização
  ws.mergeCells('A9:F9');
  const r9 = ws.getCell('A9');
  r9.value = `AUTORIZO a empresa ${data.supplier_name}  a partir da presente data, proceder o fornecimento OU serviço dos itens relacionados e na forma abaixo, em atenção ao edital.`;
  r9.font = { name: 'Calibri', size: 10, bold: true };
  r9.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  ws.getRow(9).height = 30.0;
  applyBoxBorders(ws, 9, 1, 9, 6);

  // Row 10: DESTINADOS AO COZAM / MUNICÍPIO | Nº DA OF
  ws.mergeCells('A10:E10');
  const r10a = ws.getCell('A10');
  r10a.value = resolveDestinationLabel(data);
  r10a.font = { name: 'Calibri', size: 10, bold: true };
  r10a.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  const r10b = ws.getCell('F10');
  r10b.value = data.order_number;
  r10b.font = { name: 'Calibri', size: 11, bold: true };
  r10b.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(10).height = 22.0;
  applyBoxBorders(ws, 10, 1, 10, 6);

  // Row 11: Cabeçalho da Tabela
  const r11 = ws.getRow(11);
  const headers = ['ITEM', 'DESCRIÇÃO', 'UND', 'QUANT', 'VALOR UNITÁRIO', 'VALOR TOTAL'];
  headers.forEach((h, idx) => {
    const c = r11.getCell(idx + 1);
    c.value = h;
    c.font = { name: 'Calibri', size: 10, bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  r11.height = 24.0;
  applyBoxBorders(ws, 11, 1, 11, 6);

  // Rows 12+: Itens
  let curRow = 12;
  const startItemRow = curRow;
  data.items.forEach((item, idx) => {
    const row = ws.getRow(curRow);
    const itemNum = item.item_number ?? `${idx + 1}`;
    
    // Col 1: ITEM
    row.getCell(1).value = isNaN(Number(itemNum)) ? itemNum : Number(itemNum);
    row.getCell(1).font = { name: 'Calibri', size: 10 };
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Col 2: DESCRIÇÃO
    row.getCell(2).value = item.description;
    row.getCell(2).font = { name: 'Calibri', size: 10 };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    // Col 3: UND
    row.getCell(3).value = item.unit_of_measure;
    row.getCell(3).font = { name: 'Calibri', size: 10 };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

    // Col 4: QUANT
    row.getCell(4).value = Number(item.quantity);
    row.getCell(4).font = { name: 'Calibri', size: 10 };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).numFmt = '#,##0.##';

    // Col 5: VALOR UNITÁRIO
    row.getCell(5).value = Number(item.unit_price);
    row.getCell(5).font = { name: 'Calibri', size: 10, bold: true };
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).numFmt = '#,##0.00';

    // Col 6: VALOR TOTAL com fórmula =D{curRow}*E{curRow}
    row.getCell(6).value = {
      formula: `D${curRow}*E${curRow}`,
      result: Number(item.total_price)
    };
    row.getCell(6).font = { name: 'Calibri', size: 8, bold: true };
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(6).numFmt = '#,##0.00';

    const descLines = item.description.split('\n').length;
    const descLenEst = Math.ceil(item.description.length / 42);
    row.height = Math.max(35.0, Math.max(descLines, descLenEst) * 16.5);

    applyBoxBorders(ws, curRow, 1, curRow, 6);
    curRow++;
  });
  const endItemRow = curRow - 1;

  // Linha de TOTAL GERAL
  ws.mergeCells(`A${curRow}:E${curRow}`);
  const rTotF = ws.getCell(`F${curRow}`);
  rTotF.value = {
    formula: `SUM(F${startItemRow}:F${endItemRow})`,
    result: Number(data.total_amount)
  };
  rTotF.font = { name: 'Calibri', size: 8, bold: true };
  rTotF.alignment = { horizontal: 'center', vertical: 'middle' };
  rTotF.numFmt = '#,##0.00';
  ws.getRow(curRow).height = 22.0;
  applyBoxBorders(ws, curRow, 1, curRow, 6);
  curRow++;

  // Linha de Data
  ws.mergeCells(`A${curRow}:F${curRow}`);
  const rDate = ws.getCell(`A${curRow}`);
  rDate.value = `Maceió/AL, ${formatDateExtenso(data.created_at)}.`;
  rDate.font = { name: 'Calibri', size: 11, bold: true };
  rDate.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(curRow).height = 27.75;
  applyBoxBorders(ws, curRow, 1, curRow, 6);
  curRow++;

  // Espaço de Assinatura (3 linhas mescladas: A..F)
  const sigStartRow = curRow;
  const sigEndRow = curRow + 2;
  ws.mergeCells(`A${sigStartRow}:F${sigEndRow}`);
  ws.getRow(sigStartRow).height = 27.75;
  ws.getRow(sigStartRow + 1).height = 27.75;
  ws.getRow(sigStartRow + 2).height = 27.75;
  applyBoxBorders(ws, sigStartRow, 1, sigEndRow, 6);

  // Se confirmado/assinado, insere a assinatura do Jonatha no espaço apropriado
  if (data.is_signed) {
    const sigBuffer = getJonathaSignatureBuffer();
    const sigImageId = wb.addImage({
      buffer: sigBuffer as any,
      extension: 'png',
    });
    // Ancorado no meio do bloco A..F nas linhas de assinatura
    ws.addImage(sigImageId, {
      tl: { col: 2.1, row: sigStartRow - 1 + 0.15 },
      ext: { width: 175, height: 72 }
    });
  }
  curRow = sigEndRow + 1;

  // Nome do Supervisor
  ws.mergeCells(`A${curRow}:F${curRow}`);
  const rName = ws.getCell(`A${curRow}`);
  rName.value = 'JONATHA PEREIRA DE JESUS';
  rName.font = { name: 'Calibri', size: 11, bold: true };
  rName.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(curRow).height = 18.0;
  applyBoxBorders(ws, curRow, 1, curRow, 6);
  curRow++;

  // Cargo do Supervisor
  ws.mergeCells(`A${curRow}:F${curRow}`);
  const rRole = ws.getCell(`A${curRow}`);
  rRole.value = 'SUPERVISOR DE COMPRAS';
  rRole.font = { name: 'Calibri', size: 11, bold: true };
  rRole.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(curRow).height = 18.0;
  applyBoxBorders(ws, curRow, 1, curRow, 6);
  curRow++;

  // Bloco Inferior Bipartido (3 linhas):
  // Esquerda: A..B (3 linhas mescladas) -> ENDEREÇO PARA ENTREGA
  // Direita: C..F (linhas 1 e 2 mescladas) -> Fornecedor; linha 3 -> "FORNECEDOR"
  const btmStartRow = curRow;
  ws.getRow(btmStartRow).height = 22.0;
  ws.getRow(btmStartRow + 1).height = 15.0;
  ws.getRow(btmStartRow + 2).height = 22.0;

  ws.mergeCells(`A${btmStartRow}:B${btmStartRow + 2}`);
  const rEnd = ws.getCell(`A${btmStartRow}`);
  rEnd.value = `ENDEREÇO PARA ENTREGA : ${resolveDeliveryAddress(data)}`;
  rEnd.font = { name: 'Calibri', size: 11, bold: true };
  rEnd.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  applyBoxBorders(ws, btmStartRow, 1, btmStartRow + 2, 2);

  ws.mergeCells(`C${btmStartRow}:F${btmStartRow + 1}`);
  const rSupBtm = ws.getCell(`C${btmStartRow}`);
  rSupBtm.value = data.supplier_name;
  rSupBtm.font = { name: 'Calibri', size: 10.5, bold: true };
  rSupBtm.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  applyBoxBorders(ws, btmStartRow, 3, btmStartRow + 1, 6);

  ws.mergeCells(`C${btmStartRow + 2}:F${btmStartRow + 2}`);
  const rFornLabel = ws.getCell(`C${btmStartRow + 2}`);
  rFornLabel.value = 'FORNECEDOR';
  rFornLabel.font = { name: 'Calibri', size: 10, bold: true };
  rFornLabel.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorders(ws, btmStartRow + 2, 3, btmStartRow + 2, 6);

  return wb;
}

/**
 * Text wrapper utility for PDF vector drawing
 */
function wrapTextLines(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const paragraphs = text.split('\n');
  const resultLines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      resultLines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = '';

    for (const w of words) {
      const testLine = currentLine ? `${currentLine} ${w}` : w;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) resultLines.push(currentLine);
        currentLine = w;
      }
    }
    if (currentLine) resultLines.push(currentLine);
  }
  return resultLines;
}

/**
 * Generates an official vector PDF strictly matching MODELO_SUL_GÁS_SISTEMA.xlsx
 */
export async function generateSupplyOrderPdf(data: SupplyOrderDocData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Ordem de Fornecimento - ${data.order_number}`);
  pdfDoc.setAuthor('COZAM — Consórcio Intermunicipal da Zona da Mata Alagoana');
  pdfDoc.setSubject(`OF referente ao contrato ${data.contract_number || ''}`);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const logoBytes = getCozamLogoBuffer();
  const pdfLogo = await pdfDoc.embedPng(logoBytes);

  let pdfSig: any = null;
  if (data.is_signed) {
    const sigBytes = getJonathaSignatureBuffer();
    pdfSig = await pdfDoc.embedPng(sigBytes);
  }

  // A4 dimensions: 595.28 x 841.89 points
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 35;
  const contentWidth = pageWidth - marginX * 2; // 525.28 pt

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let curY = pageHeight - 35;

  const black = rgb(0, 0, 0);

  // Helper to draw a bordered rectangle
  const drawBox = (x: number, y: number, w: number, h: number) => {
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      borderColor: black,
      borderWidth: 0.5,
      color: rgb(1, 1, 1),
    });
  };

  // Helper to draw centered text inside a box
  const drawCenteredInBox = (
    text: string,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    font: PDFFont,
    fontSize: number
  ) => {
    const textW = font.widthOfTextAtSize(text, fontSize);
    const textX = boxX + (boxW - textW) / 2;
    const textY = boxY + (boxH - fontSize) / 2 + 1;
    page.drawText(text, {
      x: textX,
      y: textY,
      size: fontSize,
      font,
      color: black,
    });
  };

  // ==========================================
  // ROW 1: Logo Box (Height: 80 pt)
  // ==========================================
  const r1Height = 80;
  const r1Y = curY - r1Height;
  drawBox(marginX, r1Y, contentWidth, r1Height);

  // Draw COZAM Logo centered in Row 1
  const logoH = 68;
  const logoW = (pdfLogo.width / pdfLogo.height) * logoH;
  page.drawImage(pdfLogo, {
    x: marginX + (contentWidth - logoW) / 2,
    y: r1Y + (r1Height - logoH) / 2,
    width: logoW,
    height: logoH,
  });
  curY -= r1Height;

  // ==========================================
  // ROW 2: ORDEM DE FORNECIMENTO (Height: 18 pt)
  // ==========================================
  const r2Height = 18;
  curY -= r2Height;
  drawBox(marginX, curY, contentWidth, r2Height);
  drawCenteredInBox('ORDEM DE FORNECIMENTO', marginX, curY, contentWidth, r2Height, fontBold, 12);

  // ==========================================
  // ROW 3: CONTRATO Nº XXX/XXXX (Height: 18 pt)
  // ==========================================
  const r3Height = 18;
  curY -= r3Height;
  drawBox(marginX, curY, contentWidth, r3Height);
  const contractTitle = data.contract_number
    ? `CONTRATO Nº ${data.contract_number}${data.contract_year ? `/${data.contract_year}` : ''}`
    : (data.bidding_number ? `PROCESSO Nº ${data.bidding_number}` : 'ORDEM DE FORNECIMENTO');
  drawCenteredInBox(contractTitle.toUpperCase(), marginX, curY, contentWidth, r3Height, fontBold, 10);

  // Helper for metadata rows with left label and right value box
  const labelColW = 108;
  const valueColW = contentWidth - labelColW;

  const drawMetadataRow = (
    label: string,
    value: string,
    isBoldValue = false,
    fontSize = 8.5
  ) => {
    const valLines = wrapTextLines(value, valueColW - 12, isBoldValue ? fontBold : fontRegular, fontSize);
    const labelLines = wrapTextLines(label, labelColW - 12, fontBold, 8);
    const neededH = Math.max(valLines.length * (fontSize + 3.5), labelLines.length * 11) + 6;
    const rowH = Math.max(18, neededH);
    curY -= rowH;

    // Label Box
    drawBox(marginX, curY, labelColW, rowH);
    const labelStartY = curY + (rowH - labelLines.length * 10.5) / 2 + (labelLines.length - 1) * 10.5;
    labelLines.forEach((l, lIdx) => {
      const lineW = fontBold.widthOfTextAtSize(l, 8);
      page.drawText(l, {
        x: marginX + (labelColW - lineW) / 2,
        y: labelStartY - lIdx * 10.5,
        size: 8,
        font: fontBold,
        color: black,
      });
    });

    // Value Box
    drawBox(marginX + labelColW, curY, valueColW, rowH);
    const startTextY = curY + (rowH - valLines.length * (fontSize + 3.5)) / 2 + (valLines.length - 1) * (fontSize + 3.5);
    valLines.forEach((line, lIdx) => {
      page.drawText(line, {
        x: marginX + labelColW + 6,
        y: startTextY - lIdx * (fontSize + 3.5),
        size: fontSize,
        font: isBoldValue ? fontBold : fontRegular,
        color: black,
      });
    });
  };

  // ==========================================
  // ROW 4: Objeto
  // ==========================================
  drawMetadataRow(
    'Objeto:',
    data.contract_object || 'CONTRATAÇÃO DE FORNECIMENTO CONFORME EDITAL E CONTRATO AO COZAM.',
    false,
    8
  );

  // ==========================================
  // ROW 5: Fundamentação Legal
  // ==========================================
  drawMetadataRow('Fundamentação Legal:', data.legal_framework || 'Lei 14.133/2021', false, 8.5);

  // ==========================================
  // ROW 6: Órgão Gerenciador
  // ==========================================
  drawMetadataRow(
    'Órgão Gerenciador:',
    'CONSÓRCIO INTERMUNICIPAL DA ZONA DA MATA ALAGOANA E SERVIÇOS PÚBLICOS CNPJ Nº 19.140.014/0001-39',
    true,
    8
  );

  // ==========================================
  // ROW 7: Fornecedor Registrado
  // ==========================================
  const supplierContactParts = [
    data.supplier_address ? `com sede na ${data.supplier_address}` : '',
    data.supplier_phone ? `Telefone ${data.supplier_phone}` : '',
    data.supplier_email ? `Email : ${data.supplier_email}` : ''
  ].filter(Boolean).join(' :   ');
  const supplierFullText = `${data.supplier_name},  inscrita no CNPJ sob o nº${data.supplier_cnpj}${supplierContactParts ? ', ' + supplierContactParts : ''}`;
  drawMetadataRow('Fornecedor Registrado: ', supplierFullText, false, 8);

  // ==========================================
  // ROW 8: Celebração & Prazo de Vigência (decisão 1)
  // ==========================================
  const r8Height = 18;
  curY -= r8Height;
  const colA_B_W = 200;
  const colC_F_W = contentWidth - colA_B_W;
  drawBox(marginX, curY, colA_B_W, r8Height);
  drawCenteredInBox(`Celebração: ${data.celebration_date || 'Não informada'}`, marginX, curY, colA_B_W, r8Height, fontBold, 8.5);
  drawBox(marginX + colA_B_W, curY, colC_F_W, r8Height);
  drawCenteredInBox(`Prazo de Vigência: ${data.validity_date || 'Não informada'}`, marginX + colA_B_W, curY, colC_F_W, r8Height, fontBold, 8.5);

  // ==========================================
  // ROW 9: AUTORIZO a empresa...
  // ==========================================
  const authText = `AUTORIZO a empresa ${data.supplier_name}  a partir da presente data, proceder o fornecimento OU serviço dos itens relacionados e na forma abaixo, em atenção ao edital.`;
  const authLines = wrapTextLines(authText, contentWidth - 14, fontBold, 8);
  const r9Height = Math.max(22, authLines.length * 11 + 6);
  curY -= r9Height;
  drawBox(marginX, curY, contentWidth, r9Height);
  authLines.forEach((l, idx) => {
    page.drawText(l, {
      x: marginX + 6,
      y: curY + r9Height - 4 - 8 - idx * 11,
      size: 8,
      font: fontBold,
      color: black,
    });
  });

  // ==========================================
  // ROW 10: DESTINADOS AO COZAM | Nº DA OF
  // ==========================================
  const r10Height = 18;
  curY -= r10Height;
  const destBoxW = contentWidth - 85;
  const ofBoxW = 85;
  drawBox(marginX, curY, destBoxW, r10Height);
  drawCenteredInBox(resolveDestinationLabel(data), marginX, curY, destBoxW, r10Height, fontBold, 9);
  drawBox(marginX + destBoxW, curY, ofBoxW, r10Height);
  drawCenteredInBox(data.order_number, marginX + destBoxW, curY, ofBoxW, r10Height, fontBold, 9.5);

  // ==========================================
  // TABLE COLUMNS GEOMETRY
  // Total: 525.28 pt
  // ==========================================
  const colW = {
    item: 36,     // A
    desc: 260,    // B
    und: 40,      // C
    qtd: 40,      // D
    unit: 74,     // E
    total: 75.28  // F
  };

  const drawTableHeader = (yPos: number) => {
    const hH = 18;
    let x = marginX;
    const headerCols = [
      { title: 'ITEM', w: colW.item },
      { title: 'DESCRIÇÃO', w: colW.desc },
      { title: 'UND', w: colW.und },
      { title: 'QUANT', w: colW.qtd },
      { title: 'VALOR UNITÁRIO', w: colW.unit },
      { title: 'VALOR TOTAL', w: colW.total },
    ];
    headerCols.forEach((col) => {
      drawBox(x, yPos - hH, col.w, hH);
      drawCenteredInBox(col.title, x, yPos - hH, col.w, hH, fontBold, 7.5);
      x += col.w;
    });
    return hH;
  };

  // Draw Table Header
  const hHeight = drawTableHeader(curY);
  curY -= hHeight;

  // ==========================================
  // TABLE ROWS
  // ==========================================
  data.items.forEach((item, idx) => {
    const itemNum = String(item.item_number ?? (idx + 1));
    const descLines = wrapTextLines(item.description, colW.desc - 10, fontRegular, 7.5);
    const rowH = Math.max(22, descLines.length * 10 + 8);

    // If needed, handle page break
    if (curY - rowH < 140) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      curY = pageHeight - 40;
      const newHeaderH = drawTableHeader(curY);
      curY -= newHeaderH;
    }

    curY -= rowH;
    let x = marginX;

    // Col A: ITEM
    drawBox(x, curY, colW.item, rowH);
    drawCenteredInBox(itemNum, x, curY, colW.item, rowH, fontRegular, 8);
    x += colW.item;

    // Col B: DESCRIÇÃO
    drawBox(x, curY, colW.desc, rowH);
    const textStartY = curY + (rowH - descLines.length * 10) / 2 + (descLines.length - 1) * 10;
    descLines.forEach((l, lIdx) => {
      const lineW = fontRegular.widthOfTextAtSize(l, 7.5);
      page.drawText(l, {
        x: x + (colW.desc - lineW) / 2,
        y: textStartY - lIdx * 10,
        size: 7.5,
        font: fontRegular,
        color: black,
      });
    });
    x += colW.desc;

    // Col C: UND
    drawBox(x, curY, colW.und, rowH);
    drawCenteredInBox(item.unit_of_measure, x, curY, colW.und, rowH, fontRegular, 7.5);
    x += colW.und;

    // Col D: QUANT
    drawBox(x, curY, colW.qtd, rowH);
    drawCenteredInBox(String(item.quantity), x, curY, colW.qtd, rowH, fontRegular, 8);
    x += colW.qtd;

    // Col E: VALOR UNITÁRIO
    drawBox(x, curY, colW.unit, rowH);
    const uStr = formatCurrency(Number(item.unit_price)).replace('R$', '').trim();
    drawCenteredInBox(uStr, x, curY, colW.unit, rowH, fontBold, 8);
    x += colW.unit;

    // Col F: VALOR TOTAL
    drawBox(x, curY, colW.total, rowH);
    const tStr = formatCurrency(Number(item.total_price)).replace('R$', '').trim();
    drawCenteredInBox(tStr, x, curY, colW.total, rowH, fontBold, 8);
  });

  // ==========================================
  // TABLE TOTAL ROW
  // ==========================================
  const totRowH = 18;
  curY -= totRowH;
  const totLeftW = contentWidth - colW.total;
  drawBox(marginX, curY, totLeftW, totRowH);
  // Merged A..E blank in template
  drawBox(marginX + totLeftW, curY, colW.total, totRowH);
  const totAmountStr = formatCurrency(Number(data.total_amount)).replace('R$', '').trim();
  drawCenteredInBox(totAmountStr, marginX + totLeftW, curY, colW.total, totRowH, fontBold, 8);

  // Check room for signatures; if too tight, add page
  if (curY < 180) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    curY = pageHeight - 50;
  }

  // ==========================================
  // DATE ROW
  // ==========================================
  const dateH = 22;
  curY -= dateH;
  drawBox(marginX, curY, contentWidth, dateH);
  drawCenteredInBox(
    `Maceió/AL, ${formatDateExtenso(data.created_at)}.`,
    marginX,
    curY,
    contentWidth,
    dateH,
    fontBold,
    9.5
  );

  // ==========================================
  // SIGNATURE SPACE (Height: 65 pt)
  // ==========================================
  const sigH = 65;
  curY -= sigH;
  drawBox(marginX, curY, contentWidth, sigH);

  // Draw signature if order is signed/confirmed
  if (pdfSig) {
    const sH = 55;
    const sW = (pdfSig.width / pdfSig.height) * sH;
    page.drawImage(pdfSig, {
      x: marginX + (contentWidth - sW) / 2,
      y: curY + (sigH - sH) / 2,
      width: sW,
      height: sH,
    });
  }

  // ==========================================
  // ISSUER NAME & ROLE
  // ==========================================
  const nameH = 16;
  curY -= nameH;
  drawBox(marginX, curY, contentWidth, nameH);
  drawCenteredInBox('JONATHA PEREIRA DE JESUS', marginX, curY, contentWidth, nameH, fontBold, 9);

  const roleH = 16;
  curY -= roleH;
  drawBox(marginX, curY, contentWidth, roleH);
  drawCenteredInBox('SUPERVISOR DE COMPRAS', marginX, curY, contentWidth, roleH, fontBold, 9);

  // ==========================================
  // LOWER BIPARTITE BLOCK (Height: 52 pt)
  // Left: ENDEREÇO PARA ENTREGA (colA + colB width)
  // Right: FORNECEDOR (colC + colD + colE + colF width)
  // ==========================================
  const btmH = 52;
  curY -= btmH;
  const btmLeftW = colW.item + colW.desc; // 296 pt
  const btmRightW = contentWidth - btmLeftW; // 229.28 pt

  // Left Box: Delivery Address
  drawBox(marginX, curY, btmLeftW, btmH);
  const deliveryFull = `ENDEREÇO PARA ENTREGA : ${resolveDeliveryAddress(data)}`;
  const delivLines = wrapTextLines(deliveryFull, btmLeftW - 14, fontBold, 8);
  const delivStartY = curY + (btmH - delivLines.length * 11) / 2 + (delivLines.length - 1) * 11;
  delivLines.forEach((dl, dlIdx) => {
    const w = fontBold.widthOfTextAtSize(dl, 8);
    page.drawText(dl, {
      x: marginX + (btmLeftW - w) / 2,
      y: delivStartY - dlIdx * 11,
      size: 8,
      font: fontBold,
      color: black,
    });
  });

  // Right Top Box: Supplier Name (Height: 34 pt)
  const supTopH = 34;
  drawBox(marginX + btmLeftW, curY + (btmH - supTopH), btmRightW, supTopH);
  const supNameLines = wrapTextLines(data.supplier_name, btmRightW - 12, fontBold, 8.5);
  const supStartY = curY + (btmH - supTopH) + (supTopH - supNameLines.length * 11) / 2 + (supNameLines.length - 1) * 11;
  supNameLines.forEach((sl, slIdx) => {
    const w = fontBold.widthOfTextAtSize(sl, 8.5);
    page.drawText(sl, {
      x: marginX + btmLeftW + (btmRightW - w) / 2,
      y: supStartY - slIdx * 11,
      size: 8.5,
      font: fontBold,
      color: black,
    });
  });

  // Right Bottom Box: "FORNECEDOR" (Height: 18 pt)
  const fornLblH = 18;
  drawBox(marginX + btmLeftW, curY, btmRightW, fornLblH);
  drawCenteredInBox('FORNECEDOR', marginX + btmLeftW, curY, btmRightW, fornLblH, fontBold, 8.5);

  // ==========================================
  // DISCREET AUDIT FOOTER
  // ==========================================
  const footText = `Autenticidade: ${data.tracking_code} · COZAM INC Gestão de Compras e Contratos Públicos`;
  const footW = fontItalic.widthOfTextAtSize(footText, 6);
  page.drawText(footText, {
    x: marginX + (contentWidth - footW) / 2,
    y: 16,
    size: 6,
    font: fontItalic,
    color: rgb(0.4, 0.4, 0.4),
  });

  return await pdfDoc.save();
}
