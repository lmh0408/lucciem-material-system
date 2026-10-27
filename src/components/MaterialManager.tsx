import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Edit2, 
  Trash2,
  Loader2,
  Factory,
  AlertCircle, 
  CheckCircle2, 
  X, 
  SlidersHorizontal,
  Layers,
  Building2,
  DollarSign
} from 'lucide-react';
import { MaterialItem, MainCategory, CommonalityLevel } from '../types/inventory';
import { displayedCurrentStock, displayedSafetyStock, stockStatus } from '../utils/stockDisplay';
import {
  computeProductionConsumption,
  PRODUCTION_MODEL_LABELS,
  ProductionLinePreview,
  ProductionModel,
} from '../utils/productionConsumption';
import { MaterialUsedModelsCell } from './MaterialUsedModelsCell';

interface MaterialManagerProps {
  materials: MaterialItem[];
  onAddMaterial: (material: MaterialItem) => void;
  onUpdateMaterial: (material: MaterialItem) => void;
  onDeleteMaterials: (ids: number[]) => void;
  onApplyProductionConsumption?: (model: ProductionModel, productionUnits: number) => Promise<void>;
  isProductionSaving?: boolean;
  initialEditingItem?: MaterialItem | null;
  onClearInitialEditingItem?: () => void;
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
  onDeleteMaterials,
  onApplyProductionConsumption,
  isProductionSaving = false,
  initialEditingItem,
  onClearInitialEditingItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedModel, setSelectedModel] = useState<'ALL' | 'outdoor' | 'indoor' | 'mobile' | 'lsend'>('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MaterialItem | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  // Delete confirm modal state (in-app modal to prevent sandbox iframe from blocking window.confirm)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [itemsPendingDelete, setItemsPendingDelete] = useState<MaterialItem[] | null>(null);
  const [productionQty, setProductionQty] = useState<number>(0);
  const [productionEntryOpen, setProductionEntryOpen] = useState(false);
  const [productionPreview, setProductionPreview] = useState<{
    model: ProductionModel;
    units: number;
    lines: ProductionLinePreview[];
  } | null>(null);

  const isModelTab =
    selectedModel === 'outdoor' ||
    selectedModel === 'indoor' ||
    selectedModel === 'mobile' ||
    selectedModel === 'lsend';

  // Open edit modal if requested from another screen
  React.useEffect(() => {
    if (initialEditingItem) {
      handleOpenEditModal(initialEditingItem);
      onClearInitialEditingItem?.();
    }
  }, [initialEditingItem]);

  const handleCancel = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

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
    usedIn: { outdoor: 0, indoor: 0, mobile: 0, lsend: 0 },
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
      indoor: materials.filter(m => (m.usedIn?.indoor ?? 0) > 0).length,
      mobile: materials.filter(m => (m.usedIn?.mobile ?? 0) > 0).length,
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

      const matchesModel = 
        selectedModel === 'ALL' ||
        (selectedModel === 'outdoor' && (item.usedIn?.outdoor ?? 0) > 0) ||
        (selectedModel === 'indoor' && (item.usedIn?.indoor ?? 0) > 0) ||
        (selectedModel === 'mobile' && (item.usedIn?.mobile ?? 0) > 0) ||
        (selectedModel === 'lsend' && (item.usedIn?.lsend ?? 0) > 0);

      return matchesSearch && matchesCat && matchesModel;
    });
  }, [materials, searchTerm, selectedCategory, selectedModel]);

  const buildDefaultUsedIn = (model: typeof selectedModel) => {
    const base = { outdoor: 0, indoor: 0, mobile: 0, lsend: 0 };
    if (model === 'outdoor') return { ...base, outdoor: 1 };
    if (model === 'indoor') return { ...base, indoor: 1 };
    if (model === 'mobile') return { ...base, mobile: 1 };
    if (model === 'lsend') return { ...base, lsend: 1 };
    return base;
  };

  const ensureUsedInForSelectedModel = (
    model: typeof selectedModel,
    usedIn: { outdoor: number; indoor: number; mobile: number; lsend: number },
  ) => {
    if (model === 'ALL') return usedIn;
    const next = { ...usedIn };
    if (model === 'outdoor' && next.outdoor <= 0) next.outdoor = 1;
    if (model === 'indoor' && next.indoor <= 0) next.indoor = 1;
    if (model === 'mobile' && next.mobile <= 0) next.mobile = 1;
    if (model === 'lsend' && next.lsend <= 0) next.lsend = 1;
    return next;
  };

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
      usedIn: buildDefaultUsedIn(selectedModel),
      currentStock: 100,
      safetyStock: 30,
      reorderPoint: 40,
      leadTimeDays: 7,
      moq: 10,
    });
    setIsModalOpen(true);
  };

  // Open edit modal with the same safety stock the current tab shows
  const handleOpenEditModal = (item: MaterialItem) => {
    setEditingItem(item);
    setFormData({
      ...item,
      safetyStock: displayedSafetyStock(item, selectedModel),
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

    const normalizedUsedIn = ensureUsedInForSelectedModel(selectedModel, {
      outdoor: Number(formData.usedIn?.outdoor || 0),
      indoor: Number(formData.usedIn?.indoor || 0),
      mobile: Number(formData.usedIn?.mobile || 0),
      lsend: Number(formData.usedIn?.lsend || 0),
    });
    const outdoorUsage = normalizedUsedIn.outdoor;
    const indoorUsage = normalizedUsedIn.indoor;
    const mobileUsage = normalizedUsedIn.mobile;
    const lsendUsage = normalizedUsedIn.lsend;

    const usageCount = 
      (outdoorUsage > 0 ? 1 : 0) +
      (indoorUsage > 0 ? 1 : 0) +
      (mobileUsage > 0 ? 1 : 0) +
      (lsendUsage > 0 ? 1 : 0);

    let commonLevel: CommonalityLevel = 'DEDICATED';
    if (usageCount === 4) commonLevel = 'C4';
    else if (usageCount === 3) commonLevel = 'C3';
    else if (usageCount === 2) commonLevel = 'C2';
    const isCommon = usageCount >= 2;

    const dailyUsage = Math.round(((outdoorUsage * 80 + indoorUsage * 150 + mobileUsage * 60 + lsendUsage * 120) / 25) * 10) / 10;
    const leadTimeDays = Number(formData.leadTimeDays || 7);
    const enteredSafety = Number(formData.safetyStock ?? 0);
    const modelCount = [outdoorUsage, indoorUsage, mobileUsage, lsendUsage].filter((qty) => qty > 0).length;
    const shownSafety = editingItem ? displayedSafetyStock(editingItem, selectedModel) : enteredSafety;
    let safetyStock = enteredSafety;
    if (editingItem && enteredSafety === shownSafety) {
      safetyStock = Number(editingItem.safetyStock) || 0;
    } else if (selectedModel === 'ALL' && modelCount > 1) {
      safetyStock = Math.round(enteredSafety / modelCount);
    }
    const reorderPoint = editingItem ? editingItem.reorderPoint : safetyStock;

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
          mobile: mobileUsage,
          lsend: lsendUsage,
        },
        isCommon,
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
      const numericIds = materials.map((m) => m.id).filter((id) => Number.isFinite(id));
      const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
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
          mobile: mobileUsage,
          lsend: lsendUsage,
        },
        isCommon,
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
      setSearchTerm('');
      setSelectedCategory('ALL');
      setSelectedItemId(newItem.id);
    }

    setIsModalOpen(false);
  };

  const selectedMaterials = useMemo(
    () => materials.filter((item) => selectedIds.has(item.id)),
    [materials, selectedIds],
  );

  const allFilteredSelected =
    filteredMaterials.length > 0 && filteredMaterials.every((item) => selectedIds.has(item.id));

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredMaterials.forEach((item) => next.delete(item.id));
      } else {
        filteredMaterials.forEach((item) => next.add(item.id));
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

  const handleConfirmDelete = () => {
    if (!itemsPendingDelete?.length) return;
    onDeleteMaterials(itemsPendingDelete.map((item) => item.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      itemsPendingDelete.forEach((item) => next.delete(item.id));
      return next;
    });
    setItemsPendingDelete(null);
  };

  const handleCancelDelete = () => {
    setItemsPendingDelete(null);
  };

  const handleOpenProductionPreview = () => {
    if (!isModelTab || !onApplyProductionConsumption) return;
    const units = Math.floor(Number(productionQty) || 0);
    if (units <= 0) {
      window.alert('생산 수량(완제품 대수)을 1 이상 입력해 주세요.');
      return;
    }
    const lines = computeProductionConsumption(materials, selectedModel, units);
    if (lines.length === 0) {
      window.alert('이 모델 BOM에 차감할 자재가 없습니다.');
      return;
    }
    setProductionEntryOpen(false);
    setProductionPreview({ model: selectedModel, units, lines });
  };

  const handleOpenProductionEntry = () => {
    if (!isModelTab || !onApplyProductionConsumption) return;
    setProductionQty(0);
    setProductionEntryOpen(true);
  };

  const handleConfirmProduction = async () => {
    if (!productionPreview || !onApplyProductionConsumption) return;
    try {
      await onApplyProductionConsumption(productionPreview.model, productionPreview.units);
      setProductionPreview(null);
      setProductionQty(0);
    } catch {
      // App에서 토스트 처리
    }
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

          {(searchTerm || selectedCategory !== 'ALL' || selectedModel !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('ALL');
                setSelectedModel('ALL');
              }}
              className="text-xs text-[#BA1B2D] hover:underline font-medium shrink-0"
            >
              필터 초기화
            </button>
          )}

          <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
            <button
              type="button"
              disabled={selectedIds.size === 0 || isProductionSaving}
              onClick={() => setItemsPendingDelete(selectedMaterials)}
              className="inline-flex h-[37px] items-center gap-1.5 px-3 text-xs sm:text-sm font-bold rounded-xl border transition-all shrink-0 active:scale-95 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 enabled:border-rose-200 enabled:bg-rose-50 enabled:text-[#BA1B2D] enabled:hover:bg-rose-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>항목 삭제</span>
            </button>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex h-[37px] items-center gap-1.5 px-3 text-xs sm:text-sm font-bold text-white bg-[#BA1B2D] hover:bg-[#a01625] rounded-xl border border-[#BA1B2D] transition-all shadow-xs shadow-red-600/20 active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>신규 자재 등록</span>
            </button>
          </div>
        </div>

        {isModelTab && onApplyProductionConsumption && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={isProductionSaving}
              onClick={handleOpenProductionEntry}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 enabled:border-emerald-200 enabled:bg-emerald-50 enabled:text-emerald-900 enabled:hover:bg-emerald-100 enabled:hover:border-emerald-300 shadow-xs"
            >
              {isProductionSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Factory className="h-3.5 w-3.5" />
              )}
              제품 생산(자재 수량 반영)
            </button>
          </div>
        )}

        {/* Materials Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-2.5 text-center w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      aria-label="현재 목록 전체 선택"
                      className="h-4 w-4 rounded border-slate-300 text-[#BA1B2D] focus:ring-[#BA1B2D]"
                    />
                  </th>
                  <th className="py-3 px-2.5 text-center w-12">No</th>
                  <th className="py-3 px-3 min-w-[160px]">품목명 (더블 클릭 시 편집)</th>
                  <th className="py-3 px-3 min-w-[150px]">규격</th>
                  <th className="py-3 px-3 text-center min-w-[90px]">재고 상태</th>
                  <th className="py-3 px-3 text-right min-w-[90px]">현재 재고</th>
                  <th className="py-3 px-3 text-right min-w-[80px]">안전 재고</th>
                  <th className="py-3 px-3 text-center min-w-[95px]">사용 모델</th>
                  {selectedModel !== 'ALL' && (
                    <th className="py-3 px-3 text-center min-w-[90px]">대당 수량</th>
                  )}
                  <th className="py-3 px-2 text-center w-14">단위</th>
                  <th className="py-3 px-3 text-right min-w-[85px]">단가</th>
                  <th className="py-3 px-2.5 text-center min-w-[80px]">조달 소요일</th>
                  <th className="py-3 px-3 min-w-[100px]">발주처</th>
                  <th className="py-3 px-3 min-w-[120px]">담당자 / 연락처</th>
                  <th className="py-3 px-3 min-w-[130px]">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={selectedModel === 'ALL' ? 14 : 15} className="text-center py-8 text-slate-400">
                      검색 조건과 일치하는 자재가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredMaterials.map((item, idx) => {
                    const rowStatus = stockStatus(
                      displayedCurrentStock(item),
                      displayedSafetyStock(item, selectedModel),
                    );
                    const moq = item.moq || 10;
                    const shortage = displayedSafetyStock(item, selectedModel) - displayedCurrentStock(item);
                    const orderQty = rowStatus === 'ORDER_NEEDED'
                      ? Math.max(moq, shortage > 0 ? Math.ceil(shortage / moq) * moq : moq)
                      : 0;
                    return (
                    <tr 
                      key={item.id} 
                      onClick={() => setSelectedItemId(item.id)}
                      onDoubleClick={() => handleOpenEditModal(item)}
                      className={`transition-all cursor-pointer group select-none ${
                        selectedItemId === item.id 
                          ? 'bg-rose-50/90 ring-1 ring-inset ring-[#BA1B2D]/40' 
                          : 'hover:bg-slate-50/80'
                      }`}
                      title="더블 클릭하여 자재 사양 및 재고 수정"
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
                      <td className="py-2.5 px-2.5 text-center font-mono text-slate-500">
                        {idx + 1}
                      </td>

                      {/* [B열] 품목명 */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {item.categoryName}
                          </span>
                          {item.standardCode && (
                            <span className="font-mono text-[10px] text-slate-400">
                              {item.standardCode}
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-slate-900 leading-snug group-hover:text-[#BA1B2D] transition-colors">
                          {item.name}
                        </div>
                      </td>

                      {/* [C열] 규격 */}
                      <td className="py-2.5 px-3 text-slate-700">
                        <div className="font-medium text-slate-800">{item.spec}</div>
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {rowStatus === 'ORDER_NEEDED' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            발주 필요 (+{orderQty}{item.unit})
                          </span>
                        )}
                        {rowStatus === 'WARNING' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            재고 주의
                          </span>
                        )}
                        {rowStatus === 'NORMAL' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                            적정
                          </span>
                        )}
                      </td>

                      {/* 현재 재고 */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded border transition-colors ${
                          rowStatus === 'ORDER_NEEDED'
                            ? 'text-[#BA1B2D] bg-rose-50 border-rose-300 ring-1 ring-rose-200'
                            : rowStatus === 'WARNING'
                              ? 'text-amber-800 bg-amber-50 border-amber-300'
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
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                        {item.unitPrice.toLocaleString()}원
                      </td>

                      {/* [I열] 조달 소요일(일) */}
                      <td className="py-2.5 px-2.5 text-center text-slate-600 font-medium whitespace-nowrap">
                        {item.leadTimeDays || 7}일
                      </td>

                      {/* [J열] 발주처 */}
                      <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        {item.supplier || '-'}
                      </td>

                      {/* [K열] 담당자 / 연락처 */}
                      <td className="py-2.5 px-3 text-slate-600">
                        <div className="font-medium text-slate-800">{item.contactPerson || '-'}</div>
                        {item.phone && (
                          <div className="text-[11px] text-slate-500 font-mono">{item.phone}</div>
                        )}
                      </td>

                      {/* [L열] 비고 */}
                      <td className="py-2.5 px-3 text-slate-600">
                        <div className="text-[11px] line-clamp-2" title={item.notes || '-'}>
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
      </div>

      {/* 등록 및 수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[calc(100vh-2rem)] overflow-hidden border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-rose-50 text-[#BA1B2D]">
                  <Package className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingItem ? '자재 정보 및 재고 수정' : '신규 관리 대상 자재 등록'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col text-xs">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
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
                  4대 제품별 완제품 1대당 소요 수량
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                    <label className="text-[#BA1B2D] font-semibold block mb-1">실내보관함</label>
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
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 text-xs block">창고 재고 및 안전재고 설정</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">
                      현 재고 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.currentStock ?? 0}
                      onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                      className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm font-bold text-slate-900 bg-white focus:outline-hidden focus:border-[#BA1B2D] focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-rose-950 block mb-1">
                      안전 재고 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.safetyStock ?? 0}
                      onChange={(e) => setFormData({ ...formData, safetyStock: Number(e.target.value) })}
                      className="w-full px-3 py-2 border-2 border-rose-300 bg-rose-50/60 rounded-lg text-sm font-bold text-[#BA1B2D] focus:outline-hidden focus:border-[#BA1B2D] focus:ring-2 focus:ring-red-500/20"
                      placeholder="예: 30"
                    />
                  </div>
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
                <label className="font-semibold text-slate-700 block mb-1">비고</label>
                <input
                  type="text"
                  placeholder="예: 유명전자 직납, 롤러형 스위치"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              </div>

              <div className="shrink-0 border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-2.5 bg-white">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#BA1B2D] hover:bg-[#a01625] rounded-xl shadow-xs shadow-red-600/20 transition-all cursor-pointer"
                >
                  {editingItem ? '저장' : '신규 자재 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 등록 및 수정 모달 종료 */}
      {productionEntryOpen && isModelTab && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isProductionSaving && setProductionEntryOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Factory className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">제품 생산(자재 수량 반영)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {PRODUCTION_MODEL_LABELS[selectedModel]} · 완제품 1대 단위
                </p>
              </div>
            </div>
            <label className="font-bold text-slate-800 text-xs block mb-1.5">
              생산 수량 (대) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              step={1}
              autoFocus
              value={productionQty || ''}
              onChange={(e) => setProductionQty(Number(e.target.value))}
              disabled={isProductionSaving}
              className="w-full px-3 py-2.5 border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="예: 10"
            />
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isProductionSaving}
                onClick={() => setProductionEntryOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isProductionSaving}
                onClick={handleOpenProductionPreview}
                className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all"
              >
                차감 미리보기
              </button>
            </div>
          </div>
        </div>
      )}
      {productionPreview && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isProductionSaving && setProductionPreview(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[calc(100vh-2rem)] overflow-hidden border border-slate-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900">제품 생산 · 자재 차감 미리보기</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {PRODUCTION_MODEL_LABELS[productionPreview.model]} · 완제품{' '}
                  <strong className="text-slate-800">{productionPreview.units}대</strong> ·{' '}
                  {productionPreview.lines.length}종 BOM 반영
                </p>
              </div>
              <button
                type="button"
                disabled={isProductionSaving}
                onClick={() => setProductionPreview(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {productionPreview.lines.some((line) => line.isNegative) && (
              <div className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <p>
                  차감 후 재고가 <strong>0 미만</strong>인 품목이 있습니다. 정책상 반영은 가능하며, 아래 표에서
                  강조 표시됩니다.
                </p>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2 px-2">품목명</th>
                    <th className="py-2 px-2 text-right">대당</th>
                    <th className="py-2 px-2 text-right">차감</th>
                    <th className="py-2 px-2 text-right">출고 전</th>
                    <th className="py-2 px-2 text-right">출고 후</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productionPreview.lines.map((line) => (
                    <tr
                      key={line.materialId}
                      className={line.isNegative ? 'bg-rose-50/80' : undefined}
                    >
                      <td className="py-2 px-2">
                        <div className="font-bold text-slate-900">{line.name}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[220px]" title={line.spec}>
                          {line.spec}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                        {line.perUnitQty} {line.unit}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-[#BA1B2D] whitespace-nowrap">
                        −{line.consumeQty.toLocaleString()} {line.unit}
                      </td>
                      <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                        {line.beforeStock.toLocaleString()}
                      </td>
                      <td
                        className={`py-2 px-2 text-right font-mono font-bold whitespace-nowrap ${
                          line.isNegative ? 'text-rose-700' : 'text-slate-900'
                        }`}
                      >
                        {line.afterStock.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="shrink-0 border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-2.5 bg-white">
              <button
                type="button"
                disabled={isProductionSaving}
                onClick={() => setProductionPreview(null)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isProductionSaving}
                onClick={handleConfirmProduction}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-[#BA1B2D] hover:bg-[#a01625] rounded-xl shadow-xs transition-all disabled:opacity-60"
              >
                {isProductionSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                재고 반영
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 자재 삭제 확인 모달 (iFrame 환경에서도 100% 동작하는 안전한 모달) */}
      {itemsPendingDelete && itemsPendingDelete.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={handleCancelDelete}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                <Trash2 className="w-6 h-6 text-[#BA1B2D]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">자재 항목 삭제 확인</h3>
                <p className="text-xs text-slate-500">선택한 항목이 원장 및 관리 목록에서 제거됩니다.</p>
              </div>
            </div>

            <div className="mb-5 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <p className="mb-2 font-semibold text-slate-700">삭제 대상 {itemsPendingDelete.length}건</p>
              <ul className="space-y-1 text-slate-600">
                {itemsPendingDelete.map((item) => (
                  <li key={item.id} className="truncate">
                    · {item.name} ({item.spec})
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-slate-600 mb-6">
              선택한 <strong className="text-slate-900">{itemsPendingDelete.length}개</strong> 자재 항목을 삭제하시겠습니까?
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                취소 (유지)
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#BA1B2D] hover:bg-[#a01625] active:scale-95 transition-all shadow-xs shadow-red-600/30 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>삭제하기</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
