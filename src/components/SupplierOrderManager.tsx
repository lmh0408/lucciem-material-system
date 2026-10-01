import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Phone, 
  User, 
  Send, 
  Printer, 
  FileText, 
  CheckCircle2, 
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
import { downloadElementAsPDF } from '../utils/pdfExport';
import { 
  getSuppliersFromDb, 
  saveSupplierToDb, 
  deleteSupplierFromDb, 
  seedSuppliersToDb 
} from '../lib/firebase';

interface SupplierOrderManagerProps {
  materials?: MaterialItem[];
}

const SUPPLIERS_STORAGE_KEY = 'lucciem_suppliers_inventory_v2';

export const SupplierOrderManager: React.FC<SupplierOrderManagerProps> = ({
  materials = RAW_MATERIALS_DATA,
}) => {
  // Suppliers state with LocalStorage persistence & Firebase Firestore sync
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

  // Load from Firebase DB on mount
  useEffect(() => {
    let isMounted = true;
    const fetchSuppliers = async () => {
      try {
        let dbList = await getSuppliersFromDb();
        if (dbList.length === 0) {
          await seedSuppliersToDb(SUPPLIERS_LIST);
          dbList = await getSuppliersFromDb();
        }
        if (isMounted && dbList.length > 0) {
          setSuppliers(dbList);
          localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(dbList));
        }
      } catch (err) {
        console.warn('Firebase suppliers fetch fallback:', err);
      }
    };
    fetchSuppliers();
    return () => { isMounted = false; };
  }, []);

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
  const [activePO, setActivePO] = useState<PurchaseOrder | null>(null);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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
  const handleSubmitSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    if (editingSupplier) {
      // Update
      const updated: SupplierInfo = {
        ...editingSupplier,
        name: formData.name!.trim(),
        category: formData.category?.trim() || '일반 부품',
        contactPerson: formData.contactPerson?.trim() || '',
        phone: formData.phone?.trim() || '',
        leadTimeAvgDays: Number(formData.leadTimeAvgDays) || 7,
        reliability: (formData.reliability as 'A' | 'B' | 'C') || 'A',
      };
      setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? updated : s));
      saveSupplierToDb(updated).catch(err => console.error('Error updating supplier in DB:', err));
    } else {
      // Create new
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
      setSuppliers(prev => [...prev, newSupplier]);
      saveSupplierToDb(newSupplier).catch(err => console.error('Error saving supplier to DB:', err));
    }

    setIsModalOpen(false);
  };

  // Delete supplier
  const handleDeleteSupplier = (supplier: SupplierInfo) => {
    if (confirm(`'${supplier.name}' 협력사를 관리 목록에서 삭제하시겠습니까?`)) {
      setSuppliers(prev => prev.filter(s => s.id !== supplier.id));
      deleteSupplierFromDb(supplier.id).catch(err => console.error('Error deleting supplier from DB:', err));
    }
  };

  // Generate PO for a selected supplier
  const handleGeneratePO = (supplier: SupplierInfo) => {
    // Find all materials from this supplier that need order or all materials from this supplier
    const supplierMaterials = materials.filter(m => 
      m.supplier.toLowerCase().includes(supplier.name.toLowerCase().split('(')[0].trim()) ||
      supplier.name.toLowerCase().includes(m.supplier.toLowerCase().split('(')[0].trim())
    );

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
      orderNumber: `발주-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${supplier.id}`,
      orderDate: today.toISOString().slice(0, 10),
      supplier: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      deliveryDueDate: dueDate.toISOString().slice(0, 10),
      items: poItems,
      totalAmount,
      vatAmount,
      grandTotal,
      status: 'DRAFT',
    };

    setSelectedSupplier(supplier);
    setActivePO(generatedPO);
    setSentSuccess(false);
  };

  const handleDownloadPO_PDF = async () => {
    if (!activePO || isGeneratingPdf) return;
    try {
      setIsGeneratingPdf(true);
      await downloadElementAsPDF('purchase-order-document', {
        filename: `루씨엠_발주서_${activePO.supplier}_${activePO.orderNumber}.pdf`,
      });
    } catch (e) {
      console.error('Failed to generate PO PDF', e);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintPO = () => {
    try {
      window.print();
    } catch {
      handleDownloadPO_PDF();
    }
  };

  const handleSendPO = () => {
    setSentSuccess(true);
    setTimeout(() => {
      setSentSuccess(false);
    }, 4000);
  };

  // Export CSV of materials needing order
  const handleExportOrderNeededCSV = () => {
    const orderNeededList = materials.filter(m => {
      const rop = m.reorderPoint > 0 ? m.reorderPoint : (m.safetyStock || 30);
      return m.currentStock <= rop;
    });

    if (orderNeededList.length === 0) {
      alert('현재 재발주 기준점 이하인 발주 대상 자재가 없습니다.');
      return;
    }

    const headers = ['순번', '품목명', '규격', '단가', '현재고', '재발주기준점', '조달소요일', '공급처'];
    const rows = orderNeededList.map((item, index) => [
      index + 1,
      `"${item.name}"`,
      `"${item.spec}"`,
      item.unitPrice,
      item.currentStock,
      item.reorderPoint > 0 ? item.reorderPoint : item.safetyStock,
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
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition-all shrink-0 active:scale-95"
              title="현재고가 재발주 기준점 이하인 자재 목록을 CSV 파일로 다운로드합니다"
            >
              <FileDown className="w-4 h-4 text-slate-600" />
              <span>발주 대상 목록 파일 다운로드</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#BA1B2D] hover:bg-[#a01625] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs shadow-red-600/20 transition-all shrink-0 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>신규 협력사 등록</span>
            </button>
          </div>
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map((supplier) => {
          // Count items needing order
          const matchedMaterials = materials.filter(m => 
            m.supplier.toLowerCase().includes(supplier.name.toLowerCase().split('(')[0].trim()) ||
            supplier.name.toLowerCase().includes(m.supplier.toLowerCase().split('(')[0].trim())
          );
          const needingOrder = matchedMaterials.filter(m => m.currentStock <= m.reorderPoint);

          return (
            <div 
              key={supplier.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-rose-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
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
                    <button
                      onClick={() => handleDeleteSupplier(supplier)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="협력사 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
                  onClick={handleDownloadPO_PDF}
                  disabled={isGeneratingPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#BA1B2D] hover:bg-[#a01625] rounded-lg shadow-xs transition-colors disabled:opacity-50"
                  title="발주서를 파일로 저장"
                >
                  {isGeneratingPdf ? (
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
                  onClick={handleSendPO}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#BA1B2D] hover:bg-[#a01625] rounded-lg transition-colors shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>거래처 발송</span>
                </button>

                <button
                  onClick={() => setActivePO(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
            </div>

            {sentSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800 flex items-center gap-2 print:hidden">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>발주서가 거래처 담당자({activePO.contactPerson})에게 정상 발송 처리되었습니다.</span>
              </div>
            )}

            {/* Official Purchase Order Document Sheet */}
            <div id="purchase-order-document" className="border-2 border-slate-900 p-6 sm:p-8 space-y-6 text-slate-900 font-sans bg-white">
              {/* PO Title & Doc Number */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-widest text-slate-900">
                    자 재 발 주 서
                  </h1>
                </div>
                <div className="mt-2 sm:mt-0 text-right text-xs">
                  <p className="font-mono font-bold text-sm text-[#BA1B2D]">{activePO.orderNumber}</p>
                  <p className="text-slate-600">발주일자: {activePO.orderDate}</p>
                  <p className="text-rose-600 font-semibold">납기요청일: {activePO.deliveryDueDate}</p>
                </div>
              </div>

              {/* Vendor & Buyer Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs border border-slate-300 p-3 rounded-lg bg-slate-50/50">
                {/* Buyer Info */}
                <div className="space-y-1 pr-2">
                  <p className="font-bold text-[#BA1B2D] border-b border-slate-200 pb-1">발주자</p>
                  <p><span className="text-slate-500">상호명:</span> <strong>주식회사 루씨엠</strong></p>
                  <p><span className="text-slate-500">사업자등록번호:</span> 119-86-59000</p>
                  <p><span className="text-slate-500">납품장소:</span> 루씨엠 중앙제조센터 제1생산공장</p>
                  <p><span className="text-slate-500">발주담당:</span> 자재구매팀 선임매니저 (02-851-7100)</p>
                </div>

                {/* Supplier Info */}
                <div className="space-y-1 pl-2 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0">
                  <p className="font-bold text-slate-800 border-b border-slate-200 pb-1">공급자</p>
                  <p><span className="text-slate-500">상호명:</span> <strong>{activePO.supplier}</strong></p>
                  <p><span className="text-slate-500">담당자:</span> {activePO.contactPerson}</p>
                  <p><span className="text-slate-500">연락처:</span> {activePO.phone}</p>
                  <p><span className="text-slate-500">결제조건:</span> 마감 익월 30일 현금 또는 계좌이체</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border border-slate-300">
                  <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-800">
                    <tr>
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
                        <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                        <td className="p-2">
                          <span className="font-bold block">{item.name}</span>
                          <span className="text-[11px] text-slate-500">{item.spec}</span>
                        </td>
                        <td className="p-2 text-center font-medium">{item.unit}</td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {item.orderQty.toLocaleString()}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {item.unitPrice.toLocaleString()}
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          {item.totalPrice.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-900 bg-slate-50 font-bold">
                    <tr>
                      <td colSpan={5} className="p-2 text-right text-slate-600">공급가액 소계:</td>
                      <td className="p-2 text-right font-mono">{activePO.totalAmount.toLocaleString()}원</td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="p-2 text-right text-slate-600">부가가치세 (10%):</td>
                      <td className="p-2 text-right font-mono">{activePO.vatAmount.toLocaleString()}원</td>
                    </tr>
                    <tr className="text-sm bg-rose-50 text-rose-950 font-black">
                      <td colSpan={5} className="p-2 text-right">총 발주 금액 (부가세 포함):</td>
                      <td className="p-2 text-right font-black font-mono text-[#BA1B2D]">{activePO.grandTotal.toLocaleString()}원</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Terms & Official Stamp */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-600 pt-4 border-t border-slate-200">
                <div className="space-y-1">
                  <p>1. 모든 납품 자재는 본사 사전 승인된 규격서 및 시험성적서를 만족해야 합니다.</p>
                  <p>2. 납기 지연 시 일 지체상금률(0.15%)이 적용될 수 있습니다.</p>
                  <p>3. 물품 인수 검수 시 불량품 발생 시 즉시 무상 교환을 원칙으로 합니다.</p>
                </div>

                <div className="border border-slate-400 p-3 rounded-md text-center min-w-[140px] bg-slate-50">
                  <span className="text-[10px] text-slate-500 block">발주처 확인인</span>
                  <span className="text-xs font-bold text-slate-900 block mt-1">주식회사 루씨엠</span>
                  <div className="w-10 h-10 border border-rose-400 rounded-full mx-auto my-1 flex items-center justify-center text-[10px] text-rose-500 font-bold">
                    직인생략
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
