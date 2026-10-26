import React, { useState, useMemo } from 'react';
import { 
  Search, 
  AlertTriangle,
  Building2,
  Tag,
  Trash2,
} from 'lucide-react';
import { CROSS_SHEET_COMPARISON_MAP } from '../data/divergentPartsData';
import { RAW_MATERIALS_DATA } from '../data/materialsData';
import { MaterialItem } from '../types/inventory';

interface CommonPartsMatrixProps {
  materials?: MaterialItem[];
  onDeleteMaterial?: (id: number) => void;
}

export const CommonPartsMatrix: React.FC<CommonPartsMatrixProps> = ({ 
  materials = RAW_MATERIALS_DATA,
  onDeleteMaterial,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // 자재 DB (materials) 중 원장 간 표기 상이로 통합 관리가 필요한 품목 매핑 (일치 완료 품목은 제외)
  const divergentList = useMemo(() => {
    // CROSS_SHEET_COMPARISON_MAP에 정의된 실제 표기 상이 품목만 필터링
    const targetCodes = Object.keys(CROSS_SHEET_COMPARISON_MAP);
    const matchedMaterials = materials.filter(m => targetCodes.includes(m.standardCode));

    return matchedMaterials.map((mat) => {
      const comparison = CROSS_SHEET_COMPARISON_MAP[mat.standardCode];
      const outdoorSheet = comparison?.outdoorSheetName || mat.name;
      const indoorSheet = comparison?.indoorSheetName || mat.name;
      const mobileSheet = comparison?.mobileSheetName || mat.name;
      const analysis = comparison?.analysis || mat.notes;
      const solution = comparison?.solution || '표준 코드로 통합 발주 관리';

      const usageCount = (mat.usedIn.outdoor > 0 ? 1 : 0) + 
                         (mat.usedIn.indoor > 0 ? 1 : 0) + 
                         (mat.usedIn.mobile > 0 ? 1 : 0) + 
                         (mat.usedIn.lsend > 0 ? 1 : 0);

      return {
        id: mat.id,
        standardCode: mat.standardCode,
        dbName: mat.name, // 자재 DB 실시간 등록명
        dbSpec: mat.spec, // 자재 DB 실시간 규격
        dbSupplier: mat.supplier, // 자재 DB 실시간 공급처
        dbUnitPrice: mat.unitPrice, // 자재 DB 실시간 단가
        usedIn: mat.usedIn,
        currentStock: mat.currentStock,
        usageCount,
        variants: {
          outdoor: outdoorSheet,
          indoor: indoorSheet,
          mobile: mobileSheet,
        },
        analysis,
        solution,
      };
    });
  }, [materials]);

  // 공급처 목록 추출
  const supplierOptions = useMemo(() => {
    const set = new Set<string>();
    divergentList.forEach(item => {
      const mainSupplier = item.dbSupplier.split('(')[0].split('/')[0].trim();
      if (mainSupplier) set.add(mainSupplier);
    });
    return Array.from(set);
  }, [divergentList]);

  // 필터링된 자재 목록
  const filteredList = useMemo(() => {
    return divergentList.filter(item => {
      const matchSearch = 
        item.standardCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.dbName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.dbSpec.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.dbSupplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.variants.outdoor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.variants.indoor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.variants.mobile.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.analysis.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.solution.toLowerCase().includes(searchTerm.toLowerCase());

      const matchSupplier = 
        selectedSupplier === 'ALL' || item.dbSupplier.includes(selectedSupplier);

      return matchSearch && matchSupplier;
    });
  }, [divergentList, searchTerm, selectedSupplier]);

  const allFilteredSelected =
    filteredList.length > 0 && filteredList.every((item) => selectedIds.has(item.id));

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredList.forEach((item) => next.delete(item.id));
      } else {
        filteredList.forEach((item) => next.add(item.id));
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
    if (!onDeleteMaterial) return;
    selectedIds.forEach((id) => onDeleteMaterial(id));
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* 1. 핵심 요약 헤더 카드 */}
      <div className="bg-white border border-rose-200 rounded-2xl p-6 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-rose-800 font-semibold mb-1">
              <span>표기 상이 관리 대상</span>
              <AlertTriangle className="w-4 h-4 text-[#BA1B2D]" />
            </div>
            <div className="text-2xl font-black text-rose-950">{divergentList.length}개 품목</div>
          </div>

          <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-blue-800 font-semibold mb-1">
              <span>관련 공급처</span>
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-950">{supplierOptions.length}개 거래처</div>
          </div>

          <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-amber-800 font-semibold mb-1">
              <span>관리 상태</span>
              <Tag className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-950">표준화 추진 중</div>
          </div>
        </div>
      </div>

      {/* 2. 검색 및 공급처 필터 컨트롤 바 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto flex-1">
          {/* 검색창 */}
          <div className="relative flex-1 sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-divergent"
              type="text"
              placeholder="코드, 자재 DB 품명, 원장 기재명, 규격 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#BA1B2D]"
            />
          </div>

          {/* 공급처 필터 */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-slate-400 hidden sm:inline" />
            <select
              id="select-divergent-supplier"
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#BA1B2D]"
            >
              <option value="ALL">전체 공급처 ({supplierOptions.length}개사)</option>
              {supplierOptions.map(sup => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 self-end sm:self-center">
          <span>대조 품목: <strong className="text-slate-900 font-bold">{filteredList.length}</strong> / {divergentList.length}개</span>
          {(searchTerm || selectedSupplier !== 'ALL') && (
            <button
              id="btn-reset-divergent-filter"
              onClick={() => {
                setSearchTerm('');
                setSelectedSupplier('ALL');
              }}
              className="text-[#BA1B2D] hover:underline font-bold"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {/* 3. 자재 DB 기준 표기 상이 자재 대조 및 통합 관리 상세 비교표 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              원장 간 표기 상이 부품 현황 및 통합 관리 방안 ({filteredList.length}종)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> 옥외원장
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#BA1B2D] bg-rose-100 px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-[#BA1B2D]"></span> 실내원장
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span> 이동형원장
            </span>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-slate-100 flex justify-end bg-white">
          <button
            type="button"
            disabled={selectedIds.size === 0 || !onDeleteMaterial}
            onClick={() => setConfirmBulkDelete(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 enabled:border-rose-200 enabled:bg-rose-50 enabled:text-[#BA1B2D] enabled:hover:bg-rose-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            내역 삭제
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    aria-label="현재 목록 전체 선택"
                    className="h-4 w-4 rounded border-slate-300 text-[#BA1B2D] focus:ring-[#BA1B2D]"
                  />
                </th>
                <th className="py-3 px-3 w-12 text-center">No</th>
                <th className="py-3 px-3 min-w-[190px]">자재 DB 표준 등록명 (코드)</th>
                <th className="py-3 px-3 min-w-[140px]">자재 DB 규격 사양</th>
                <th className="py-3 px-3 text-center min-w-[100px]">상태</th>
                <th className="py-3 px-3 text-center bg-emerald-50 text-emerald-950 border-l border-r border-slate-200 min-w-[130px]">
                  옥외보관함 원장 기재명
                </th>
                <th className="py-3 px-3 text-center bg-rose-50 text-rose-950 border-r border-slate-200 min-w-[130px]">
                  실내보관함 원장 기재명
                </th>
                <th className="py-3 px-3 text-center bg-amber-50 text-amber-950 border-r border-slate-200 min-w-[140px]">
                  이동형보관함 원장 기재명
                </th>
                <th className="py-3 px-3 min-w-[120px]">주 공급처</th>
                <th className="py-3 px-3 text-right min-w-[80px]">DB 단가</th>
                <th className="py-3 px-4 min-w-[260px]">원장 대조 분석 및 통합 방안</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    일치하는 표기 상이 자재 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => (
                  <tr key={item.standardCode || item.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelectRow(item.id)}
                        aria-label={`${item.dbName} 선택`}
                        className="h-4 w-4 rounded border-slate-300 text-[#BA1B2D] focus:ring-[#BA1B2D]"
                      />
                    </td>
                    <td className="py-3 px-3 text-center text-slate-400 font-mono font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">
                        {item.dbName}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {item.standardCode}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded">
                          <Tag className="w-2.5 h-2.5" />
                          {item.usageCount}개 제품 공통
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">
                      {item.dbSpec}
                    </td>

                    {/* 대조 상태 배지 */}
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-[#BA1B2D] border border-rose-300 shadow-2xs">
                        <AlertTriangle className="w-3 h-3 text-[#BA1B2D]" />
                        표기 상이
                      </span>
                    </td>

                    {/* 원장별 기재명 3개 열 */}
                    <td className="py-3 px-3 text-center border-l border-r border-slate-200 bg-emerald-50/20">
                      <span className="inline-block px-2 py-1 rounded bg-emerald-100/90 text-emerald-950 font-semibold text-[11px]">
                        {item.variants.outdoor}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center border-r border-slate-200 bg-rose-50/20">
                      <span className="inline-block px-2 py-1 rounded bg-rose-100/90 text-rose-950 font-semibold text-[11px]">
                        {item.variants.indoor}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center border-r border-slate-200 bg-amber-50/20">
                      <span className="inline-block px-2 py-1 rounded bg-amber-100/90 text-amber-950 font-semibold text-[11px]">
                        {item.variants.mobile}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-800 font-semibold">
                      {item.dbSupplier}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900">
                      {item.dbUnitPrice.toLocaleString()}원
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 leading-relaxed">
                      <div className="text-slate-800 font-medium">
                        <span className="text-slate-400 mr-1 font-bold">[현황 대조]</span>
                        {item.analysis}
                      </div>
                      <div className="text-[#BA1B2D] font-bold mt-1 bg-rose-50/80 p-1.5 rounded border border-rose-100">
                        <span className="mr-1">↳ [통합 방안]</span>
                        {item.solution}
                      </div>
                    </td>
                  </tr>
                ))
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
