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
// => 실내 및 이동형 보관함 공통 C2 품목 중 원장 간 명칭 표기 이원화 품목:
export const CROSS_SHEET_COMPARISON_MAP: Record<string, CrossSheetMaterialComparison> = {
  'CB-AT-0001-02': {
    standardCode: 'CB-AT-0001-02',
    defaultId: 65,
    outdoorSheetName: '(미적용 - 500mm 옥외 전용 분리)',
    indoorSheetName: 'PCB 안테나 (300mm, 스타텔랩스)',
    mobileSheetName: 'PCB ANT (300mm, 스타텔랩스)',
    status: 'DIVERGENT',
    statusLabel: '원장 간 표기 차이 (300mm 공통 C2)',
    analysis: '실내 원장("PCB 안테나")과 이동형 원장("PCB ANT")은 명칭 표기만 상이할 뿐 실물 규격(300mm FPC LTE)과 공급사(스타텔랩스)가 동일한 C2 공통 자재입니다.',
    solution: '표준 자재명 "PCB 안테나 (LTE 관제 300mm)"로 일원화하고 실내·이동형 수량을 묶어 발주하여 구매 단가 절감 및 납기를 단축합니다.',
  },
};

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
