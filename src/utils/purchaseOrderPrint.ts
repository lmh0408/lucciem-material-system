const PRINT_ROOT_ID = 'po-print-root';
const PRINT_MODE_CLASS = 'po-print-mode';

const PAGE_MARGIN_MM = 8;
const CSS_PX_PER_MM = 96 / 25.4;
const PRINTABLE_WIDTH = (210 - PAGE_MARGIN_MM * 2) * CSS_PX_PER_MM;
const PRINTABLE_HEIGHT = (297 - PAGE_MARGIN_MM * 2) * CSS_PX_PER_MM;

function copyControlValues(root: ParentNode) {
  root.querySelectorAll('input, textarea').forEach((control) => {
    if (control instanceof HTMLInputElement) {
      control.setAttribute('value', control.value);
      if (control.checked) control.setAttribute('checked', '');
    }
    if (control instanceof HTMLTextAreaElement) {
      control.textContent = control.value;
    }
  });
}

function preparePrintClone(source: HTMLElement) {
  copyControlValues(source);
  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.print\\:hidden, .pdf-export-hidden').forEach((node) => node.remove());
  clone.querySelectorAll('tfoot td[colspan]').forEach((cell) => {
    cell.setAttribute('colspan', '5');
  });
  clone.querySelectorAll('input, textarea, button').forEach((control) => {
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
      control.readOnly = true;
      control.tabIndex = -1;
    }
  });
  return clone;
}

function fitPurchaseOrderToPage(sheet: HTMLElement) {
  sheet.style.zoom = '1';
  sheet.style.width = `${PRINTABLE_WIDTH}px`;
  const height = sheet.scrollHeight || sheet.offsetHeight || PRINTABLE_HEIGHT;
  const scale = Math.min(1, PRINTABLE_HEIGHT / height);
  sheet.style.zoom = String(Math.max(scale, 0.42));
}

export function printPurchaseOrderDocument(orderNumber: string) {
  const source = document.getElementById('purchase-order-document');
  if (!(source instanceof HTMLElement)) return;

  document.getElementById(PRINT_ROOT_ID)?.remove();

  const sheet = preparePrintClone(source);
  const host = document.createElement('div');
  host.id = PRINT_ROOT_ID;
  host.setAttribute('aria-hidden', 'true');
  host.appendChild(sheet);
  document.body.appendChild(host);
  fitPurchaseOrderToPage(sheet);

  const previousTitle = document.title;
  document.title = `자재발주서_${orderNumber}`;
  document.body.classList.add(PRINT_MODE_CLASS);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.body.classList.remove(PRINT_MODE_CLASS);
    document.title = previousTitle;
    host.remove();
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  window.setTimeout(() => {
    fitPurchaseOrderToPage(sheet);
    window.print();
  }, 0);
}
