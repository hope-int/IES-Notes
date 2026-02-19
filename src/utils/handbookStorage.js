import { saveHandbookLocal, getHandbookHistoryLocal, deleteHandbookLocal } from './handbookStorageLocal';

const HANDBOOK_DIR = 'AppData/handbook_history';

// Ensure directory exists
const ensureDir = async () => {
    try {
        if (!window.puter || !window.puter.fs) return false;
        await window.puter.fs.mkdir(HANDBOOK_DIR, { recursive: true });
        return true;
    } catch (e) {
        console.warn("Puter FS unavailable, falling back to local");
        return false;
    }
};

export const saveHandbook = async (fileName, content) => {
    // Try Puter First (only if fully functional)
    if (window.puter && window.puter.fs && typeof window.puter.fs.list === 'function') {
        try {
            await ensureDir();
            const timestamp = Date.now();
            const safeName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const id = `${timestamp}_${safeName}`;
            const filePath = `${HANDBOOK_DIR}/${id}.json`;

            const data = {
                id,
                title: fileName,
                content,
                createdAt: new Date().toISOString(),
                source: 'cloud'
            };

            await window.puter.fs.write(filePath, JSON.stringify(data));
            return data;
        } catch (e) {
            console.warn("Puter save failed, falling back to local storage", e);
        }
    } else {
        console.warn("Puter FS unavailable/broken, defaulting to local storage");
    }

    // Fallback to Local
    return await saveHandbookLocal(fileName, content);
};

export const getHandbookHistory = async () => {
    let cloudHistory = [];
    let localHistory = [];

    // Try Cloud
    if (window.puter && window.puter.fs) {
        try {
            // Strict checks for filesystem capability
            if (window.puter.fs.list && typeof window.puter.fs.list === 'function') {
                const dirExists = await ensureDir();
                if (dirExists) {
                    const files = await window.puter.fs.list(HANDBOOK_DIR);
                    if (files && Array.isArray(files)) {
                        cloudHistory = await Promise.all(
                            files.map(async (f) => {
                                try {
                                    const content = await window.puter.fs.read(`${HANDBOOK_DIR}/${f.name}`);
                                    const json = JSON.parse(content);
                                    return { ...json, source: 'cloud' };
                                } catch (e) { return null; }
                            })
                        );
                    }
                }
            }
        } catch (e) {
            // Only log if it's NOT the "not a function" error safely
            if (e.message && !e.message.includes('not a function')) {
                console.warn("Cloud fetch failed", e);
            }
        }
    }

    // Always fetch Local
    localHistory = await getHandbookHistoryLocal();

    // Combine and Sort
    const cleanCloud = cloudHistory.filter(h => h !== null);
    // Add source tag to local items if missing
    const cleanLocal = localHistory.map(h => ({ ...h, source: 'local' }));

    const combined = [...cleanCloud, ...cleanLocal];
    return combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const deleteHandbook = async (item) => {
    if (item.source === 'local' || item.isLocal) {
        await deleteHandbookLocal(item.id);
    } else if (window.puter && window.puter.fs) {
        try {
            const filePath = `${HANDBOOK_DIR}/${item.id}.json`;
            await window.puter.fs.delete(filePath);
        } catch (e) {
            console.error("Cloud delete failed", e);
            throw e;
        }
    }
};

// Deprecated alias for compatibility if needed, but we should switch to `saveHandbook`
export const saveHandbookToPuter = saveHandbook;
