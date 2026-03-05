
const DB_NAME = 'HOPE_AI_Tutor_DB';
const DB_VERSION = 2;
const STORES = {
    SESSIONS: 'sessions',
    MESSAGES: 'messages',
    FILES: 'files'
};

export const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;

            // Sessions Metadata Store
            if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
                db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
            }

            // Messages Store
            if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
                const messageStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id', autoIncrement: true });
                messageStore.createIndex('sessionId', 'sessionId', { unique: false });
            }

            // Legacy Files Store (kept for compatibility or specific blobs)
            if (!db.objectStoreNames.contains(STORES.FILES)) {
                db.createObjectStore(STORES.FILES);
            }
        };

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

// --- Session Operations ---
export const saveSession = async (session) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.SESSIONS, 'readwrite');
        const store = transaction.objectStore(STORES.SESSIONS);
        const request = store.put(session);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
};

export const getAllSessions = async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.SESSIONS, 'readonly');
        const store = transaction.objectStore(STORES.SESSIONS);
        const request = store.getAll();
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const deleteSessionFromDB = async (sessionId) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.SESSIONS, STORES.MESSAGES], 'readwrite');

        // Delete Session
        transaction.objectStore(STORES.SESSIONS).delete(sessionId);

        // Delete related messages
        const messageStore = transaction.objectStore(STORES.MESSAGES);
        const index = messageStore.index('sessionId');
        const request = index.openKeyCursor(IDBKeyRange.only(sessionId));

        request.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                messageStore.delete(cursor.primaryKey);
                cursor.continue();
            }
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(e.target.error);
    });
};

// --- Message Operations ---
export const saveMessage = async (message) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.MESSAGES, 'readwrite');
        const store = transaction.objectStore(STORES.MESSAGES);
        const request = store.add(message);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
};

export const getMessagesBySession = async (sessionId) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.MESSAGES, 'readonly');
        const store = transaction.objectStore(STORES.MESSAGES);
        const index = store.index('sessionId');
        const request = index.getAll(IDBKeyRange.only(sessionId));
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const clearAllMessagesInSession = async (sessionId) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.MESSAGES, 'readwrite');
        const store = transaction.objectStore(STORES.MESSAGES);
        const index = store.index('sessionId');
        const request = index.openKeyCursor(IDBKeyRange.only(sessionId));

        request.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                cursor.continue();
            }
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(e.target.error);
    });
};

// --- File/Blob Operations ---
export const saveFileToDB = async (id, blob) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.FILES, 'readwrite');
        const store = transaction.objectStore(STORES.FILES);
        const request = store.put(blob, id);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
};

export const getFileFromDB = async (id) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.FILES, 'readonly');
        const store = transaction.objectStore(STORES.FILES);
        const request = store.get(id);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const clearFilesFromDB = async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.FILES, 'readwrite');
        const store = transaction.objectStore(STORES.FILES);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
};
