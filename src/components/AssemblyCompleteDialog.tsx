import React, { useMemo, useState } from 'react';
import { AssemblyRecord, MaterialItem } from '../types/inventory';
import { ASSEMBLY_PRODUCTS, AssemblyProduct, modelUsage, productById } from '../lib/productModels';

interface AssemblyCompleteDialogProps {
  materials: MaterialItem[];
  records: AssemblyRecord[];
  initialProduct?: AssemblyProduct;
  onClose: () => void;
  onConfirm: (product: AssemblyProduct, quantity: number) => Promise<void>;
  onReverse: (record: AssemblyRecord) => Promise<void>;
}

export const AssemblyCompleteDialog: React.FC<AssemblyCompleteDialogProps> = ({
  materials,
  records,
  initialProduct = 'outdoor',
  onClose,
  onConfirm,
  onReverse,
}) => {
  const [product, setProduct] = useState<AssemblyProduct>(initialProduct);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const preview = useMemo(() => {
    const qty = Number.isFinite(quantity) ? quantity : 0;
    return materials
      .map(item => {
        const perUnit = modelUsage(item, product);
        const deductQty = Math.round(perUnit * qty * 10000) / 10000;
        return {
          id: item.id,
          name: item.name,
          perUnit,
          deductQty,
          currentStock: item.currentStock,
          stockAfter: Math.round((item.currentStock - deductQty) * 10000) / 10000,
        };
      })
      .filter(line => line.perUnit > 0);
  }, [materials, product, quantity]);

  const hasShortage = preview.some(line => line.stockAfter < 0);
  const productName = productById(product).name;

  const handleConfirm = async () => {
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('조립 대수는 1 이상의 정수로 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onConfirm(product, quantity);
      onClose();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : '자재 차감에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleReverse = async (record: AssemblyRecord) => {
    setBusy(true);
    setError('');
    try {
      await onReverse(record);
    } catch {
      setError('차감 취소에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60">
      <div className="flex min-h-full items-start justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4 p-6 border border-slate-200">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-slate-900">자재 일괄 차감</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <label className="text-xs text-slate-600">
            제품
            <select
              value={product}
              onChange={(event) => setProduct(event.target.value as AssemblyProduct)}
              className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-900"
            >
              {ASSEMBLY_PRODUCTS.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            조립 대수
            <input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-900"
            />
          </label>
        </div>

        <div className="max-h-[40vh] overflow-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 w-12 text-center">순번</th>
                <th className="p-2">품목명</th>
                <th className="p-2 text-right">대당 소요</th>
                <th className="p-2 text-right">감소 수량</th>
                <th className="p-2 text-right">현재고</th>
                <th className="p-2 text-right">차감 후</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((line, index) => (
                <tr key={line.id} className="border-t border-slate-100">
                  <td className="p-2 text-center font-mono text-slate-400">{index + 1}</td>
                  <td className="p-2">{line.name}</td>
                  <td className="p-2 text-right font-mono">{line.perUnit}</td>
                  <td className="p-2 text-right font-mono">{line.deductQty}</td>
                  <td className="p-2 text-right font-mono">{line.currentStock}</td>
                  <td className={`p-2 text-right font-mono ${line.stockAfter < 0 ? 'text-rose-600 font-bold' : ''}`}>{line.stockAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasShortage && (
          <p className="mt-2 text-xs text-rose-600">차감 후 재고가 0보다 작아지는 품목이 있습니다. 차감은 그대로 진행할 수 있습니다.</p>
        )}
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy || preview.length === 0}
          className="mt-4 w-full py-2 rounded-lg bg-[#BA1B2D] text-white text-sm font-bold disabled:opacity-50"
        >
          {productName} {Number.isFinite(quantity) ? quantity : 0}대 재고 차감
        </button>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-bold text-slate-900">최근 차감</h3>
          <p className="mt-1 text-[11px] text-slate-500">취소하면 그 차감에서 줄인 수량만 현재고에 다시 더합니다.</p>
          {records.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">저장된 차감 기록이 없습니다.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {records.map(record => (
                <li key={record.id} className="flex items-center justify-between gap-3 text-xs border border-slate-200 rounded-lg px-3 py-2">
                  <span>
                    {record.productName} {record.quantity}대
                    <span className="ml-2 text-slate-400">{record.createdAt.slice(0, 16).replace('T', ' ')}</span>
                    {record.reversedAt && <span className="ml-2 text-slate-400">취소됨</span>}
                  </span>
                  {!record.reversedAt && (
                    <button
                      type="button"
                      onClick={() => handleReverse(record)}
                      disabled={busy}
                      className="text-[#BA1B2D] font-semibold hover:underline disabled:opacity-50"
                    >
                      취소
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
