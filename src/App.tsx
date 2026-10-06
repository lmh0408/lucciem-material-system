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
import { AssemblyRecord, MaterialItem } from './types/inventory';
import { 
  getMaterialsFromDb, 
  saveMaterialToDb, 
  deleteMaterialFromDb, 
  seedMaterialsToDb,
  getAssemblyRecords,
  saveAssemblyRecord,
} from './lib/firebase';
import { AssemblyProduct, modelUsage, productById } from './lib/productModels';
import { Database, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';

const STORAGE_KEY = 'lucciem_materials_inventory_v3_fact';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('simulator');

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

  // Firebase DB 연동 상태
  const [dbStatus, setDbStatus] = useState<DbStatus>('loading');
  const [dbMessage, setDbMessage] = useState<string>('Firebase DB 연결 및 데이터 조회 중...');
  const [assemblies, setAssemblies] = useState<AssemblyRecord[]>([]);
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
          showToast(`Firebase DB에서 ${dbMaterials.length}개 자재를 새로고침했습니다.`, 'success');
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
    getAssemblyRecords()
      .then(setAssemblies)
      .catch((error) => {
        console.error('조립 기록 조회 오류:', error);
      });
  }, [loadDataFromFirebase]);

  const roundQty = (value: number) => Math.round(value * 10000) / 10000;

  const applyStockDelta = async (deltas: { id: number; delta: number }[]) => {
    const timestamp = new Date().toISOString();
    const deltaMap = new Map(deltas.map(entry => [entry.id, entry.delta]));
    const changed: MaterialItem[] = [];
    const next = materials.map(item => {
      const delta = deltaMap.get(item.id);
      if (delta == null) return item;
      const updated: MaterialItem = {
        ...item,
        currentStock: roundQty(item.currentStock + delta),
        updatedAt: timestamp,
      };
      pendingUpdatesRef.current.set(item.id, updated);
      changed.push(updated);
      return updated;
    });
    setMaterials(next);

    setDbStatus('syncing');
    await Promise.all(changed.map(item => saveMaterialToDb(item)));
    setDbStatus('connected');
    setTimeout(() => {
      changed.forEach(item => {
        if (pendingUpdatesRef.current.get(item.id)?.updatedAt === timestamp) {
          pendingUpdatesRef.current.delete(item.id);
        }
      });
    }, 5000);
  };

  const handleConfirmAssembly = async (product: AssemblyProduct, quantity: number) => {
    const lines = materials
      .map(item => {
        const perUnit = modelUsage(item, product);
        const deductQty = roundQty(perUnit * quantity);
        return {
          materialId: item.id,
          name: item.name,
          unit: item.unit,
          perUnit,
          deductQty,
          stockBefore: item.currentStock,
          stockAfter: roundQty(item.currentStock - deductQty),
        };
      })
      .filter(line => line.perUnit > 0);

    if (lines.length === 0) {
      throw new Error('차감할 품목이 없습니다.');
    }

    await applyStockDelta(lines.map(line => ({ id: line.materialId, delta: -line.deductQty })));
    const record: AssemblyRecord = {
      id: `ASM-${Date.now()}`,
      createdAt: new Date().toISOString(),
      product,
      productName: productById(product).name,
      quantity,
      lines,
    };
    await saveAssemblyRecord(record);
    setAssemblies(prev => [record, ...prev]);
    showToast(`${record.productName} ${quantity}대분 자재를 일괄 차감했습니다.`, 'success');
  };

  const handleReverseAssembly = async (record: AssemblyRecord) => {
    if (record.reversedAt) return;
    const present = record.lines.filter(line => materials.some(item => item.id === line.materialId));
    if (present.length === 0) {
      throw new Error('되돌릴 품목을 찾지 못했습니다.');
    }
    await applyStockDelta(present.map(line => ({ id: line.materialId, delta: line.deductQty })));
    const reversed: AssemblyRecord = { ...record, reversedAt: new Date().toISOString() };
    await saveAssemblyRecord(reversed);
    setAssemblies(prev => prev.map(item => item.id === record.id ? reversed : item));
    showToast(`${record.productName} ${record.quantity}대 차감을 취소하고 재고를 되돌렸습니다.`, 'success');
  };

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

  // 전체 데이터 강제 일괄 백업
  const handleReseedDb = async () => {
    if (!confirm('현재 화면에 표시된 모든 자재 데이터를 Firebase DB로 일괄 덮어쓰기 저장하시겠습니까?')) {
      return;
    }
    try {
      setDbStatus('syncing');
      setDbMessage(`Firebase DB에 ${materials.length}개 자재 일괄 저장 중...`);
      await seedMaterialsToDb(materials);
      const reloaded = await getMaterialsFromDb();
      setMaterials(reloaded);
      setDbStatus('connected');
      setDbMessage(`Firebase DB에 ${reloaded.length}개 자재 일괄 저장 완료!`);
      showToast(`Firebase DB에 총 ${reloaded.length}개 자재가 정상 저장되었습니다.`, 'success');
    } catch (err: any) {
      console.error('일괄 저장 실패:', err);
      setDbStatus('error');
      showToast(`Firebase DB 일괄 저장 실패: ${err.message}`, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F8] text-slate-800 flex flex-col font-sans selection:bg-[#BA1B2D] selection:text-white">
      {/* 상단 내비게이션 바 (Firebase 상태 및 동기화 버튼 포함) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dbStatus={dbStatus}
        dbMessage={dbMessage}
        totalMaterialsCount={materials.length}
        onRefreshFromDb={() => loadDataFromFirebase(true)}
        onReseedDb={handleReseedDb}
      />

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'materials' && (
          <MaterialManager
            materials={materials}
            onAddMaterial={handleAddMaterial}
            onUpdateMaterial={handleUpdateMaterial}
            onDeleteMaterial={handleDeleteMaterial}
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
            assemblies={assemblies}
            onConfirmAssembly={handleConfirmAssembly}
            onReverseAssembly={handleReverseAssembly}
          />
        )}

        {activeTab === 'suppliers' && (
          <SupplierOrderManager 
            materials={materials}
          />
        )}
      </main>

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
