import { MaterialItem, ProductCategory } from '../types/inventory';

export type ProductionModel = ProductCategory;

export interface ProductionLinePreview {
  materialId: number;
  name: string;
  spec: string;
  unit: string;
  perUnitQty: number;
  consumeQty: number;
  beforeStock: number;
  afterStock: number;
  isNegative: boolean;
}

export const PRODUCTION_MODEL_LABELS: Record<ProductionModel, string> = {
  outdoor: '옥외보관함',
  indoor: '실내보관함',
  mobile: '이동형보관함',
  lsend: 'L.SEND case',
};

function normalizeProductionUnits(units: number): number {
  const value = Number(units);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

/** 선택 모델 완제품 N대 기준 BOM 소모 미리보기 */
export function computeProductionConsumption(
  materials: MaterialItem[],
  model: ProductionModel,
  productionUnits: number,
): ProductionLinePreview[] {
  const units = normalizeProductionUnits(productionUnits);
  if (units === 0) return [];

  return materials
    .map((item) => {
      const perUnit = Number(item.usedIn?.[model] ?? 0);
      if (perUnit <= 0) return null;

      const consumeQty = units * perUnit;
      const beforeStock = Number(item.currentStock);
      const safeBefore = Number.isFinite(beforeStock) ? beforeStock : 0;
      const afterStock = safeBefore - consumeQty;

      return {
        materialId: item.id,
        name: item.name,
        spec: item.spec,
        unit: item.unit,
        perUnitQty: perUnit,
        consumeQty,
        beforeStock: safeBefore,
        afterStock,
        isNegative: afterStock < 0,
      };
    })
    .filter((line): line is ProductionLinePreview => line !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export function applyProductionToMaterials(
  materials: MaterialItem[],
  model: ProductionModel,
  productionUnits: number,
): MaterialItem[] {
  const lines = computeProductionConsumption(materials, model, productionUnits);
  if (lines.length === 0) return materials;

  const deltaById = new Map(lines.map((line) => [line.materialId, line.consumeQty]));
  const updatedAt = new Date().toISOString();

  return materials.map((item) => {
    const delta = deltaById.get(item.id);
    if (delta === undefined) return item;

    const current = Number(item.currentStock);
    const safeCurrent = Number.isFinite(current) ? current : 0;
    return {
      ...item,
      currentStock: safeCurrent - delta,
      updatedAt,
    };
  });
}
