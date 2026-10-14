import {
  StandardSalesRecord,
  ExcludedRecord,
  AdjustmentRecord,
  ProductMappingItem,
  ProcessingLog,
} from '../types/sales';

const DB_NAME = 'WalmartSalesAnalyticsDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sales')) {
        const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
        salesStore.createIndex('dateOnly', 'dateOnly', { unique: false });
        salesStore.createIndex('onlineProductSKU', 'onlineProductSKU', { unique: false });
        salesStore.createIndex('SPU', 'SPU', { unique: false });
        salesStore.createIndex('productType', 'productType', { unique: false });
      }
      if (!db.objectStoreNames.contains('excluded')) {
        db.createObjectStore('excluded', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('adjustments')) {
        db.createObjectStore('adjustments', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('mappings')) {
        db.createObjectStore('mappings', { keyPath: 'SKU' });
      }
      if (!db.objectStoreNames.contains('logs')) {
        db.createObjectStore('logs', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function saveCleanSalesRecords(records: StandardSalesRecord[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sales', 'readwrite');
    const store = tx.objectStore('sales');
    for (const r of records) {
      store.put(r);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllCleanSalesRecords(): Promise<StandardSalesRecord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sales', 'readonly');
    const store = tx.objectStore('sales');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveExcludedRecords(records: ExcludedRecord[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('excluded', 'readwrite');
    const store = tx.objectStore('excluded');
    for (const r of records) {
      store.put(r);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllExcludedRecords(): Promise<ExcludedRecord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('excluded', 'readonly');
    const store = tx.objectStore('excluded');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAdjustmentRecords(records: AdjustmentRecord[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('adjustments', 'readwrite');
    const store = tx.objectStore('adjustments');
    for (const r of records) {
      store.put(r);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllAdjustmentRecords(): Promise<AdjustmentRecord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('adjustments', 'readonly');
    const store = tx.objectStore('adjustments');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProductMappings(mappings: ProductMappingItem[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mappings', 'readwrite');
    const store = tx.objectStore('mappings');
    for (const m of mappings) {
      store.put(m);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllProductMappings(): Promise<ProductMappingItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mappings', 'readonly');
    const store = tx.objectStore('mappings');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProcessingLog(log: ProcessingLog): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('logs', 'readwrite');
    const store = tx.objectStore('logs');
    store.put(log);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllProcessingLogs(): Promise<ProcessingLog[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('logs', 'readonly');
    const store = tx.objectStore('logs');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllAnalyticsData(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sales', 'excluded', 'adjustments', 'logs', 'mappings'], 'readwrite');
    tx.objectStore('sales').clear();
    tx.objectStore('excluded').clear();
    tx.objectStore('adjustments').clear();
    tx.objectStore('logs').clear();
    tx.objectStore('mappings').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearDemoDataOnly(): Promise<{ removedCount: number }> {
  const db = await getDB();
  const sales = await getAllCleanSalesRecords();
  const nonDemoSales = sales.filter((s) => !s.isDemoData);
  const removedCount = sales.length - nonDemoSales.length;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sales', 'excluded', 'adjustments', 'logs', 'mappings'], 'readwrite');
    tx.objectStore('sales').clear();
    tx.objectStore('mappings').clear(); // Clear mapping table as requested by user
    const salesStore = tx.objectStore('sales');
    for (const r of nonDemoSales) {
      salesStore.put(r);
    }
    tx.oncomplete = () => resolve({ removedCount });
    tx.onerror = () => reject(tx.error);
  });
}

const EXCHANGE_RATES_KEY = 'walmart_erp_monthly_exchange_rates';

export function getSavedMonthlyExchangeRates(): Record<string, number> {
  try {
    const item = localStorage.getItem(EXCHANGE_RATES_KEY);
    if (item) {
      return JSON.parse(item);
    }
  } catch (e) {
    console.warn('Failed to read exchange rates from localStorage:', e);
  }
  return {};
}

export function saveMonthlyExchangeRatesToStorage(rates: Record<string, number>): void {
  try {
    localStorage.setItem(EXCHANGE_RATES_KEY, JSON.stringify(rates));
  } catch (e) {
    console.warn('Failed to save exchange rates to localStorage:', e);
  }
}


