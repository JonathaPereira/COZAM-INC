import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBRL, formatDateBR, formatDateTimeBR, type ReportResult } from '@cozam/shared';
import { BRAND } from '../../config/brand.js';

export function exportReportToPdf(report: ReportResult): void {
  // Se houver mais de 6 colunas, usa orientação Paisagem (Landscape) para legibilidade
  const isLandscape = report.columns.length > 6;
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Cabeçalho institucional
  doc.setFillColor(37, 137, 0); // Verde profundo COZAM
  doc.rect(0, 0, pageWidth, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(43, 48, 51); // Grafite institucional
  doc.text(BRAND.acronym, 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(BRAND.name, 14, 19);

  // Título do Relatório
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(report.title, 14, 28);

  // Metadados de geração
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const metaText = `Gerado em: ${formatDateTimeBR(report.generated_at)} por ${report.generated_by}`;
  doc.text(metaText, 14, 33);

  // Filtros aplicados
  let startY = 38;
  if (report.filters_applied && report.filters_applied.length > 0) {
    const filtersStr = report.filters_applied.map((f) => `${f.label}: ${f.value}`).join('  |  ');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Filtros: ${filtersStr}`, 14, startY);
    startY += 6;
  }

  // Tabela de dados
  const headers = report.columns.map((c) => c.label);
  const rows = report.rows.map((r) =>
    report.columns.map((c) => {
      const v = r[c.key];
      if (v === null || v === undefined) return '—';
      if (c.type === 'money') return formatBRL(v as number);
      if (c.type === 'date') return formatDateBR(v as string);
      if (c.type === 'datetime') return formatDateTimeBR(v as string);
      return String(v);
    })
  );

  // Linha de totalizadores
  if (report.totals && Object.keys(report.totals).length > 0) {
    const totalsRow = report.columns.map((c, idx) => {
      if (idx === 0) return 'TOTAL GERAL';
      if (report.totals[c.key] !== undefined) {
        return c.type === 'money'
          ? formatBRL(report.totals[c.key])
          : String(report.totals[c.key]);
      }
      return '';
    });
    rows.push(totalsRow);
  }

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [37, 137, 0], // Verde COZAM
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: report.columns.reduce((acc, col, idx) => {
      if (col.type === 'money' || col.type === 'number') {
        acc[idx] = { halign: 'right' };
      }
      return acc;
    }, {} as Record<number, any>),
    didDrawPage: (data) => {
      // Rodapé com número de página
      const pageCount = doc.internal.pages.length - 1;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount} · ${BRAND.systemName}`,
        pageWidth - 14,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'right' }
      );
    },
  });

  const safeName = report.title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 40);
  doc.save(`${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
