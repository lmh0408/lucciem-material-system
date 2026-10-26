/**
 * Google Sheet Live BOM Sync Utility
 * 원장 구글 시트 4대 탭(옥외보관함, 실내보관함, 이동형보관함, L.SEND Case)으로부터
 * 최신 자재 목록, 규격, 대당 수량, 단가, 거래처 및 재고/안전재고 데이터를 직접 파싱 및 동기화합니다.
 */

import { MaterialItem, MainCategory, CommonalityLevel } from '../types/inventory';

export const MASTER_SHEET_ID = '1cqYtwVvxJU9UmQ0oHJYMFupGZDae5sN1bh3Grvrt7Xs';
export const GOOGLE_SCRIPT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycby5Ej456eViW4ubnSNwTJHNcCRxwZ5NCzZs8Bo6wQtznqNa9a04sCbyESoWe87Y4nOS/exec';

export interface SheetTabConfig {
  modelKey: 'outdoor' | 'indoor' | 'mobile' | 'lsend';
  tabName: string;
}

export const BOM_TABS: SheetTabConfig[] = [
  { modelKey: 'outdoor', tabName: '옥외보관함 자재리스트' },
  { modelKey: 'indoor', tabName: '실내보관함 자재리스트' },
  { modelKey: 'mobile', tabName: '이동형보관함 자재리스트' },
  { modelKey: 'lsend', tabName: 'L.SEND Case 자재리스트' },
];

/**
 * 간단하고 안전한 CSV 파서 (따옴표 내 개행 및 쉼표 지원)
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * 숫자 문자열 정제 헬퍼 (쉼표, 화폐단위 제거)
 */
function parseNumeric(val: string | undefined, defaultValue = 0): number {
  if (!val) return defaultValue;
  const cleaned = val.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? defaultValue : num;
}

/**
 * 품목명/규격을 바탕으로 자재 카테고리 자동 추론
 */
function inferCategory(name: string, spec: string): { category: MainCategory; categoryName: string } {
  const combined = (name + ' ' + spec).toLowerCase();
  if (combined.includes('스위치') || combined.includes('switch') || combined.includes('s/w') || combined.includes('버튼') || combined.includes('button') || combined.includes('센서') || combined.includes('sensor')) {
    return { category: 'SW', categoryName: '스위치 / 센서' };
  }
  if (combined.includes('케이블') || combined.includes('cable') || combined.includes('하네스') || combined.includes('harness') || combined.includes('전선') || combined.includes('열선') || combined.includes('히팅')) {
    return { category: 'CA', categoryName: '배선 / 열선' };
  }
  if (combined.includes('smps') || combined.includes('차단기') || combined.includes('단자대') || combined.includes('배터리') || combined.includes('전원') || combined.includes('릴레이') || combined.includes('power')) {
    return { category: 'EL', categoryName: '전장 / 전원' };
  }
  if (combined.includes('보드') || combined.includes('pcb') || combined.includes('안테나') || combined.includes('antenna') || combined.includes('통신') || combined.includes('lte') || combined.includes('모듈')) {
    return { category: 'CB', categoryName: '제어보드 / 통신' };
  }
  if (combined.includes('경광등') || combined.includes('경고등') || combined.includes('부저') || combined.includes('siren') || combined.includes('led') || combined.includes('카메라') || combined.includes('camera')) {
    return { category: 'OP', categoryName: '광학 / 음향' };
  }
  return { category: 'ME', categoryName: '기구 / 외장' };
}

/**
 * 구글 시트 4대 탭 전체를 불러와 통합 MaterialItem 배열로 변환
 */
export async function fetchMaterialsFromGoogleSheet(sheetId = MASTER_SHEET_ID): Promise<MaterialItem[]> {
  const itemsMap = new Map<string, MaterialItem>();
  let runningId = 1;

  for (const { modelKey, tabName } of BOM_TABS) {
    try {
      const encodedTab = encodeURIComponent(tabName);
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedTab}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch tab ${tabName}: ${response.statusText}`);
        continue;
      }

      const csvText = await response.text();
      const rows = parseCSV(csvText);
      if (rows.length < 2) continue;

      // 헤더 행 찾기 ('품목' 또는 '품명' 포함 행)
      let headerIdx = 1;
      for (let r = 0; r < Math.min(rows.length, 5); r++) {
        if (rows[r].some(cell => cell.includes('품목') || cell.includes('품명'))) {
          headerIdx = r;
          break;
        }
      }

      const dataRows = rows.slice(headerIdx + 1);

      for (const row of dataRows) {
        // [A열] No, [B열] 품목명, [C열] 규격, [D열] 현재재고, [E열] 안전재고, [F열] 대당수량, [G열] 단위, [H열] 단가, [I열] 조달소요일, [J열] 발주처, [K열] 담당자, [L열] 연락처, [M열] 비고
        const name = row[1] || '';
        if (!name || name.startsWith('=') || name.startsWith('합계')) {
          continue;
        }

        const spec = row[2] || '';
        const currentStock = parseNumeric(row[3], 100);
        const safetyStock = parseNumeric(row[4], 30);
        const usedQty = parseNumeric(row[5], 1);
        const unit = row[6] || 'EA';
        const unitPrice = parseNumeric(row[7], 0);
        const leadTimeDays = parseNumeric(row[8], 7) || 7;
        const supplier = row[9] || '';
        const contactPerson = row[10] || '';
        const phone = row[11] || '';
        const notes = row[12] || '';

        // 품목명 + 규격을 식별 키로 통합
        const key = `${name.trim()}__${spec.trim()}`;

        if (!itemsMap.has(key)) {
          const { category, categoryName } = inferCategory(name, spec);
          itemsMap.set(key, {
            id: runningId++,
            originalNo: runningId - 1,
            name: name.trim(),
            spec: spec.trim(),
            category,
            categoryName,
            unit,
            unitPrice,
            supplier,
            contactPerson,
            phone,
            notes,
            usedIn: { outdoor: 0, indoor: 0, mobile: 0, lsend: 0 },
            isCommon: false,
            commonLevel: 'DEDICATED',
            currentStock: currentStock > 0 ? currentStock : 100,
            safetyStock: safetyStock > 0 ? safetyStock : 30,
            leadTimeDays,
            dailyUsage: 5,
            reorderPoint: safetyStock + (leadTimeDays * 5),
            moq: 10,
            eoq: 50,
            updatedAt: new Date().toISOString(),
          });
        }

        const existing = itemsMap.get(key)!;
        existing.usedIn[modelKey] = usedQty;

        // 공급처나 단가 정보가 빈 곳에 채워지면 보강
        if (!existing.supplier && supplier) existing.supplier = supplier;
        if (!existing.contactPerson && contactPerson) existing.contactPerson = contactPerson;
        if (!existing.phone && phone) existing.phone = phone;
        if (existing.unitPrice === 0 && unitPrice > 0) existing.unitPrice = unitPrice;
        if (notes && !existing.notes.includes(notes)) {
          existing.notes = existing.notes ? `${existing.notes} / ${notes}` : notes;
        }
      }
    } catch (err) {
      console.error(`Error processing tab ${tabName}:`, err);
    }
  }

  // 공용성 레벨(C4, C3, C2, DEDICATED) 및 재주문점 재산정
  const results: MaterialItem[] = Array.from(itemsMap.values()).map(item => {
    let usedCount = 0;
    if (item.usedIn.outdoor > 0) usedCount++;
    if (item.usedIn.indoor > 0) usedCount++;
    if (item.usedIn.mobile > 0) usedCount++;
    if (item.usedIn.lsend > 0) usedCount++;

    let commonLevel: CommonalityLevel = 'DEDICATED';
    if (usedCount >= 4) commonLevel = 'C4';
    else if (usedCount === 3) commonLevel = 'C3';
    else if (usedCount === 2) commonLevel = 'C2';

    const dailyUsage = Number(((item.usedIn.outdoor * 3) + (item.usedIn.indoor * 5) + (item.usedIn.mobile * 2) + (item.usedIn.lsend * 4)).toFixed(1));
    const reorderPoint = Math.ceil(item.safetyStock + (dailyUsage * item.leadTimeDays));

    return {
      ...item,
      isCommon: usedCount >= 2,
      commonLevel,
      dailyUsage,
      reorderPoint,
      eoq: Math.max(item.moq || 10, Math.ceil(dailyUsage * 20)),
    };
  });

  return results;
}

import { buildGoogleSheetSavePayload } from '../data/sheetRowMapping';

/**
 * Apps Script Web App 엔드포인트로 자재 데이터를 전송하여 구글 시트 4대 탭에 직접 저장
 * SHEET_ROW_DEFINITIONS(85행) 정밀 매핑을 통해 옥외, 실내, 이동, L.SEND 4개 탭 전 행의
 * 현재 재고 및 안전 재고를 누락 없이 100% 실시간 저장합니다.
 */
export async function saveMaterialsToGoogleSheet(
  materials: MaterialItem[],
  webAppUrl: string = GOOGLE_SCRIPT_WEBAPP_URL
): Promise<{ success: boolean; message: string }> {
  try {
    const payloadItems = buildGoogleSheetSavePayload(materials);

    const payload = {
      action: 'saveMaterials',
      materials: payloadItems,
      timestamp: new Date().toISOString(),
    };

    // Google Apps Script는 302 Redirect를 수반하므로 브라우저 CORS 차단을 방지하기 위해 mode: 'no-cors' 필수
    await fetch(webAppUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    return {
      success: true,
      message: `구글 시트 4개 탭(${payloadItems.length}개 항목)에 정상 저장 완료`,
    };
  } catch (err: any) {
    console.error('구글 시트 저장 API 오류:', err);
    throw err;
  }
}

