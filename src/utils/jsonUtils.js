export const extractJSONBlock = (text = '') => {
    const cleaned = String(text)
        .replace(/```json/gi, '```')
        .replace(/```/g, '')
        .trim();

    const objectStart = cleaned.indexOf('{');
    const arrayStart = cleaned.indexOf('[');
    const start = objectStart !== -1 && (arrayStart === -1 || objectStart < arrayStart)
        ? objectStart
        : arrayStart;

    if (start === -1) return cleaned;

    const opener = cleaned[start];
    const closer = opener === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < cleaned.length; index += 1) {
        const char = cleaned[index];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
        } else if (char === opener) {
            depth += 1;
        } else if (char === closer) {
            depth -= 1;
            if (depth === 0) return cleaned.slice(start, index + 1);
        }
    }

    return cleaned.slice(start);
};

const repairCommonJSONIssues = (text) => text
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

export const parseAIJSON = (text) => {
    const extracted = extractJSONBlock(text);
    const attempts = [
        extracted,
        repairCommonJSONIssues(extracted)
    ];

    let lastError = null;
    for (const attempt of attempts) {
        try {
            return JSON.parse(attempt);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Invalid JSON response');
};
