import ExcelJS from 'exceljs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
  // Items
  items: SupplyOrderItemDoc[];
  total_amount: number;
}

function formatDateExtenso(dateInput: string | Date): string {
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

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

/**
 * Generates an Excel workbook reproducing the official COZAM spreadsheet layout
 */
export async function generateSupplyOrderWorkbook(data: SupplyOrderDocData): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'COZAM — Consórcio Intermunicipal da Zona da Mata Alagoana';
  wb.created = new Date();

  const sheetName = (data.supplier_trade_name || data.supplier_name || 'ORDEM DE FORNECIMENTO')
    .slice(0, 31)
    .replace(/[\\/?*:[\]]/g, '');
  const ws = wb.addWorksheet(sheetName);

  // Column widths matching official template
  ws.columns = [
    { width: 16 }, // ITEM
    { width: 44 }, // DESCRIÇÃO
    { width: 13 }, // UND
    { width: 11 }, // QUANT
    { width: 16 }, // VALOR UNITÁRIO
    { width: 18 }  // VALOR TOTAL
  ];

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };

  const grayFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF2F2F2' }
  };

  // Row 1: Blank
  ws.addRow([]);

  // Row 2: ORDEM DE FORNECIMENTO
  ws.mergeCells('A2:F2');
  const r2 = ws.getCell('A2');
  r2.value = 'ORDEM DE FORNECIMENTO';
  r2.font = { name: 'Calibri', size: 14, bold: true };
  r2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 24;

  // Row 3: TERMO DE CONTRATO - PREGÃO ELETRÔNICO...
  ws.mergeCells('A3:F3');
  const r3 = ws.getCell('A3');
  const procTitle = data.bidding_number || data.process_number || '002/2026';
  const modTitle = data.process_modality || 'PREGÃO ELETRÔNICO';
  r3.value = `TERMO DE CONTRATO - ${modTitle.toUpperCase()} ${procTitle}`;
  r3.font = { name: 'Calibri', size: 11, bold: true };
  r3.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(3).height = 20;

  // Row 4: Objeto
  const r4 = ws.getRow(4);
  r4.getCell(1).value = 'Objeto:';
  r4.getCell(1).font = { name: 'Calibri', size: 10, bold: true };
  r4.getCell(1).alignment = { horizontal: 'left', vertical: 'top' };
  ws.mergeCells('B4:F4');
  const r4Val = ws.getCell('B4');
  r4Val.value = data.contract_object || 'AQUISIÇÃO DE MATERIAIS CONFORME EDITAL E CONTRATO';
  r4Val.font = { name: 'Calibri', size: 10 };
  r4Val.alignment = { wrapText: true, vertical: 'top' };
  r4.height = 36;

  // Row 5: Fundamentação Legal
  const r5 = ws.getRow(5);
  r5.getCell(1).value = 'Fundamentação Legal:';
  r5.getCell(1).font = { name: 'Calibri', size: 10, bold: true };
  r5.getCell(1).alignment = { horizontal: 'left', vertical: 'top' };
  ws.mergeCells('B5:F5');
  const r5Val = ws.getCell('B5');
  r5Val.value = data.legal_framework || 'Lei 14.133/2021 e suas alterações posteriores.';
  r5Val.font = { name: 'Calibri', size: 10 };
  r5Val.alignment = { wrapText: true, vertical: 'top' };

  // Row 6: Órgão Gerenciador
  const r6 = ws.getRow(6);
  r6.getCell(1).value = 'Órgão Gerenciador:';
  r6.getCell(1).font = { name: 'Calibri', size: 10, bold: true };
  r6.getCell(1).alignment = { horizontal: 'left', vertical: 'top' };
  ws.mergeCells('B6:F6');
  const r6Val = ws.getCell('B6');
  r6Val.value = 'CONSÓRCIO INTERMUNICIPAL DA ZONA DA MATA ALAGOANA E SERVIÇOS PÚBLICOS CNPJ Nº 19.140.014/0001-39';
  r6Val.font = { name: 'Calibri', size: 10, bold: true };
  r6Val.alignment = { wrapText: true, vertical: 'top' };

  // Row 7: Fornecedor Registrado
  const r7 = ws.getRow(7);
  r7.getCell(1).value = 'Fornecedor Registrado:';
  r7.getCell(1).font = { name: 'Calibri', size: 10, bold: true };
  r7.getCell(1).alignment = { horizontal: 'left', vertical: 'top' };
  ws.mergeCells('B7:F7');
  const r7Val = ws.getCell('B7');
  const fullAddress = [
    data.supplier_address,
    data.supplier_phone ? `Fone: ${data.supplier_phone}` : '',
    data.supplier_email ? `E-mail: ${data.supplier_email}` : ''
  ].filter(Boolean).join(' - ');
  r7Val.value = `${data.supplier_name}, inscrita no CNPJ sob o nº ${data.supplier_cnpj}${fullAddress ? ', ' + fullAddress : ''}`;
  r7Val.font = { name: 'Calibri', size: 10 };
  r7Val.alignment = { wrapText: true, vertical: 'top' };
  r7.height = 36;

  // Row 8: Celebração & Validade
  ws.mergeCells('A8:B8');
  const r8a = ws.getCell('A8');
  r8a.value = `Celebração: ${data.celebration_date || 'NÃO INFORMADA'}`;
  r8a.font = { name: 'Calibri', size: 10, bold: true };
  r8a.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('C8:F8');
  const r8b = ws.getCell('C8');
  r8b.value = `Prazo validade: ${data.validity_date || 'NÃO INFORMADA'}`;
  r8b.font = { name: 'Calibri', size: 10, bold: true };
  r8b.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(8).height = 20;

  // Row 9: Autorização
  ws.mergeCells('A9:F9');
  const r9 = ws.getCell('A9');
  r9.value = `AUTORIZO a empresa ${data.supplier_name}, a partir da presente data, proceder o fornecimento dos itens relacionados e na forma abaixo, em atenção ao edital.`;
  r9.font = { name: 'Calibri', size: 10, bold: true };
  r9.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  ws.getRow(9).height = 30;

  // Row 10: Município & Número da OF
  ws.mergeCells('A10:E10');
  const r10a = ws.getCell('A10');
  r10a.value = `MUNICÍPIO: ${(data.destination_name || 'NÃO ESPECIFICADO').toUpperCase()}`;
  r10a.font = { name: 'Calibri', size: 11, bold: true };
  r10a.alignment = { horizontal: 'left', vertical: 'middle' };

  const r10b = ws.getCell('F10');
  r10b.value = data.order_number;
  r10b.font = { name: 'Calibri', size: 11, bold: true };
  r10b.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(10).height = 22;

  // Borders for header section
  for (let r = 2; r <= 10; r++) {
    for (let c = 1; c <= 6; c++) {
      ws.getRow(r).getCell(c).border = thinBorder;
    }
  }

  // Row 11: Table Header
  const headers = ['ITEM', 'DESCRIÇÃO', 'UND', 'QUANT', 'VALOR UNITÁRIO', 'VALOR TOTAL'];
  const r11 = ws.getRow(11);
  r11.height = 24;
  headers.forEach((h, idx) => {
    const cell = r11.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = grayFill;
    cell.border = thinBorder;
  });

  // Items rows
  let currentRow = 12;
  data.items.forEach((item, idx) => {
    const row = ws.getRow(currentRow);
    row.getCell(1).value = item.item_number ?? `${idx + 1}`;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(2).value = item.description;
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    row.getCell(3).value = item.unit_of_measure;
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(4).value = Number(item.quantity);
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).numFmt = '#,##0.##';

    row.getCell(5).value = Number(item.unit_price);
    row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(5).numFmt = '"R$ "#,##0.00';

    row.getCell(6).value = Number(item.total_price);
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(6).numFmt = '"R$ "#,##0.00';

    for (let c = 1; c <= 6; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Calibri', size: 10 };
      cell.border = thinBorder;
    }
    currentRow++;
  });

  // Total Row
  ws.mergeCells(`A${currentRow}:E${currentRow}`);
  const rTotTitle = ws.getCell(`A${currentRow}`);
  rTotTitle.value = 'TOTAL';
  rTotTitle.font = { name: 'Calibri', size: 11, bold: true };
  rTotTitle.alignment = { horizontal: 'center', vertical: 'middle' };

  const rTotVal = ws.getCell(`F${currentRow}`);
  rTotVal.value = Number(data.total_amount);
  rTotVal.font = { name: 'Calibri', size: 11, bold: true };
  rTotVal.alignment = { horizontal: 'right', vertical: 'middle' };
  rTotVal.numFmt = '"R$ "#,##0.00';

  for (let c = 1; c <= 6; c++) {
    const cell = ws.getRow(currentRow).getCell(c);
    cell.fill = grayFill;
    cell.border = thinBorder;
  }
  currentRow++;

  // Date row
  currentRow++;
  ws.mergeCells(`A${currentRow}:F${currentRow}`);
  const rDate = ws.getCell(`A${currentRow}`);
  rDate.value = `Maceió/AL, ${formatDateExtenso(data.created_at)}`;
  rDate.font = { name: 'Calibri', size: 11, bold: true };
  rDate.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(currentRow).height = 24;

  // Signature lines
  currentRow += 3;
  ws.mergeCells(`A${currentRow}:C${currentRow}`);
  const rSigSup = ws.getCell(`A${currentRow}`);
  rSigSup.value = data.issuer_name || 'JONATHA PEREIRA DE JESUS';
  rSigSup.font = { name: 'Calibri', size: 11, bold: true };
  rSigSup.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`D${currentRow}:F${currentRow}`);
  const rSigSupName = ws.getCell(`D${currentRow}`);
  rSigSupName.value = data.supplier_name;
  rSigSupName.font = { name: 'Calibri', size: 11, bold: true };
  rSigSupName.alignment = { horizontal: 'center', vertical: 'middle' };

  currentRow++;
  ws.mergeCells(`A${currentRow}:C${currentRow}`);
  const rRoleSup = ws.getCell(`A${currentRow}`);
  rRoleSup.value = data.issuer_role || 'SUPERVISOR DE COMPRAS';
  rRoleSup.font = { name: 'Calibri', size: 10, bold: true };
  rRoleSup.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`D${currentRow}:F${currentRow}`);
  const rRoleForn = ws.getCell(`D${currentRow}`);
  rRoleForn.value = 'Fornecedor';
  rRoleForn.font = { name: 'Calibri', size: 10, bold: true };
  rRoleForn.alignment = { horizontal: 'center', vertical: 'middle' };

  currentRow++;
  ws.mergeCells(`A${currentRow}:F${currentRow}`);
  const rPrazo = ws.getCell(`A${currentRow}`);
  rPrazo.value = `PRAZO DE ENTREGA : ${data.delivery_deadline_days || 15} DIAS CORRIDOS`;
  rPrazo.font = { name: 'Calibri', size: 10, bold: true };
  rPrazo.alignment = { horizontal: 'center', vertical: 'middle' };

  currentRow += 2;
  ws.mergeCells(`A${currentRow}:F${currentRow}`);
  const rTrack = ws.getCell(`A${currentRow}`);
  rTrack.value = `Código de Rastreamento / Autenticidade: ${data.tracking_code} | COZAM Gestão de Contratos`;
  rTrack.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF666666' } };
  rTrack.alignment = { horizontal: 'center', vertical: 'middle' };

  return wb;
}

/**
 * Generates an official vector PDF for the Supply Order matching public sector standards
 */
export async function generateSupplyOrderPdf(data: SupplyOrderDocData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Ordem de Fornecimento - ${data.order_number}`);
  pdfDoc.setAuthor('COZAM — Consórcio Intermunicipal da Zona da Mata Alagoana');
  pdfDoc.setSubject(`OF referente ao contrato ${data.contract_number || ''}`);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // A4 dimensions: 595.28 x 841.89 points
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2; // 523.28

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const navy = rgb(0.08, 0.18, 0.36); // #152e5c
  const darkGray = rgb(0.2, 0.2, 0.2);
  const lightGray = rgb(0.94, 0.95, 0.96);
  const borderGray = rgb(0.7, 0.72, 0.75);

  // Helper for text drawing
  const drawTextCenter = (text: string, fontSize: number, font = fontRegular, color = darkGray, posY = y) => {
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, {
      x: margin + (contentWidth - textWidth) / 2,
      y: posY,
      size: fontSize,
      font,
      color
    });
  };

  // Header Institution
  drawTextCenter('CONSÓRCIO INTERMUNICIPAL DA ZONA DA MATA ALAGOANA — COZAM', 10, fontBold, navy, y);
  y -= 14;
  drawTextCenter('CNPJ Nº 19.140.014/0001-39 | GESTÃO DE CONTRATOS E COMPRAS PÚBLICAS', 8, fontRegular, rgb(0.4, 0.4, 0.4), y);
  y -= 18;

  // Title Box
  page.drawRectangle({
    x: margin,
    y: y - 28,
    width: contentWidth,
    height: 32,
    color: navy
  });
  drawTextCenter(`ORDEM DE FORNECIMENTO — N° ${data.order_number}`, 12, fontBold, rgb(1, 1, 1), y - 14);
  const biddingTitle = data.bidding_number || data.process_number || '';
  const modalityTitle = (data.process_modality || 'PREGÃO ELETRÔNICO').toUpperCase();
  drawTextCenter(`TERMO DE CONTRATO - ${modalityTitle} ${biddingTitle}`, 9, fontRegular, rgb(0.9, 0.9, 0.9), y - 25);
  y -= 38;

  // Box with metadata
  const drawMetaRow = (label: string, value: string, height = 16): number => {
    page.drawRectangle({
      x: margin,
      y: y - height,
      width: contentWidth,
      height,
      borderColor: borderGray,
      borderWidth: 0.5,
      color: rgb(1, 1, 1)
    });
    page.drawText(label, {
      x: margin + 6,
      y: y - height + 4,
      size: 8,
      font: fontBold,
      color: navy
    });
    const labelWidth = fontBold.widthOfTextAtSize(label, 8);
    // Truncate value if too wide
    let safeVal = value;
    const maxValWidth = contentWidth - labelWidth - 20;
    while (safeVal.length > 5 && fontRegular.widthOfTextAtSize(safeVal, 8) > maxValWidth) {
      safeVal = safeVal.slice(0, -4) + '...';
    }
    page.drawText(safeVal, {
      x: margin + labelWidth + 10,
      y: y - height + 4,
      size: 8,
      font: fontRegular,
      color: darkGray
    });
    y -= height;
    return height;
  };

  drawMetaRow('Objeto: ', data.contract_object || 'Aquisição de materiais conforme edital', 20);
  drawMetaRow('Fundamentação Legal: ', data.legal_framework || 'Lei 14.133/2021', 16);
  drawMetaRow('Fornecedor: ', `${data.supplier_name} — CNPJ: ${data.supplier_cnpj}`, 18);
  drawMetaRow('Vigência do Contrato: ', `Celebração: ${data.celebration_date || 'N/I'} | Validade: ${data.validity_date || 'N/I'} | Prazo: ${data.delivery_deadline_days || 15} dias corridos`, 16);
  
  // Destination Municipality highlighted row
  page.drawRectangle({
    x: margin,
    y: y - 20,
    width: contentWidth,
    height: 20,
    color: lightGray,
    borderColor: navy,
    borderWidth: 1
  });
  page.drawText('MUNICÍPIO DESTINATÁRIO: ', {
    x: margin + 6,
    y: y - 14,
    size: 9,
    font: fontBold,
    color: navy
  });
  page.drawText((data.destination_name || 'NÃO ESPECIFICADO').toUpperCase(), {
    x: margin + 140,
    y: y - 14,
    size: 9,
    font: fontBold,
    color: rgb(0.1, 0.4, 0.2)
  });
  y -= 26;

  // Authorization banner
  page.drawText(`AUTORIZO a empresa ${data.supplier_name.slice(0, 50)}, a partir da presente data, proceder o fornecimento:`, {
    x: margin,
    y,
    size: 8.5,
    font: fontBold,
    color: darkGray
  });
  y -= 14;

  // Table Columns
  // Total width: 523.28
  const colWidths = {
    item: 35,
    desc: 268,
    und: 40,
    qtd: 40,
    unit: 65,
    total: 75.28
  };

  // Table Header
  page.drawRectangle({
    x: margin,
    y: y - 18,
    width: contentWidth,
    height: 18,
    color: lightGray,
    borderColor: borderGray,
    borderWidth: 0.5
  });

  let curX = margin;
  const drawColHeader = (title: string, width: number, alignCenter = true) => {
    const textWidth = fontBold.widthOfTextAtSize(title, 7.5);
    const textX = alignCenter ? curX + (width - textWidth) / 2 : curX + 4;
    page.drawText(title, {
      x: textX,
      y: y - 13,
      size: 7.5,
      font: fontBold,
      color: navy
    });
    curX += width;
  };

  drawColHeader('ITEM', colWidths.item);
  drawColHeader('DESCRIÇÃO', colWidths.desc, false);
  drawColHeader('UND', colWidths.und);
  drawColHeader('QUANT', colWidths.qtd);
  drawColHeader('VLR UNIT (R$)', colWidths.unit);
  drawColHeader('TOTAL (R$)', colWidths.total);
  y -= 18;

  // Table Rows
  data.items.forEach((item, idx) => {
    // Check if new page needed
    if (y < margin + 120) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    const rowHeight = 16;
    const isEven = idx % 2 === 0;
    if (isEven) {
      page.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: rgb(0.98, 0.98, 0.99)
      });
    }

    // Outer line
    page.drawRectangle({
      x: margin,
      y: y - rowHeight,
      width: contentWidth,
      height: rowHeight,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 0.5
    });

    curX = margin;
    // Col 1: item number
    const itNum = String(item.item_number ?? (idx + 1));
    const itW = fontRegular.widthOfTextAtSize(itNum, 7.5);
    page.drawText(itNum, { x: curX + (colWidths.item - itW) / 2, y: y - 11, size: 7.5, font: fontRegular, color: darkGray });
    curX += colWidths.item;

    // Col 2: description (truncated if needed)
    let desc = item.description;
    while (desc.length > 5 && fontRegular.widthOfTextAtSize(desc, 7.5) > colWidths.desc - 8) {
      desc = desc.slice(0, -4) + '...';
    }
    page.drawText(desc, { x: curX + 4, y: y - 11, size: 7.5, font: fontRegular, color: darkGray });
    curX += colWidths.desc;

    // Col 3: unit
    const undW = fontRegular.widthOfTextAtSize(item.unit_of_measure, 7);
    page.drawText(item.unit_of_measure, { x: curX + (colWidths.und - undW) / 2, y: y - 11, size: 7, font: fontRegular, color: darkGray });
    curX += colWidths.und;

    // Col 4: quantity
    const qtdStr = String(item.quantity);
    const qtdW = fontRegular.widthOfTextAtSize(qtdStr, 7.5);
    page.drawText(qtdStr, { x: curX + (colWidths.qtd - qtdW) / 2, y: y - 11, size: 7.5, font: fontRegular, color: darkGray });
    curX += colWidths.qtd;

    // Col 5: unit price
    const unitStr = formatCurrency(Number(item.unit_price)).replace('R$', '').trim();
    const unitW = fontRegular.widthOfTextAtSize(unitStr, 7.5);
    page.drawText(unitStr, { x: curX + colWidths.unit - unitW - 4, y: y - 11, size: 7.5, font: fontRegular, color: darkGray });
    curX += colWidths.unit;

    // Col 6: total price
    const totStr = formatCurrency(Number(item.total_price)).replace('R$', '').trim();
    const totW = fontRegular.widthOfTextAtSize(totStr, 7.5);
    page.drawText(totStr, { x: curX + colWidths.total - totW - 4, y: y - 11, size: 7.5, font: fontRegular, color: darkGray });

    y -= rowHeight;
  });

  // Table Total Row
  page.drawRectangle({
    x: margin,
    y: y - 20,
    width: contentWidth,
    height: 20,
    color: lightGray,
    borderColor: borderGray,
    borderWidth: 0.5
  });
  page.drawText('VALOR TOTAL DA ORDEM:', {
    x: margin + colWidths.item + 8,
    y: y - 14,
    size: 8.5,
    font: fontBold,
    color: navy
  });
  const totalFormatted = formatCurrency(Number(data.total_amount));
  const totW = fontBold.widthOfTextAtSize(totalFormatted, 9.5);
  page.drawText(totalFormatted, {
    x: margin + contentWidth - totW - 6,
    y: y - 14,
    size: 9.5,
    font: fontBold,
    color: navy
  });
  y -= 30;

  // Date
  drawTextCenter(`Maceió/AL, ${formatDateExtenso(data.created_at)}`, 9, fontBold, darkGray, y);
  y -= 45;

  // Signatures
  const sigBoxW = (contentWidth - 20) / 2;
  // Left: Compras Supervisor
  page.drawLine({
    start: { x: margin + 10, y: y },
    end: { x: margin + sigBoxW - 10, y: y },
    thickness: 0.8,
    color: darkGray
  });
  const sig1Name = data.issuer_name || 'JONATHA PEREIRA DE JESUS';
  const sig1W = fontBold.widthOfTextAtSize(sig1Name, 8);
  page.drawText(sig1Name, {
    x: margin + (sigBoxW - sig1W) / 2,
    y: y - 12,
    size: 8,
    font: fontBold,
    color: darkGray
  });
  const sig1Role = data.issuer_role || 'SUPERVISOR DE COMPRAS — COZAM';
  const sig1RoleW = fontRegular.widthOfTextAtSize(sig1Role, 7.5);
  page.drawText(sig1Role, {
    x: margin + (sigBoxW - sig1RoleW) / 2,
    y: y - 22,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3)
  });

  // Right: Fornecedor
  const rightX = margin + sigBoxW + 20;
  page.drawLine({
    start: { x: rightX + 10, y: y },
    end: { x: rightX + sigBoxW - 10, y: y },
    thickness: 0.8,
    color: darkGray
  });
  let supSigName = data.supplier_name;
  if (supSigName.length > 35) supSigName = supSigName.slice(0, 32) + '...';
  const sig2W = fontBold.widthOfTextAtSize(supSigName, 8);
  page.drawText(supSigName, {
    x: rightX + (sigBoxW - sig2W) / 2,
    y: y - 12,
    size: 8,
    font: fontBold,
    color: darkGray
  });
  const sig2Role = 'Representante Legal / Fornecedor';
  const sig2RoleW = fontRegular.widthOfTextAtSize(sig2Role, 7.5);
  page.drawText(sig2Role, {
    x: rightX + (sigBoxW - sig2RoleW) / 2,
    y: y - 22,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3)
  });

  // Footer tracking
  page.drawRectangle({
    x: margin,
    y: margin,
    width: contentWidth,
    height: 18,
    color: rgb(0.97, 0.97, 0.98),
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 0.5
  });
  const trackText = `Código Verificador: ${data.tracking_code} | Autenticidade verificável em COZAM INC | Status: ${data.status}`;
  const trackW = fontItalic.widthOfTextAtSize(trackText, 6.5);
  page.drawText(trackText, {
    x: margin + (contentWidth - trackW) / 2,
    y: margin + 6,
    size: 6.5,
    font: fontItalic,
    color: rgb(0.4, 0.4, 0.4)
  });

  return await pdfDoc.save();
}
