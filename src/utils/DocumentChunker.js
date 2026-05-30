import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker to use cdnjs version matching current version
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '5.4.624'}/pdf.worker.min.js`;

/**
 * Extracts raw text from an uploaded File.
 * Supports PDF (via pdfjs-dist) and plain text formats (TXT, MD, CSV, etc.).
 * @param {File} file
 * @returns {Promise<string>}
 */
export const extractTextFromFile = async (file) => {
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (fileExtension === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            text += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        return text;
    } else {
        // Plain text files
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }
};

/**
 * Splits document text into smaller overlapping chunks for RAG or prompt context injection.
 * @param {string} text
 * @param {number} chunkSize
 * @param {number} chunkOverlap
 * @returns {Array<string>}
 */
export const chunkText = (text, chunkSize = 800, chunkOverlap = 150) => {
    if (!text) return [];
    
    const chunks = [];
    let i = 0;
    
    while (i < text.length) {
        const chunk = text.slice(i, i + chunkSize);
        chunks.push(chunk.trim());
        i += (chunkSize - chunkOverlap);
    }
    
    return chunks;
};
