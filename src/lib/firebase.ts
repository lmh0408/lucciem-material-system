import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore,
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { MaterialItem, SupplierInfo } from '../types/inventory';

// Firebase 앱 초기화 (중복 초기화 방지)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// firestoreDatabaseId 설정 및 undefined 프로퍼티 무시 설정 적용
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
  }, firebaseConfig.firestoreDatabaseId || undefined);
} catch {
  firestoreInstance = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}

export const db = firestoreInstance;
export const auth = getAuth(app);

// Firestore 저장 시 undefined 필드 제거 헬퍼
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const clean: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        clean[key] = sanitizeForFirestore(val);
      } else {
        clean[key] = val;
      }
    }
  }
  return clean;
}

export const MATERIALS_COLLECTION = 'materials';
export const SUPPLIERS_COLLECTION = 'suppliers';

/**
 * Firestore에서 자재 목록 전체 가져오기
 */
export async function getMaterialsFromDb(): Promise<MaterialItem[]> {
  const materialsRef = collection(db, MATERIALS_COLLECTION);
  const q = query(materialsRef, orderBy('id', 'asc'));
  const snapshot = await getDocs(q);
  
  const items: MaterialItem[] = [];
  snapshot.forEach((docSnap) => {
    items.push(docSnap.data() as MaterialItem);
  });
  return items;
}

/**
 * 단일 자재 추가 또는 갱신
 */
export async function saveMaterialToDb(material: MaterialItem): Promise<void> {
  const docRef = doc(db, MATERIALS_COLLECTION, String(material.id));
  const payload = sanitizeForFirestore({
    ...material,
    updatedAt: material.updatedAt || new Date().toISOString()
  });
  await setDoc(docRef, payload, { merge: true });
}

/**
 * 단일 자재 삭제
 */
export async function deleteMaterialFromDb(id: number): Promise<void> {
  const docRef = doc(db, MATERIALS_COLLECTION, String(id));
  await deleteDoc(docRef);
}

/**
 * 기본 자재 데이터 일괄 시딩 (batch write)
 */
export async function seedMaterialsToDb(materials: MaterialItem[]): Promise<void> {
  // 400개 단위로 청크 분할하여 batch write
  const chunkSize = 400;
  for (let i = 0; i < materials.length; i += chunkSize) {
    const chunk = materials.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const docRef = doc(db, MATERIALS_COLLECTION, String(item.id));
      const payload = sanitizeForFirestore({
        ...item,
        updatedAt: item.updatedAt || new Date().toISOString()
      });
      batch.set(docRef, payload, { merge: true });
    }
    await batch.commit();
  }
}

/**
 * Firestore에서 협력사 목록 가져오기
 */
export async function getSuppliersFromDb(): Promise<SupplierInfo[]> {
  const suppliersRef = collection(db, SUPPLIERS_COLLECTION);
  const snapshot = await getDocs(suppliersRef);
  
  const items: SupplierInfo[] = [];
  snapshot.forEach((docSnap) => {
    items.push(docSnap.data() as SupplierInfo);
  });
  return items;
}

/**
 * 협력사 추가 또는 갱신
 */
export async function saveSupplierToDb(supplier: SupplierInfo): Promise<void> {
  const docRef = doc(db, SUPPLIERS_COLLECTION, supplier.id);
  const payload = sanitizeForFirestore({
    ...supplier,
    updatedAt: new Date().toISOString()
  });
  await setDoc(docRef, payload, { merge: true });
}

/**
 * 협력사 삭제
 */
export async function deleteSupplierFromDb(id: string): Promise<void> {
  const docRef = doc(db, SUPPLIERS_COLLECTION, id);
  await deleteDoc(docRef);
}

/**
 * 기본 협력사 데이터 일괄 시딩
 */
export async function seedSuppliersToDb(suppliers: SupplierInfo[]): Promise<void> {
  const batch = writeBatch(db);
  for (const s of suppliers) {
    const docRef = doc(db, SUPPLIERS_COLLECTION, s.id);
    const payload = sanitizeForFirestore({
      ...s,
      updatedAt: new Date().toISOString()
    });
    batch.set(docRef, payload, { merge: true });
  }
  await batch.commit();
}

