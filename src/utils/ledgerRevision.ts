import { MaterialItem, SupplierInfo } from '../types/inventory';

let materialBases: Record<string, string> = {};
let supplierBases: Record<string, string> = {};
let knownVersion = '';
let reloadSuppliers: (() => Promise<void>) | null = null;

function remember(target: Record<string, string>, id: string, updatedAt?: string) {
  target[id] = updatedAt || '';
}

export function rememberMaterials(items: MaterialItem[]) {
  materialBases = {};
  items.forEach((item) => remember(materialBases, String(item.id), item.updatedAt));
}

export function rememberSuppliers(items: SupplierInfo[]) {
  supplierBases = {};
  items.forEach((item) => remember(supplierBases, String(item.id), item.updatedAt));
}

export function getMaterialBases(): Record<string, string> {
  return { ...materialBases };
}

export function getSupplierBases(): Record<string, string> {
  return { ...supplierBases };
}

export function materialBase(id: number): string | undefined {
  const key = String(id);
  return Object.prototype.hasOwnProperty.call(materialBases, key) ? materialBases[key] : undefined;
}

export function supplierBase(id: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(supplierBases, id) ? supplierBases[id] : undefined;
}

export function noteMaterialSaved(id: number, updatedAt?: string) {
  remember(materialBases, String(id), updatedAt);
}

export function noteSupplierSaved(id: string, updatedAt?: string) {
  remember(supplierBases, id, updatedAt);
}

export function getKnownLedgerVersion() {
  return knownVersion;
}

export function setKnownLedgerVersion(version: string) {
  knownVersion = version;
}

export function registerSupplierReload(loader: () => Promise<void>) {
  reloadSuppliers = loader;
  return () => {
    if (reloadSuppliers === loader) reloadSuppliers = null;
  };
}

export async function reloadSuppliersFromLedger() {
  if (reloadSuppliers) await reloadSuppliers();
}
