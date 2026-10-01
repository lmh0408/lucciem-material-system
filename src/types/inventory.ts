export type ProductCategory = 'outdoor' | 'indoor' | 'mobile' | 'lsend';

export interface ProductInfo {
  id: ProductCategory;
  name: string;
  description: string;
  badgeColor: string;
  estimatedMonthlyProd: number;
}

export type CommonalityLevel = 'C4' | 'C3' | 'C2' | 'DEDICATED';

export type MainCategory = 'EL' | 'SW' | 'CB' | 'OP' | 'ME' | 'CA';

export interface MaterialItem {
  id: number;
  originalNo: number;
  standardCode?: string;
  name: string;
  spec: string;
  category: MainCategory;
  categoryName: string;
  unit: string;
  unitPrice: number;
  supplier: string;
  contactPerson: string;
  phone: string;
  notes: string;
  isCommon: boolean;
  commonLevel: CommonalityLevel;
  usedIn: {
    outdoor: number;
    indoor: number;
    mobile: number;
    lsend: number;
  };
  currentStock: number;
  safetyStock: number;
  leadTimeDays: number;
  dailyUsage: number;
  reorderPoint: number;
  moq: number;
  eoq: number;
  status?: 'NORMAL' | 'WARNING' | 'ORDER_NEEDED' | 'OUT_OF_STOCK';
  updatedAt?: string;
}

export interface SupplierInfo {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  itemsCount: number;
  category: string;
  reliability: 'A' | 'B' | 'C';
  leadTimeAvgDays: number;
}

export interface PurchaseOrderItem {
  materialId: number;
  name: string;
  spec: string;
  unit: string;
  unitPrice: number;
  orderQty: number;
  totalPrice: number;
  currentStock: number;
  safetyStock: number;
  supplier: string;
  reason: string;
}

export interface PurchaseOrder {
  orderNumber: string;
  orderDate: string;
  supplier: string;
  contactPerson: string;
  phone: string;
  deliveryDueDate: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  vatAmount: number;
  grandTotal: number;
  status: 'DRAFT' | 'APPROVED' | 'SENT';
}

