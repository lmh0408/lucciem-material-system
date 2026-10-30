import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Phone, 
  User, 
  Printer, 
  FileText, 
  AlertCircle, 
  DollarSign,
  FileDown,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { SUPPLIERS_LIST, RAW_MATERIALS_DATA } from '../data/materialsData';
import { SupplierInfo, PurchaseOrder, PurchaseOrderItem, MaterialItem } from '../types/inventory';
import { downloadPurchaseOrderAsExcel } from '../utils/purchaseOrderExport';
import { printPurchaseOrderDocument } from '../utils/purchaseOrderPrint';
import {
  fetchSuppliersFromLedger,
  upsertSupplierInLedger,
  deleteSupplierInLedger,
  deleteSuppliersInLedger,
} from '../utils/googleSheetLedger';
import {
  noteSupplierSaved,
  registerSupplierReload,
  rememberSuppliers,
  supplierBase,
} from '../utils/ledgerRevision';
import { getMaterialsBySupplier } from '../utils/supplierMatching';
import { displayedCurrentStock, displayedSafetyStock, stockStatus } from '../utils/stockDisplay';
import { SUPPLIERS_STORAGE_KEY } from '../constants/ledgerStorage';

interface SupplierOrderManagerProps {
  materials?: MaterialItem[];
  webAppUrl: string;
  onToast?: (text: string, type: 'success' | 'info' | 'error', persist?: boolean) => void;
}

const DEFAULT_PO_TERMS = [
  '모든 납품 자재는 본사 사전 승인된 규격서 및 시험성적서를 만족해야 합니다.',
  '납기 지연 시 일 지체상금률(0.15%)이 적용될 수 있습니다.',
  '물품 인수 검수 시 불량품 발생 시 즉시 무상 교환을 원칙으로 합니다.',
];

const PoEditable: React.FC<{
  editing: boolean;
  value: string;
  onStart: () => void;
  onCommit: (next: string) => void;
  onCancel: () => void;
  className?: string;
  inputClassName?: string;
  numeric?: boolean;
}> = ({ editing, value, onStart, onCommit, onCancel, className, inputClassName, numeric }) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (editing) setDraft(value);
  }, [editing, value]);

  if (!editing) {
    return (
      <span onDoubleClick={onStart} title="더블클릭하여 편집" className={`cursor-text ${className ?? ''}`}>
        {value || '\u00A0'}
      </span>
    );
  }

  return (
    <input
      autoFocus
      type={numeric ? 'number' : 'text'}
      min={numeric ? 0 : undefined}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          onCommit(draft);
        }
      }}
      className={inputClassName}
    />
  );
};

export const SupplierOrderManager: React.FC<SupplierOrderManagerProps> = ({
  materials = RAW_MATERIALS_DATA,
  webAppUrl,
  onToast,
}) => {
  // Suppliers state with LocalStorage cache + 구글 원장 협력사관리DB
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>(() => {
    try {
      const saved = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return SUPPLIERS_LIST;
  });

  useEffect(() => {
    let isMounted = true;
    const loadSuppliers = async () => {
      try {
        const ledgerList = await fetchSuppliersFromLedger(webAppUrl);
        if (!isMounted || ledgerList.length === 0) return;
        rememberSuppliers(ledgerList);
        setSuppliers(ledgerList);
        localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(ledgerList));
      } catch (err) {
        console.warn('원장 협력사 불러오기 실패, 로컬 캐시 유지:', err);
      }
    };
    const unregister = registerSupplierReload(loadSuppliers);
    loadSuppliers();
    return () => {
      isMounted = false;
      unregister();
    };
  }, [webAppUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(suppliers));
    } catch {
      // ignore
    }
  }, [suppliers]);

  // Modal states for Supplier Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierInfo | null>(null);
  const [formData, setFormData] = useState<Partial<SupplierInfo>>({
    name: '',
    category: '',
    contactPerson: '',
    phone: '',
    leadTimeAvgDays: 7,
    reliability: 'A',
  });

  const [selectedSupplier, setSelectedSupplier] = useState<SupplierInfo | null>(null);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());
  const [confirmSupplierBulkDelete, setConfirmSupplierBulkDelete] = useState(false);
  const [selectedPoLineIndexes, setSelectedPoLineIndexes] = useState<Set<number>>(new Set());
  const [activePO, setActivePO] = useState<PurchaseOrder | null>(null);
  const [poEditKey, setPoEditKey] = useState<string | null>(null);

  useEffect(() => {
    setSelectedPoLineIndexes(new Set());
  }, [activePO?.orderNumber]);
  const [isExportingPoFile, setIsExportingPoFile] = useState(false);

  // Open add modal
  const handleOpenAddModal = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      category: '',
      contactPerson: '',
      phone: '',
      leadTimeAvgDays: 7,
      reliability: 'A',
    });
    setIsModalOpen(true);
  };

  // Open edit modal
  const handleOpenEditModal = (supplier: SupplierInfo) => {
    setEditingSupplier(supplier);
    setFormData({
      ...supplier,
    });
    setIsModalOpen(true);
  };

  // Submit add or edit
  const handleSubmitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    if (editingSupplier) {
      const updated: SupplierInfo = {
        ...editingSupplier,
        name: formData.name!.trim(),
        category: formData.category?.trim() || '일반 부품',
        contactPerson: formData.contactPerson?.trim() || '',
        phone: formData.phone?.trim() || '',
        leadTimeAvgDays: Number(formData.leadTimeAvgDays) || 7,
        reliability: (formData.reliability as 'A' | 'B' | 'C') || 'A',
        updatedAt: new Date().toISOString(),
      };
      setSuppliers((prev) => prev.map((s) => (s.id === editingSupplier.id ? updated : s)));
      onToast?.(`협력사 '${updated.name}' 저장 중입니다.`, 'info', true);
      try {
        const saved = await upsertSupplierInLedger(webAppUrl, updated, supplierBase(editingSupplier.id));
        noteSupplierSaved(saved.id, saved.updatedAt);
        setSuppliers((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
        onToast?.(`'${saved.name}' 협력사를 시트에 반영했습니다.`, 'success');
      } catch (err) {
        console.error('원장 협력사 수정 실패:', err);
        const message = err instanceof Error ? err.message : '저장 실패';
        onToast?.(`협력사 저장 실패: ${message}`, 'error');
        const ledgerList = await fetchSuppliersFromLedger(webAppUrl);
        if (ledgerList.length > 0) {
          rememberSuppliers(ledgerList);
          setSuppliers(ledgerList);
        }
      }
    } else {
      const nextNum = suppliers.length + 1;
      const newId = `V-${String(nextNum).padStart(3, '0')}`;
      const newSupplier: SupplierInfo = {
        id: newId,
        name: formData.name!.trim(),
        category: formData.category?.trim() || '일반 부품',
        contactPerson: formData.contactPerson?.trim() || '',
        phone: formData.phone?.trim() || '',
        itemsCount: 0,
        leadTimeAvgDays: Number(formData.leadTimeAvgDays) || 7,
        reliability: (formData.reliability as 'A' | 'B' | 'C') || 'A',
      };
      setSuppliers((prev) => [...prev, newSupplier]);
      onToast?.(`협력사 '${newSupplier.name}' 저장 중입니다.`, 'info', true);
      try {
        const saved = await upsertSupplierInLedger(webAppUrl, newSupplier);
        noteSupplierSaved(saved.id, saved.updatedAt);
        setSuppliers((prev) => prev.map((s) => (s.id === newSupplier.id ? saved : s)));
        onToast?.(`'${saved.name}' 협력사를 시트에 반영했습니다.`, 'success');
      } catch (err) {
        console.error('원장 협력사 추가 실패:', err);
        const message = err instanceof Error ? err.message : '저장 실패';
        onToast?.(`협력사 저장 실패: ${message}`, 'error');
        const ledgerList = await fetchSuppliersFromLedger(webAppUrl);
        if (ledgerList.length > 0) {
          rememberSuppliers(ledgerList);
          setSuppliers(ledgerList);
        }
      }
    }

    setIsModalOpen(false);
  };

  const handleDeleteSupplier = async (supplier: SupplierInfo) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== supplier.id));
    await deleteSupplierInLedger(webAppUrl, supplier.id, supplier.recordUuid);
  };

  const toggleSupplierSelection = (id: string) => {
    setSelectedSupplierIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmSupplierBulkDelete = async () => {
    const targets = suppliers.filter((supplier) => selectedSupplierIds.has(supplier.id));
    if (targets.length === 0) {
      setConfirmSupplierBulkDelete(false);
      return;
    }
    const label = targets.length === 1 ? `'${targets[0].name}'` : `${targets.length}곳`;
    onToast?.(`협력사 ${label} 삭제 중입니다.`, 'info', true);
    setSuppliers((prev) => prev.filter((supplier) => !selectedSupplierIds.has(supplier.id)));
    try {
      try {
        await deleteSuppliersInLedger(
          webAppUrl,
          targets.map((supplier) => ({ id: supplier.id, recordUuid: supplier.recordUuid })),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        if (!message.includes('Unknown action') && !message.includes('다른 응답')) throw err;
        for (const supplier of targets) {
          await deleteSupplierInLedger(webAppUrl, supplier.id, supplier.recordUuid);
        }
      }
      rememberSuppliers(
        suppliers.filter((supplier) => !selectedSupplierIds.has(supplier.id)),
      );
      onToast?.(`협력사 ${label}을 시트에서 삭제했습니다.`, 'success');
    } catch (err) {
      console.error('원장 협력사 삭제 실패:', err);
      const message = err instanceof Error ? err.message : '협력사 삭제 실패';
      onToast?.(`협력사 삭제 실패: ${message}`, 'error');
      try {
        const ledgerList = await fetchSuppliersFromLedger(webAppUrl);
        if (ledgerList.length > 0) {
          rememberSuppliers(ledgerList);
          setSuppliers(ledgerList);
        }
      } catch {
        // 화면 목록은 삭제 시도 상태를 유지한다.
      }
    }
    setSelectedSupplierIds(new Set());
    setConfirmSupplierBulkDelete(false);
  };

  const withRecalculatedTotals = (items: PurchaseOrder['items']) => {
    const nextItems = items.map((item) => {
      const orderQty = Number(item.orderQty) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      return { ...item, orderQty, unitPrice, totalPrice: orderQty * unitPrice };
    });
    const totalAmount = nextItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const vatAmount = Math.round(totalAmount * 0.1);
    return {
      items: nextItems,
      totalAmount,
      vatAmount,
      grandTotal: totalAmount + vatAmount,
    };
  };

  const patchPo = (patch: Partial<PurchaseOrder>) => {
    setActivePO((prev) => (prev ? { ...prev, ...patch } : prev));
    setPoEditKey(null);
  };

  const addPoLine = () => {
    if (!activePO) return;
    const nextIndex = activePO.items.length;
    const item: PurchaseOrderItem = {
      materialId: Date.now(),
      name: '신규 품목',
      spec: '',
      unit: 'EA',
      unitPrice: 0,
      orderQty: 1,
      totalPrice: 0,
      currentStock: 0,
      safetyStock: 0,
      supplier: activePO.supplier,
      reason: '수기 추가',
    };
    setActivePO({
      ...activePO,
      ...withRecalculatedTotals([...activePO.items, item]),
    });
    setPoEditKey(`item-${nextIndex}-name`);
  };

  const updatePoItem = (index: number, patch: Partial<PurchaseOrder['items'][number]>) => {
    if (!activePO) return;
    const items = activePO.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    );
    setActivePO({ ...activePO, ...withRecalculatedTotals(items) });
    setPoEditKey(null);
  };

  const poField = (
    key: string,
    value: string,
    onCommit: (next: string) => void,
    className: string,
    inputClassName: string,
    numeric = false,
  ) => (
    <PoEditable
      editing={poEditKey === key}
      value={value}
      numeric={numeric}
      onStart={() => setPoEditKey(key)}
      onCancel={() => setPoEditKey(null)}
      onCommit={onCommit}
      className={className}
      inputClassName={inputClassName}
    />
  );

  const removeSelectedPoLines = () => {
    if (!activePO || selectedPoLineIndexes.size === 0) return;
    const remainingItems = activePO.items.filter((_, index) => !selectedPoLineIndexes.has(index));
    setActivePO({
      ...activePO,
      ...withRecalculatedTotals(remainingItems),
    });
    setSelectedPoLineIndexes(new Set());
  };

  // Generate PO for a selected supplier
  const handleGeneratePO = (supplier: SupplierInfo) => {
    const supplierMaterials = getMaterialsBySupplier(materials, supplier);
    if (supplierMaterials.length === 0) {
      window.alert(
        `「${supplier.name}」 협력사와 발주처가 일치하는 자재가 자재 DB에 없습니다. 자재 DB의 발주처 필드를 확인해 주세요.`,
      );
      return;
    }

    const poItems: PurchaseOrderItem[] = supplierMaterials.map(m => {
      const orderQty = m.currentStock <= m.reorderPoint ? m.eoq : m.moq;
      const totalPrice = orderQty * m.unitPrice;
      return {
        materialId: m.id,
        name: m.name,
        spec: m.spec,
        unit: m.unit,
        unitPrice: m.unitPrice,
        orderQty,
        totalPrice,
        currentStock: m.currentStock,
        safetyStock: m.safetyStock,
        supplier: supplier.name,
        reason: m.currentStock <= m.reorderPoint ? '안전재고 기준 도달에 따른 자동 발주' : '생산 계획 대비 완충 확보',
      };
    });

    const totalAmount = poItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const vatAmount = Math.round(totalAmount * 0.1);
    const grandTotal = totalAmount + vatAmount;

    const today = new Date();
    const dueDate = new Date();
    dueDate.setDate(today.getDate() + supplier.leadTimeAvgDays);

    const generatedPO: PurchaseOrder = {
      documentTitle: '자 재 발 주 서',
      orderNumber: `발주-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${supplier.id}`,
      orderDate: today.toISOString().slice(0, 10),
      supplier: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      deliveryDueDate: dueDate.toISOString().slice(0, 10),
      buyerName: '주식회사 루씨엠',
      buyerBusinessNumber: '119-86-59000',
      deliveryPlace: '루씨엠 중앙제조센터 제1생산공장',
      buyerContact: '자재구매팀 선임매니저 (02-851-7100)',
      paymentTerms: '마감 익월 30일 현금 또는 계좌이체',
      terms: [...DEFAULT_PO_TERMS],
      confirmLabel: '발주처 확인인',
      confirmCompany: '주식회사 루씨엠',
      confirmNote: '직인생략',
      items: poItems,
      totalAmount,
      vatAmount,
      grandTotal,
      status: 'DRAFT',
    };

    setSelectedSupplier(supplier);
    setPoEditKey(null);
    setActivePO(generatedPO);
  };

  const handleDownloadPO_File = async () => {
    if (!activePO || isExportingPoFile) return;
    try {
      setIsExportingPoFile(true);
      await downloadPurchaseOrderAsExcel(
        activePO,
        `루씨엠_발주서_${activePO.supplier}_${activePO.orderNumber}.xlsx`,
      );
    } catch (e) {
      console.error('Failed to export PO Excel', e);
      window.alert('Excel 파일 저장에 실패했습니다. 브라우저 다운로드 설정을 확인해 주세요.');
    } finally {
      setIsExportingPoFile(false);
    }
  };

  const handlePrintPO = () => {
    if (!activePO) return;
    printPurchaseOrderDocument(activePO.orderNumber);
  };

  const partyField = (label: string, value: string, onChange: (next: string) => void, emphasize = false) => (
    <label className="flex items-center gap-2 py-0.5">
      <span className="w-24 shrink-0 text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 outline-none focus:border-[#BA1B2D] ${emphasize ? 'font-bold text-slate-900' : 'text-slate-800'}`}
      />
    </label>
  );

  // Export CSV of materials needing order
  const handleExportOrderNeededCSV = () => {
    const orderNeededList = materials.filter(
      (item) => stockStatus(displayedCurrentStock(item), displayedSafetyStock(item, 'ALL')) === 'ORDER_NEEDED',
    );

    if (orderNeededList.length === 0) {
      return;
    }

    const headers = ['순번', '품목명', '규격', '단가', '현재고', '안전재고', '조달소요일', '공급처'];
    const rows = orderNeededList.map((item, index) => [
      index + 1,
      `"${item.name}"`,
      `"${item.spec}"`,
      item.unitPrice,
      displayedCurrentStock(item),
      displayedSafetyStock(item, 'ALL'),
      item.leadTimeDays,
      `"${item.supplier}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `루씨엠_발주대상목록_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-4">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-100 text-[#BA1B2D] rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                협력사 관리 및 발주서 발행
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                등록 협력사 총 {suppliers.length}개사 관리 중
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportOrderNeededCSV}
              className="inline-flex h-[37px] items-center justify-center gap-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl border border-transparent transition-all shrink-0 active:scale-95"
              title="현재고가 안전재고의 50% 미만인 자재 목록을 CSV 파일로 다운로드합니다"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-600" />
              <span>발주 대상 다운로드</span>
            </button>

            <button
              type="button"
              disabled={selectedSupplierIds.size === 0}
              onClick={() => setConfirmSupplierBulkDelete(true)}
              className="inline-flex h-[37px] items-center justify-center gap-1.5 px-3 text-xs sm:text-sm font-bold rounded-xl border transition-all shrink-0 active:scale-95 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 enabled:border-rose-200 enabled:bg-rose-50 enabled:text-[#BA1B2D] enabled:hover:bg-rose-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>협력사 삭제</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="inline-flex h-[37px] items-center justify-center gap-1.5 px-3 bg-[#BA1B2D] hover:bg-[#a01625] text-white text-xs sm:text-sm font-bold rounded-xl border border-[#BA1B2D] shadow-xs shadow-red-600/20 transition-all shrink-0 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>신규 협력사 등록</span>
            </button>
          </div>
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map((supplier) => {
          // Count items needing order
          const matchedMaterials = getMaterialsBySupplier(materials, supplier);
          const needingOrder = matchedMaterials.filter(
            (item) => stockStatus(displayedCurrentStock(item), displayedSafetyStock(item, 'ALL')) === 'ORDER_NEEDED',
          );

          return (
            <div 
              key={supplier.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-rose-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedSupplierIds.has(supplier.id)}
                      onChange={() => toggleSupplierSelection(supplier.id)}
                      aria-label={`${supplier.name} 선택`}
                      className="h-4 w-4 rounded border-slate-300 text-[#BA1B2D] focus:ring-[#BA1B2D]"
                    />
                    <span className="text-xs font-mono font-bold text-[#BA1B2D] bg-rose-50 px-2 py-0.5 rounded">
                      {supplier.id}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      평균 납기 {supplier.leadTimeAvgDays}일
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(supplier)}
                      className="p-1 text-slate-400 hover:text-[#BA1B2D] hover:bg-rose-50 rounded-md transition-colors"
                      title="협력사 정보 수정"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-900 mt-1">{supplier.name}</h3>
                <p className="text-xs text-slate-500 mb-3">{supplier.category}</p>

                <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-800">{supplier.contactPerson || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{supplier.phone || '-'}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-slate-500">관리 품목: <strong>{matchedMaterials.length}종</strong></span>
                  {needingOrder.length > 0 ? (
                    <span className="text-rose-600 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      발주 필요 {needingOrder.length}건
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-medium">재고 적정</span>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleGeneratePO(supplier)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-[#BA1B2D] hover:bg-[#a01625] rounded-lg shadow-xs transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>정식 발주서 자동 생성</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Supplier Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-50 text-[#BA1B2D] rounded-lg">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingSupplier ? '협력사 정보 수정' : '신규 협력사 등록'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  협력사 상호명 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 유명전자, (주)파워네트"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#BA1B2D] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  주요 공급 품목 / 분류
                </label>
                <input
                  type="text"
                  placeholder="예: 마이크로스위치 및 센서류, 전원공급장치"
                  value={formData.category || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#BA1B2D] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    담당자 성명
                  </label>
                  <input
                    type="text"
                    placeholder="예: 홍길동 팀장"
                    value={formData.contactPerson || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#BA1B2D] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    연락처 / 전화번호
                  </label>
                  <input
                    type="text"
                    placeholder="02-1234-5678"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#BA1B2D] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    평균 납기 (일)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={formData.leadTimeAvgDays || 7}
                    onChange={(e) => setFormData(prev => ({ ...prev, leadTimeAvgDays: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#BA1B2D] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    신용 등급
                  </label>
                  <select
                    value={formData.reliability || 'A'}
                    onChange={(e) => setFormData(prev => ({ ...prev, reliability: e.target.value as 'A' | 'B' | 'C' }))}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#BA1B2D] focus:outline-hidden bg-white"
                  >
                    <option value="A">A 등급 (우수)</option>
                    <option value="B">B 등급 (보통)</option>
                    <option value="C">C 등급 (관리대상)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[#BA1B2D] hover:bg-[#a01625] rounded-xl shadow-xs shadow-red-600/20 transition-colors"
                >
                  {editingSupplier ? '수정 완료' : '협력사 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formal Purchase Order Modal / Printable Area */}
      {activePO && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-transparent print:relative">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 sm:p-10 my-auto border border-slate-200 relative print:border-none print:shadow-none print:p-0">
            {/* Modal Controls (Hidden in Print) */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6 print:hidden">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-[#BA1B2D]">
                  발주서 초안
                </span>
                <span className="text-sm font-bold text-slate-800">
                  발주서 미리보기
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleDownloadPO_File}
                  disabled={isExportingPoFile}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#BA1B2D] hover:bg-[#a01625] rounded-lg shadow-xs transition-colors disabled:opacity-50"
                  title="발주서를 Excel(.xlsx) 파일로 저장"
                >
                  {isExportingPoFile ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>저장 중...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-3.5 h-3.5" />
                      <span>발주서 파일 저장</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handlePrintPO}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>인쇄</span>
                </button>

                <button
                  onClick={() => setActivePO(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Official Purchase Order Document Sheet */}
            <div id="purchase-order-document" className="mx-auto w-full max-w-[794px] border-2 border-slate-900 bg-white p-6 text-slate-900 font-sans sm:p-8">
              <div className="po-head flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-slate-900 pb-4">
                <h1 className="text-2xl sm:text-3xl font-black tracking-widest text-slate-900">
                  {poField(
                    'documentTitle',
                    activePO.documentTitle,
                    (next) => patchPo({ documentTitle: next }),
                    'font-black tracking-widest',
                    'w-full bg-white text-2xl font-black tracking-widest outline-none',
                  )}
                </h1>
                <div className="mt-2 sm:mt-0 text-right text-xs">
                  <p className="font-mono font-bold text-sm text-[#BA1B2D]">
                    {poField('orderNumber', activePO.orderNumber, (next) => patchPo({ orderNumber: next }), 'font-mono font-bold text-[#BA1B2D]', 'w-full bg-white text-right font-mono font-bold text-[#BA1B2D] outline-none')}
                  </p>
                  <p className="text-slate-600">
                    발주일자:{' '}
                    {poField('orderDate', activePO.orderDate, (next) => patchPo({ orderDate: next }), '', 'bg-white text-right outline-none')}
                  </p>
                  <p className="text-rose-600 font-semibold">
                    납기요청일:{' '}
                    {poField('deliveryDueDate', activePO.deliveryDueDate, (next) => patchPo({ deliveryDueDate: next }), 'text-rose-600 font-semibold', 'bg-white text-right font-semibold text-rose-600 outline-none')}
                  </p>
                </div>
              </div>

              <div className="po-party-grid mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs border border-slate-300 p-3 rounded-lg bg-slate-50/50">
                <div className="space-y-1 pr-2">
                  <p className="font-bold text-[#BA1B2D] border-b border-slate-200 pb-1">발주자</p>
                  {partyField('상호명', activePO.buyerName, (next) => patchPo({ buyerName: next }), true)}
                  {partyField('사업자등록번호', activePO.buyerBusinessNumber, (next) => patchPo({ buyerBusinessNumber: next }))}
                  {partyField('납품장소', activePO.deliveryPlace, (next) => patchPo({ deliveryPlace: next }))}
                  {partyField('발주담당', activePO.buyerContact, (next) => patchPo({ buyerContact: next }))}
                </div>
                <div className="po-party-supplier space-y-1 border-t border-slate-200 pl-0 pt-2 md:border-l md:border-t-0 md:pl-2 md:pt-0">
                  <p className="font-bold text-slate-800 border-b border-slate-200 pb-1">공급자</p>
                  {partyField('상호명', activePO.supplier, (next) => patchPo({ supplier: next }), true)}
                  {partyField('담당자', activePO.contactPerson, (next) => patchPo({ contactPerson: next }))}
                  {partyField('연락처', activePO.phone, (next) => patchPo({ phone: next }))}
                  {partyField('결제조건', activePO.paymentTerms, (next) => patchPo({ paymentTerms: next }))}
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2 print:hidden pdf-export-hidden">
                <button
                  type="button"
                  onClick={addPoLine}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-3 w-3" />
                  항목 추가
                </button>
                <button
                  type="button"
                  disabled={selectedPoLineIndexes.size === 0}
                  onClick={removeSelectedPoLines}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 enabled:border-rose-200 enabled:bg-rose-50 enabled:text-[#BA1B2D] enabled:hover:bg-rose-100"
                >
                  <Trash2 className="h-3 w-3" />
                  내역 삭제
                </button>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border border-slate-300">
                  <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-800">
                    <tr>
                      <th className="p-2 w-8 text-center print:hidden pdf-export-hidden">
                        <input
                          type="checkbox"
                          checked={
                            activePO.items.length > 0 &&
                            activePO.items.every((_, index) => selectedPoLineIndexes.has(index))
                          }
                          onChange={() => {
                            if (activePO.items.every((_, index) => selectedPoLineIndexes.has(index))) {
                              setSelectedPoLineIndexes(new Set());
                            } else {
                              setSelectedPoLineIndexes(new Set(activePO.items.map((_, index) => index)));
                            }
                          }}
                          aria-label="발주 품목 전체 선택"
                          className="h-3.5 w-3.5 rounded border-slate-300 text-[#BA1B2D] focus:ring-[#BA1B2D]"
                        />
                      </th>
                      <th className="p-2 w-10 text-center">순번</th>
                      <th className="p-2">품목명 및 규격</th>
                      <th className="p-2 text-center">단위</th>
                      <th className="p-2 text-right">발주수량</th>
                      <th className="p-2 text-right">단가(원)</th>
                      <th className="p-2 text-right">공급가액(원)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activePO.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2 text-center print:hidden pdf-export-hidden">
                          <input
                            type="checkbox"
                            checked={selectedPoLineIndexes.has(idx)}
                            onChange={() => {
                              setSelectedPoLineIndexes((prev) => {
                                const next = new Set(prev);
                                if (next.has(idx)) next.delete(idx);
                                else next.add(idx);
                                return next;
                              });
                            }}
                            aria-label={`${item.name} 선택`}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-[#BA1B2D] focus:ring-[#BA1B2D]"
                          />
                        </td>
                        <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                        <td className="p-2">
                          <div className="font-bold">
                            {poField(`item-${idx}-name`, item.name, (next) => updatePoItem(idx, { name: next }), 'block font-bold', 'w-full bg-white text-xs font-bold outline-none')}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {poField(`item-${idx}-spec`, item.spec, (next) => updatePoItem(idx, { spec: next }), 'block text-[11px] text-slate-500', 'mt-0.5 w-full bg-white text-[11px] text-slate-500 outline-none')}
                          </div>
                        </td>
                        <td className="p-2 text-center font-medium">
                          {poField(`item-${idx}-unit`, item.unit, (next) => updatePoItem(idx, { unit: next }), 'font-medium', 'w-14 bg-white text-center text-xs outline-none')}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {poField(`item-${idx}-qty`, String(item.orderQty), (next) => updatePoItem(idx, { orderQty: Number(next) || 0 }), 'font-mono font-bold', 'w-20 bg-white text-right font-mono text-xs font-bold outline-none', true)}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {poField(`item-${idx}-price`, String(item.unitPrice), (next) => updatePoItem(idx, { unitPrice: Number(next) || 0 }), 'font-mono', 'w-24 bg-white text-right font-mono text-xs outline-none', true)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          {item.totalPrice.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-900 bg-slate-50 font-bold">
                    <tr>
                      <td colSpan={6} className="p-2 text-right text-slate-600">공급가액 소계:</td>
                      <td className="p-2 text-right font-mono">{activePO.totalAmount.toLocaleString()}원</td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="p-2 text-right text-slate-600">부가가치세 (10%):</td>
                      <td className="p-2 text-right font-mono">{activePO.vatAmount.toLocaleString()}원</td>
                    </tr>
                    <tr className="text-sm bg-rose-50 text-rose-950 font-black">
                      <td colSpan={6} className="p-2 text-right">총 발주 금액 (부가세 포함):</td>
                      <td className="p-2 text-right font-black font-mono text-[#BA1B2D]">{activePO.grandTotal.toLocaleString()}원</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Terms & Official Stamp */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-600 pt-4 border-t border-slate-200">
                <div className="space-y-1">
                  {activePO.terms.map((term, index) => (
                    <p key={index}>
                      {index + 1}.{' '}
                      {poField(
                        `term-${index}`,
                        term,
                        (next) => {
                          const terms = [...activePO.terms];
                          terms[index] = next;
                          patchPo({ terms });
                        },
                        '',
                        'w-full bg-white outline-none',
                      )}
                    </p>
                  ))}
                </div>

                <div className="border border-slate-400 p-3 rounded-md text-center min-w-[140px] bg-slate-50">
                  <span className="text-[10px] text-slate-500 block">
                    {poField('confirmLabel', activePO.confirmLabel, (next) => patchPo({ confirmLabel: next }), 'text-[10px] text-slate-500', 'w-full bg-slate-50 text-center text-[10px] outline-none')}
                  </span>
                  <span className="text-xs font-bold text-slate-900 block mt-1">
                    {poField('confirmCompany', activePO.confirmCompany, (next) => patchPo({ confirmCompany: next }), 'text-xs font-bold', 'w-full bg-slate-50 text-center text-xs font-bold outline-none')}
                  </span>
                  <div className="w-10 h-10 border border-rose-400 rounded-full mx-auto my-1 flex items-center justify-center text-[10px] text-rose-500 font-bold">
                    {poField('confirmNote', activePO.confirmNote, (next) => patchPo({ confirmNote: next }), 'text-[10px] text-rose-500 font-bold', 'w-8 bg-transparent text-center text-[10px] font-bold text-rose-500 outline-none')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmSupplierBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">선택 협력사 삭제</h3>
            <p className="mt-2 text-xs text-slate-600">
              선택한 {selectedSupplierIds.size}개 협력사를 원장에서 삭제합니다. 계속하시겠습니까?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSupplierBulkDelete(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmSupplierBulkDelete}
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
