import { MaterialItem, SupplierInfo } from '../types/inventory';
import { setKnownLedgerVersion } from './ledgerRevision';

export const GOOGLE_SCRIPT_WEBAPP_URL =
  'https://script.google.com/macros/s/AKfycby5Ej456eViW4ubnSNwTJHNcCRxwZ5NCzZs8Bo6wQtznqNa9a04sCbyESoWe87Y4nOS/exec';

const LEDGER_REQUEST_TIMEOUT_MS = 120_000;
const POST_HEADERS = { 'Content-Type': 'text/plain;charset=utf-8' };

type LedgerResponse<T> = T & { success: boolean; action?: string; message?: string };

function buildWebAppUrl(webAppUrl: string, action: string): string {
  const url = new URL(webAppUrl);
  url.searchParams.set('action', action);
  return url.toString();
}

function parseLedgerResponse<T extends { success: boolean }>(
  text: string,
  expectedAction?: string,
): LedgerResponse<T> {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) {
    const preview = trimmed.slice(0, 120).replace(/\s+/g, ' ');
    throw new Error(
      `원장 API가 JSON이 아닌 응답을 반환했습니다. Apps Script 재배포와 웹앱 URL을 확인해 주세요. (${preview})`,
    );
  }

  const parsed = JSON.parse(trimmed) as LedgerResponse<T>;
  if (!parsed.success) {
    throw new Error(parsed.message || '원장 API 요청이 실패했습니다.');
  }

  const legacy = parsed as LedgerResponse<T> & { status?: string };
  if (legacy.status !== undefined && parsed.success !== true) {
    throw new Error(
      '저장용 웹앱 URL이 예전 BOM 저장 스크립트입니다. 설정에서「Apps Script 코드 복사」→ 원장 시트에 붙여 넣기 →「새 배포」웹앱 /exec URL을 입력해 주세요.',
    );
  }

  if (expectedAction && parsed.action !== expectedAction) {
    throw new Error(
      parsed.action
        ? `원장 API가 요청(${expectedAction})과 다른 응답(${parsed.action})을 반환했습니다. Apps Script를 재배포하고 URL을 갱신해 주세요.`
        : `원장 API 응답에 action이 없습니다. ledger용 Apps Script를 배포했는지와 /exec URL을 확인해 주세요.`,
    );
  }

  return parsed;
}

function noteLedgerVersion(result: { version?: string }) {
  if (result.version) setKnownLedgerVersion(result.version);
}

const LEDGER_PROXY_PATH = '/api/google-ledger';
const GET_PAYLOAD_FALLBACK_ACTIONS = new Set([
  'upsertMaterial',
  'deleteMaterial',
  'upsertSupplier',
  'deleteSupplier',
]);
const MAX_GET_LEDGER_URL_LENGTH = 7800;

function cloneForLedgerJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function encodePayloadBase64(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function isAllowedGasUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'script.google.com' || parsed.hostname === 'script.googleusercontent.com')
    );
  } catch {
    return false;
  }
}

function looksLikeLedgerJson(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('{') && trimmed.includes('"success"');
}

/** GAS 웹앱 POST: follow → (실패 시) manual 302 후 GET */
async function postLedgerDirect(webAppUrl: string, body: string, signal: AbortSignal): Promise<string> {
  let response = await fetch(webAppUrl, {
    method: 'POST',
    headers: POST_HEADERS,
    body,
    redirect: 'follow',
    signal,
  });
  let text = await response.text();
  if (response.ok && looksLikeLedgerJson(text)) {
    return text;
  }

  response = await fetch(webAppUrl, {
    method: 'POST',
    headers: POST_HEADERS,
    body,
    redirect: 'manual',
    signal,
  });

  if (response.status === 302 || response.status === 303 || response.status === 307 || response.status === 308) {
    const location = response.headers.get('Location');
    if (!location) {
      throw new Error('원장 API 리다이렉트 URL을 받지 못했습니다.');
    }
    if (!isAllowedGasUrl(location)) {
      throw new Error('원장 API 리다이렉트 URL이 허용되지 않습니다.');
    }
    response = await fetch(location, { method: 'GET', redirect: 'follow', signal });
    text = await response.text();
  }

  if (!response.ok) {
    throw new Error(`원장 API HTTP ${response.status}: ${text.slice(0, 160)}`);
  }
  if (!looksLikeLedgerJson(text)) {
    throw new Error(
      `원장 API가 JSON이 아닌 응답을 반환했습니다. (${text.slice(0, 120).replace(/\s+/g, ' ')})`,
    );
  }
  return text;
}

async function postLedgerViaServerProxy(
  webAppUrl: string,
  payload: Record<string, unknown>,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(LEDGER_PROXY_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify({ webAppUrl, payload }),
    signal,
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text.slice(0, 200);
    try {
      const errBody = JSON.parse(text) as { message?: string };
      if (errBody.message) message = errBody.message;
    } catch {
      // keep raw snippet
    }
    throw new Error(message || `원장 프록시 HTTP ${response.status}`);
  }
  return text;
}

async function postLedgerViaGetPayload(
  webAppUrl: string,
  action: string,
  payload: Record<string, unknown>,
  signal: AbortSignal,
): Promise<string> {
  const { action: _ignored, ...rest } = payload;
  const url = new URL(webAppUrl);
  url.searchParams.set('action', action);
  url.searchParams.set('payloadB64', encodePayloadBase64(rest));
  if (url.href.length > MAX_GET_LEDGER_URL_LENGTH) {
    throw new Error('자재 데이터가 URL 한도를 초과합니다. Apps Script를 최신 코드로 재배포해 주세요.');
  }
  const response = await fetch(url.href, { method: 'GET', redirect: 'follow', signal });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`원장 API HTTP ${response.status}: ${text.slice(0, 160)}`);
  }
  return text;
}

async function postLedger(
  webAppUrl: string,
  payload: Record<string, unknown>,
  signal: AbortSignal,
): Promise<string> {
  const body = JSON.stringify(payload);
  try {
    return await postLedgerViaServerProxy(webAppUrl, payload, signal);
  } catch {
    return postLedgerDirect(webAppUrl, body, signal);
  }
}

async function getLedger(webAppUrl: string, action: string, signal: AbortSignal): Promise<Response> {
  const response = await fetch(buildWebAppUrl(webAppUrl, action), {
    method: 'GET',
    redirect: 'follow',
    signal,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`원장 API HTTP ${response.status}: ${text.slice(0, 160)}`);
  }
  return response;
}

async function callLedgerApi<T extends { success: boolean }>(
  webAppUrl: string,
  payload: Record<string, unknown>,
): Promise<LedgerResponse<T>> {
  const action = String(payload.action ?? '');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), LEDGER_REQUEST_TIMEOUT_MS);

  const canGetFallback = GET_PAYLOAD_FALLBACK_ACTIONS.has(action);

  const runGetFallback = async (): Promise<LedgerResponse<T>> => {
    const text = await postLedgerViaGetPayload(webAppUrl, action, payload, controller.signal);
    return parseLedgerResponse<T>(text, action);
  };

  try {
    let text: string;
    try {
      text = await postLedger(webAppUrl, payload, controller.signal);
    } catch (postError) {
      if (!canGetFallback) throw postError;
      return runGetFallback();
    }

    try {
      return parseLedgerResponse<T>(text, action);
    } catch (parseError) {
      if (!canGetFallback) throw parseError;
      return runGetFallback();
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('원장 API 요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function checkLedgerApiHealth(webAppUrl: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await getLedger(webAppUrl, 'health', controller.signal);
    parseLedgerResponse<{ success: boolean }>(await response.text(), 'health');
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchMaterialsFromLedger(webAppUrl: string): Promise<MaterialItem[]> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), LEDGER_REQUEST_TIMEOUT_MS);
  try {
    const response = await getLedger(webAppUrl, 'listMaterials', controller.signal);
    const result = parseLedgerResponse<{ success: boolean; materials: MaterialItem[] }>(
      await response.text(),
      'listMaterials',
    );
    return Array.isArray(result.materials) ? result.materials : [];
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchSuppliersFromLedger(webAppUrl: string): Promise<SupplierInfo[]> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), LEDGER_REQUEST_TIMEOUT_MS);
  try {
    const response = await getLedger(webAppUrl, 'listSuppliers', controller.signal);
    const result = parseLedgerResponse<{ success: boolean; suppliers: SupplierInfo[] }>(
      await response.text(),
      'listSuppliers',
    );
    return Array.isArray(result.suppliers) ? result.suppliers : [];
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchLedgerVersion(webAppUrl: string): Promise<string> {
  const result = await callLedgerApi<{ success: boolean; version?: string }>(webAppUrl, {
    action: 'ledgerVersion',
  });
  return String(result.version || '');
}

export async function rebuildBomInLedger(webAppUrl: string): Promise<void> {
  await callLedgerApi<{ success: boolean }>(webAppUrl, { action: 'rebuildBom' });
}

export async function upsertMaterialInLedger(
  webAppUrl: string,
  material: MaterialItem,
  baseUpdatedAt?: string,
): Promise<MaterialItem> {
  const materialPayload = cloneForLedgerJson(material) as MaterialItem & { baseUpdatedAt?: string };
  if (baseUpdatedAt !== undefined) materialPayload.baseUpdatedAt = baseUpdatedAt;
  const result = await callLedgerApi<{ success: boolean; material: MaterialItem; version?: string }>(webAppUrl, {
    action: 'upsertMaterial',
    material: materialPayload,
  });
  if (!result.material) {
    throw new Error('원장에 자재를 저장했지만 응답 데이터가 없습니다.');
  }
  noteLedgerVersion(result);
  return result.material;
}

export async function deleteMaterialInLedger(
  webAppUrl: string,
  id: number,
  recordUuid?: string,
): Promise<void> {
  const result = await callLedgerApi<{ success: boolean; version?: string }>(webAppUrl, {
    action: 'deleteMaterial',
    id,
    recordUuid,
  });
  noteLedgerVersion(result);
}

export async function deleteMaterialsInLedger(
  webAppUrl: string,
  materials: Array<{ id: number; recordUuid?: string }>,
): Promise<void> {
  const result = await callLedgerApi<{ success: boolean; version?: string }>(webAppUrl, {
    action: 'deleteMaterials',
    materials,
  });
  noteLedgerVersion(result);
}

export async function upsertSupplierInLedger(
  webAppUrl: string,
  supplier: SupplierInfo,
  baseUpdatedAt?: string,
): Promise<SupplierInfo> {
  const supplierPayload = cloneForLedgerJson(supplier) as SupplierInfo & { baseUpdatedAt?: string };
  if (baseUpdatedAt !== undefined) supplierPayload.baseUpdatedAt = baseUpdatedAt;
  const result = await callLedgerApi<{ success: boolean; supplier: SupplierInfo; version?: string }>(webAppUrl, {
    action: 'upsertSupplier',
    supplier: supplierPayload,
  });
  if (!result.supplier) {
    throw new Error('원장에 협력사를 저장했지만 응답 데이터가 없습니다.');
  }
  noteLedgerVersion(result);
  return result.supplier;
}

export async function deleteSupplierInLedger(
  webAppUrl: string,
  id: string,
  recordUuid?: string,
): Promise<void> {
  const result = await callLedgerApi<{ success: boolean; version?: string }>(webAppUrl, {
    action: 'deleteSupplier',
    id,
    recordUuid,
  });
  noteLedgerVersion(result);
}

export async function deleteSuppliersInLedger(
  webAppUrl: string,
  suppliers: Array<{ id: string; recordUuid?: string }>,
): Promise<void> {
  const result = await callLedgerApi<{ success: boolean; version?: string }>(webAppUrl, {
    action: 'deleteSuppliers',
    suppliers,
  });
  noteLedgerVersion(result);
}

export async function replaceAllMaterialsInLedger(
  webAppUrl: string,
  materials: MaterialItem[],
  baseVersions?: Record<string, string>,
): Promise<number> {
  const result = await callLedgerApi<{ success: boolean; count: number; version?: string }>(webAppUrl, {
    action: 'replaceAllMaterials',
    materials,
    ...(baseVersions ? { baseVersions } : {}),
  });
  noteLedgerVersion(result);
  return Number(result.count ?? materials.length);
}

export async function saveLedgerSnapshot(
  webAppUrl: string,
  materials: MaterialItem[],
  suppliers: SupplierInfo[],
  baseVersions?: Record<string, string>,
  supplierBaseVersions?: Record<string, string>,
): Promise<{ materialCount: number; supplierCount: number; version: string }> {
  const result = await callLedgerApi<{
    success: boolean;
    materialCount: number;
    supplierCount: number;
    version?: string;
  }>(webAppUrl, {
    action: 'saveLedger',
    materials,
    suppliers,
    ...(baseVersions ? { baseVersions } : {}),
    ...(supplierBaseVersions ? { supplierBaseVersions } : {}),
  });
  noteLedgerVersion(result);
  return {
    materialCount: Number(result.materialCount ?? materials.length),
    supplierCount: Number(result.supplierCount ?? suppliers.length),
    version: String(result.version || ''),
  };
}

export async function replaceAllSuppliersInLedger(
  webAppUrl: string,
  suppliers: SupplierInfo[],
  baseVersions?: Record<string, string>,
): Promise<number> {
  const result = await callLedgerApi<{ success: boolean; count: number; version?: string }>(webAppUrl, {
    action: 'replaceAllSuppliers',
    suppliers,
    ...(baseVersions ? { baseVersions } : {}),
  });
  noteLedgerVersion(result);
  return Number(result.count ?? suppliers.length);
}
