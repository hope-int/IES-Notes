
// Secure Backend Fallback (Vercel Serverless Function)
const fetchBackendFallback = async (messages, model, jsonMode) => {
    try {
        const response = await fetch('/api/ai-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, model, jsonMode })
        });

        if (!response.ok) {
            // Local Dev Fallback (Vite)
            // If API returns 404 (Not Found) AND we are in Dev mode, use client-side keys
            if (response.status === 404 && import.meta.env.DEV) {
                console.warn("Backend API not found (Local Dev). Falling back to Client-Side Keys.");
                return await fetchClientSideFallback(messages, model, jsonMode);
            }

            const errorText = await response.text();
            throw new Error(`Backend Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return data.content;
    } catch (error) {
        console.error("Secure Backend Call Failed:", error);
        throw error;
    }
};

// Client-Side Fallback (FOR LOCAL DEV ONLY)
const fetchClientSideFallback = async (messages, model, jsonMode) => {
    // Try OpenRouter Client-Side
    try {
        const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
        if (!apiKey) throw new Error("Client-Side OpenRouter Key Missing");

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.origin,
            },
            body: JSON.stringify({
                model,
                messages,
                response_format: jsonMode ? { type: "json_object" } : undefined
            })
        });

        if (!response.ok) throw new Error(`OpenRouter Client Error: ${response.status}`);
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (orErr) {
        console.warn("Client-Side OpenRouter failed, trying Groq...", orErr);

        // Try Groq Client-Side
        const groqKey = import.meta.env.VITE_GROQ_API_KEY;
        if (!groqKey) throw new Error("Client-Side Groq Key Missing");

        const gResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-70b-8192",
                messages,
                response_format: jsonMode ? { type: "json_object" } : undefined
            })
        });

        if (!gResponse.ok) throw new Error(`Groq Client Error: ${gResponse.status}`);
        const gData = await gResponse.json();
        return gData.choices[0].message.content;
    }
};
