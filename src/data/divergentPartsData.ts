export type DivergentStatus = 'DIVERGENT';

export interface CrossSheetMaterialComparison {
  standardCode: string;
  defaultId: number;
  outdoorSheetName: string;
  indoorSheetName: string;
  mobileSheetName: string;
  status: DivergentStatus;
  statusLabel: string;
  analysis: string;
  solution: string;
}

// 자재 DB의 표준 자재 코드(standardCode)를 키로 하는 원장 시트 간 실제 표기 상이 품목
// ※ 사용자 확인 및 실물 규격 검토에 따라 분리 독립 등록 완료된 항목:
// - PCB 안테나: 옥외 전용 500mm(CB-AT-0001-01)와 실내·이동형 공통 300mm(CB-AT-0001-02)로 분리 완료
// - 비상 경광등: 옥외 24V(OP-WL-0024-01), 실내 12V(OP-WL-0012-01), 이동형 스트로브(OP-WL-0012-02) 3종 분리 완료
// - 볼트/나사: 옥외 M8x16(ME-BT-0816-01), 실내 4T 8x12(ME-SC-0812-01), 이동형 14mm(ME-SC-0014-01) 3종 분리 완료
// - MICRO S/W: 옥외·실내 플런저형 C2(SW-MC-0016-01), 이동형 롤러레버형(SW-MC-0015-01) 분리 완료
//
// 같은 부품인데 원장 품명만 다른 항목만 둔다.
// PCB 안테나(길이별), 비상 경광등, MICRO S/W, 체결 볼트/나사는 서로 다른 부품이라 여기서 관리하지 않는다.
export const CROSS_SHEET_COMPARISON_MAP: Record<string, CrossSheetMaterialComparison> = {};

export interface DivergentPartItem {
  id: number;
  standardCode: string;
  unifiedName: string;
  spec: string;
  supplier: string;
  unitPrice: number;
  usageCount: number;
  status: DivergentStatus;
  statusLabel: string;
  variants: {
    outdoor: string;
    indoor: string;
    mobile: string;
  };
  reason: string;
  effect: string;
}

export type SimilarPartKind = 'NAME_DIFF' | 'SPEC_SPLIT';

export interface SimilarPartMember {
  standardCode: string;
  ledgerNames?: {
    outdoor?: string;
    indoor?: string;
    mobile?: string;
  };
}

export interface SimilarPartGroup {
  id: string;
  label: string;
  kind: SimilarPartKind;
  members: SimilarPartMember[];
  analysis: string;
  solution: string;
}

// 같은 부품의 원장 품명이 다를 때만 추가한다. 지금은 해당 품목이 없다.
export const SIMILAR_PART_GROUPS: SimilarPartGroup[] = [];

export const DIVERGENT_PARTS_LIST: DivergentPartItem[] = Object.values(CROSS_SHEET_COMPARISON_MAP).map(item => ({
  id: item.defaultId,
  standardCode: item.standardCode,
  unifiedName: 'PCB 안테나 (LTE 관제 300mm)',
  spec: 'FPC (LTE) 케이블 300mm',
  supplier: '스타텔랩스',
  unitPrice: 2200,
  usageCount: 2,
  status: item.status,
  statusLabel: item.statusLabel,
  variants: {
    outdoor: item.outdoorSheetName,
    indoor: item.indoorSheetName,
    mobile: item.mobileSheetName,
  },
  reason: item.analysis,
  effect: item.solution,
}));
