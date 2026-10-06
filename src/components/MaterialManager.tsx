import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet,
  Package, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  SlidersHorizontal,
  Info,
  Layers,
  Building2,
  DollarSign
} from 'lucide-react';
import { MaterialItem, MainCategory, CommonalityLevel } from '../types/inventory';
import { ModelFilter, modelUsage, productById } from '../lib/productModels';
import { downloadExcel } from '../utils/excelExport';

interface MaterialManagerProps {
  materials: MaterialItem[];
  onAddMaterial: (material: MaterialItem) => void;
  onUpdateMaterial: (material: MaterialItem) => void;
  onDeleteMaterial: (id: number) => void;
}

const CATEGORY_NAMES: Record<MainCategory, string> = {
  EL: '전장 / 전원',
  SW: '스위치 / 센서',
  CB: '제어보드 / 통신',
  OP: '광학 / 음향',
  ME: '기구 / 외장',
  CA: '배선 / 열선',
};

export const MaterialManager: React.FC<MaterialManagerProps> = ({
  materials,
  onAddMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedModel, setSelectedModel] = useState<ModelFilter>('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MaterialItem | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<MaterialItem>>({
    name: '',
    spec: '',
    category: 'EL',
    categoryName: '전장 / 전원',
    unit: 'EA',
    unitPrice: 1000,
    supplier: '',
    contactPerson: '',
    phone: '',
    notes: '',
    usedIn: { outdoor: 0, indoor: 0, indoorGeneral: 0, mobile: 0, lsend: 0 },
    currentStock: 100,
    safetyStock: 30,
    leadTimeDays: 7,
    moq: 10,
  });

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

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.spec.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.notes.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;

      const matchesModel = selectedModel === 'ALL' || modelUsage(item, selectedModel) > 0;

      return matchesSearch && matchesCat && matchesModel;
    });
  }, [materials, searchTerm, selectedCategory, selectedModel]);

  // Open add modal
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      spec: '',
      category: 'EL',
      categoryName: '전장 / 전원',
      unit: 'EA',
      unitPrice: 1000,
      supplier: '',
      contactPerson: '',
      phone: '',
      notes: '',
      usedIn: { outdoor: 0, indoor: 0, indoorGeneral: 0, mobile: 0, lsend: 0 },
      currentStock: 100,
      reorderPoint: 40,
      leadTimeDays: 7,
      moq: 10,
    });
    setIsModalOpen(true);
  };

  // Open edit modal
  const handleOpenEditModal = (item: MaterialItem) => {
    setEditingItem(item);
    setFormData({
      ...item,
      reorderPoint: item.reorderPoint,
      usedIn: { ...item.usedIn },
    });
    setIsModalOpen(true);
  };

  // Submit form (add or update)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.spec?.trim()) {
      return;
    }

    const outdoorUsage = Number(formData.usedIn?.outdoor || 0);
    const indoorUsage = Number(formData.usedIn?.indoor || 0);
    const indoorGeneralUsage = Number(formData.usedIn?.indoorGeneral || 0);
    const mobileUsage = Number(formData.usedIn?.mobile || 0);
    const lsendUsage = Number(formData.usedIn?.lsend || 0);

    const usageCount = 
      (outdoorUsage > 0 ? 1 : 0) +
      (indoorUsage > 0 ? 1 : 0) +
      (mobileUsage > 0 ? 1 : 0) +
      (lsendUsage > 0 ? 1 : 0);

    let commonLevel: CommonalityLevel = 'DEDICATED';
    if (usageCount === 4) commonLevel = 'C4';
    else if (usageCount === 3) commonLevel = 'C3';
    else if (usageCount === 2) commonLevel = 'C2';

    const dailyUsage = Math.round(((outdoorUsage * 80 + indoorUsage * 150 + mobileUsage * 60 + lsendUsage * 120) / 25) * 10) / 10;
    if (formData.reorderPoint == null || Number.isNaN(Number(formData.reorderPoint))) {
      return;
    }
    const reorderPoint = Number(formData.reorderPoint);
    const leadTimeDays = Number(formData.leadTimeDays || 7);
    const safetyStock = reorderPoint;

    const category = (formData.category || 'EL') as MainCategory;
    const categoryName = CATEGORY_NAMES[category];

    if (editingItem) {
      // Update
      const updated: MaterialItem = {
        ...editingItem,
        ...formData,
        category,
        categoryName,
        name: formData.name.trim(),
        spec: formData.spec.trim(),
        unit: formData.unit || 'EA',
        unitPrice: Number(formData.unitPrice || 0),
        supplier: formData.supplier || '',
        contactPerson: formData.contactPerson || '',
        phone: formData.phone || '',
        notes: formData.notes || '',
        usedIn: {
          outdoor: outdoorUsage,
          indoor: indoorUsage,
          indoorGeneral: indoorGeneralUsage,
          mobile: mobileUsage,
          lsend: lsendUsage,
        },
        isCommon: usageCount >= 2,
        commonLevel,
        currentStock: Number(formData.currentStock || 0),
        safetyStock,
        leadTimeDays,
        dailyUsage,
        reorderPoint,
        moq: Number(formData.moq || 1),
        eoq: Math.max(Number(formData.moq || 1), Math.ceil(dailyUsage * 30)),
      };
      onUpdateMaterial(updated);
    } else {
      // Create new
      const nextId = materials.length > 0 ? Math.max(...materials.map(m => m.id)) + 1 : 1;
      const newItem: MaterialItem = {
        id: nextId,
        originalNo: nextId,
        category,
        categoryName,
        name: formData.name.trim(),
        spec: formData.spec.trim(),
        unit: formData.unit || 'EA',
        unitPrice: Number(formData.unitPrice || 0),
        supplier: formData.supplier || '',
        contactPerson: formData.contactPerson || '',
        phone: formData.phone || '',
        notes: formData.notes || '',
        usedIn: {
          outdoor: outdoorUsage,
          indoor: indoorUsage,
          indoorGeneral: indoorGeneralUsage,
          mobile: mobileUsage,
          lsend: lsendUsage,
        },
        isCommon: usageCount >= 2,
        commonLevel,
        currentStock: Number(formData.currentStock || 0),
        safetyStock,
        leadTimeDays,
        dailyUsage,
        reorderPoint,
        moq: Number(formData.moq || 1),
        eoq: Math.max(Number(formData.moq || 1), Math.ceil(dailyUsage * 30)),
      };
      onAddMaterial(newItem);
    }

    setIsModalOpen(false);
  };

  // Delete item with confirm
  const handleDelete = (item: MaterialItem) => {
    if (confirm(`'${item.name} (${item.spec})' 자재를 관리 목록에서 삭제하시겠습니까?`)) {
      onDeleteMaterial(item.id);
    }
  };

  const handleExportExcel = () => {
    const modelLabel = selectedModel === 'ALL' ? '전체모델' : productById(selectedModel).name;
    const usageHeader = selectedModel === 'ALL' ? '제품별 투입' : productById(selectedModel).usageLabel;
    const rows = filteredMaterials.map((item, index) => ({
      순번: index + 1,
      분류: item.categoryName,
      품목명: item.name,
      '상세 규격': item.spec,
      공급처: item.supplier,
      단위: item.unit,
      단가: item.unitPrice,
      [usageHeader]: selectedModel === 'ALL'
        ? `옥외 ${modelUsage(item, 'outdoor')}, 스마트 실내 ${modelUsage(item, 'indoor')}, 일반 실내 ${modelUsage(item, 'indoorGeneral')}, 이동형 ${modelUsage(item, 'mobile')}, L.SEND ${modelUsage(item, 'lsend')}`
        : modelUsage(item, selectedModel),
      '현재 재고': item.currentStock,
      '재발주 기준점': item.reorderPoint,
      '조달 소요일': item.leadTimeDays,
    }));
    downloadExcel(rows, `루씨엠_자재DB_${modelLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`, '자재 DB');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-4">
      {/* 자재 마스터 목록 검색 및 관리 툴바 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 text-[#BA1B2D] rounded-lg">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                등록 자재 목록 (총 {materials.length}종)
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#BA1B2D] hover:bg-[#a01625] rounded-xl transition-all shadow-xs shadow-red-600/20 active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>신규 자재 등록</span>
            </button>
          </div>
        </div>

        {/* Model Tabs (보관함 모델별 보기 기능) */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-xs font-bold text-slate-500 mr-1">모델별 보기:</span>
          
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
            id="btn-model-lsend-case"
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto flex-1">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="품목명, 규격, 공급처 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#BA1B2D]"
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

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full sm:w-auto text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#BA1B2D]"
              >
                <option value="ALL">모든 분류 전체</option>
                <option value="EL">전장 / 전원</option>
                <option value="SW">스위치 / 센서</option>
                <option value="CB">제어보드 / 통신</option>
                <option value="OP">광학 / 음향</option>
                <option value="ME">기구 / 외장</option>
                <option value="CA">배선 / 열선</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
            <span>조회 결과: <strong className="text-slate-800">{filteredMaterials.length}</strong>종</span>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
              title="지금 화면에 나온 품목 목록을 엑셀 파일로 저장합니다"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              엑셀 저장
            </button>
          </div>
        </div>

        {/* Materials Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-12">순번</th>
                  <th className="py-3 px-3">분류</th>
                  <th className="py-3 px-3">품목명</th>
                  <th className="py-3 px-3">상세 규격</th>
                  <th className="py-3 px-3">공급처</th>
                  <th className="py-3 px-2 text-center">단위</th>
                  <th className="py-3 px-3 text-right">단가</th>
                  <th className="py-3 px-3 text-center min-w-[90px]">
                    {selectedModel === 'ALL' ? '제품별 투입' : productById(selectedModel).usageLabel}
                  </th>
                  <th className="py-3 px-3 text-right">현재 재고</th>
                  <th className="py-3 px-3 text-right text-rose-950 font-bold">재발주 기준점</th>
                  <th className="py-3 px-3 text-center">조달 소요일</th>
                  <th className="py-3 px-3 text-center w-24">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-slate-400">
                      검색 조건과 일치하는 자재가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredMaterials.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {item.categoryName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 leading-snug">{item.name}</div>
                        {item.notes && (
                          <div className="text-[11px] text-slate-500 mt-1 flex items-start gap-1">
                            <span className="shrink-0 px-1 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              비고
                            </span>
                            <span className="line-clamp-2" title={item.notes}>{item.notes}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                        <div className="font-medium text-slate-800">{item.spec}</div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">
                        {item.supplier}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-500">
                        {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                        {item.unitPrice.toLocaleString()}원
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {selectedModel !== 'ALL' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            {modelUsage(item, selectedModel)} EA
                          </span>
                        )}
                        {selectedModel === 'ALL' && (
                          <div className="flex items-center justify-center gap-1">
                            <span 
                              title={`옥외보관함: ${item.usedIn.outdoor}개`}
                              className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                                item.usedIn.outdoor > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-300'
                              }`}
                            >
                              옥
                            </span>
                            <span 
                              title={`스마트 실내보관함: ${modelUsage(item, 'indoor')}개`}
                              className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                                item.usedIn.indoor > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-300'
                              }`}
                            >
                              실
                            </span>
                            <span
                              title={`일반 실내보관함: ${modelUsage(item, 'indoorGeneral')}개`}
                              className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                                modelUsage(item, 'indoorGeneral') > 0 ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-300'
                              }`}
                            >
                              일
                            </span>
                            <span 
                              title={`이동형보관함: ${item.usedIn.mobile}개`}
                              className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                                item.usedIn.mobile > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-300'
                              }`}
                            >
                              이
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {item.currentStock.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#BA1B2D]">
                        {item.reorderPoint.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600">
                        {item.leadTimeDays || 7}일
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1 rounded-md text-slate-500 hover:text-[#BA1B2D] hover:bg-rose-50 transition-colors"
                            title="수정"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* 등록 및 수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#BA1B2D]" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingItem ? '자재 정보 수정' : '신규 관리 대상 자재 등록'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* 기본 정보 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    품목명 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 마이크로스위치 (문열림)"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#BA1B2D]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    규격 및 상세 사양 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: V16-FA-61 (롤러레버형)"
                    value={formData.spec || ''}
                    onChange={(e) => setFormData({ ...formData, spec: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#BA1B2D]"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">※ 자재 목록 표의 [상세 규격] 열에 표시됩니다. (예: 500mm로 사양 변경 시 여기에 입력)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">자재 분류</label>
                  <select
                    value={formData.category || 'EL'}
                    onChange={(e) => {
                      const cat = e.target.value as MainCategory;
                      setFormData({ 
                        ...formData, 
                        category: cat,
                        categoryName: CATEGORY_NAMES[cat] 
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#BA1B2D] bg-white"
                  >
                    <option value="EL">전장 / 전원</option>
                    <option value="SW">스위치 / 센서</option>
                    <option value="CB">제어보드 / 통신</option>
                    <option value="OP">광학 / 음향</option>
                    <option value="ME">기구 / 외장</option>
                    <option value="CA">배선 / 열선</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">관리 단위</label>
                  <input
                    type="text"
                    placeholder="EA, M, Roll 등"
                    value={formData.unit || 'EA'}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#BA1B2D]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">구매 단가 (원)</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={formData.unitPrice || 0}
                    onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#BA1B2D]"
                  />
                </div>
              </div>

              {/* 공급처 정보 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 block">공급처 정보</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-600 block mb-1">공급처명</label>
                    <input
                      type="text"
                      placeholder="예: 유명전자, (주)파워네트"
                      value={formData.supplier || ''}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1">담당자</label>
                    <input
                      type="text"
                      placeholder="예: 김기술 부장"
                      value={formData.contactPerson || ''}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1">연락처</label>
                    <input
                      type="text"
                      placeholder="예: 010-1234-5678"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 4대 제품별 대당 투입 수량 (BOM) */}
              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 space-y-2">
                <span className="font-bold text-rose-950 block">
                  제품별 완제품 1대당 소요 수량
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="bg-white p-2 rounded-lg border border-rose-100">
                    <label className="text-emerald-900 font-semibold block mb-1">옥외보관함</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.usedIn?.outdoor || 0}
                      onChange={(e) => setFormData({
                        ...formData,
                        usedIn: { ...formData.usedIn!, outdoor: Number(e.target.value) }
                      })}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-center font-bold"
                    />
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-rose-100">
                    <label className="text-[#BA1B2D] font-semibold block mb-1">스마트 실내보관함</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.usedIn?.indoor || 0}
                      onChange={(e) => setFormData({
                        ...formData,
                        usedIn: { ...formData.usedIn!, indoor: Number(e.target.value) }
                      })}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-center font-bold"
                    />
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-rose-100">
                    <label className="text-sky-900 font-semibold block mb-1">일반 실내보관함</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.usedIn?.indoorGeneral || 0}
                      onChange={(e) => setFormData({
                        ...formData,
                        usedIn: { ...formData.usedIn!, indoorGeneral: Number(e.target.value) }
                      })}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-center font-bold"
                    />
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-rose-100">
                    <label className="text-amber-900 font-semibold block mb-1">이동형보관함</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.usedIn?.mobile || 0}
                      onChange={(e) => setFormData({
                        ...formData,
                        usedIn: { ...formData.usedIn!, mobile: Number(e.target.value) }
                      })}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-center font-bold"
                    />
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-rose-100">
                    <label className="text-indigo-900 font-semibold block mb-1">휴대용 케이스</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.usedIn?.lsend || 0}
                      onChange={(e) => setFormData({
                        ...formData,
                        usedIn: { ...formData.usedIn!, lsend: Number(e.target.value) }
                      })}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 재고 및 발주 관리 수치 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">현재 창고 재고</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.currentStock || 0}
                    onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-semibold text-rose-950 block mb-1">
                    재발주 기준점 (수량) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.reorderPoint ?? ''}
                    onChange={(e) => setFormData({ ...formData, reorderPoint: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-rose-300 bg-rose-50/40 rounded-lg font-bold text-[#BA1B2D]"
                    placeholder="예: 40"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">이 수량 이하 시 발주 알림</span>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    조달 소요일(일) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.leadTimeDays || 7}
                    onChange={(e) => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">발주 후 입고 소요일</span>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">최소 발주량 (MOQ)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.moq || 10}
                    onChange={(e) => setFormData({ ...formData, moq: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">관리 참고사항 및 비고</label>
                <input
                  type="text"
                  placeholder="예: 유명전자 직납, 롤러형 스위치"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">※ 자재 목록 표의 [품목명] 하단 [비고] 영역에 함께 표시됩니다.</span>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#BA1B2D] hover:bg-[#a01625] rounded-xl shadow-xs shadow-red-600/20"
                >
                  {editingItem ? '수정 완료' : '신규 자재 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
