import ExcelJS from 'exceljs';
import type { ReportResult } from '@cozam/shared';
import { formatDateTimeBR } from '@cozam/shared';
import { BRAND } from '../../config/brand.js';

export async function exportReportToExcel(report: ReportResult): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND.acronym;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Relatório', {
    views: [{ showGridLines: true }],
  });

  // Título e cabeçalho
  sheet.addRow([BRAND.name]);
  sheet.addRow([report.title]);
  sheet.addRow([`Gerado em: ${formatDateTimeBR(report.generated_at)} por ${report.generated_by}`]);

  if (report.filters_applied && report.filters_applied.length > 0) {
    const filtersStr = report.filters_applied.map((f) => `${f.label}: ${f.value}`).join('  |  ');
    sheet.addRow([`Filtros aplicados: ${filtersStr}`]);
  }
  sheet.addRow([]); // Linha em branco

  // Estilização das linhas de cabeçalho
  sheet.getRow(1).font = { bold: true, size: 13, color: { argb: 'FF258900' } };
  sheet.getRow(2).font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
  sheet.getRow(3).font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

  // Cabeçalhos de coluna
  const headerLabels = report.columns.map((c) => c.label);
  const headerRow = sheet.addRow(headerLabels);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF258900' }, // Verde COZAM
  };
  headerRow.alignment = { vertical: 'middle' };

  // Linhas de dados
  for (const rowData of report.rows) {
    const rowValues = report.columns.map((c) => {
      const v = rowData[c.key];
      if (v === null || v === undefined) return '';
      if (c.type === 'money' || c.type === 'number') return Number(v);
      return String(v);
    });
    const row = sheet.addRow(rowValues);

    // Formatações por coluna
    report.columns.forEach((c, idx) => {
      const cell = row.getCell(idx + 1);
      if (c.type === 'money') {
        cell.numFmt = '"R$" #,##0.00;[Red]-"R$" #,##0.00;"R$" 0.00';
        cell.alignment = { horizontal: 'right' };
      } else if (c.type === 'number') {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });
  }

  // Linha de totais
  if (report.totals && Object.keys(report.totals).length > 0) {
    const totalsValues = report.columns.map((c, idx) => {
      if (idx === 0) return 'TOTAL GERAL';
      if (report.totals[c.key] !== undefined) {
        return Number(report.totals[c.key]);
      }
      return '';
    });
    const totalsRow = sheet.addRow(totalsValues);
    totalsRow.font = { bold: true };
    totalsRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    report.columns.forEach((c, idx) => {
      const cell = totalsRow.getCell(idx + 1);
      if (c.type === 'money') {
        cell.numFmt = '"R$" #,##0.00;[Red]-"R$" #,##0.00;"R$" 0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });
  }

  // Ajusta largura automática das colunas
  sheet.columns.forEach((col, idx) => {
    const label = report.columns[idx]?.label || '';
    col.width = Math.max(label.length + 6, 14);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = report.title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 40);
  a.download = `${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
