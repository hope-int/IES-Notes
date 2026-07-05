import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { getAICompletion, FREE_MODEL_ROUTING } from './aiService';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MIN_SELECTABLE_TEXT_CHARS = 40;

const normalizeWhitespace = (text) => text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

const renderPageImage = async (page) => {
    const viewport = page.getViewport({ scale: 1.55 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.76);
};

const detectTextLocally = async (imageDataUrl) => {
    if (!('TextDetector' in window)) return '';

    const detector = new window.TextDetector();
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const detections = await detector.detect(bitmap);
    bitmap.close?.();

    return normalizeWhitespace(detections.map(item => item.rawValue).filter(Boolean).join('\n'));
};

const detectTextWithAI = async (imageDataUrl, pageNumber) => {
    const response = await getAICompletion(
        [
            {
                role: 'system',
                content: 'Precise OCR. Extract only readable text. Preserve headings, equations, code, tables, layout. Do not explain.'
            },
            {
                role: 'user',
                content: [
                    { type: 'text', text: `Extract the text from scanned PDF page ${pageNumber}.` },
                    { type: 'image_url', image_url: { url: imageDataUrl } }
                ]
            }
        ],
        {
            actionType: 'chat',
            provider: 'client',
            model: FREE_MODEL_ROUTING.HANDBOOK_PRIMARY,
            max_tokens: 4096,
            temperature: 0
        }
    );

    return normalizeWhitespace(response || '');
};

const extractScannedPageText = async (page, pageNumber, onProgress) => {
    const imageDataUrl = await renderPageImage(page);

    try {
        const localText = await detectTextLocally(imageDataUrl);
        if (localText.length >= MIN_SELECTABLE_TEXT_CHARS) {
            return { text: localText, method: 'browser-ocr' };
        }
    } catch {
        // Browser OCR is optional and not available in every Chromium build.
    }

    try {
        onProgress?.({ step: 'ocr', message: `Reading scanned page ${pageNumber} with AI OCR...` });
        const aiText = await detectTextWithAI(imageDataUrl, pageNumber);
        return { text: aiText, method: 'ai-ocr' };
    } catch {
        return {
            text: `[Page ${pageNumber}: scanned page detected, but OCR was unavailable in this browser/provider setup.]`,
            method: 'unreadable-scan'
        };
    }
};

export const extractPDFContext = async (file, { onProgress } = {}) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    let ocrPages = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        onProgress?.({ step: 'pdf-text', message: `Reading PDF page ${pageNumber}/${pdf.numPages}...` });
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const selectableText = normalizeWhitespace(content.items.map(item => item.str).join(' '));

        if (selectableText.length >= MIN_SELECTABLE_TEXT_CHARS) {
            pages.push({ pageNumber, text: selectableText, method: 'selectable-text' });
            continue;
        }

        ocrPages += 1;
        const scannedText = await extractScannedPageText(page, pageNumber, onProgress);
        pages.push({ pageNumber, ...scannedText });
    }

    const text = normalizeWhitespace(
        pages
            .map(page => `--- Page ${page.pageNumber} (${page.method}) ---\n${page.text}`)
            .join('\n\n')
    );

    return {
        text,
        pageCount: pdf.numPages,
        ocrPages,
        selectablePages: pages.length - ocrPages,
        pages
    };
};

export const extractTextFromPDF = async (file) => {
    const context = await extractPDFContext(file);
    return context.text;
};
