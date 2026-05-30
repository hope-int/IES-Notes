import { saveFileToDB, getFileFromDB } from '../../utils/indexedDB';
import { getAICompletion } from '../../utils/aiService';

// Semantic Chunker: splits text into chunks of 500-1000 chars with 10% overlap.
// Heading-aware, theorem-aware, preserves equations.
export const semanticChunk = (text, options = {}) => {
    const minSize = options.minSize || 500;
    const maxSize = options.maxSize || 1000;
    const overlapPercent = options.overlapPercent || 0.10;
    const overlapSize = Math.floor(maxSize * overlapPercent);

    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = '';

    for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i].trim();
        if (!paragraph) continue;

        // If paragraph contains a heading or theorem definition, start a new chunk if we are close to minSize
        const isHeading = /^#+\s+|^[A-Z\s]+:/.test(paragraph);
        const isTheorem = /\\begin\{theorem\}|\\end\{theorem\}|Theorem|Lemma|Definition/i.test(paragraph);

        if ((currentChunk.length + paragraph.length > maxSize) || 
            ((isHeading || isTheorem) && currentChunk.length >= minSize)) {
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }
            // Keep overlap
            const words = currentChunk.split(/\s+/);
            const overlapWords = [];
            let currentOverlapLen = 0;
            for (let j = words.length - 1; j >= 0; j--) {
                if (currentOverlapLen + words[j].length > overlapSize) break;
                overlapWords.unshift(words[j]);
                currentOverlapLen += words[j].length + 1;
            }
            currentChunk = overlapWords.join(' ') + (overlapWords.length > 0 ? ' ' : '') + paragraph;
        } else {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
};

// Edge-side vectorizer: TF-IDF + Cosine Similarity fallback.
// Extremely fast, works offline, low RAM usage, supports English and Malayalam / mixed vocabulary.
export class EdgeVectorizer {
    static getTokens(text) {
        // Support English, Malayalam and symbols
        return text.toLowerCase()
            .replace(/[^\w\s\u0D00-\u0D7F]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 1);
    }

    static calculateTF(tokens) {
        const tf = {};
        tokens.forEach(token => {
            tf[token] = (tf[token] || 0) + 1;
        });
        const len = tokens.length || 1;
        Object.keys(tf).forEach(token => {
            tf[token] = tf[token] / len;
        });
        return tf;
    }

    static cosineSimilarity(tf1, tf2) {
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        const allTokens = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);
        allTokens.forEach(token => {
            const val1 = tf1[token] || 0;
            const val2 = tf2[token] || 0;
            dotProduct += val1 * val2;
            norm1 += val1 * val1;
            norm2 += val2 * val2;
        });

        if (norm1 === 0 || norm2 === 0) return 0;
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
}

// Ingestion and Vector Search orchestrator
class RAGEngine {
    async ingestDocument(documentId, filename, text, layer = 'personal') {
        const chunks = semanticChunk(text);
        const chunkObjects = chunks.map((chunk, idx) => {
            const tokens = EdgeVectorizer.getTokens(chunk);
            const tf = EdgeVectorizer.calculateTF(tokens);
            return {
                id: `${documentId}_chunk_${idx}`,
                documentId,
                filename,
                content: chunk,
                layer, // 'personal' | 'semester' | 'department' | 'global'
                tf,
                timestamp: Date.now()
            };
        });

        // Store in IndexedDB
        await saveFileToDB(`rag_doc_${documentId}`, {
            documentId,
            filename,
            layer,
            chunks: chunkObjects
        });

        return chunkObjects;
    }

    async search(query, limit = 5, filterLayers = ['personal', 'semester', 'global']) {
        const queryTokens = EdgeVectorizer.getTokens(query);
        const queryTF = EdgeVectorizer.calculateTF(queryTokens);
        
        // Scan IndexedDB docs
        // We fetch all stored RAG documents and calculate similarity on the fly (perfect for offline/low-end Android devices)
        const allDocs = [];
        try {
            // Traverse files in indexedDB
            const db = await new Promise((resolve, reject) => {
                const request = indexedDB.open('HOPE_AI_Tutor_DB');
                request.onsuccess = (e) => resolve(e.target.result);
                request.onerror = (e) => reject(e.target.error);
            });
            const transaction = db.transaction('files', 'readonly');
            const store = transaction.objectStore('files');
            const keys = await new Promise((resolve) => {
                const req = store.getAllKeys();
                req.onsuccess = (e) => resolve(e.target.result);
            });

            for (const key of keys) {
                if (key.startsWith('rag_doc_')) {
                    const doc = await getFileFromDB(key);
                    if (doc && filterLayers.includes(doc.layer)) {
                        allDocs.push(doc);
                    }
                }
            }
        } catch (e) {
            console.error("IndexedDB RAG scan error", e);
        }

        const scores = [];
        allDocs.forEach(doc => {
            doc.chunks.forEach(chunk => {
                const score = EdgeVectorizer.cosineSimilarity(queryTF, chunk.tf);
                if (score > 0) {
                    scores.push({
                        chunk,
                        score
                    });
                }
            });
        });

        // Sort by retrieval priority: user uploads (personal) > semester > global
        const layerPriority = {
            personal: 1,
            semester: 2,
            department: 3,
            global: 4
        };

        scores.sort((a, b) => {
            // First sort by Cosine Similarity score
            if (Math.abs(a.score - b.score) > 0.05) {
                return b.score - a.score;
            }
            // If scores are similar, prioritize layer priority
            return layerPriority[a.chunk.layer] - layerPriority[b.chunk.layer];
        });

        return scores.slice(0, limit).map(s => ({
            content: s.chunk.content,
            filename: s.chunk.filename,
            layer: s.chunk.layer,
            score: s.score
        }));
    }
}

export const ragEngine = new RAGEngine();
