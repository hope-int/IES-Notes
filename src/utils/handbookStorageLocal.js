
const DB_NAME = 'ies_notes_handbook_history';
const STORE_NAME = 'handbooks';
const DB_VERSION = 1;

export const initHandbookDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // Key path is 'id' 
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const saveHandbookLocal = async (fileName, content) => {
    try {
        const db = await initHandbookDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const item = {
                id: Date.now().toString(),
                title: fileName,
                content: content,
                createdAt: new Date().toISOString(),
                isLocal: true // Flag to identify local storage
            };

            const request = store.put(item);
            request.onsuccess = () => resolve(item);
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (e) {
        console.error("Local DB Save Failed", e);
        throw e;
    }
};

export const getHandbookHistoryLocal = async () => {
    try {
        const db = await initHandbookDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = (e) => {
                const results = e.target.result;
                if (!results) {
                    resolve([]);
                    return;
                }
                // Sort by newest first
                try {
                    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                } catch (err) {
                    console.warn("Sorting error in local history", err);
                }
                resolve(results);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (e) {
        console.error("Local DB Fetch Failed", e);
        return [];
    }
};

export const deleteHandbookLocal = async (id) => {
    const db = await initHandbookDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
};
