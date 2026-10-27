import React, { useState, useMemo } from 'react';
import { 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle,
  Search,
  Package,
  Trash2,
} from 'lucide-react';
import { RAW_MATERIALS_DATA } from '../data/materialsData';
import { MaterialItem } from '../types/inventory';
import { displayedCurrentStock, displayedSafetyStock, stockStatus } from '../utils/stockDisplay';
import { MaterialUsedModelsCell } from './MaterialUsedModelsCell';

interface AutoOrderSimulatorProps {
  materials?: MaterialItem[];
  onEditMaterial?: (item: MaterialItem) => void;
  onDeleteMaterials?: (ids: number[]) => void;
}

export const AutoOrderSimulator: React.FC<AutoOrderSimulatorProps> = ({
  materials = RAW_MATERIALS_DATA,
  onEditMaterial,
  onDeleteMaterials,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'ALL' | 'outdoor' | 'indoor' | 'mobile' | 'lsend'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [commonFilter, setCommonFilter] = useState<string>('ALL');

  // Model counts
  const modelCounts = useMemo(() => {
    return {
      all: materials.length,
      outdoor: materials.filter(m => (m.usedIn?.outdoor ?? 0) > 0).length,
      indoor: materials.filter(m => (m.usedIn?.indoor ?? 0) > 0).length,
      mobile: materials.filter(m => (m.usedIn?.mobile ?? 0) > 0).length,
      lsend: materials.filter(m => (m.usedIn?.lsend ?? 0) > 0).length,
    };
  }, [materials]);

  // Filter materials by selected model first
  const modelFilteredMaterials = useMemo(() => {
    return materials.filter(item => {
      if (selectedModel === 'outdoor') return (item.usedIn?.outdoor ?? 0) > 0;
      if (selectedModel === 'indoor') return (item.usedIn?.indoor ?? 0) > 0;
      if (selectedModel === 'mobile') return (item.usedIn?.mobile ?? 0) > 0;
      if (selectedModel === 'lsend') return (item.usedIn?.lsend ?? 0) > 0;
      return true;
    });
  }, [materials, selectedModel]);

  const evaluatedMaterials = useMemo(() => {
    return modelFilteredMaterials.map(item => {
      const current = displayedCurrentStock(item);
      const safety = displayedSafetyStock(item, selectedModel);
      const computedStatus = stockStatus(current, safety);
      const moq = item.moq || 10;
      const shortage = safety - current;
      const orderQty = computedStatus === 'ORDER_NEEDED'
        ? Math.max(moq, shortage > 0 ? Math.ceil(shortage / moq) * moq : moq)
        : 0;
      const orderCost = orderQty * (item.unitPrice || 0);

      return {
        ...item,
        orderQty,
        orderCost,
        computedStatus,
      };
    });
  }, [modelFilteredMaterials, selectedModel]);

  const orderNeededList = evaluatedMaterials.filter(r => r.computedStatus === 'ORDER_NEEDED');
  const warningList = evaluatedMaterials.filter(r => r.computedStatus === 'WARNING');
  const normalList = evaluatedMaterials.filter(r => r.computedStatus === 'NORMAL');

  const totalAutoOrderCost = orderNeededList.reduce((sum, r) => sum + r.orderCost, 0);

  const displayedList = useMemo(() => {
    return evaluatedMaterials.filter(item => {
      const matchesStatus = 
        filterStatus === 'ALL' || item.computedStatus === filterStatus;

      const matchesSearch = 
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.spec.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCommon = 
        commonFilter === 'ALL' || item.commonLevel === commonFilter;

      return matchesStatus && matchesSearch && matchesCommon;
    });
  }, [evaluatedMaterials, filterStatus, searchTerm, commonFilter]);

  const allDisplayedSelected =
    displayedList.length > 0 && displayedList.every((item) => selectedIds.has(item.id));

  const toggleSelectAllDisplayed = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allDisplayedSelected) {
        displayedList.forEach((item) => next.delete(item.id));
      } else {
        displayedList.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };

  const toggleSelectRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmBulkDelete = () => {
    if (!onDeleteMaterials || selectedIds.size === 0) return;
    onDeleteMaterials([...selectedIds]);
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-4">
      {/* Model Tabs Bar (자재 관리 탭과 100% 동일한 UX 일관성 적용) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 mr-2">
              <span className="p-1.5 bg-rose-50 text-[#BA1B2D] rounded-lg">
                <Package className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-slate-700">모델별 보기:</span>
            </div>

            <button
              onClick={() => setSelectedModel('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedModel === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              전체 모델 ({modelCounts.all}종)
            </button>

            <button
              onClick={() => setSelectedModel('outdoor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedModel === 'outdoor'
                  ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/20'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              옥외보관함 ({modelCounts.outdoor}종)
            </button>

            <button
              onClick={() => setSelectedModel('indoor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedModel === 'indoor'
                  ? 'bg-[#BA1B2D] text-white shadow-xs ring-2 ring-red-500/20'
                  : 'bg-rose-50 hover:bg-rose-100 text-[#BA1B2D] border border-rose-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              실내보관함 ({modelCounts.indoor}종)
            </button>

            <button
              onClick={() => setSelectedModel('mobile')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedModel === 'mobile'
                  ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-500/20'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              이동형보관함 ({modelCounts.mobile}종)
            </button>

            <button
              id="btn-simulator-lsend-case"
              onClick={() => setSelectedModel('lsend')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedModel === 'lsend'
                  ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/20'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              L.SEND case ({modelCounts.lsend}종)
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards: Order Status Summary (선택된 모델에 맞추어 실시간 재계산) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Urgent Order Needed */}
        <button
          onClick={() => setFilterStatus(filterStatus === 'ORDER_NEEDED' ? 'ALL' : 'ORDER_NEEDED')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            filterStatus === 'ORDER_NEEDED'
              ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertOctagon className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-900 text-sm">즉시 발주 필요</span>
            </div>
            <span className="text-2xl font-black text-rose-600">{orderNeededList.length}건</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-rose-700">
            <span>안전재고의 50% 미만</span>
            <span>{totalAutoOrderCost.toLocaleString()}원</span>
          </div>
        </button>

        {/* Warning */}
        <button
          onClick={() => setFilterStatus(filterStatus === 'WARNING' ? 'ALL' : 'WARNING')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            filterStatus === 'WARNING'
              ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-900 text-sm">재고 주의</span>
            </div>
            <span className="text-2xl font-black text-amber-600">{warningList.length}건</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-xs text-amber-700 font-medium">
            안전재고의 50% 이상, 100% 미만
          </div>
        </button>

        {/* Normal */}
        <button
          onClick={() => setFilterStatus(filterStatus === 'NORMAL' ? 'ALL' : 'NORMAL')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            filterStatus === 'NORMAL'
              ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-900 text-sm">적정 재고 유지</span>
            </div>
            <span className="text-2xl font-black text-emerald-600">{normalList.length}건</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-xs text-emerald-700 font-medium">
            안전재고 100% 이상
          </div>
        </button>
      </div>

      {/* Main Stock & Auto-Order Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Table Search & Filter Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row items-center gap-2 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="품목명, 규격, 공급처 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-[#BA1B2D]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={commonFilter}
              onChange={(e) => setCommonFilter(e.target.value)}
              className="w-full sm:w-auto text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#BA1B2D]"
            >
              <option value="ALL">공통 등급 전체</option>
              <option value="C3">3개 공통 (C3)</option>
              <option value="C2">2개 공통 (C2)</option>
              <option value="DEDICATED">전용 자재</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 shrink-0">
            <span>
              조회: <strong className="text-slate-900">{displayedList.length}</strong>건
            </span>
            {filterStatus !== 'ALL' && (
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-[#BA1B2D] font-semibold text-[11px]">
                상태: {filterStatus === 'ORDER_NEEDED' ? '발주 필요' : filterStatus === 'WARNING' ? '주의' : '적정'}
              </span>
            )}
            {(filterStatus !== 'ALL' || searchTerm || commonFilter !== 'ALL' || selectedModel !== 'ALL') && (
              <button
                onClick={() => {
                  setFilterStatus('ALL');
                  setSearchTerm('');
                  setCommonFilter('ALL');
                  setSelectedModel('ALL');
                }}
                className="text-[#BA1B2D] hover:underline font-medium ml-1"
              >
                필터 초기화
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-2 border-b border-slate-100 flex justify-end bg-white">
          <button
            type="button"
            disabled={selectedIds.size === 0 || !onDeleteMaterials}
            onClick={() => setConfirmBulkDelete(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 enabled:border-rose-200 enabled:bg-rose-50 enabled:text-[#BA1B2D] enabled:hover:bg-rose-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            항목 삭제
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-2.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allDisplayedSelected}
                    onChange={toggleSelectAllDisplayed}
                    aria-label="현재 목록 전체 선택"
                    className="h-4 w-4 rounded border-slate-300 text-[#BA1B2D] focus:ring-[#BA1B2D]"
                  />
                </th>
                <th className="py-2.5 px-2.5 w-12 text-center">No</th>
                <th className="py-2.5 px-3 min-w-[130px]">품목명</th>
                <th className="py-2.5 px-3 min-w-[140px]">규격</th>
                <th className="py-2.5 px-3 text-center min-w-[90px]">재고 상태</th>
                <th className="py-2.5 px-3 text-right min-w-[85px]">현재 재고</th>
                <th className="py-2.5 px-3 text-right min-w-[80px]">안전 재고</th>
                <th className="py-2.5 px-3 text-center min-w-[95px]">사용 모델</th>
                {selectedModel !== 'ALL' && (
                  <th className="py-2.5 px-3 text-center min-w-[90px]">대당 수량</th>
                )}
                <th className="py-2.5 px-2 text-center w-12">단위</th>
                <th className="py-2.5 px-3 text-right min-w-[80px]">단가</th>
                <th className="py-2.5 px-2.5 text-center min-w-[75px]">조달 소요일</th>
                <th className="py-2.5 px-3 min-w-[95px]">발주처</th>
                <th className="py-2.5 px-3 min-w-[110px]">담당자 / 연락처</th>
                <th className="py-2.5 px-3 min-w-[110px]">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedList.length === 0 ? (
                <tr>
                  <td colSpan={selectedModel === 'ALL' ? 14 : 15} className="text-center py-8 text-slate-400">
                    조건과 일치하는 자재가 없습니다.
                  </td>
                </tr>
              ) : (
                displayedList.map((item, idx) => {
                  const isUrgent = item.computedStatus === 'ORDER_NEEDED';
                  const isWarn = item.computedStatus === 'WARNING';

                  return (
                    <tr 
                      key={item.id} 
                      onDoubleClick={() => onEditMaterial?.(item)}
                      className={`hover:bg-rose-50/60 hover:shadow-2xs transition-all cursor-pointer group select-none ${
                        isUrgent ? 'bg-rose-50/40' : isWarn ? 'bg-amber-50/30' : ''
                      }`}
                      title={onEditMaterial ? "더블 클릭하여 자재 사양 및 재고 수정" : undefined}
                    >
                      <td className="py-2.5 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelectRow(item.id)}
                          aria-label={`${item.name} 선택`}
                          className="h-4 w-4 rounded border-slate-300 text-[#BA1B2D] focus:ring-[#BA1B2D]"
                        />
                      </td>
                      {/* [A열] No */}
                      <td className="py-2.5 px-2.5 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>

                      {/* [B열] 품목명 */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 group-hover:text-[#BA1B2D] transition-colors">
                          {item.name}
                        </div>
                      </td>

                      {/* [C열] 규격 */}
                      <td className="py-2.5 px-3">
                        <div className="text-[11px] text-slate-700 truncate max-w-[200px]" title={item.spec}>
                          {item.spec}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isUrgent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            발주 필요 (+{item.orderQty}{item.unit})
                          </span>
                        )}
                        {isWarn && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            재고 주의
                          </span>
                        )}
                        {!isUrgent && !isWarn && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                            적정
                          </span>
                        )}
                      </td>

                      {/* 현재 재고 */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded border transition-colors ${
                          isUrgent 
                            ? 'text-[#BA1B2D] bg-rose-50 border-rose-300 font-black ring-1 ring-rose-200' 
                            : 'text-slate-900 bg-slate-50 border-slate-200 group-hover:border-rose-200'
                        }`}>
                          {displayedCurrentStock(item).toLocaleString()}
                        </span>
                      </td>

                      {/* [E열] 안전 재고 */}
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-600 whitespace-nowrap">
                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 group-hover:border-rose-200">
                          {displayedSafetyStock(item, selectedModel).toLocaleString()}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <MaterialUsedModelsCell item={item} />
                      </td>
                      {selectedModel !== 'ALL' && (
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {selectedModel === 'outdoor' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                              {item.usedIn.outdoor} {item.unit}
                            </span>
                          )}
                          {selectedModel === 'indoor' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-200">
                              {item.usedIn.indoor} {item.unit}
                            </span>
                          )}
                          {selectedModel === 'mobile' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              {item.usedIn.mobile} {item.unit}
                            </span>
                          )}
                          {selectedModel === 'lsend' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                              {item.usedIn.lsend} {item.unit}
                            </span>
                          )}
                        </td>
                      )}

                      {/* [G열] 단위 */}
                      <td className="py-2.5 px-2 text-center text-slate-600 font-medium">
                        {item.unit}
                      </td>

                      {/* [H열] 단가 */}
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800 whitespace-nowrap">
                        {item.unitPrice.toLocaleString()}원
                      </td>

                      {/* [I열] 조달 소요일 */}
                      <td className="py-2.5 px-2.5 text-center text-slate-600 whitespace-nowrap">
                        {item.leadTimeDays || 7}일
                      </td>

                      {/* [J열] 발주처 */}
                      <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-nowrap">
                        <div className="truncate max-w-[130px]" title={item.supplier}>
                          {item.supplier || '-'}
                        </div>
                      </td>

                      {/* [K열] 담당자 / 연락처 */}
                      <td className="py-2.5 px-3 text-slate-600">
                        <div className="font-medium text-slate-800">{item.contactPerson || '-'}</div>
                        {item.phone && (
                          <div className="text-[11px] text-slate-500 font-mono">{item.phone}</div>
                        )}
                      </td>

                      {/* 비고 */}
                      <td className="py-2.5 px-3 text-slate-500">
                        <div className="text-[11px] truncate max-w-[140px]" title={item.notes || '-'}>
                          {item.notes || '-'}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">선택 항목 삭제</h3>
            <p className="mt-2 text-xs text-slate-600">
              선택한 {selectedIds.size}건의 자재를 원장에서 삭제합니다. 계속하시겠습니까?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="rounded-xl bg-[#BA1B2D] px-4 py-2 text-xs font-bold text-white hover:bg-[#a01625]"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
