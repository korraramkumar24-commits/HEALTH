import api from './api';

const DATABASE_NAME = 'carehub-offline-v1';
const DATABASE_VERSION = 1;
const STORE_NAME = 'outbox';
const MAX_PENDING_PER_USER = 100;
const OUTBOX_UPDATED_EVENT = 'carehub:outbox-updated';

let databasePromise;

const openDatabase = () => {
  if (!('indexedDB' in globalThis)) {
    return Promise.reject(new Error('This browser does not support offline storage.'));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = undefined;
      reject(new Error('Offline storage could not be opened.'));
    };
    request.onblocked = () => {
      databasePromise = undefined;
      reject(new Error('Offline storage is blocked by another open app tab.'));
    };
  });
  return databasePromise;
};

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('Offline storage request failed.'));
});

const withStore = async (mode, operation) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;
    try {
      result = operation(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(new Error('Offline storage transaction failed.'));
    transaction.onabort = () => reject(new Error('Offline storage transaction was cancelled.'));
  });
};

const listForUser = async (userId) => {
  if (!userId) return [];
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const items = await requestResult(store.index('userId').getAll(String(userId)));
  return items.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
};

const enqueue = async ({ userId, kind, payload }) => {
  if (!userId || !['health-record', 'emergency-sos'].includes(kind)) {
    throw new Error('Offline item is missing its owner or has an unsupported type.');
  }
  const pendingItems = await listForUser(userId);
  if (pendingItems.length >= MAX_PENDING_PER_USER) {
    throw new Error(`Offline queue is full. Sync or remove items before adding more than ${MAX_PENDING_PER_USER}.`);
  }

  const item = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId: String(userId),
    kind,
    payload,
    createdAt: new Date().toISOString(),
    status: 'queued',
    error: '',
  };
  await withStore('readwrite', (store) => store.add(item));
  window.dispatchEvent(new Event(OUTBOX_UPDATED_EVENT));
  return item;
};

const updateItem = async (item, changes) =>
  withStore('readwrite', (store) => store.put({ ...item, ...changes })).then((result) => {
    window.dispatchEvent(new Event(OUTBOX_UPDATED_EVENT));
    return result;
  });

const removeItem = async (itemId) =>
  withStore('readwrite', (store) => store.delete(itemId)).then((result) => {
    window.dispatchEvent(new Event(OUTBOX_UPDATED_EVENT));
    return result;
  });

const syncPromises = new Map();
const syncForUser = (userId, send) => {
  if (!navigator.onLine || !userId) return Promise.resolve({ synced: 0, remaining: 0 });
  const ownerId = String(userId);
  if (syncPromises.has(ownerId)) return syncPromises.get(ownerId);

  const promise = (async () => {
    let synced = 0;
    const results = [];
    for (const item of await listForUser(ownerId)) {
      if (item.status === 'failed') continue;
      await updateItem(item, { status: 'syncing', error: '' });
      try {
        const response = await send(item);
        await removeItem(item.id);
        synced += 1;
        results.push({ kind: item.kind, data: response?.data?.data || null });
      } catch (error) {
        if (error.response?.status >= 400 && error.response.status < 500) {
          await updateItem(item, {
            status: 'failed',
            error: error.response.data?.message || 'The server rejected this item. Review it before retrying.',
          });
          window.dispatchEvent(new Event(OUTBOX_UPDATED_EVENT));
          continue;
        }
        await updateItem(item, { status: 'queued', error: '' });
        window.dispatchEvent(new Event(OUTBOX_UPDATED_EVENT));
        break;
      }
    }
    const remaining = (await listForUser(ownerId)).length;
    return { synced, remaining, results };
  })();
  syncPromises.set(ownerId, promise);
  return promise.finally(() => {
    syncPromises.delete(ownerId);
  });
};

const sendOutboxItem = (item) => {
  let currentUser;
  try {
    currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    throw new Error('Offline items are paused until the saved account can be verified.');
  }
  const currentUserId = currentUser?.id || currentUser?._id;
  if (String(currentUserId || '') !== String(item.userId)) {
    throw new Error('Offline item belongs to a different account and will wait until that account signs in.');
  }
  if (item.kind === 'health-record') {
    return api.post('/health-records', item.payload, { headers: { 'Idempotency-Key': item.id } });
  }
  if (item.kind === 'emergency-sos') {
    return api.post('/alerts/sos', item.payload, { headers: { 'Idempotency-Key': item.id } });
  }
  throw new Error('This offline item type cannot be synchronized.');
};

export {
  enqueue,
  listForUser,
  OUTBOX_UPDATED_EVENT,
  removeItem,
  sendOutboxItem,
  syncForUser,
};
