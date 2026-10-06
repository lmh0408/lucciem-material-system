import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet,
  Search,
  Package,
} from 'lucide-react';
import { RAW_MATERIALS_DATA } from '../data/materialsData';
import { AssemblyRecord, MaterialItem } from '../types/inventory';
import { AssemblyProduct, ModelFilter, modelUsage, productById } from '../lib/productModels';
import { downloadExcel } from '../utils/excelExport';
import { AssemblyCompleteDialog } from './AssemblyCompleteDialog';

interface AutoOrderSimulatorProps {
  materials?: MaterialItem[];
  assemblies?: AssemblyRecord[];
  onConfirmAssembly?: (product: AssemblyProduct, quantity: number) => Promise<void>;
  onReverseAssembly?: (record: AssemblyRecord) => Promise<void>;
}

export const AutoOrderSimulator: React.FC<AutoOrderSimulatorProps> = ({
  materials = RAW_MATERIALS_DATA,
  assemblies = [],
  onConfirmAssembly,
  onReverseAssembly,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedModel, setSelectedModel] = useState<ModelFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [assemblyOpen, setAssemblyOpen] = useState(false);

  // Model counts
  const modelCounts = useMemo(() => {
    return {
      all: materials.length,
      outdoor: materials.filter(m => (m.usedIn?.outdoor ?? 0) > 0).length,
      indoor: materials.filter(m => modelUsage(m, 'indoor') > 0).length,
      indoorGeneral: materials.filter(m => modelUsage(m, 'indoorGeneral') > 0).length,
      mobile: materials.filter(m => modelUsage(m, 'mobile') > 0).length,
      lsend: materials.filter(m => (m.usedIn?.lsend ?? 0) > 0).length,
    };
  }, [materials]);

  // Filter materials by selected model first
  const modelFilteredMaterials = useMemo(() => {
    return materials.filter(item => {
      if (selectedModel === 'ALL') return true;
      return modelUsage(item, selectedModel) > 0;
    });
  }, [materials, selectedModel]);

  // Evaluate order status using manager-set reorderPoint and leadTimeDays
  const evaluatedMaterials = useMemo(() => {
    return modelFilteredMaterials.map(item => {
      const rop = item.reorderPoint;
      
      // Order needed if current stock is at or below reorder point
      const isOrderNeeded = item.currentStock <= rop;
      const isWarning = !isOrderNeeded && item.currentStock <= Math.ceil(rop * 1.25);

      let computedStatus: 'ORDER_NEEDED' | 'WARNING' | 'NORMAL' = 'NORMAL';
      if (isOrderNeeded) computedStatus = 'ORDER_NEEDED';
      else if (isWarning) computedStatus = 'WARNING';

      return {
        ...item,
        reorderPoint: rop,
        computedStatus,
      };
    });
  }, [modelFilteredMaterials]);

  const displayedList = useMemo(() => {
    return evaluatedMaterials.filter(item => {
      const matchesStatus = 
        filterStatus === 'ALL' || item.computedStatus === filterStatus;

      const matchesSearch = 
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.spec.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [evaluatedMaterials, filterStatus, searchTerm]);

  const handleExportExcel = () => {
    if (displayedList.length === 0) {
      alert('저장할 품목이 없습니다.');
      return;
    }

    const modelLabel = selectedModel === 'ALL' ? '전체모델' : productById(selectedModel).name;
    const usageHeader = selectedModel === 'ALL' ? '공통 등급' : productById(selectedModel).usageLabel;

    const rows = displayedList.map((item, index) => {
      const usage = selectedModel === 'ALL'
        ? (item.commonLevel === 'C3' ? '3개 공통' : item.commonLevel === 'C2' ? '2개 공통' : item.commonLevel === 'C4' ? '4개 공통' : '전용 자재')
        : modelUsage(item, selectedModel);

      const status =
        item.computedStatus === 'ORDER_NEEDED' ? '발주 필요' :
        item.computedStatus === 'WARNING' ? '주의' :
        '적정';

      return {
        순번: index + 1,
        품목명: item.name,
        '상세 규격': item.spec,
        [usageHeader]: usage,
        현재고: item.currentStock,
        단위: item.unit,
        '재발주 기준점': item.reorderPoint,
        '조달 소요일': item.leadTimeDays,
        '재고 상태': status,
        단가: item.unitPrice,
        공급처: item.supplier,
      };
    });

    downloadExcel(rows, `루씨엠_재고현황_${modelLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`, '재고 현황');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-4">
      {/* Model Tabs Bar (자재 관리 탭과 100% 동일한 UX 일관성 적용) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
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
              스마트 실내보관함 ({modelCounts.indoor}종)
            </button>

            <button
              onClick={() => setSelectedModel('indoorGeneral')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedModel === 'indoorGeneral'
                  ? 'bg-sky-700 text-white shadow-xs ring-2 ring-sky-500/20'
                  : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              일반 실내보관함 ({modelCounts.indoorGeneral}종)
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
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="재고 상태"
              className="w-full sm:w-auto text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#BA1B2D]"
            >
              <option value="ALL">전체</option>
              <option value="ORDER_NEEDED">즉시 발주 필요</option>
              <option value="WARNING">재고 주의</option>
              <option value="NORMAL">적정 재고 유지</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 shrink-0">
            <span>
              조회: <strong className="text-slate-900">{displayedList.length}</strong>건
            </span>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
              title="지금 화면에 나온 품목 목록을 엑셀 파일로 저장합니다"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              엑셀 저장
            </button>
            {onConfirmAssembly && onReverseAssembly && (
              <button
                type="button"
                onClick={() => setAssemblyOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#BA1B2D] text-white font-semibold hover:bg-[#a01625]"
              >
                자재 일괄 차감
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">순번</th>
                <th className="py-2.5 px-3">품목명 / 상세 규격</th>
                <th className="py-2.5 px-3 text-center min-w-[90px]">
                  {selectedModel === 'ALL' ? '공통 등급' : productById(selectedModel).usageLabel}
                </th>
                <th className="py-2.5 px-3 text-right">현재고</th>
                <th className="py-2.5 px-3 text-right bg-rose-50/50 text-[#BA1B2D] font-bold">
                  재발주 기준점
                </th>
                <th className="py-2.5 px-3 text-center">조달 소요일</th>
                <th className="py-2.5 px-3 text-center">재고 상태</th>
                <th className="py-2.5 px-3 text-right">단가</th>
                <th className="py-2.5 px-3">공급처</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400">
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
                      className={`hover:bg-slate-50 transition-colors ${
                        isUrgent ? 'bg-rose-50/30' : isWarn ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[220px]" title={item.spec}>
                          {item.spec}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {selectedModel !== 'ALL' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            {modelUsage(item, selectedModel)} EA
                          </span>
                        )}
                        {selectedModel === 'ALL' && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.commonLevel === 'C3' 
                              ? 'bg-rose-100 text-[#BA1B2D] border border-rose-200' 
                              : item.commonLevel === 'C2'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {item.commonLevel === 'C3' ? '3개 공통' : item.commonLevel === 'C2' ? '2개 공통' : '전용 자재'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span className={isUrgent ? 'text-[#BA1B2D] font-black' : 'text-slate-900'}>
                          {item.currentStock.toLocaleString()} {item.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold bg-rose-50/50 text-[#BA1B2D]">
                        {item.reorderPoint.toLocaleString()} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600">
                        {item.leadTimeDays}일
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isUrgent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            발주 필요
                          </span>
                        )}
                        {isWarn && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            주의
                          </span>
                        )}
                        {!isUrgent && !isWarn && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                            적정
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800 whitespace-nowrap">
                        {item.unitPrice.toLocaleString()}원
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        <div className="truncate max-w-[150px]" title={item.supplier}>
                          {item.supplier}
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

      {assemblyOpen && onConfirmAssembly && onReverseAssembly && (
        <AssemblyCompleteDialog
          materials={materials}
          records={assemblies}
          initialProduct={selectedModel === 'ALL' ? 'outdoor' : selectedModel}
          onClose={() => setAssemblyOpen(false)}
          onConfirm={onConfirmAssembly}
          onReverse={onReverseAssembly}
        />
      )}
    </div>
  );
};
