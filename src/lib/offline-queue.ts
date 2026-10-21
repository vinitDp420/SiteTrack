// IndexedDB Offline Queue for Edge Biometric Kiosk Attendance

export interface OfflineAttendanceRecord {
  id: string;
  workerId: string;
  workerName?: string;
  projectId: string;
  action: 'in' | 'out';
  timestamp: number;
  retryCount: number;
}

const DB_NAME = 'sitetrack_kiosk_offline';
const DB_VERSION = 1;
const STORE_NAME = 'attendance_queue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueAttendance(record: Omit<OfflineAttendanceRecord, 'id' | 'retryCount'>): Promise<string> {
  try {
    const db = await openDB();
    const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullRecord: OfflineAttendanceRecord = {
      ...record,
      id,
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(fullRecord);

      req.onsuccess = () => resolve(id);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to enqueue attendance to IndexedDB:', err);
    throw err;
  }
}

export async function getPendingAttendanceQueue(): Promise<OfflineAttendanceRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB unavailable:', err);
    return [];
  }
}

export async function removeQueueRecord(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to remove record ${id} from IndexedDB:`, err);
  }
}

export async function getQueueCount(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

/**
 * Synchronize all pending offline attendance records with the server API.
 */
export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const items = await getPendingAttendanceQueue();
  if (items.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      let res: Response;
      if (item.action === 'in') {
        res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerId: item.workerId,
            projectId: item.projectId,
            manualBackup: true,
            offlineTimestamp: item.timestamp,
          }),
        });
      } else {
        res = await fetch('/api/attendance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerId: item.workerId,
            offlineTimestamp: item.timestamp,
          }),
        });
      }

      if (res.ok) {
        await removeQueueRecord(item.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}
