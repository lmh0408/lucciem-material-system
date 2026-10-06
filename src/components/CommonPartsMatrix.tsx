import React, { useState, useMemo } from 'react';
import { 
  Search, 
  AlertTriangle,
  Building2,
  Tag
} from 'lucide-react';
import { SIMILAR_PART_GROUPS } from '../data/divergentPartsData';
import { RAW_MATERIALS_DATA } from '../data/materialsData';
import { MaterialItem } from '../types/inventory';

interface CommonPartsMatrixProps {
  materials?: MaterialItem[];
}

export const CommonPartsMatrix: React.FC<CommonPartsMatrixProps> = ({ 
  materials = RAW_MATERIALS_DATA 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');

  const divergentList = useMemo(() => {
    const notation = (
      mat: MaterialItem,
      model: 'outdoor' | 'indoor' | 'mobile',
      ledgerName?: string,
    ) => {
      if ((mat.usedIn?.[model] ?? 0) <= 0) return null;
      return {
        name: ledgerName || mat.name,
        spec: mat.spec,
      };
    };

    return SIMILAR_PART_GROUPS.flatMap((group) => {
      return group.members.flatMap((member) => {
        const mat = materials.find(item => item.standardCode === member.standardCode);
        if (!mat) return [];

        const variants = {
          outdoor: notation(mat, 'outdoor', member.ledgerNames?.outdoor),
          indoor: notation(mat, 'indoor', member.ledgerNames?.indoor),
          mobile: notation(mat, 'mobile', member.ledgerNames?.mobile),
        };
        const usageCount = (mat.usedIn.outdoor > 0 ? 1 : 0) +
                           (mat.usedIn.indoor > 0 ? 1 : 0) +
                           (mat.usedIn.mobile > 0 ? 1 : 0) +
                           (mat.usedIn.lsend > 0 ? 1 : 0);

        return [{
          id: mat.id,
          groupId: group.id,
          groupLabel: group.label,
          standardCode: mat.standardCode,
          dbName: mat.name,
          dbSpec: mat.spec,
          dbSupplier: mat.supplier,
          dbUnitPrice: mat.unitPrice,
          usageCount,
          variants,
          analysis: group.analysis,
          solution: group.solution,
        }];
      });
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
      const keyword = searchTerm.toLowerCase();
      const variantText = [item.variants.outdoor, item.variants.indoor, item.variants.mobile]
        .flatMap(cell => cell ? [cell.name, cell.spec] : [])
        .join(' ')
        .toLowerCase();
      const matchSearch = 
        item.standardCode.toLowerCase().includes(keyword) ||
        item.groupLabel.toLowerCase().includes(keyword) ||
        item.dbName.toLowerCase().includes(keyword) ||
        item.dbSpec.toLowerCase().includes(keyword) ||
        item.dbSupplier.toLowerCase().includes(keyword) ||
        variantText.includes(keyword) ||
        item.analysis.toLowerCase().includes(keyword) ||
        item.solution.toLowerCase().includes(keyword);

      const matchSupplier = 
        selectedSupplier === 'ALL' || item.dbSupplier.includes(selectedSupplier);

      return matchSearch && matchSupplier;
    });
  }, [divergentList, searchTerm, selectedSupplier]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* 1. 핵심 요약 헤더 카드 */}
      <div className="bg-white border border-rose-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-100 pb-5">
          <div className="flex items-start gap-3">
            <span className="p-2.5 bg-rose-100 text-[#BA1B2D] rounded-xl mt-0.5">
              <AlertTriangle className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">
                  동일 자재 품명 상이 현황 및 통합 관리
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  관리 대상 {divergentList.length}종
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                같은 부품인데 원장마다 품명이 다른 경우만 여기에 둡니다. 지금은 해당 품목이 없습니다.
              </p>
            </div>
          </div>
        </div>

        {/* 핵심 효과 요약 지표 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
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
            <div className="text-2xl font-black text-amber-950">{divergentList.length === 0 ? '대상 없음' : '표준화 추진 중'}</div>
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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-12 text-center">No</th>
                <th className="py-3 px-3 min-w-[190px]">품목명</th>
                <th className="py-3 px-3 min-w-[140px]">상세 규격</th>
                <th className="py-3 px-3 text-center min-w-[100px]">상태</th>
                <th className="py-3 px-3 text-center bg-emerald-50 text-emerald-950 border-l border-r border-slate-200 min-w-[160px]">
                  옥외보관함 품목명 / 상세 규격
                </th>
                <th className="py-3 px-3 text-center bg-rose-50 text-rose-950 border-r border-slate-200 min-w-[160px]">
                  스마트 실내보관함 품목명 / 상세 규격
                </th>
                <th className="py-3 px-3 text-center bg-amber-50 text-amber-950 border-r border-slate-200 min-w-[160px]">
                  이동형보관함 품목명 / 상세 규격
                </th>
                <th className="py-3 px-3 min-w-[120px]">주 공급처</th>
                <th className="py-3 px-3 text-right min-w-[80px]">DB 단가</th>
                <th className="py-3 px-4 min-w-[260px]">원장 대조 분석 및 통합 방안</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    현재 원장 간 품명이 다른 동일 부품은 없습니다.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => (
                  <tr key={item.standardCode || item.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-3 px-3 text-center text-slate-400 font-mono font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-[10px] font-semibold text-slate-500">{item.groupLabel}</div>
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
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-2xs bg-emerald-100 text-emerald-900 border-emerald-300">
                        품명 유지
                      </span>
                    </td>

                    {(['outdoor', 'indoor', 'mobile'] as const).map((model) => {
                      const cell = item.variants[model];
                      const tone = model === 'outdoor'
                        ? 'border-l border-r border-slate-200 bg-emerald-50/20'
                        : 'border-r border-slate-200 ' + (model === 'indoor' ? 'bg-rose-50/20' : 'bg-amber-50/20');
                      return (
                        <td key={model} className={`py-3 px-3 ${tone}`}>
                          {cell ? (
                            <div className="text-left">
                              <div className="font-bold text-slate-900">{cell.name}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5" title={cell.spec}>{cell.spec}</div>
                            </div>
                          ) : (
                            <span className="block text-center text-slate-300">미사용</span>
                          )}
                        </td>
                      );
                    })}

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
                        <span className="mr-1">↳ [유지 결정]</span>
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
    </div>
  );
};
