import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { PurchaseOrder } from '../types/inventory';

const FONT = 'Malgun Gothic';
type Edge = { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
type Edges = { top: Edge; bottom: Edge; left: Edge; right: Edge };

const thin: Edge = { style: BorderStyle.SINGLE, size: 8, color: 'CBD5E1' };
const thick: Edge = { style: BorderStyle.SINGLE, size: 16, color: '0F172A' };
const none: Edge = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const box: Edges = { top: thin, bottom: thin, left: thin, right: thin };
const noBorder: Edges = { top: none, bottom: none, left: none, right: none };

export interface PurchaseOrderForm extends PurchaseOrder {
  title: string;
  buyerName: string;
  buyerBizNo: string;
  deliveryPlace: string;
  buyerContact: string;
  paymentTerms: string;
  terms: string[];
  remarks: string;
  stampLabel: string;
  stampOrg: string;
  stampMark: string;
}

export const DEFAULT_PURCHASE_ORDER_FORM = {
  title: '자 재 발 주 서',
  buyerName: '주식회사 루씨엠',
  buyerBizNo: '119-86-59000',
  deliveryPlace: '경기도 안양시 동안구 학의로 282, B동 2022 (관양동, 금강펜테리움IT타워)',
  buyerContact: '자재구매팀 선임매니저 (02-851-7100)',
  paymentTerms: '마감 익월 30일 현금 또는 계좌이체',
  terms: [
    '1. 납품 자재는 발주서의 품목명, 상세 규격과 본사가 사전에 승인한 규격서 및 시험성적서를 만족해야 합니다.',
    '2. 납기요청일을 넘기면 지체일수마다 지체상금률 0.15%를 적용할 수 있습니다.',
    '3. 인수 검수에서 불량품이 확인되면 공급자는 해당 물품을 즉시 무상으로 교환해야 합니다.',
  ],
  remarks: '',
  stampLabel: '발주처 확인인',
  stampOrg: '주식회사 루씨엠',
  stampMark: '직인생략',
};

function run(value: string, options?: { bold?: boolean; size?: number; color?: string }) {
  return new TextRun({
    text: value || ' ',
    font: FONT,
    bold: options?.bold,
    size: options?.size ?? 18,
    color: options?.color,
  });
}

function paragraph(
  children: TextRun[],
  align?: (typeof AlignmentType)[keyof typeof AlignmentType],
) {
  return new Paragraph({
    alignment: align,
    spacing: { before: 40, after: 40 },
    children,
  });
}

function cell(
  lines: TextRun[][],
  width: number,
  options?: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    fill?: string;
    borders?: Edges;
    span?: number;
  },
) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: options?.span,
    verticalAlign: VerticalAlign.CENTER,
    borders: options?.borders ?? box,
    shading: options?.fill ? { type: ShadingType.CLEAR, fill: options.fill } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: lines.map((line) => paragraph(line, options?.align)),
  });
}

export function purchaseOrderFileBase(po: Pick<PurchaseOrderForm, 'supplier' | 'orderNumber'>): string {
  const safeSupplier = po.supplier.replace(/[\\/:*?"<>|]/g, ' ').trim();
  return `루씨엠_발주서_${safeSupplier}_${po.orderNumber}`;
}

export function buildPurchaseOrderDocument(po: PurchaseOrderForm): Document {
  const metaLine = (text: string, width: number, options?: { bold?: boolean; color?: string; size?: number; span?: number }) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: options?.span,
    borders: noBorder,
    margins: { top: 0, bottom: 0, left: 0, right: 40 },
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 40 },
      children: [run(text, { bold: options?.bold, size: options?.size ?? 18, color: options?.color })],
    })],
  });

  const meta = new Table({
    width: { size: 3200, type: WidthType.DXA },
    columnWidths: [1400, 1800],
    rows: [
      new TableRow({
        children: [metaLine(po.orderNumber, 3200, { bold: true, color: 'BA1B2D', size: 22, span: 2 })],
      }),
      new TableRow({
        children: [
          metaLine('발주일자:', 1400, { color: '475569' }),
          metaLine(po.orderDate, 1800, { color: '475569' }),
        ],
      }),
      new TableRow({
        children: [
          metaLine('납기요청일:', 1400, { bold: true, color: 'BE123C' }),
          metaLine(po.deliveryDueDate, 1800, { bold: true, color: 'BE123C' }),
        ],
      }),
    ],
  });

  const header = new Table({
    width: { size: 9900, type: WidthType.DXA },
    columnWidths: [6700, 3200],
    rows: [
      new TableRow({
        children: [
          cell([[run(po.title, { bold: true, size: 44 })]], 6700, { borders: { ...noBorder, bottom: thick } }),
          new TableCell({
            width: { size: 3200, type: WidthType.DXA },
            verticalAlign: VerticalAlign.BOTTOM,
            borders: { ...noBorder, bottom: thick },
            margins: { top: 0, bottom: 40, left: 0, right: 0 },
            children: [meta],
          }),
        ],
      }),
    ],
  });

  const parties = new Table({
    width: { size: 9900, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          cell([
            [run('발주자', { bold: true, size: 20, color: 'BA1B2D' })],
            [run('상호명: ', { color: '64748B' }), run(po.buyerName, { bold: true })],
            [run('사업자등록번호: ', { color: '64748B' }), run(po.buyerBizNo)],
            [run('납품장소: ', { color: '64748B' }), run(po.deliveryPlace)],
            [run('발주담당: ', { color: '64748B' }), run(po.buyerContact)],
          ], 4950, { fill: 'F8FAFC' }),
          cell([
            [run('공급자', { bold: true, size: 20 })],
            [run('상호명: ', { color: '64748B' }), run(po.supplier, { bold: true })],
            [run('담당자: ', { color: '64748B' }), run(po.contactPerson)],
            [run('연락처: ', { color: '64748B' }), run(po.phone)],
            [run('결제조건: ', { color: '64748B' }), run(po.paymentTerms)],
          ], 4950, { fill: 'F8FAFC' }),
        ],
      }),
    ],
  });

  const itemHeader = new TableRow({
    tableHeader: true,
    children: [
      cell([[run('순번', { bold: true })]], 700, { align: AlignmentType.CENTER, fill: 'F1F5F9' }),
      cell([[run('품목명 및 규격', { bold: true })]], 4200, { fill: 'F1F5F9' }),
      cell([[run('단위', { bold: true })]], 800, { align: AlignmentType.CENTER, fill: 'F1F5F9' }),
      cell([[run('발주수량', { bold: true })]], 1200, { align: AlignmentType.RIGHT, fill: 'F1F5F9' }),
      cell([[run('단가(원)', { bold: true })]], 1400, { align: AlignmentType.RIGHT, fill: 'F1F5F9' }),
      cell([[run('공급가액(원)', { bold: true })]], 1600, { align: AlignmentType.RIGHT, fill: 'F1F5F9' }),
    ],
  });

  const itemRows = po.items.map((item, index) => new TableRow({
    children: [
      cell([[run(String(index + 1), { color: '64748B' })]], 700, { align: AlignmentType.CENTER }),
      cell([
        [run(item.name, { bold: true })],
        [run(item.spec, { size: 16, color: '64748B' })],
      ], 4200),
      cell([[run(item.unit)]], 800, { align: AlignmentType.CENTER }),
      cell([[run(item.orderQty.toLocaleString(), { bold: true })]], 1200, { align: AlignmentType.RIGHT }),
      cell([[run(item.unitPrice.toLocaleString())]], 1400, { align: AlignmentType.RIGHT }),
      cell([[run(item.totalPrice.toLocaleString(), { bold: true })]], 1600, { align: AlignmentType.RIGHT }),
    ],
  }));

  const totalRow = (label: string, amount: string, fill?: string, color = '334155') => new TableRow({
    children: [
      new TableCell({
        columnSpan: 5,
        width: { size: 8300, type: WidthType.DXA },
        borders: { ...box, top: thick },
        shading: fill ? { type: ShadingType.CLEAR, fill } : { type: ShadingType.CLEAR, fill: 'F8FAFC' },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [paragraph([run(label, { bold: true, color })], AlignmentType.RIGHT)],
      }),
      cell([[run(amount, { bold: true, color: fill ? 'BA1B2D' : '0F172A' })]], 1600, {
        align: AlignmentType.RIGHT,
        fill: fill ?? 'F8FAFC',
        borders: { ...box, top: thick },
      }),
    ],
  });

  const items = new Table({
    width: { size: 9900, type: WidthType.DXA },
    rows: [
      itemHeader,
      ...itemRows,
      totalRow('공급가액 소계:', `${po.totalAmount.toLocaleString()}원`),
      totalRow('부가가치세 (10%):', `${po.vatAmount.toLocaleString()}원`),
      totalRow('총 발주 금액 (부가세 포함):', `${po.grandTotal.toLocaleString()}원`, 'FFF1F2', '9F1239'),
    ],
  });

  const footer = new Table({
    width: { size: 9900, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          cell(
            po.terms.map((term) => [run(term.replace(/\s*\n\s*/g, ' '), { size: 15, color: '475569' })]),
            7900,
            { borders: noBorder },
          ),
          cell([
            [run(po.stampLabel, { size: 16, color: '64748B' })],
            [run(po.stampOrg, { bold: true })],
            [run(po.stampMark, { bold: true, color: 'E11D48' })],
          ], 2000, { align: AlignmentType.CENTER, fill: 'F8FAFC', borders: box }),
        ],
      }),
    ],
  });

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children: [
        header,
        paragraph([run(' ')]),
        parties,
        paragraph([run(' ')]),
        items,
        paragraph([run(' ')]),
        new Table({
          width: { size: 9900, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: [
                cell([[run('비고', { bold: true, size: 16 })]], 1400, { fill: 'F8FAFC' }),
                cell(
                  (po.remarks || ' ').split('\n').map((line) => [run(line || ' ', { size: 16 })]),
                  8500,
                ),
              ],
            }),
          ],
        }),
        paragraph([run(' ')]),
        footer,
      ],
    }],
  });
}

export async function downloadPurchaseOrderAsWord(po: PurchaseOrderForm): Promise<void> {
  const blob = await Packer.toBlob(buildPurchaseOrderDocument(po));
  const filename = `${purchaseOrderFileBase(po)}.docx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
