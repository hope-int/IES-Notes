
const DB_NAME = 'ies_notes_ppt_history';
const STORE_NAME = 'presentations';
const DB_VERSION = 1;

export const initPPTDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // Key path is 'id' (timestamp based or uuid)
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const savePPT = async (pptData) => {
    const db = await initPPTDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const item = {
            id: pptData.id || Date.now().toString(),
            topic: pptData.topic,
            timestamp: new Date().toISOString(),
            slides: pptData.slides, // Array of slide objects {title, type, prompt, html, status}
            theme: pptData.theme,
            slideCount: pptData.slides.length || 0
        };

        const request = store.put(item);
        request.onsuccess = () => resolve(item.id);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const getAllPPTs = async () => {
    const db = await initPPTDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = (e) => {
            // Sort by newest first
            const results = e.target.result || [];
            results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            resolve(results);
        };
        request.onerror = (e) => reject(e.target.error);
    });
};

export const deletePPT = async (id) => {
    const db = await initPPTDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
};
