import { MaterialItem } from '../types/inventory';

export type AssemblyProduct = 'outdoor' | 'indoor' | 'indoorGeneral' | 'mobile' | 'lsend';
export type ModelFilter = 'ALL' | AssemblyProduct;

export const ASSEMBLY_PRODUCTS: { id: AssemblyProduct; name: string; usageLabel: string }[] = [
  { id: 'outdoor', name: '옥외보관함', usageLabel: '옥외 대당 소요' },
  { id: 'indoor', name: '스마트 실내보관함', usageLabel: '스마트 실내 대당 소요' },
  { id: 'indoorGeneral', name: '일반 실내보관함', usageLabel: '일반 실내 대당 소요' },
  { id: 'mobile', name: '이동형보관함', usageLabel: '이동형 대당 소요' },
  { id: 'lsend', name: 'L.SEND case', usageLabel: 'L.SEND 대당 소요' },
];

export function productById(id: AssemblyProduct) {
  const product = ASSEMBLY_PRODUCTS.find(item => item.id === id);
  if (!product) {
    throw new Error(`알 수 없는 제품입니다: ${id}`);
  }
  return product;
}

export function modelUsage(item: MaterialItem, model: AssemblyProduct): number {
  const value = Number(item.usedIn?.[model]);
  return Number.isFinite(value) ? value : 0;
}

export const GENERAL_INDOOR_ITEM_NAMES = [
  'MICRO S/W (문열림 - 플런저형)',
  '9V 배터리 케이스 / 홀더',
  'Toggle S/W',
  '하네스 경광등 조립',
  '하네스 배터리홀더(스마트기준)',
  '9V 건전지',
  '비상 경광등 (12V 소형 점멸)',
] as const;
