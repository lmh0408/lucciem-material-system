import { MaterialItem } from '../types/inventory';

export type StockModelView = 'ALL' | 'outdoor' | 'indoor' | 'mobile' | 'lsend';

const MODEL_KEYS = ['outdoor', 'indoor', 'mobile', 'lsend'] as const;

function perModelSafetyStock(item: MaterialItem): number {
  const value = Number(item.safetyStock);
  return Number.isFinite(value) ? value : 0;
}

export function applicableModelCount(item: MaterialItem): number {
  return MODEL_KEYS.filter((key) => (item.usedIn?.[key] ?? 0) > 0).length;
}

/** 2개 이상 모델에 투입되는 공통 품목 — 창고·안전재고 표시·상태를 탭과 무관하게 동일하게 */
export function isSharedStockMaterial(item: MaterialItem): boolean {
  if (item.isCommon) return true;
  return applicableModelCount(item) >= 2;
}

/**
 * 안전 재고 표시
 * - 전체 모델: 사용 모델 수 × 모델당 안전재고 (공통 품목 포함 합산)
 * - 개별 모델·공통 품목: 원장 safetyStock 1값 (탭 간 동일)
 * - 개별 모델·전용 품목: 그 모델 기준
 */
export function displayedSafetyStock(item: MaterialItem, model: StockModelView): number {
  const perModel = perModelSafetyStock(item);
  if (model === 'ALL') {
    return perModel * applicableModelCount(item);
  }
  if (isSharedStockMaterial(item)) {
    return perModel;
  }
  return (item.usedIn?.[model] ?? 0) > 0 ? perModel : 0;
}

export function displayedCurrentStock(item: MaterialItem): number {
  const value = Number(item.currentStock);
  return Number.isFinite(value) ? value : 0;
}

export type StockStatus = 'ORDER_NEEDED' | 'WARNING' | 'NORMAL';

/**
 * 화면 안전재고 기준
 * - 적정: 현재 재고가 안전재고의 100% 이상
 * - 재고 주의: 안전재고의 50% 이상, 100% 미만
 * - 발주 필요: 현재 재고가 안전재고의 50% 미만
 */
export function stockStatus(currentStock: number, safetyStock: number): StockStatus {
  const current = Number.isFinite(currentStock) ? currentStock : 0;
  const safety = Number.isFinite(safetyStock) ? safetyStock : 0;
  if (current >= safety) return 'NORMAL';
  if (current < safety * 0.5) return 'ORDER_NEEDED';
  return 'WARNING';
}
