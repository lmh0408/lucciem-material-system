import ExcelJS from 'exceljs';
import { PurchaseOrder } from '../types/inventory';

/** A4 세로(210×297)에 맞춘 화면 발주서 열 비율: 순번, 품목명·규격, 단위, 수량, 단가, 금액 */
const COLUMN_WIDTHS = [8, 36, 10, 12, 14, 16];
const LAST_COL = COLUMN_WIDTHS.length;
const INPUT_FILL = 'FFFFFBEB';
const CALC_FILL = 'FFF8FAFC';
const HEADER_FILL = 'FFF1F5F9';
const BRAND = 'FFBA1B2D';
const INK = 'FF0F172A';
const MUTED = 'FF64748B';
const LINE = 'FFCBD5E1';

function sanitizeExcelFilename(name: string): string {
  const base = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return base.toLowerCase().endsWith('.xlsx') ? base : `${base}.xlsx`;
}

function border(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: LINE } };
  return { top: side, left: side, bottom: side, right: side };
}

function paint(cell: ExcelJS.Cell, fill: string): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
}

function triggerBrowserDownload(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 화면 발주서와 같은 세로 A4 비율의 편집 가능한 Excel 시트로 저장합니다.
 * 노란 칸은 수정할 수 있고, 공급가액·합계는 수식입니다.
 */
export async function downloadPurchaseOrderAsExcel(
  po: PurchaseOrder,
  filename?: string,
): Promise<void> {
  const safeName = sanitizeExcelFilename(
    filename ?? `루씨엠_발주서_${po.supplier}_${po.orderNumber}.xlsx`,
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('발주서', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
    },
  });

  sheet.columns = COLUMN_WIDTHS.map((width) => ({ width }));

  sheet.mergeCells('A1:C3');
  sheet.getCell('A1').value = po.documentTitle || '자 재 발 주 서';
  sheet.getCell('A1').font = { name: 'Malgun Gothic', size: 20, bold: true, color: { argb: INK } };
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 24;
  sheet.getRow(2).height = 20;
  sheet.getRow(3).height = 20;

  const meta: [string, string][] = [
    ['발주번호', po.orderNumber],
    ['발주일자', po.orderDate],
    ['납기요청일', po.deliveryDueDate],
  ];
  meta.forEach(([label, value], index) => {
    const row = index + 1;
    sheet.getCell(row, 4).value = label;
    sheet.getCell(row, 4).font = { name: 'Malgun Gothic', size: 9, color: { argb: MUTED } };
    sheet.getCell(row, 4).alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.mergeCells(row, 5, row, LAST_COL);
    sheet.getCell(row, 5).value = value;
    sheet.getCell(row, 5).font = {
      name: 'Malgun Gothic',
      size: 11,
      bold: true,
      color: { argb: index === 1 ? MUTED : BRAND },
    };
    sheet.getCell(row, 5).alignment = { horizontal: 'right', vertical: 'middle' };
    paint(sheet.getCell(row, 5), INPUT_FILL);
  });

  sheet.mergeCells('A5:C5');
  sheet.getCell('A5').value = '발주자';
  sheet.getCell('A5').font = { name: 'Malgun Gothic', bold: true, color: { argb: BRAND } };
  sheet.mergeCells('D5:F5');
  sheet.getCell('D5').value = '공급자';
  sheet.getCell('D5').font = { name: 'Malgun Gothic', bold: true, color: { argb: INK } };
  sheet.getRow(5).height = 20;

  const infoRows: [string, string, string, string][] = [
    ['상호명', po.buyerName, '상호명', po.supplier],
    ['사업자등록번호', po.buyerBusinessNumber, '담당자', po.contactPerson || ''],
    ['납품장소', po.deliveryPlace, '연락처', po.phone || ''],
    ['발주담당', po.buyerContact, '결제조건', po.paymentTerms],
  ];

  infoRows.forEach((row, index) => {
    const r = 6 + index;
    sheet.getCell(r, 1).value = row[0];
    sheet.getCell(r, 1).font = { name: 'Malgun Gothic', size: 9, color: { argb: MUTED } };
    sheet.mergeCells(r, 2, r, 3);
    sheet.getCell(r, 2).value = row[1];
    sheet.getCell(r, 2).font = { name: 'Malgun Gothic', size: 10, bold: true };
    sheet.getCell(r, 2).alignment = { vertical: 'middle', wrapText: true };
    paint(sheet.getCell(r, 2), INPUT_FILL);

    sheet.getCell(r, 4).value = row[2];
    sheet.getCell(r, 4).font = { name: 'Malgun Gothic', size: 9, color: { argb: MUTED } };
    sheet.mergeCells(r, 5, r, LAST_COL);
    sheet.getCell(r, 5).value = row[3];
    sheet.getCell(r, 5).font = { name: 'Malgun Gothic', size: 10, bold: true };
    sheet.getCell(r, 5).alignment = { vertical: 'middle', wrapText: true };
    paint(sheet.getCell(r, 5), INPUT_FILL);
    sheet.getRow(r).height = 22;
    for (let c = 1; c <= LAST_COL; c += 1) sheet.getCell(r, c).border = border();
  });
  for (let c = 1; c <= LAST_COL; c += 1) sheet.getCell(5, c).border = border();

  const headerRow = 11;
  ['순번', '품목명 및 규격', '단위', '발주수량', '단가(원)', '공급가액(원)'].forEach((label, index) => {
    const cell = sheet.getCell(headerRow, index + 1);
    cell.value = label;
    cell.font = { name: 'Malgun Gothic', bold: true, size: 10 };
    cell.alignment = { horizontal: index === 1 ? 'left' : index === 0 || index === 2 ? 'center' : 'right', vertical: 'middle' };
    paint(cell, HEADER_FILL);
    cell.border = border();
  });
  sheet.getRow(headerRow).height = 22;

  const firstItemRow = headerRow + 1;
  po.items.forEach((item, index) => {
    const r = firstItemRow + index;
    sheet.getCell(r, 1).value = index + 1;
    sheet.getCell(r, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell(r, 2).value = item.spec ? `${item.name}\n${item.spec}` : item.name;
    sheet.getCell(r, 2).alignment = { wrapText: true, vertical: 'middle' };
    sheet.getCell(r, 3).value = item.unit;
    sheet.getCell(r, 3).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell(r, 4).value = item.orderQty;
    sheet.getCell(r, 4).numFmt = '#,##0';
    sheet.getCell(r, 4).alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getCell(r, 5).value = item.unitPrice;
    sheet.getCell(r, 5).numFmt = '#,##0';
    sheet.getCell(r, 5).alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getCell(r, 6).value = { formula: `D${r}*E${r}`, result: item.totalPrice };
    sheet.getCell(r, 6).numFmt = '#,##0';
    sheet.getCell(r, 6).alignment = { horizontal: 'right', vertical: 'middle' };

    for (let c = 1; c <= LAST_COL; c += 1) {
      const cell = sheet.getCell(r, c);
      cell.font = { name: 'Malgun Gothic', size: 10, bold: c === 2 || c === 4 || c === 6 };
      cell.border = border();
      if (c >= 2 && c <= 5) paint(cell, INPUT_FILL);
      if (c === 6) paint(cell, CALC_FILL);
    }
    sheet.getRow(r).height = 32;
  });

  const lastItemRow = po.items.length > 0 ? firstItemRow + po.items.length - 1 : firstItemRow;
  const subtotalRow = (po.items.length > 0 ? lastItemRow : headerRow) + 1;
  const vatRow = subtotalRow + 1;
  const grandRow = vatRow + 1;
  const sumFormula = po.items.length > 0 ? `SUM(F${firstItemRow}:F${lastItemRow})` : '0';

  const writeTotal = (row: number, label: string, formula: string, result: number, highlight: boolean) => {
    sheet.mergeCells(row, 1, row, 5);
    sheet.getCell(row, 1).value = label;
    sheet.getCell(row, 1).alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getCell(row, 1).font = { name: 'Malgun Gothic', bold: true, size: highlight ? 12 : 10 };
    sheet.getCell(row, 6).value = { formula, result };
    sheet.getCell(row, 6).numFmt = '#,##0"원"';
    sheet.getCell(row, 6).alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getCell(row, 6).font = {
      name: 'Malgun Gothic',
      bold: true,
      size: highlight ? 12 : 10,
      color: { argb: highlight ? BRAND : INK },
    };
    sheet.getRow(row).height = 22;
    for (let c = 1; c <= LAST_COL; c += 1) {
      paint(sheet.getCell(row, c), highlight ? 'FFFFF1F2' : CALC_FILL);
      sheet.getCell(row, c).border = border();
    }
  };

  writeTotal(subtotalRow, '공급가액 소계', sumFormula, po.totalAmount, false);
  writeTotal(vatRow, '부가가치세 (10%)', `ROUND(F${subtotalRow}*0.1,0)`, po.vatAmount, false);
  writeTotal(grandRow, '총 발주 금액 (부가세 포함)', `F${subtotalRow}+F${vatRow}`, po.grandTotal, true);

  const noteRow = grandRow + 2;
  const terms = (po.terms.length > 0 ? po.terms : ['']).map((term, index) => `${index + 1}. ${term}`).join('\n');
  sheet.mergeCells(noteRow, 1, noteRow + 3, 4);
  sheet.getCell(noteRow, 1).value = terms;
  sheet.getCell(noteRow, 1).alignment = { wrapText: true, vertical: 'top' };
  sheet.getCell(noteRow, 1).font = { name: 'Malgun Gothic', size: 9, color: { argb: MUTED } };
  sheet.getRow(noteRow).height = 18;
  sheet.getRow(noteRow + 1).height = 18;
  sheet.getRow(noteRow + 2).height = 18;
  sheet.getRow(noteRow + 3).height = 18;

  sheet.mergeCells(noteRow, 5, noteRow + 3, LAST_COL);
  sheet.getCell(noteRow, 5).value = `${po.confirmLabel}\n${po.confirmCompany}\n(${po.confirmNote})`;
  sheet.getCell(noteRow, 5).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  sheet.getCell(noteRow, 5).font = { name: 'Malgun Gothic', size: 10, bold: true };
  sheet.getCell(noteRow, 5).border = border();
  paint(sheet.getCell(noteRow, 5), CALC_FILL);

  sheet.pageSetup.printArea = `A1:F${noteRow + 3}`;

  const buffer = await workbook.xlsx.writeBuffer();
  triggerBrowserDownload(buffer, safeName);
}
