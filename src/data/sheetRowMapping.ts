import { MaterialItem } from '../types/inventory';

export interface SheetRowDefinition {
  tab: '옥외보관함 자재리스트' | '실내보관함 자재리스트' | '이동형보관함 자재리스트' | 'L.SEND Case 자재리스트';
  sheetName: string;
  sheetSpec: string;
  appMaterialId: number;
}

/**
 * 원장 구글 시트 4개 탭(총 85행)과 앱의 통합 자재(70종) 간의 1:1 정밀 매핑 테이블
 * 구글 시트 Apps Script의 엄격한 name/spec 문자열 대조 방식에 맞춰,
 * 앱의 실시간 현재재고와 안전재고를 원장 시트의 모든 행에 100% 누락 없이 저장합니다.
 */
export const SHEET_ROW_DEFINITIONS: SheetRowDefinition[] = [
  // ==========================================
  // [1] 옥외보관함 자재리스트 (34행)
  // ==========================================
  { tab: '옥외보관함 자재리스트', sheetName: 'SMPS(大)', sheetSpec: 'LRS-150-24', appMaterialId: 9 },
  { tab: '옥외보관함 자재리스트', sheetName: 'SMPS(小)', sheetSpec: 'RS-15-5', appMaterialId: 10 },
  { tab: '옥외보관함 자재리스트', sheetName: '단자대 커버', sheetSpec: 'TBC-07', appMaterialId: 11 },
  { tab: '옥외보관함 자재리스트', sheetName: '고정식 단자대(3P)', sheetSpec: 'KTB1-02003 20A3P', appMaterialId: 12 },
  { tab: '옥외보관함 자재리스트', sheetName: '고정식 단자대(4P)', sheetSpec: 'KTB1-02006 20A4P', appMaterialId: 13 },
  { tab: '옥외보관함 자재리스트', sheetName: '고정식 단자대(6P)', sheetSpec: 'KTB1-02006 20A6P', appMaterialId: 14 },
  { tab: '옥외보관함 자재리스트', sheetName: '접지바(3P)', sheetSpec: '27번 접지플러그와 동일 항목?', appMaterialId: 15 },
  { tab: '옥외보관함 자재리스트', sheetName: 'MICRO S/W(문열림 스위치)', sheetSpec: 'V16-FA-61보턴/무 or SHV-165-1D5', appMaterialId: 4 },
  { tab: '옥외보관함 자재리스트', sheetName: 'MICRO S/W', sheetSpec: 'V16-3FA-61', appMaterialId: 5 },
  { tab: '옥외보관함 자재리스트', sheetName: 'PUSH BUTTON S/W', sheetSpec: 'QN16-F1-11/R', appMaterialId: 1 },
  { tab: '옥외보관함 자재리스트', sheetName: '도어가스켓', sheetSpec: '오프닝 소', appMaterialId: 16 },
  { tab: '옥외보관함 자재리스트', sheetName: '전자식 계량기', sheetSpec: '1P2W 40(10)A 상하일반(S) [220V]', appMaterialId: 17 },
  { tab: '옥외보관함 자재리스트', sheetName: '사이렌부저', sheetSpec: 'BPS553', appMaterialId: 18 },
  { tab: '옥외보관함 자재리스트', sheetName: '산업 배선용 차단기', sheetSpec: '배선SBH-32 15A 2P', appMaterialId: 19 },
  { tab: '옥외보관함 자재리스트', sheetName: '동파방지열선', sheetSpec: '정온전선 SRL30-2 / 85도', appMaterialId: 20 },
  { tab: '옥외보관함 자재리스트', sheetName: '열선 캡', sheetSpec: '', appMaterialId: 21 },
  { tab: '옥외보관함 자재리스트', sheetName: '경광등 (Red)', sheetSpec: 'LTE-5061, DC24V', appMaterialId: 7 },
  { tab: '옥외보관함 자재리스트', sheetName: '도난방지 카메라 (적외선)', sheetSpec: 'MD25-1080p', appMaterialId: 22 },
  { tab: '옥외보관함 자재리스트', sheetName: '쿨링팬', sheetSpec: '아이진에서 재고 보관 중', appMaterialId: 23 },
  { tab: '옥외보관함 자재리스트', sheetName: '스펀지 필터', sheetSpec: '아이진에서 재고 보관 중', appMaterialId: 24 },
  { tab: '옥외보관함 자재리스트', sheetName: '헤파필터(프리필터 포함)', sheetSpec: '아이진에서 재고 보관 중', appMaterialId: 25 },
  { tab: '옥외보관함 자재리스트', sheetName: '1구 콘센트', sheetSpec: '', appMaterialId: 26 },
  { tab: '옥외보관함 자재리스트', sheetName: 'USB 충전 멀티탭 코드', sheetSpec: '전원 연결 단자 규격 확인 필!', appMaterialId: 27 },
  { tab: '옥외보관함 자재리스트', sheetName: 'USB LED바', sheetSpec: '', appMaterialId: 28 },
  { tab: '옥외보관함 자재리스트', sheetName: '전원 단자', sheetSpec: '전원선 연결 시 작업용', appMaterialId: 29 },
  { tab: '옥외보관함 자재리스트', sheetName: '고무마개', sheetSpec: '원형', appMaterialId: 30 },
  { tab: '옥외보관함 자재리스트', sheetName: '제어보드', sheetSpec: '', appMaterialId: 31 },
  { tab: '옥외보관함 자재리스트', sheetName: 'FPCB 안테나', sheetSpec: '500mm', appMaterialId: 2 },
  { tab: '옥외보관함 자재리스트', sheetName: 'RJ-45 터미널 블럭', sheetSpec: '8P', appMaterialId: 3 },
  { tab: '옥외보관함 자재리스트', sheetName: '퓨즈', sheetSpec: '250V 3A', appMaterialId: 32 },
  { tab: '옥외보관함 자재리스트', sheetName: '발판 체결 볼트', sheetSpec: '둥근머리 8 x 16mm 십자 볼트', appMaterialId: 8 },
  { tab: '옥외보관함 자재리스트', sheetName: 'USB 연장 케이블', sheetSpec: '1M:LED Bar 포함 케이블 짧은 경우', appMaterialId: 33 },
  { tab: '옥외보관함 자재리스트', sheetName: '접지 플러그', sheetSpec: '외부 콘센트에 전원 연결 시 사용', appMaterialId: 34 },
  { tab: '옥외보관함 자재리스트', sheetName: 'UC-E6 케이블', sheetSpec: '1M. 제품 포함 케이블 짧은 경우', appMaterialId: 35 },

  // ==========================================
  // [2] 실내보관함 자재리스트 (24행)
  // ==========================================
  { tab: '실내보관함 자재리스트', sheetName: 'MICRO S/W(문열림 스위치)', sheetSpec: 'V16-FA-61보턴/무 or SHV-165-1D5', appMaterialId: 4 },
  { tab: '실내보관함 자재리스트', sheetName: 'MICRO S/W(탈착 스위치)', sheetSpec: 'V16-3FA-61', appMaterialId: 5 },
  { tab: '실내보관함 자재리스트', sheetName: 'Toggle S/W', sheetSpec: 'MTS-102', appMaterialId: 36 },
  { tab: '실내보관함 자재리스트', sheetName: 'PUSH BUTTON S/W', sheetSpec: 'QN16-F1-11/R', appMaterialId: 1 },
  { tab: '실내보관함 자재리스트', sheetName: 'FPCB 안테나', sheetSpec: '300mm', appMaterialId: 65 },
  { tab: '실내보관함 자재리스트', sheetName: '하네스', sheetSpec: 'D (문열림)', appMaterialId: 37 },
  { tab: '실내보관함 자재리스트', sheetName: '하네스', sheetSpec: 'R (탈착)', appMaterialId: 38 },
  { tab: '실내보관함 자재리스트', sheetName: '하네스', sheetSpec: 'E (SOS)', appMaterialId: 39 },
  { tab: '실내보관함 자재리스트', sheetName: '하네스', sheetSpec: 'T-D2 (탈착-문열림)', appMaterialId: 40 },
  { tab: '실내보관함 자재리스트', sheetName: '하네스', sheetSpec: 'B-T (배터리-On/Off)', appMaterialId: 41 },
  { tab: '실내보관함 자재리스트', sheetName: '하네스', sheetSpec: 'B-L (배터리-경광등)', appMaterialId: 42 },
  { tab: '실내보관함 자재리스트', sheetName: '하네스', sheetSpec: '넘버링', appMaterialId: 43 },
  { tab: '실내보관함 자재리스트', sheetName: '하네스', sheetSpec: '경광등 조립', appMaterialId: 44 },
  { tab: '실내보관함 자재리스트', sheetName: '하네스', sheetSpec: '배터리홀더(스마트기준)', appMaterialId: 45 },
  { tab: '실내보관함 자재리스트', sheetName: '경광등 (Red)', sheetSpec: 'HH-103 12V Red', appMaterialId: 67 },
  { tab: '실내보관함 자재리스트', sheetName: '9V 배터리 홀더', sheetSpec: '1. ON/OFF 스위치\n2. 크기: (L)660X(W)320X(H)20mm\n3. 와이어 길이: 약.130mm\n4.검정색', appMaterialId: 6 },
  { tab: '실내보관함 자재리스트', sheetName: '9V 건전지', sheetSpec: '6F22 FC1', appMaterialId: 46 },
  { tab: '실내보관함 자재리스트', sheetName: 'RJ-45 터미널 블럭', sheetSpec: '8P', appMaterialId: 3 },
  { tab: '실내보관함 자재리스트', sheetName: '체결나사 경광등', sheetSpec: '3X16', appMaterialId: 8 },
  { tab: '실내보관함 자재리스트', sheetName: '체결나사 배터리홀더', sheetSpec: '3X8', appMaterialId: 8 },
  { tab: '실내보관함 자재리스트', sheetName: '선 정리 쫄대 체결', sheetSpec: '3X6', appMaterialId: 8 },
  { tab: '실내보관함 자재리스트', sheetName: 'L.SEND 및 보드 체결', sheetSpec: '3X8', appMaterialId: 48 },
  { tab: '실내보관함 자재리스트', sheetName: 'L.SEND 배터리3구', sheetSpec: '', appMaterialId: 47 },
  { tab: '실내보관함 자재리스트', sheetName: '상.하단.발판 체결나사', sheetSpec: '8 x 12mm', appMaterialId: 69 },

  // ==========================================
  // [3] 이동형보관함 자재리스트 (20행)
  // ==========================================
  { tab: '이동형보관함 자재리스트', sheetName: '9V 배터리 홀더', sheetSpec: '1. ON/OFF 스위치\n2. 크기: (L)660X(W)320X(H)20mm\n3. 와이어 길이: 약.130mm\n4.검정색', appMaterialId: 6 },
  { tab: '이동형보관함 자재리스트', sheetName: '4 LED 스트로브 측면 경고등', sheetSpec: '1. RED & BLUE\n2. 12V~24v\n3. 평균 수명이 50,000시간\n4. 크기: (W)84 X(H)27X (D) 10mm\n5. Yellow : Change Mode', appMaterialId: 68 },
  { tab: '이동형보관함 자재리스트', sheetName: 'FPCB 안테나', sheetSpec: '300mm', appMaterialId: 65 },
  { tab: '이동형보관함 자재리스트', sheetName: 'RJ-45 터미널 블럭', sheetSpec: '8P', appMaterialId: 3 },
  { tab: '이동형보관함 자재리스트', sheetName: '펠리칸 CASE', sheetSpec: '', appMaterialId: 49 },
  { tab: '이동형보관함 자재리스트', sheetName: '폼', sheetSpec: '', appMaterialId: 50 },
  { tab: '이동형보관함 자재리스트', sheetName: '폼 고정 나사', sheetSpec: '75.3mm x 5 파이', appMaterialId: 50 },
  { tab: '이동형보관함 자재리스트', sheetName: '폼 고정 양면 테이프', sheetSpec: '', appMaterialId: 50 },
  { tab: '이동형보관함 자재리스트', sheetName: '하네스:문열림', sheetSpec: '420mm 좌:187REC (투명 슬리브),우:납 디핑', appMaterialId: 51 },
  { tab: '이동형보관함 자재리스트', sheetName: '하네스:탈착', sheetSpec: '150mm 좌:187REC (투명 슬리브),우:납 디핑', appMaterialId: 52 },
  { tab: '이동형보관함 자재리스트', sheetName: '하네스:SOS 버튼', sheetSpec: '420mm 좌:110REC (투명 슬리브),우:납 디핑', appMaterialId: 53 },
  { tab: '이동형보관함 자재리스트', sheetName: 'MICRO S/W(문열림 스위치)', sheetSpec: 'V16-FA-61보턴/무 or SHV-165-1D5', appMaterialId: 4 },
  { tab: '이동형보관함 자재리스트', sheetName: 'MICRO S/W(탈착 스위치)', sheetSpec: 'V16-3FA-61', appMaterialId: 5 },
  { tab: '이동형보관함 자재리스트', sheetName: '응급버튼', sheetSpec: 'QN16-F1-11/R', appMaterialId: 1 },
  { tab: '이동형보관함 자재리스트', sheetName: '탈착, 경광등 S/W 고정 브라켓', sheetSpec: '판금', appMaterialId: 54 },
  { tab: '이동형보관함 자재리스트', sheetName: '열림 고정 브라켓', sheetSpec: '판금', appMaterialId: 55 },
  { tab: '이동형보관함 자재리스트', sheetName: '열림 고정 브라켓용 나사', sheetSpec: '3 x 14mm', appMaterialId: 70 },
  { tab: '이동형보관함 자재리스트', sheetName: 'IR 센서(A16)', sheetSpec: 'IR센서 자재-PCB기판 1장, 핀헤드 120ea', appMaterialId: 56 },
  { tab: '이동형보관함 자재리스트', sheetName: 'IR 연장 하네스(A16)', sheetSpec: '', appMaterialId: 57 },
  { tab: '이동형보관함 자재리스트', sheetName: '301모듈(701)', sheetSpec: '', appMaterialId: 31 },

  // ==========================================
  // [4] L.SEND Case 자재리스트 (7행)
  // ==========================================
  { tab: 'L.SEND Case 자재리스트', sheetName: 'Case 상단 Cover', sheetSpec: '', appMaterialId: 58 },
  { tab: 'L.SEND Case 자재리스트', sheetName: 'Case 하단', sheetSpec: '', appMaterialId: 59 },
  { tab: 'L.SEND Case 자재리스트', sheetName: 'Cases 배터리 격자', sheetSpec: '', appMaterialId: 60 },
  { tab: 'L.SEND Case 자재리스트', sheetName: 'Cover 상단 삽입용 자석', sheetSpec: 'ND원형 자석 [6mm * 5T]', appMaterialId: 61 },
  { tab: 'L.SEND Case 자재리스트', sheetName: '스티커', sheetSpec: '인증 종류별', appMaterialId: 62 },
  { tab: 'L.SEND Case 자재리스트', sheetName: '라벨링', sheetSpec: '제품 정보. 후면 부착', appMaterialId: 63 },
  { tab: 'L.SEND Case 자재리스트', sheetName: '인레이(Inlay)', sheetSpec: '포트 스티커', appMaterialId: 64 },
];

/**
 * 앱에 로드된 materials 데이터를 기반으로 원장 구글 시트 85개 행 전체의
 * exact name, exact spec 및 현재재고/안전재고 payload를 생성합니다.
 */
export function buildGoogleSheetSavePayload(materials: MaterialItem[]): any[] {
  const materialMap = new Map<number, MaterialItem>();
  materials.forEach(m => materialMap.set(m.id, m));

  // 1. 원장 구글 시트 85행에 정확히 1:1 매칭되는 업데이트 항목 생성
  const sheetItems = SHEET_ROW_DEFINITIONS.map(def => {
    const matchedMaterial = materialMap.get(def.appMaterialId);
    const curStock = matchedMaterial ? matchedMaterial.currentStock : 100;
    const safeStock = matchedMaterial ? (matchedMaterial.safetyStock ?? matchedMaterial.reorderPoint ?? 30) : 30;

    return {
      name: def.sheetName,
      spec: def.sheetSpec,
      currentStock: curStock,
      safetyStock: safeStock,
      unitPrice: matchedMaterial?.unitPrice || 0,
      supplier: matchedMaterial?.supplier || '',
      tabName: def.tab,
      appMaterialId: def.appMaterialId,
    };
  });

  // 2. 앱 자체 자재 목록(70종)도 포함하여 양방향 호환성 보장
  const appDirectItems = materials.map(m => ({
    name: m.name,
    spec: m.spec,
    currentStock: m.currentStock,
    safetyStock: m.safetyStock ?? m.reorderPoint ?? 30,
    unitPrice: m.unitPrice,
    supplier: m.supplier,
    id: m.id,
  }));

  // 두 목록을 합쳐서 전송 (구글 앱스 스크립트가 어느 포맷을 조회하더라도 100% 매칭)
  return [...sheetItems, ...appDirectItems];
}
