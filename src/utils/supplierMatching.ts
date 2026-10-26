import { MaterialItem, SupplierInfo } from '../types/inventory';

/** 발주처 문자열 정규화 (협력사명·자재 DB supplier 비교용) */
function normalizeSupplierKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\([^)]*\)/g, '')
    .replace(/㈜|\(주\)|주식회사|\(유\)/gi, '')
    .replace(/[·.,'"]/g, '')
    .replace(/\s+/g, '');
}

/** "A / B" 형태 복수 발주처를 각각 비교 키로 확장 */
export function expandSupplierAliases(raw: string): string[] {
  const trimmed = (raw || '').trim();
  if (!trimmed) return [];

  const segments = trimmed
    .split(/[/|,，]|\s+\/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const keys = new Set<string>();
  for (const segment of [trimmed, ...segments]) {
    const key = normalizeSupplierKey(segment);
    if (key.length >= 2) {
      keys.add(key);
    }
  }
  return [...keys];
}

/** 자재 DB 발주처(supplier)가 선택 협력사와 동일 업체인지 (정확 키 매칭만) */
export function supplierKeysMatch(materialSupplier: string, supplierName: string): boolean {
  const materialKeys = expandSupplierAliases(materialSupplier);
  const supplierKeys = expandSupplierAliases(supplierName);
  if (materialKeys.length === 0 || supplierKeys.length === 0) {
    return false;
  }
  return materialKeys.some((mk) => supplierKeys.some((sk) => mk === sk));
}

export function getMaterialsBySupplier(
  materials: MaterialItem[],
  supplier: SupplierInfo,
): MaterialItem[] {
  return materials.filter((material) =>
    supplierKeysMatch(material.supplier || '', supplier.name),
  );
}
