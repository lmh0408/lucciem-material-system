import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFExportOptions {
  filename?: string;
  onProgress?: (step: string) => void;
}

/**
 * Renders a DOM element to an A4 multi-page PDF and triggers a direct file download.
 * Bypasses iframe sandbox print restrictions completely.
 */
export async function downloadElementAsPDF(
  elementId: string,
  options: PDFExportOptions = {}
): Promise<boolean> {
  const {
    filename = '루씨엠_스마트통합자재관리_제안서.pdf',
    onProgress
  } = options;

  const targetElement = document.getElementById(elementId);
  if (!targetElement) {
    console.error(`Target element #${elementId} not found`);
    return false;
  }

  try {
    if (onProgress) onProgress('문서 렌더링 준비 중...');

    // Save current scroll position
    const prevScrollY = window.scrollY;
    window.scrollTo(0, 0);

    // Hide any elements with .print:hidden during canvas rendering
    const hiddenElements = targetElement.querySelectorAll('.print\\:hidden') as NodeListOf<HTMLElement>;
    const originalDisplays: string[] = [];
    hiddenElements.forEach((el, idx) => {
      originalDisplays[idx] = el.style.display;
      el.style.display = 'none';
    });

    if (onProgress) onProgress('고해상도 이미지 변환 중 (Canvas)...');

    const canvas = await html2canvas(targetElement, {
      scale: 1.5, // Crisp resolution without blowing up memory
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
    });

    // Restore hidden elements
    hiddenElements.forEach((el, idx) => {
      el.style.display = originalDisplays[idx] || '';
    });
    window.scrollTo(0, prevScrollY);

    if (onProgress) onProgress('A4 다중 페이지 PDF 구성 중...');

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    // Subsequent pages
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    if (onProgress) onProgress('PDF 다운로드 시작...');
    pdf.save(filename);

    return true;
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    throw error;
  }
}

/**
 * Exports the HTML content as a standalone HTML file that can be opened anywhere and printed.
 */
export function downloadPrintableHTML(elementId: string, filename = '루씨엠_제안서_출력용.html') {
  const targetElement = document.getElementById(elementId);
  if (!targetElement) return false;

  const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>루씨엠 스마트 통합 자재 관리 및 자동 발주 시스템 구축 제안서</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print\\:hidden { display: none !important; }
      @page { size: A4 portrait; margin: 12mm; }
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 p-4 sm:p-8 font-sans">
  <div class="max-w-5xl mx-auto bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200">
    <div class="print:hidden mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
      <span class="text-xs text-[#BA1B2D] font-medium">이 파일은 독립적으로 실행 가능한 오프라인 제안서 문서입니다. 브라우저에서 Ctrl+P (또는 Cmd+P)를 눌러 PDF로 저장하실 수 있습니다.</span>
      <button onclick="window.print()" class="px-3 py-1.5 bg-[#BA1B2D] text-white rounded-lg text-xs font-bold hover:bg-[#a01625]">바로 인쇄하기</button>
    </div>
    ${targetElement.innerHTML}
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
