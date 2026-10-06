import * as XLSX from 'xlsx';

export function downloadExcel(
  rows: Record<string, string | number>[],
  filename: string,
  sheetName: string,
) {
  if (rows.length === 0) {
    alert('저장할 품목이 없습니다.');
    return;
  }

  const sheet = XLSX.utils.json_to_sheet(rows);
  const keys = Object.keys(rows[0]);
  sheet['!cols'] = keys.map(key => ({
    wch: Math.min(
      42,
      Math.max(key.length + 2, ...rows.map(row => String(row[key] ?? '').length)),
    ),
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(book, filename);
}
