
const DB_NAME = 'HOPE_AI_Tutor_DB';
const DB_VERSION = 3;
const STORES = {
    SESSIONS: 'sessions',
    MESSAGES: 'messages',
    FILES: 'files',
    QUEUE: 'queue',
    REPLAY: 'replay',
    AUDIO_CACHE: 'audio_cache',
    WHITEBOARD_EVENTS: 'whiteboard_events',
    OFFLINE_PROGRESS: 'offline_progress'
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

            // Legacy Files Store
            if (!db.objectStoreNames.contains(STORES.FILES)) {
                db.createObjectStore(STORES.FILES);
            }

            // Queue Store
            if (!db.objectStoreNames.contains(STORES.QUEUE)) {
                db.createObjectStore(STORES.QUEUE, { keyPath: 'id' });
            }

            // Replay Store (events stream)
            if (!db.objectStoreNames.contains(STORES.REPLAY)) {
                const replayStore = db.createObjectStore(STORES.REPLAY, { keyPath: 'id' });
                replayStore.createIndex('sessionId', 'sessionId', { unique: false });
            }

            // Audio Cache
            if (!db.objectStoreNames.contains(STORES.AUDIO_CACHE)) {
                db.createObjectStore(STORES.AUDIO_CACHE, { keyPath: 'id' }); // id is segment hash
            }

            // Whiteboard Events Store
            if (!db.objectStoreNames.contains(STORES.WHITEBOARD_EVENTS)) {
                const wbStore = db.createObjectStore(STORES.WHITEBOARD_EVENTS, { keyPath: 'id', autoIncrement: true });
                wbStore.createIndex('sessionId', 'sessionId', { unique: false });
            }

            // Offline Progress
            if (!db.objectStoreNames.contains(STORES.OFFLINE_PROGRESS)) {
                db.createObjectStore(STORES.OFFLINE_PROGRESS, { keyPath: 'id' });
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

// --- Queue Operations ---
export const saveQueueState = async (sessionId, queueItems) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.QUEUE, 'readwrite');
        const store = transaction.objectStore(STORES.QUEUE);
        const request = store.put({ id: sessionId, items: queueItems, updatedAt: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
};

export const getQueueState = async (sessionId) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.QUEUE, 'readonly');
        const store = transaction.objectStore(STORES.QUEUE);
        const request = store.get(sessionId);
        request.onsuccess = (e) => resolve(e.target.result ? e.target.result.items : null);
        request.onerror = (e) => reject(e.target.error);
    });
};

// --- Replay Operations ---
export const saveReplayEvents = async (sessionId, events) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.REPLAY, 'readwrite');
        const store = transaction.objectStore(STORES.REPLAY);
        const request = store.put({ id: sessionId, events, updatedAt: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
};

export const getReplayEvents = async (sessionId) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.REPLAY, 'readonly');
        const store = transaction.objectStore(STORES.REPLAY);
        const request = store.get(sessionId);
        request.onsuccess = (e) => resolve(e.target.result ? e.target.result.events : []);
        request.onerror = (e) => reject(e.target.error);
    });
};

// --- Audio Cache Operations ---
export const saveAudioToCache = async (hashId, audioBlobOrBase64) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.AUDIO_CACHE, 'readwrite');
        const store = transaction.objectStore(STORES.AUDIO_CACHE);
        const request = store.put({ id: hashId, data: audioBlobOrBase64, timestamp: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
};

export const getAudioFromCache = async (hashId) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.AUDIO_CACHE, 'readonly');
        const store = transaction.objectStore(STORES.AUDIO_CACHE);
        const request = store.get(hashId);
        request.onsuccess = (e) => resolve(e.target.result ? e.target.result.data : null);
        request.onerror = (e) => reject(e.target.error);
    });
};

// --- Whiteboard Events Operations ---
export const saveWhiteboardEvents = async (sessionId, events) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.WHITEBOARD_EVENTS, 'readwrite');
        const store = transaction.objectStore(STORES.WHITEBOARD_EVENTS);
        const request = store.put({ id: sessionId, events, updatedAt: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
};

export const getWhiteboardEvents = async (sessionId) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.WHITEBOARD_EVENTS, 'readonly');
        const store = transaction.objectStore(STORES.WHITEBOARD_EVENTS);
        const request = store.get(sessionId);
        request.onsuccess = (e) => resolve(e.target.result ? e.target.result.events : []);
        request.onerror = (e) => reject(e.target.error);
    });
};

// --- Offline Progress Operations ---
export const saveOfflineProgress = async (progressId, data) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.OFFLINE_PROGRESS, 'readwrite');
        const store = transaction.objectStore(STORES.OFFLINE_PROGRESS);
        const request = store.put({ id: progressId, ...data, updatedAt: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
};

export const getOfflineProgress = async (progressId) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.OFFLINE_PROGRESS, 'readonly');
        const store = transaction.objectStore(STORES.OFFLINE_PROGRESS);
        const request = store.get(progressId);
        request.onsuccess = (e) => resolve(e.target.result || null);
        request.onerror = (e) => reject(e.target.error);
    });
};
