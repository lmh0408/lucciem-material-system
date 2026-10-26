/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar, TabType, DbStatus } from './components/Navbar';
import { MaterialManager } from './components/MaterialManager';
import { CommonPartsMatrix } from './components/CommonPartsMatrix';
import { AutoOrderSimulator } from './components/AutoOrderSimulator';
import { SupplierOrderManager } from './components/SupplierOrderManager';
import { RAW_MATERIALS_DATA } from './data/materialsData';
import { MaterialItem } from './types/inventory';
import { 
  getMaterialsFromDb, 
  saveMaterialToDb, 
  deleteMaterialFromDb, 
  seedMaterialsToDb 
} from './lib/firebase';
import { 
  fetchMaterialsFromGoogleSheet,
  saveMaterialsToGoogleSheet,
  GOOGLE_SCRIPT_WEBAPP_URL
} from './utils/googleSheetSync';
import { Database, CheckCircle2, AlertCircle, RefreshCw, X, Save, Loader2, FileSpreadsheet } from 'lucide-react';

const STORAGE_KEY = 'lucciem_materials_inventory_v3_fact';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('simulator');
  const [editingMaterialForModal, setEditingMaterialForModal] = useState<MaterialItem | null>(null);

  // Materials State with LocalStorage fallback while Firebase loads
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

  // 비동기 경합(Race Condition) 방지 및 최근 수정 항목 락(Lock)을 위한 Refs
  const pendingUpdatesRef = useRef<Map<number, MaterialItem>>(new Map());
  const deletedIdsRef = useRef<Set<number>>(new Set());

  // Firebase DB 연동 상태 및 저장 중 애니메이션 상태
  const [dbStatus, setDbStatus] = useState<DbStatus>('loading');
  const [isSaving, setIsSaving] = useState(false);
  const [dbMessage, setDbMessage] = useState<string>('Firebase DB 연결 및 데이터 조회 중...');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => prev?.text === text ? null : prev);
    }, 4000);
  };

  // Firebase Firestore에서 자재 데이터 로드 함수 (지능적 병합 적용)
  const loadDataFromFirebase = useCallback(async (isManualRefresh = false) => {
    try {
      setDbStatus('loading');
      setDbMessage('Firebase DB에서 최신 자재 데이터를 불러오는 중...');

      const dbMaterials = await getMaterialsFromDb();

      if (dbMaterials && dbMaterials.length > 0) {
        // Firebase DB 데이터 수신 시 지능적 병합 (Race Condition 및 최근 사용자 수정 내용 보호)
        setMaterials(currentMaterials => {
          const currentMap = new Map<number, MaterialItem>();
          currentMaterials.forEach(m => currentMap.set(m.id, m));

          const merged = dbMaterials
            // 1. 이미 삭제 요청된 ID 제외
            .filter(dbItem => !deletedIdsRef.current.has(dbItem.id))
            .map(dbItem => {
              // 2. 현재 사용자가 수정 중이거나 방금 수정한 항목이 있으면 최우선 보존
              const pending = pendingUpdatesRef.current.get(dbItem.id);
              if (pending) {
                return pending;
              }

              // 3. 화면의 로컬 항목이 서버 DB 항목보다 최신 updatedAt인 경우 로컬 값 유지
              const localItem = currentMap.get(dbItem.id);
              if (localItem) {
                if (localItem.updatedAt && dbItem.updatedAt) {
                  const localTime = new Date(localItem.updatedAt).getTime();
                  const dbTime = new Date(dbItem.updatedAt).getTime();
                  if (localTime > dbTime) {
                    return localItem;
                  }
                } else if (localItem.updatedAt && !dbItem.updatedAt) {
                  return localItem;
                }
              }

              return dbItem;
            });

          // 4. 로컬에서 새로 추가되었으나 아직 DB 쿼리 결과에 없는 신규 항목 보존
          const dbIdSet = new Set(dbMaterials.map(m => m.id));
          currentMaterials.forEach(m => {
            if (!dbIdSet.has(m.id) && !deletedIdsRef.current.has(m.id)) {
              merged.push(m);
            }
          });

          // 번호순 정렬
          merged.sort((a, b) => a.id - b.id);

          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}

          return merged;
        });

        setDbStatus('connected');
        setDbMessage(`Firebase DB에서 ${dbMaterials.length}개 자재 정상 로드 완료`);
        if (isManualRefresh) {
          showToast(`Firebase DB에서 ${dbMaterials.length}개 자재를 성공적으로 불러왔습니다.`, 'success');
        }
      } else {
        // Firebase DB가 비어있는 경우 최초 시딩 진행
        setDbStatus('syncing');
        setDbMessage('Firebase DB에 초기 자재 데이터 74개 저장(시딩) 중...');
        const initialSeedData = RAW_MATERIALS_DATA;
        await seedMaterialsToDb(initialSeedData);

        // 시딩 후 재조회
        const seededList = await getMaterialsFromDb();
        setMaterials(seededList);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(seededList));
        } catch {}
        setDbStatus('connected');
        setDbMessage(`Firebase DB에 ${seededList.length}개 자재 초기 저장 및 로드 완료`);
        showToast(`Firebase DB 초기화 완료: ${seededList.length}개 자재가 DB에 저장되었습니다.`, 'success');
      }
    } catch (error: any) {
      console.error('Firebase DB 연동 오류:', error);
      setDbStatus('error');
      setDbMessage(`Firebase DB 연동 실패: ${error.message || '네트워크 확인 필요'}`);
      showToast('Firebase DB 연결 중 오류가 발생하여 로컬 캐시 데이터를 유지합니다.', 'error');
    }
  }, []);

  // 앱 최초 실행 시 Firebase DB에서 데이터 로드
  useEffect(() => {
    loadDataFromFirebase(false);
  }, [loadDataFromFirebase]);

  // Sync to LocalStorage as auxiliary cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
    } catch {
      // ignore
    }
  }, [materials]);

  // CRUD Operations with Firebase Firestore persistence & Race condition Lock
  const handleAddMaterial = async (newItem: MaterialItem) => {
    const timestamp = new Date().toISOString();
    const itemWithTimestamp: MaterialItem = {
      ...newItem,
      updatedAt: timestamp,
    };

    pendingUpdatesRef.current.set(itemWithTimestamp.id, itemWithTimestamp);
    deletedIdsRef.current.delete(itemWithTimestamp.id);

    // 1. 화면 즉시 반영
    setMaterials(prev => {
      const next = [itemWithTimestamp, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    showToast(`신규 자재 '${itemWithTimestamp.name}' 추가 중...`, 'info');

    // 2. Firebase DB 영구 저장
    try {
      setDbStatus('syncing');
      await saveMaterialToDb(itemWithTimestamp);
      setDbStatus('connected');
      setDbMessage(`자재 '${itemWithTimestamp.name}' Firebase DB 저장 완료`);
      showToast(`'${itemWithTimestamp.name}' 자재가 Firebase DB에 저장되었습니다.`, 'success');

      // 저장 완료 후 잠시 락 유지 후 안전하게 해제
      setTimeout(() => {
        if (pendingUpdatesRef.current.get(itemWithTimestamp.id)?.updatedAt === timestamp) {
          pendingUpdatesRef.current.delete(itemWithTimestamp.id);
        }
      }, 5000);
    } catch (err: any) {
      console.error('Firebase DB 저장 오류:', err);
      setDbStatus('error');
      showToast(`Firebase DB 저장 실패: ${err.message}`, 'error');
    }
  };

  const handleUpdateMaterial = async (updatedItem: MaterialItem) => {
    const timestamp = new Date().toISOString();
    const itemWithTimestamp: MaterialItem = {
      ...updatedItem,
      updatedAt: timestamp,
    };

    // 1. Pending 맵에 즉시 등록하여 어떤 백그라운드 DB 쿼리도 이 수정값을 덮어쓰지 못하도록 락 보호
    pendingUpdatesRef.current.set(updatedItem.id, itemWithTimestamp);
    deletedIdsRef.current.delete(updatedItem.id);

    // 2. 화면 및 로컬스토리지 즉시 반영
    setMaterials(prev => {
      const next = prev.map(m => m.id === updatedItem.id ? itemWithTimestamp : m);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    
    // 3. Firebase DB 동기화
    try {
      setDbStatus('syncing');
      await saveMaterialToDb(itemWithTimestamp);
      setDbStatus('connected');
      setDbMessage(`자재 '${itemWithTimestamp.name}' DB 갱신 완료`);
      showToast(`'${itemWithTimestamp.name}' 정보가 Firebase DB에 저장되었습니다.`, 'success');

      // 저장 후 5초간 락 유지
      setTimeout(() => {
        if (pendingUpdatesRef.current.get(updatedItem.id)?.updatedAt === timestamp) {
          pendingUpdatesRef.current.delete(updatedItem.id);
        }
      }, 5000);
    } catch (err: any) {
      console.error('Firebase DB 갱신 오류:', err);
      setDbStatus('error');
      showToast(`Firebase DB 수정 실패: ${err.message}`, 'error');
    }
  };

  const handleDeleteMaterial = async (id: number) => {
    const target = materials.find(m => m.id === id);
    deletedIdsRef.current.add(id);
    pendingUpdatesRef.current.delete(id);

    // 1. 화면 즉시 반영
    setMaterials(prev => {
      const next = prev.filter(m => m.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. Firebase DB 삭제
    try {
      setDbStatus('syncing');
      await deleteMaterialFromDb(id);
      setDbStatus('connected');
      setDbMessage(`자재 (ID: ${id}) Firebase DB 삭제 완료`);
      showToast(`자재 '${target?.name || id}'가 Firebase DB에서 삭제되었습니다.`, 'info');

      setTimeout(() => {
        deletedIdsRef.current.delete(id);
      }, 10000);
    } catch (err: any) {
      console.error('Firebase DB 삭제 오류:', err);
      setDbStatus('error');
      showToast(`Firebase DB 삭제 실패: ${err.message}`, 'error');
    }
  };

  // 전체 데이터 저장 (Firebase DB + 원장 구글 시트 4대 탭 동시 저장)
  const handleReseedDb = async () => {
    setIsSaving(true);
    const startTime = Date.now();
    try {
      setDbStatus('syncing');
      setDbMessage(`Firebase DB 및 원장 구글 시트에 ${materials.length}개 자재 동시 저장 중...`);
      
      // 1. Firebase Firestore 일괄 저장
      await seedMaterialsToDb(materials);

      // 2. 원장 구글 시트 4대 탭(옥외, 실내, 이동, L.SEND) 85행 정밀 매핑 일괄 저장
      let sheetSuccess = false;
      try {
        const sheetRes = await saveMaterialsToGoogleSheet(materials, GOOGLE_SCRIPT_WEBAPP_URL);
        sheetSuccess = sheetRes.success;
      } catch (sheetErr: any) {
        console.warn('구글 시트 저장 경고:', sheetErr);
      }

      // 사용자가 "저장 중..." 진행 상태를 인지할 수 있도록 최소 1.2초 표시 보장
      const elapsed = Date.now() - startTime;
      if (elapsed < 1200) {
        await new Promise(r => setTimeout(r, 1200 - elapsed));
      }

      const reloaded = await getMaterialsFromDb();
      setMaterials(reloaded);
      setDbStatus('connected');

      if (sheetSuccess) {
        setDbMessage(`Firebase DB & 원장 구글 시트 4개 탭에 총 ${materials.length}종 자재 저장 완료!`);
        showToast(`원장 구글 시트(옥외·실내·이동·L.SEND 4개 탭) 및 Firebase DB에 현재 재고·안전 재고가 정상 저장되었습니다!`, 'success');
      } else {
        setDbMessage(`Firebase DB에 ${materials.length}개 자재 저장 완료`);
        showToast(`Firebase DB에 정상 저장되었습니다. (구글 시트 저장 확인 필요)`, 'info');
      }
    } catch (err: any) {
      console.error('일괄 저장 실패:', err);
      setDbStatus('error');
      showToast(`저장 실패: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 구글 시트 4대 탭에서 최신 자재 및 BOM 데이터 직접 가져오기
  const handleSyncFromGoogleSheet = async () => {
    try {
      setDbStatus('loading');
      setDbMessage('구글 시트 4개 탭에서 최신 BOM 데이터 불러오는 중...');
      const sheetMaterials = await fetchMaterialsFromGoogleSheet();
      if (sheetMaterials && sheetMaterials.length > 0) {
        setMaterials(sheetMaterials);
        setDbStatus('connected');
        setDbMessage(`구글 시트에서 총 ${sheetMaterials.length}개 자재 정상 동기화 완료!`);
        showToast(`원장 구글 시트로부터 총 ${sheetMaterials.length}개 자재를 성공적으로 불러왔습니다!`, 'success');
        
        // Firebase DB에도 일괄 자동 반영
        try {
          await seedMaterialsToDb(sheetMaterials);
        } catch (dbErr) {
          console.warn('Firebase 자동 백업 경고:', dbErr);
        }
      } else {
        showToast('구글 시트에서 유효한 자재 데이터를 찾지 못했습니다.', 'error');
        setDbStatus('connected');
      }
    } catch (err: any) {
      console.error('구글 시트 동기화 실패:', err);
      setDbStatus('error');
      showToast(`구글 시트 동기화 실패: ${err.message || '네트워크 확인 필요'}`, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F8] text-slate-800 flex flex-col font-sans selection:bg-[#BA1B2D] selection:text-white">
      {/* 상단 내비게이션 바 (저장, 불러오기, 시트 보기 버튼 포함) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dbStatus={dbStatus}
        dbMessage={dbMessage}
        totalMaterialsCount={materials.length}
        onRefreshFromDb={() => loadDataFromFirebase(true)}
        onReseedDb={handleReseedDb}
        onSyncFromGoogleSheet={handleSyncFromGoogleSheet}
        isSaving={isSaving}
        googleSheetUrl="https://docs.google.com/spreadsheets/d/1cqYtwVvxJU9UmQ0oHJYMFupGZDae5sN1bh3Grvrt7Xs/edit?usp=sharing"
      />

      {/* 메인 콘텐츠 영역 */}
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

        {activeTab === 'matrix' && (
          <CommonPartsMatrix 
            materials={materials}
          />
        )}

        {activeTab === 'simulator' && (
          <AutoOrderSimulator 
            materials={materials}
            onEditMaterial={(item) => {
              setEditingMaterialForModal(item);
              setActiveTab('materials');
            }}
          />
        )}

        {activeTab === 'suppliers' && (
          <SupplierOrderManager 
            materials={materials}
          />
        )}
      </main>

      {/* 데이터 저장 중 전면 애니메이션 오버레이 */}
      {isSaving && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-slate-200 text-center space-y-5">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-rose-100 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-4 border-t-[#BA1B2D] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <Save className="w-7 h-7 text-[#BA1B2D]" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900">원장 구글 시트 & DB 동시 저장 중...</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                현재 재고와 안전 재고 데이터를 <strong>원장 구글 시트 4개 탭(옥외·실내·이동·L.SEND)</strong> 및 <strong>Firebase DB</strong>에 안전하게 기록하고 있습니다.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-left space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>1단계: Firebase 클라우드 DB 데이터 동기화</span>
              </div>
              <div className="flex items-center gap-2 text-[#BA1B2D] font-bold">
                <Loader2 className="w-4 h-4 text-[#BA1B2D] animate-spin shrink-0" />
                <span>2단계: 구글 시트 4대 탭(85개 행) 현재/안전재고 기록 중...</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>창을 닫지 마시고 잠시만 기다려 주세요.</span>
            </div>
          </div>
        </div>
      )}

      {/* 실시간 알림 토스트 */}
      {toastMessage && (
        <div 
          id="firebase-toast-notification"
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
          {toastMessage.type === 'info' && <Database className="w-4 h-4 text-sky-400 shrink-0" />}
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
