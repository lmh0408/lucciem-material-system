/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar, TabType, DbStatus } from './components/Navbar';
import { MaterialManager } from './components/MaterialManager';
import { AutoOrderSimulator } from './components/AutoOrderSimulator';
import { SupplierOrderManager } from './components/SupplierOrderManager';
import { RAW_MATERIALS_DATA, SUPPLIERS_LIST } from './data/materialsData';
import { MaterialItem, SupplierInfo } from './types/inventory';
import { SUPPLIERS_STORAGE_KEY } from './constants/ledgerStorage';
import {
  fetchMaterialsFromLedger,
  upsertMaterialInLedger,
  deleteMaterialInLedger,
  replaceAllMaterialsInLedger,
  replaceAllSuppliersInLedger,
  saveLedgerSnapshot,
  GOOGLE_SCRIPT_WEBAPP_URL,
} from './utils/googleSheetLedger';
import { CheckCircle2, AlertCircle, X, FileSpreadsheet } from 'lucide-react';
import {
  applyProductionToMaterials,
  computeProductionConsumption,
  PRODUCTION_MODEL_LABELS,
  ProductionModel,
} from './utils/productionConsumption';

const STORAGE_KEY = 'lucciem_materials_inventory_v3_fact';
const GOOGLE_SHEET_SETTINGS_STORAGE_KEY = 'lucciem_google_sheet_settings_v1';
const DEFAULT_GOOGLE_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1cqYtwVvxJU9UmQ0oHJYMFupGZDae5sN1bh3Grvrt7Xs/edit?usp=sharing';

function loadSuppliersForLedgerSave(): SupplierInfo[] {
  try {
    const saved = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as SupplierInfo[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return SUPPLIERS_LIST;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('simulator');
  const [editingMaterialForModal, setEditingMaterialForModal] = useState<MaterialItem | null>(null);
  const [googleSheetSettings, setGoogleSheetSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(GOOGLE_SHEET_SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.googleSheetUrl === 'string' && typeof parsed.googleScriptUrl === 'string') {
          return parsed;
        }
      }
    } catch {
      // 기본 설정 사용
    }
    return { googleSheetUrl: DEFAULT_GOOGLE_SHEET_URL, googleScriptUrl: GOOGLE_SCRIPT_WEBAPP_URL };
  });

  const [materials, setMaterials] = useState<MaterialItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return RAW_MATERIALS_DATA;
  });

  const [sheetStatus, setSheetStatus] = useState<DbStatus>('loading');
  const [isSaving, setIsSaving] = useState(false);
  const [sheetMessage, setSheetMessage] = useState<string>('구글 원장에서 자재 데이터를 불러오는 중...');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(
    null,
  );
  const toastTimerRef = useRef<number | null>(null);

  const webAppUrl = googleSheetSettings.googleScriptUrl;

  const showToast = (
    text: string,
    type: 'success' | 'info' | 'error' = 'info',
    persist = false,
  ) => {
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastMessage({ text, type });
    if (persist) return;
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const persistMaterialsLocally = (next: MaterialItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

    const loadMaterialsFromLedger = useCallback(
    async (isManualRefresh = false) => {
      try {
        setSheetStatus('loading');
        if (isManualRefresh) {
          showToast('원장에서 자재를 불러오는 중입니다.', 'info', true);
        }
        setSheetMessage('구글 원장 자재관리DB에서 데이터를 불러오는 중...');

        const ledgerMaterials = await fetchMaterialsFromLedger(webAppUrl);

        if (ledgerMaterials.length > 0) {
          const sorted = [...ledgerMaterials].sort((a, b) => a.id - b.id);
          setMaterials(sorted);
          persistMaterialsLocally(sorted);
          setSheetStatus('connected');
          setSheetMessage(`원장에서 ${sorted.length}개 자재를 불러왔습니다.`);
          if (isManualRefresh) {
            showToast(`원장에서 ${sorted.length}개 자재를 불러왔습니다.`, 'success');
          }
        } else {
          setSheetStatus('connected');
          setSheetMessage('원장 자재관리DB가 비어 있습니다. 로컬 캐시 데이터를 표시합니다.');
          if (isManualRefresh) {
            showToast('원장 DB가 비어 있습니다. [저장]으로 앱 데이터를 원장에 업로드할 수 있습니다.', 'info');
          }
        }
      } catch (error: unknown) {
        console.error('원장 불러오기 오류:', error);
        setSheetStatus('error');
        const message = error instanceof Error ? error.message : '네트워크 확인 필요';
        setSheetMessage(`원장 연동 실패: ${message}`);
        showToast(`원장 불러오기 실패: ${message}. 로컬 캐시를 유지합니다.`, 'error');
      }
    },
    [webAppUrl],
  );

  useEffect(() => {
    loadMaterialsFromLedger(false);
  }, [loadMaterialsFromLedger]);

  useEffect(() => {
    persistMaterialsLocally(materials);
  }, [materials]);

  const handleAddMaterial = async (newItem: MaterialItem) => {
    const timestamp = new Date().toISOString();
    const itemWithTimestamp: MaterialItem = {
      ...newItem,
      updatedAt: timestamp,
    };

    setMaterials((prev) => {
      const next = [...prev, itemWithTimestamp];
      persistMaterialsLocally(next);
      return next;
    });
    showToast(`신규 자재 '${itemWithTimestamp.name}' 저장 중입니다.`, 'info', true);

    try {
      setSheetStatus('syncing');
      const saved = await upsertMaterialInLedger(webAppUrl, itemWithTimestamp);
      setMaterials((prev) => {
        const next = prev.map((m) => (m.id === saved.id ? saved : m));
        if (!next.some((m) => m.id === saved.id)) {
          next.push(saved);
        }
        persistMaterialsLocally(next);
        return next;
      });
      setSheetStatus('connected');
      setSheetMessage(`자재 '${saved.name}' 원장 저장 완료`);
      showToast(`'${saved.name}' 자재를 시트에 반영했습니다.`, 'success');
    } catch (err: unknown) {
      console.error('원장 저장 오류:', err);
      setSheetStatus('error');
      const message = err instanceof Error ? err.message : '저장 실패';
      showToast(`원장 저장 실패: ${message}`, 'error');
      await loadMaterialsFromLedger(false);
    }
  };

  const handleUpdateMaterial = async (updatedItem: MaterialItem) => {
    const timestamp = new Date().toISOString();
    const itemWithTimestamp: MaterialItem = {
      ...updatedItem,
      updatedAt: timestamp,
    };

    setMaterials((prev) => {
      const next = prev.map((m) => (m.id === updatedItem.id ? itemWithTimestamp : m));
      persistMaterialsLocally(next);
      return next;
    });
    showToast(`'${itemWithTimestamp.name}' 수정 내용을 저장 중입니다.`, 'info', true);

    try {
      setSheetStatus('syncing');
      const saved = await upsertMaterialInLedger(webAppUrl, itemWithTimestamp);
      setMaterials((prev) => {
        const next = prev.map((m) => (m.id === saved.id ? saved : m));
        persistMaterialsLocally(next);
        return next;
      });
      setSheetStatus('connected');
      setSheetMessage(`자재 '${saved.name}' 원장 갱신 완료`);
      showToast(`'${saved.name}' 수정 내용을 시트에 반영했습니다.`, 'success');
    } catch (err: unknown) {
      console.error('원장 갱신 오류:', err);
      setSheetStatus('error');
      const message = err instanceof Error ? err.message : '수정 실패';
      showToast(`원장 수정 실패: ${message}`, 'error');
      await loadMaterialsFromLedger(false);
    }
  };

  const handleDeleteMaterials = async (ids: number[]) => {
    const uniqueIds = [...new Set(ids)];
    const targets = materials.filter((item) => uniqueIds.includes(item.id));
    if (targets.length === 0) return;

    const label =
      targets.length === 1 ? `'${targets[0].name}'` : `${targets.length}건`;
    showToast(`자재 ${label} 삭제 중입니다.`, 'info', true);

    setMaterials((prev) => {
      const next = prev.filter((item) => !uniqueIds.includes(item.id));
      persistMaterialsLocally(next);
      return next;
    });

    try {
      setSheetStatus('syncing');
      for (const target of targets) {
        await deleteMaterialInLedger(webAppUrl, target.id, target.recordUuid);
      }
      setSheetStatus('connected');
      setSheetMessage(`자재 ${label} 원장 삭제 완료`);
      showToast(`자재 ${label}을 시트에서 삭제했습니다.`, 'success');
    } catch (err: unknown) {
      console.error('원장 삭제 오류:', err);
      setSheetStatus('error');
      const message = err instanceof Error ? err.message : '삭제 실패';
      showToast(`자재 삭제 실패: ${message}`, 'error');
      await loadMaterialsFromLedger(false);
    }
  };

  const handleReseedDb = async () => {
    setIsSaving(true);
    try {
      setSheetStatus('syncing');
      const suppliersToSave = loadSuppliersForLedgerSave();
      showToast(
        `자재 ${materials.length}종·협력사 ${suppliersToSave.length}곳 저장 중입니다.`,
        'info',
        true,
      );
      setSheetMessage(
        `원장에 자재 ${materials.length}종·협력사 ${suppliersToSave.length}곳 저장 중...`,
      );
      let savedCount = materials.length;
      let supplierCount = suppliersToSave.length;
      try {
        const saved = await saveLedgerSnapshot(webAppUrl, materials, suppliersToSave);
        savedCount = saved.materialCount;
        supplierCount = saved.supplierCount;
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        if (!message.includes('Unknown action')) throw err;
        const [materialSaved, supplierSaved] = await Promise.all([
          replaceAllMaterialsInLedger(webAppUrl, materials),
          replaceAllSuppliersInLedger(webAppUrl, suppliersToSave),
        ]);
        savedCount = materialSaved;
        supplierCount = supplierSaved;
      }

      setSheetStatus('connected');
      setSheetMessage(
        `원장 저장 완료 — 자재 ${savedCount}종, 협력사 ${supplierCount}곳`,
      );
      showToast(
        `자재 ${savedCount}종·협력사 ${supplierCount}곳을 시트에 반영했습니다.`,
        'success',
      );
    } catch (err: unknown) {
      console.error('원장 일괄 저장 실패:', err);
      setSheetStatus('error');
      const message = err instanceof Error ? err.message : '저장 실패';
      showToast(`원장 저장 실패: ${message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncFromGoogleSheet = async () => {
    await loadMaterialsFromLedger(true);
  };

  const handleApplyProductionConsumption = async (model: ProductionModel, productionUnits: number) => {
    const lines = computeProductionConsumption(materials, model, productionUnits);
    if (lines.length === 0) {
      showToast('차감할 BOM 품목이 없습니다. 생산 수량을 확인해 주세요.', 'info');
      return;
    }

    const next = applyProductionToMaterials(materials, model, productionUnits);
    const negativeCount = lines.filter((line) => line.isNegative).length;
    const modelLabel = PRODUCTION_MODEL_LABELS[model];

    setMaterials(next);
    persistMaterialsLocally(next);

    try {
      setSheetStatus('syncing');
      showToast(
        `${modelLabel} ${Math.floor(productionUnits)}대 생산 반영 중입니다.`,
        'info',
        true,
      );
      setSheetMessage(`${modelLabel} 생산 ${Math.floor(productionUnits)}대 반영 중...`);
      await replaceAllMaterialsInLedger(webAppUrl, next);
      setSheetStatus('connected');
      setSheetMessage(`${modelLabel} 생산 반영 완료 (${lines.length}종 차감)`);
      const warn =
        negativeCount > 0
          ? ` 마이너스 재고 ${negativeCount}종 포함.`
          : '';
      showToast(
        `${modelLabel} ${Math.floor(productionUnits)}대 생산을 시트에 반영했습니다 (${lines.length}종 차감).${warn}`,
        negativeCount > 0 ? 'info' : 'success',
      );
    } catch (err: unknown) {
      console.error('생산 반영 원장 저장 오류:', err);
      setSheetStatus('error');
      const message = err instanceof Error ? err.message : '저장 실패';
      showToast(`생산 반영 후 원장 저장 실패: ${message}`, 'error');
      await loadMaterialsFromLedger(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F8] text-slate-800 flex flex-col font-sans selection:bg-[#BA1B2D] selection:text-white">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onReseedDb={handleReseedDb}
        onSyncFromGoogleSheet={handleSyncFromGoogleSheet}
        isSaving={isSaving}
        googleSheetUrl={googleSheetSettings.googleSheetUrl}
        googleScriptUrl={googleSheetSettings.googleScriptUrl}
        onGoogleSheetSettingsChange={(settings) => {
          showToast('구글 시트 설정 저장 중입니다.', 'info', true);
          setGoogleSheetSettings(settings);
          localStorage.setItem(GOOGLE_SHEET_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
          showToast('구글 시트 설정을 저장했습니다.', 'success');
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'materials' && (
          <MaterialManager
            materials={materials}
            onAddMaterial={handleAddMaterial}
            onUpdateMaterial={handleUpdateMaterial}
            onDeleteMaterials={handleDeleteMaterials}
            onApplyProductionConsumption={handleApplyProductionConsumption}
            isProductionSaving={sheetStatus === 'syncing'}
            initialEditingItem={editingMaterialForModal}
            onClearInitialEditingItem={() => setEditingMaterialForModal(null)}
          />
        )}

        {activeTab === 'simulator' && (
          <AutoOrderSimulator
            materials={materials}
            onDeleteMaterials={handleDeleteMaterials}
            onEditMaterial={(item) => {
              setEditingMaterialForModal(item);
              setActiveTab('materials');
            }}
          />
        )}

        {activeTab === 'suppliers' && (
          <SupplierOrderManager materials={materials} webAppUrl={webAppUrl} onToast={showToast} />
        )}
      </main>

      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-[120] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-medium transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900/95 text-white border-emerald-700'
              : toastMessage.type === 'error'
                ? 'bg-rose-900/95 text-white border-rose-700'
                : 'bg-slate-900/95 text-white border-slate-700'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toastMessage.type === 'info' && <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-white/60 hover:text-white ml-2 p-0.5"
            aria-label="닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
