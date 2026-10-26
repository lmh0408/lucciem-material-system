/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, TabType, DbStatus } from './components/Navbar';
import { MaterialManager } from './components/MaterialManager';
import { AutoOrderSimulator } from './components/AutoOrderSimulator';
import { SupplierOrderManager } from './components/SupplierOrderManager';
import { RAW_MATERIALS_DATA } from './data/materialsData';
import { MaterialItem } from './types/inventory';
import {
  fetchMaterialsFromLedger,
  upsertMaterialInLedger,
  deleteMaterialInLedger,
  replaceAllMaterialsInLedger,
  GOOGLE_SCRIPT_WEBAPP_URL,
} from './utils/googleSheetLedger';
import { CheckCircle2, AlertCircle, RefreshCw, X, Save, Loader2, FileSpreadsheet } from 'lucide-react';

const STORAGE_KEY = 'lucciem_materials_inventory_v3_fact';
const GOOGLE_SHEET_SETTINGS_STORAGE_KEY = 'lucciem_google_sheet_settings_v1';
const DEFAULT_GOOGLE_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1cqYtwVvxJU9UmQ0oHJYMFupGZDae5sN1bh3Grvrt7Xs/edit?usp=sharing';

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

  const webAppUrl = googleSheetSettings.googleScriptUrl;

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
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
      const next = [itemWithTimestamp, ...prev];
      persistMaterialsLocally(next);
      return next;
    });
    showToast(`신규 자재 '${itemWithTimestamp.name}' 원장에 저장 중...`, 'info');

    try {
      setSheetStatus('syncing');
      const saved = await upsertMaterialInLedger(webAppUrl, itemWithTimestamp);
      setMaterials((prev) => {
        const next = prev.map((m) => (m.id === saved.id ? saved : m));
        if (!next.some((m) => m.id === saved.id)) {
          next.unshift(saved);
        }
        persistMaterialsLocally(next);
        return next;
      });
      setSheetStatus('connected');
      setSheetMessage(`자재 '${saved.name}' 원장 저장 완료`);
      showToast(`'${saved.name}' 자재가 자재관리DB 및 해당 모델 BOM 탭에 반영되었습니다.`, 'success');
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
      showToast(`'${saved.name}' 정보가 자재관리DB 및 BOM 탭에 반영되었습니다.`, 'success');
    } catch (err: unknown) {
      console.error('원장 갱신 오류:', err);
      setSheetStatus('error');
      const message = err instanceof Error ? err.message : '수정 실패';
      showToast(`원장 수정 실패: ${message}`, 'error');
      await loadMaterialsFromLedger(false);
    }
  };

  const handleDeleteMaterial = async (id: number) => {
    const target = materials.find((m) => m.id === id);

    setMaterials((prev) => {
      const next = prev.filter((m) => m.id !== id);
      persistMaterialsLocally(next);
      return next;
    });

    try {
      setSheetStatus('syncing');
      await deleteMaterialInLedger(webAppUrl, id, target?.recordUuid);
      setSheetStatus('connected');
      setSheetMessage(`자재 (ID: ${id}) 원장 삭제 완료`);
      showToast(`자재 '${target?.name || id}'가 원장에서 삭제되었습니다.`, 'info');
    } catch (err: unknown) {
      console.error('원장 삭제 오류:', err);
      setSheetStatus('error');
      const message = err instanceof Error ? err.message : '삭제 실패';
      showToast(`원장 삭제 실패: ${message}`, 'error');
      await loadMaterialsFromLedger(false);
    }
  };

  const handleReseedDb = async () => {
    setIsSaving(true);
    const startTime = Date.now();
    try {
      setSheetStatus('syncing');
      setSheetMessage(`원장 자재관리DB에 ${materials.length}개 자재 저장 중...`);
      const savedCount = await replaceAllMaterialsInLedger(webAppUrl, materials);

      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise((r) => setTimeout(r, 800 - elapsed));
      }

      setSheetStatus('connected');
      setSheetMessage(`원장 자재관리DB에 ${savedCount}종 자재 저장 완료`);
      showToast(`자재관리DB 및 4대 BOM 탭에 ${savedCount}개 자재를 반영했습니다.`, 'success');
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
            onDeleteMaterial={handleDeleteMaterial}
            initialEditingItem={editingMaterialForModal}
            onClearInitialEditingItem={() => setEditingMaterialForModal(null)}
          />
        )}

        {activeTab === 'simulator' && (
          <AutoOrderSimulator
            materials={materials}
            onDeleteMaterial={handleDeleteMaterial}
            onEditMaterial={(item) => {
              setEditingMaterialForModal(item);
              setActiveTab('materials');
            }}
          />
        )}

        {activeTab === 'suppliers' && (
          <SupplierOrderManager materials={materials} webAppUrl={webAppUrl} />
        )}
      </main>

      {isSaving && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-slate-200 text-center space-y-5">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-rose-100 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-4 border-t-[#BA1B2D] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <Save className="w-7 h-7 text-[#BA1B2D]" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900">원장 자재관리DB 저장 중...</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                현재 앱의 자재 데이터 전체를 <strong>구글 원장 자재관리DB</strong> 시트에 반영하고 있습니다.
              </p>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>창을 닫지 마시고 잠시만 기다려 주세요.</span>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-medium transition-all ${
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
