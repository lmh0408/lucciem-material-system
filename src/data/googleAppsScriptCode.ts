export const GOOGLE_APPS_SCRIPT_CODE = String.raw`/**
 * 루씨엠 자재 관리 — 구글 원장 단일 저장소 (Apps Script)
 *
 * 1. 원장 스프레드시트 > 확장 프로그램 > Apps Script 에 붙여 넣기
 * 2. 배포 > 새 배포 > 웹 앱 (실행: 본인, 액세스: 모든 사용자)
 * 3. /exec URL 을 앱 설정의 "저장용 웹앱 URL"에 입력
 */
const MATERIALS_SHEET = '자재관리DB';
const SUPPLIERS_SHEET = '협력사관리DB';

const MATERIAL_HEADERS = ['recordUuid', 'id', 'json'];
/** 협력사관리DB — BOM 탭과 같이 원장에서 바로 읽을 수 있는 표 형식 */
const SUPPLIER_HEADERS = [
  'No',
  '협력사 ID',
  '협력사명',
  '담당자',
  '연락처',
  '취급 분류',
  '신뢰등급',
  '평균조달일(일)',
  '연결품목수',
  'recordUuid',
];
const SUPPLIER_COL = {
  NO: 1,
  ID: 2,
  NAME: 3,
  CONTACT: 4,
  PHONE: 5,
  CATEGORY: 6,
  RELIABILITY: 7,
  LEAD_DAYS: 8,
  ITEMS_COUNT: 9,
  RECORD_UUID: 10,
};

/** 4대 제품 BOM 탭 (원장 시트) */
const BOM_TABS = [
  { key: 'outdoor', name: '옥외보관함 자재리스트' },
  { key: 'indoor', name: '실내보관함 자재리스트' },
  { key: 'mobile', name: '이동형보관함 자재리스트' },
  { key: 'lsend', name: 'L.SEND Case 자재리스트' },
];
const BOM_ROW_WIDTH = 13;

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'health';
    var payload = {};
    if (e && e.parameter && e.parameter.payloadB64) {
      var decoded = Utilities.newBlob(Utilities.base64Decode(e.parameter.payloadB64)).getDataAsString('UTF-8');
      payload = JSON.parse(decoded);
    }
    return handleAction(action, payload);
  } catch (error) {
    return jsonResponse({ success: false, message: String(error) });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return fail('', 'POST body가 비어 있습니다. 웹앱 URL과 배포 상태를 확인해 주세요.');
    }
    const payload = JSON.parse(e.postData.contents);
    if (!payload.action) {
      return fail('', 'action 필드가 없습니다.');
    }
    return handleAction(payload.action, payload);
  } catch (error) {
    return fail('', String(error));
  }
}

function ok(action, extra) {
  var body = { success: true, action: action };
  if (extra) {
    Object.keys(extra).forEach(function (key) {
      body[key] = extra[key];
    });
  }
  return jsonResponse(body);
}

function fail(action, message) {
  return jsonResponse({ success: false, action: action || '', message: message });
}

function handleAction(action, payload) {
  ensureSheets();
  switch (action) {
    case 'health':
      return ok('health', { message: 'Lucciem ledger API ready' });
    case 'listMaterials':
      return ok('listMaterials', { materials: listMaterials_() });
    case 'listSuppliers':
      return ok('listSuppliers', { suppliers: listSuppliers_() });
    case 'upsertMaterial':
      return ok('upsertMaterial', { material: upsertMaterial_(payload.material) });
    case 'deleteMaterial':
      deleteMaterial_(payload.id, payload.recordUuid);
      return ok('deleteMaterial');
    case 'upsertSupplier':
      return ok('upsertSupplier', { supplier: upsertSupplier_(payload.supplier) });
    case 'deleteSupplier':
      deleteSupplier_(payload.id, payload.recordUuid);
      return ok('deleteSupplier');
    case 'replaceAllMaterials': {
      var materials = payload.materials || [];
      replaceAllMaterials_(materials);
      return ok('replaceAllMaterials', { count: materials.length });
    }
    case 'replaceAllSuppliers': {
      var suppliers = payload.suppliers || [];
      replaceAllSuppliers_(suppliers);
      return ok('replaceAllSuppliers', { count: suppliers.length });
    }
    case 'saveLedger': {
      var saveMaterials = payload.materials || [];
      var saveSuppliers = payload.suppliers || [];
      replaceAllMaterials_(saveMaterials);
      replaceAllSuppliers_(saveSuppliers);
      return ok('saveLedger', {
        materialCount: saveMaterials.length,
        supplierCount: saveSuppliers.length,
      });
    }
    default:
      return fail(action, 'Unknown action: ' + action);
  }
}

function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetWithHeaders_(ss, MATERIALS_SHEET, MATERIAL_HEADERS);
  ensureSupplierSheetTable_(ss.getSheetByName(SUPPLIERS_SHEET) || ss.insertSheet(SUPPLIERS_SHEET));
}

function ensureSheetWithHeaders_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function listMaterials_() {
  return readJsonRows_(getSheet_(MATERIALS_SHEET));
}

function listSuppliers_() {
  var sheet = getSheet_(SUPPLIERS_SHEET);
  if (isLegacySupplierJsonSheet_(sheet)) {
    return readJsonRows_(sheet);
  }
  return readSupplierTableRows_(sheet);
}

function isLegacySupplierJsonSheet_(sheet) {
  var h3 = String(sheet.getRange(1, 3).getValue() || '').trim();
  return h3 === 'json';
}

function ensureSupplierSheetTable_(sheet) {
  if (!sheet) return;
  if (isLegacySupplierJsonSheet_(sheet)) return;
  var headerCell = String(sheet.getRange(1, 1).getValue() || '').trim();
  if (headerCell !== 'No') {
    sheet.getRange(1, 1, 1, SUPPLIER_HEADERS.length).setValues([SUPPLIER_HEADERS]);
  }
  sheet.setFrozenRows(1);
  var headerRange = sheet.getRange(1, 1, 1, SUPPLIER_HEADERS.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#e8eaed');
}

function supplierToRowValues_(no, supplier) {
  var recordUuid = supplier.recordUuid || Utilities.getUuid();
  var id = String(supplier.id || '');
  return [
    Number(no) || 0,
    id,
    String(supplier.name || ''),
    String(supplier.contactPerson || ''),
    String(supplier.phone || ''),
    String(supplier.category || ''),
    String(supplier.reliability || ''),
    Number(supplier.leadTimeAvgDays || 0),
    Number(supplier.itemsCount || 0),
    recordUuid,
  ];
}

function rowValuesToSupplier_(row) {
  var id = String(row[SUPPLIER_COL.ID - 1] || '').trim();
  if (!id) return null;
  var recordUuid = String(row[SUPPLIER_COL.RECORD_UUID - 1] || '').trim();
  return {
    recordUuid: recordUuid || Utilities.getUuid(),
    id: id,
    name: String(row[SUPPLIER_COL.NAME - 1] || '').trim(),
    contactPerson: String(row[SUPPLIER_COL.CONTACT - 1] || '').trim(),
    phone: String(row[SUPPLIER_COL.PHONE - 1] || '').trim(),
    category: String(row[SUPPLIER_COL.CATEGORY - 1] || '').trim(),
    reliability: String(row[SUPPLIER_COL.RELIABILITY - 1] || 'B').trim(),
    leadTimeAvgDays: Number(row[SUPPLIER_COL.LEAD_DAYS - 1] || 0),
    itemsCount: Number(row[SUPPLIER_COL.ITEMS_COUNT - 1] || 0),
  };
}

function readSupplierTableRows_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var width = SUPPLIER_HEADERS.length;
  var values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  var items = [];
  values.forEach(function (row) {
    var supplier = rowValuesToSupplier_(row);
    if (supplier) items.push(supplier);
  });
  items.sort(function (a, b) {
    return String(a.id).localeCompare(String(b.id));
  });
  return items;
}

function findSupplierRowIndex_(sheet, recordUuid, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var width = SUPPLIER_HEADERS.length;
  var values = sheet.getRange(2, 1, lastRow, width).getValues();
  for (var i = 0; i < values.length; i += 1) {
    var row = values[i];
    var rowUuid = String(row[SUPPLIER_COL.RECORD_UUID - 1] || '').trim();
    var rowId = String(row[SUPPLIER_COL.ID - 1] || '').trim();
    if (recordUuid && rowUuid === recordUuid) return i + 2;
    if (id && rowId === String(id)) return i + 2;
  }
  return -1;
}

function writeSupplierTableRow_(sheet, rowIndex, no, supplier) {
  var rowValues = supplierToRowValues_(no, supplier);
  if (rowIndex === -1) {
    sheet.appendRow(rowValues);
  } else {
    sheet.getRange(rowIndex, 1, 1, SUPPLIER_HEADERS.length).setValues([rowValues]);
  }
}

function nextSupplierNo_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  var values = sheet.getRange(2, 1, lastRow, 1).getValues();
  var maxNo = 0;
  values.forEach(function (row) {
    var n = Number(row[0]);
    if (!isNaN(n) && n > maxNo) maxNo = n;
  });
  return maxNo + 1;
}

function readJsonRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow, 3).getValues();
  const items = [];
  values.forEach(function (row) {
    const recordUuid = String(row[0] || '').trim();
    const jsonText = String(row[2] || '').trim();
    if (!jsonText) return;
    try {
      const parsed = JSON.parse(jsonText);
      if (recordUuid && !parsed.recordUuid) parsed.recordUuid = recordUuid;
      items.push(parsed);
    } catch (err) {
      // skip invalid row
    }
  });
  items.sort(function (a, b) {
    return Number(a.id || 0) - Number(b.id || 0);
  });
  return items;
}

function upsertMaterial_(material) {
  if (!material) throw new Error('material is required');
  const sheet = getSheet_(MATERIALS_SHEET);
  const recordUuid = material.recordUuid || Utilities.getUuid();
  const id = Number(material.id);
  const payload = Object.assign({}, material, { recordUuid: recordUuid, id: id, updatedAt: material.updatedAt || new Date().toISOString() });
  const rowIndex = findRowIndex_(sheet, recordUuid, String(id));
  var previousName = '';
  var previousSpec = '';
  if (rowIndex !== -1) {
    try {
      const prev = JSON.parse(String(sheet.getRange(rowIndex, 3).getValue() || '{}'));
      previousName = String(prev.name || '').trim();
      previousSpec = String(prev.spec || '').trim();
    } catch (err) {
      // ignore
    }
  }
  writeJsonRow_(sheet, rowIndex, recordUuid, id, payload);
  if (
    previousName &&
    normalizeBomKey_(previousName, previousSpec) !== normalizeBomKey_(payload.name, payload.spec)
  ) {
    removeMaterialFromBomTabs_(previousName, previousSpec);
  }
  syncMaterialToBomTabs_(payload);
  return payload;
}

function deleteMaterial_(id, recordUuid) {
  const sheet = getSheet_(MATERIALS_SHEET);
  var name = '';
  var spec = '';
  const rowIndex = findRowIndex_(sheet, recordUuid, id != null ? String(id) : '');
  if (rowIndex !== -1) {
    try {
      const parsed = JSON.parse(String(sheet.getRange(rowIndex, 3).getValue() || '{}'));
      name = String(parsed.name || '').trim();
      spec = String(parsed.spec || '').trim();
    } catch (err) {
      // ignore
    }
  }
  deleteRow_(sheet, recordUuid, id != null ? String(id) : '');
  if (name) {
    removeMaterialFromBomTabs_(name, spec);
  }
}

function upsertSupplier_(supplier) {
  if (!supplier) throw new Error('supplier is required');
  var sheet = getSheet_(SUPPLIERS_SHEET);
  if (isLegacySupplierJsonSheet_(sheet)) {
    migrateSupplierSheetToTable_(sheet);
  }
  ensureSupplierSheetTable_(sheet);
  var recordUuid = supplier.recordUuid || Utilities.getUuid();
  var id = String(supplier.id || '');
  var payload = Object.assign({}, supplier, {
    recordUuid: recordUuid,
    id: id,
    updatedAt: supplier.updatedAt || new Date().toISOString(),
  });
  var rowIndex = findSupplierRowIndex_(sheet, recordUuid, id);
  var no = rowIndex > 0 ? sheet.getRange(rowIndex, 1).getValue() : nextSupplierNo_(sheet);
  writeSupplierTableRow_(sheet, rowIndex, no, payload);
  return payload;
}

function deleteSupplier_(id, recordUuid) {
  var sheet = getSheet_(SUPPLIERS_SHEET);
  var idText = id != null ? String(id).trim() : '';
  var uuidText = recordUuid != null ? String(recordUuid).trim() : '';
  var current = listSuppliers_();
  var next = current.filter(function (supplier) {
    var sameUuid = uuidText && String(supplier.recordUuid || '') === uuidText;
    var sameId = idText && String(supplier.id || '') === idText;
    return !sameUuid && !sameId;
  });
  if (next.length === current.length) {
    var fallbackRow = findSupplierRowAnywhere_(sheet, uuidText, idText);
    if (fallbackRow === -1) {
      throw new Error('원장에서 협력사를 찾지 못했습니다 (' + (idText || uuidText) + ')');
    }
    clearOrDeleteRow_(sheet, fallbackRow);
    return;
  }
  replaceAllSuppliers_(next);
}

function findSupplierRowAnywhere_(sheet, recordUuid, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var width = Math.max(sheet.getLastColumn(), SUPPLIER_HEADERS.length, 3);
  var numRows = lastRow - 1;
  var values = sheet.getRange(2, 1, numRows, width).getValues();
  for (var i = 0; i < values.length; i += 1) {
    var row = values[i];
    var legacyUuid = String(row[0] || '').trim();
    var legacyId = String(row[1] || '').trim();
    var tableId = String(row[SUPPLIER_COL.ID - 1] || '').trim();
    var tableUuid = String(row[SUPPLIER_COL.RECORD_UUID - 1] || '').trim();
    if (recordUuid && (legacyUuid === recordUuid || tableUuid === recordUuid)) return i + 2;
    if (id && (legacyId === id || tableId === id)) return i + 2;
  }
  return -1;
}

function clearOrDeleteRow_(sheet, rowIndex) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  try {
    sheet.deleteRow(rowIndex);
  } catch (err) {
    sheet.getRange(rowIndex, 1, 1, lastCol).clearContent();
  }
}

function migrateSupplierSheetToTable_(sheet) {
  var legacy = readJsonRows_(sheet);
  ensureSupplierSheetTable_(sheet);
  clearDataRows_(sheet);
  if (!legacy || legacy.length === 0) return;
  var rows = legacy.map(function (supplier, idx) {
    return supplierToRowValues_(idx + 1, supplier);
  });
  sheet.getRange(2, 1, rows.length, SUPPLIER_HEADERS.length).setValues(rows);
}

function replaceAllMaterials_(materials) {
  const sheet = getSheet_(MATERIALS_SHEET);
  var rows = (materials || []).map(function (material) {
    var recordUuid = material.recordUuid || Utilities.getUuid();
    var id = Number(material.id);
    var payload = Object.assign({}, material, {
      recordUuid: recordUuid,
      id: id,
      updatedAt: material.updatedAt || new Date().toISOString(),
    });
    return [recordUuid, id, JSON.stringify(payload)];
  });
  writeBlock_(sheet, 2, rows, 3);
  rebuildAllBomTabsFromMaterials_(materials);
}

function replaceAllSuppliers_(suppliers) {
  var sheet = getSheet_(SUPPLIERS_SHEET);
  if (isLegacySupplierJsonSheet_(sheet)) {
    sheet.getRange(1, 1, 1, 3).clearContent();
  }
  ensureSupplierSheetTable_(sheet);
  var rows = (suppliers || []).map(function (supplier, idx) {
    var recordUuid = supplier.recordUuid || Utilities.getUuid();
    var id = String(supplier.id || '');
    var payload = Object.assign({}, supplier, {
      recordUuid: recordUuid,
      id: id,
      updatedAt: supplier.updatedAt || new Date().toISOString(),
    });
    return supplierToRowValues_(idx + 1, payload);
  });
  writeBlock_(sheet, 2, rows, SUPPLIER_HEADERS.length);
}

function writeBlock_(sheet, startRow, rows, numCols) {
  var lastRow = sheet.getLastRow();
  var count = rows ? rows.length : 0;
  if (count > 0) {
    sheet.getRange(startRow, 1, count, numCols).setValues(rows);
  }
  var writtenLast = startRow - 1 + count;
  if (lastRow > writtenLast) {
    var extra = lastRow - writtenLast;
    sheet.getRange(writtenLast + 1, 1, extra, Math.max(sheet.getLastColumn(), numCols)).clearContent();
    if (writtenLast >= 1 && extra > 0) {
      try {
        sheet.deleteRows(writtenLast + 1, extra);
      } catch (err) {
        // 고정 행만 남는 경우에는 내용만 비워 둔다.
      }
    }
  }
}

function getSheet_(name) {
  ensureSheets();
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function findRowIndex_(sheet, recordUuid, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const values = sheet.getRange(2, 1, lastRow, 2).getValues();
  for (var i = 0; i < values.length; i += 1) {
    var rowUuid = String(values[i][0] || '').trim();
    var rowId = String(values[i][1] || '').trim();
    if (recordUuid && rowUuid === recordUuid) return i + 2;
    if (id && rowId === String(id)) return i + 2;
  }
  return -1;
}

function writeJsonRow_(sheet, rowIndex, recordUuid, id, payload) {
  var json = JSON.stringify(payload);
  if (rowIndex === -1) {
    sheet.appendRow([recordUuid, id, json]);
  } else {
    sheet.getRange(rowIndex, 1, 1, 3).setValues([[recordUuid, id, json]]);
  }
}

function deleteRow_(sheet, recordUuid, id) {
  var rowIndex = findRowIndex_(sheet, recordUuid, id);
  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex);
  }
}

/** 고정 헤더(1행) 아래 데이터만 비움. 비고정 행을 전부 deleteRows 하면 Sheets 오류가 납니다. */
function clearDataRows_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var numRows = lastRow - 1;
  sheet.getRange(2, 1, numRows, lastCol).clearContent();
  if (lastRow > 2) {
    sheet.deleteRows(3, lastRow - 2);
  }
}

function clearBomDataRows_(sheet, headerRow) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= headerRow) return;
  var width = Math.max(sheet.getLastColumn(), BOM_ROW_WIDTH);
  var dataRows = lastRow - headerRow;
  sheet.getRange(headerRow + 1, 1, dataRows, width).clearContent();
  if (dataRows > 1) {
    sheet.deleteRows(headerRow + 2, dataRows - 1);
  }
}

function normalizeBomKey_(name, spec) {
  return String(name || '').trim() + '\u0001' + String(spec || '').trim();
}

function findBomHeaderRow_(sheet) {
  var lastRow = Math.min(sheet.getLastRow(), 8);
  for (var r = 1; r <= lastRow; r += 1) {
    var values = sheet.getRange(r, 1, 1, Math.max(sheet.getLastColumn(), BOM_ROW_WIDTH)).getValues()[0];
    for (var c = 0; c < values.length; c += 1) {
      var cell = String(values[c] || '');
      if (cell.indexOf('품목') >= 0 || cell.indexOf('품명') >= 0) {
        return r;
      }
    }
  }
  return 1;
}

function isBomDataRowName_(name) {
  if (!name) return false;
  if (name.indexOf('합계') === 0) return false;
  if (name.charAt(0) === '=') return false;
  return true;
}

function findBomRowByNameSpec_(sheet, headerRow, name, spec) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= headerRow) return -1;
  var key = normalizeBomKey_(name, spec);
  var numRows = lastRow - headerRow;
  var values = sheet.getRange(headerRow + 1, 1, numRows, 3).getValues();
  for (var i = 0; i < values.length; i += 1) {
    var rowName = String(values[i][1] || '').trim();
    if (!isBomDataRowName_(rowName)) continue;
    var rowSpec = String(values[i][2] || '').trim();
    if (normalizeBomKey_(rowName, rowSpec) === key) return headerRow + 1 + i;
  }
  return -1;
}

function getLastBomDataRow_(sheet, headerRow) {
  var lastRow = sheet.getLastRow();
  var lastData = headerRow;
  for (var r = headerRow + 1; r <= lastRow; r += 1) {
    var name = String(sheet.getRange(r, 2).getValue() || '').trim();
    if (isBomDataRowName_(name)) lastData = r;
  }
  return lastData;
}

function nextBomNo_(sheet, headerRow) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= headerRow) return 1;
  var numRows = lastRow - headerRow;
  var values = sheet.getRange(headerRow + 1, 1, numRows, 1).getValues();
  var maxNo = 0;
  values.forEach(function (row) {
    var n = Number(row[0]);
    if (!isNaN(n) && n > maxNo) maxNo = n;
  });
  return maxNo + 1;
}

function buildBomRowValues_(material, perUnitQty) {
  return [
    0,
    String(material.name || '').trim(),
    String(material.spec || '').trim(),
    Number(material.currentStock || 0),
    Number(material.safetyStock || material.reorderPoint || 0),
    Number(perUnitQty || 0),
    String(material.unit || 'EA'),
    Number(material.unitPrice || 0),
    Number(material.leadTimeDays || 7),
    String(material.supplier || ''),
    String(material.contactPerson || ''),
    String(material.phone || ''),
    String(material.notes || ''),
  ];
}

function writeBomRow_(sheet, headerRow, rowIndex, material, perUnitQty) {
  var rowValues = buildBomRowValues_(material, perUnitQty);
  if (rowIndex > 0) {
    var existingNo = sheet.getRange(rowIndex, 1).getValue();
    rowValues[0] = existingNo !== '' && existingNo != null ? existingNo : nextBomNo_(sheet, headerRow);
    sheet.getRange(rowIndex, 1, 1, BOM_ROW_WIDTH).setValues([rowValues]);
    return;
  }
  var lastData = getLastBomDataRow_(sheet, headerRow);
  rowValues[0] = nextBomNo_(sheet, headerRow);
  sheet.insertRowAfter(lastData);
  sheet.getRange(lastData + 1, 1, 1, BOM_ROW_WIDTH).setValues([rowValues]);
}

function syncMaterialToBomTabs_(material) {
  var usedIn = material.usedIn || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  BOM_TABS.forEach(function (tab) {
    var qty = Number(usedIn[tab.key] || 0);
    var sheet = ss.getSheetByName(tab.name);
    if (!sheet) return;
    var headerRow = findBomHeaderRow_(sheet);
    var rowIndex = findBomRowByNameSpec_(sheet, headerRow, material.name, material.spec);
    if (qty <= 0) {
      if (rowIndex > 0) sheet.deleteRow(rowIndex);
      return;
    }
    writeBomRow_(sheet, headerRow, rowIndex, material, qty);
  });
}

function removeMaterialFromBomTabs_(name, spec) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  BOM_TABS.forEach(function (tab) {
    var sheet = ss.getSheetByName(tab.name);
    if (!sheet) return;
    var headerRow = findBomHeaderRow_(sheet);
    var rowIndex = findBomRowByNameSpec_(sheet, headerRow, name, spec);
    if (rowIndex > 0) sheet.deleteRow(rowIndex);
  });
}

function rebuildAllBomTabsFromMaterials_(materials) {
  var list = materials || [];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  BOM_TABS.forEach(function (tab) {
    var sheet = ss.getSheetByName(tab.name);
    if (!sheet) return;
    var headerRow = findBomHeaderRow_(sheet);
    var rows = [];
    var no = 1;
    list.forEach(function (material) {
      var qty = Number((material.usedIn || {})[tab.key] || 0);
      if (qty <= 0) return;
      var rowValues = buildBomRowValues_(material, qty);
      rowValues[0] = no;
      no += 1;
      rows.push(rowValues);
    });
    writeBlock_(sheet, headerRow + 1, rows, BOM_ROW_WIDTH);
  });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}`;
