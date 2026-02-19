
export const config = {
    runtime: 'edge', // or 'nodejs' - edge is faster for AI streaming if we wanted
};

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SITE_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
const SITE_NAME = "IES Notes AI";

// Helper: Clean JSON
const cleanJSON = (text) => {
    try {
        return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch { return text; } // Return raw if parse fails, handle upstream
};

async function fetchOpenRouter(messages, model, jsonMode) {
    if (!OPENROUTER_API_KEY) throw new Error("Server: OpenRouter Key Missing");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": SITE_URL,
            "X-Title": SITE_NAME
        },
        body: JSON.stringify({
            model, // e.g. "llama-3.1-8b-instant"
            messages,
            response_format: jsonMode ? { type: "json_object" } : undefined
        })
    });

    if (!response.ok) throw new Error(`OpenRouter Error: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
}

async function fetchGroq(messages, jsonMode) {
    if (!GROQ_API_KEY) throw new Error("Server: Groq Key Missing");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama3-70b-8192",
            messages,
            response_format: jsonMode ? { type: "json_object" } : undefined
        })
    });

    if (!response.ok) throw new Error(`Groq Error: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
}

export default async function handler(request) {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { messages, model, jsonMode } = await request.json();

        // 1. Try OpenRouter
        try {
            const result = await fetchOpenRouter(messages, model, jsonMode);
            return new Response(JSON.stringify({ content: result }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (orError) {
            console.error("OpenRouter Backend Fail:", orError);

            // 2. Fallback to Groq
            try {
                const result = await fetchGroq(messages, jsonMode);
                return new Response(JSON.stringify({ content: result }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (groqError) {
                console.error("Groq Backend Fail:", groqError);
                return new Response(JSON.stringify({ error: "All AI Backends Failed" }), {
                    status: 502,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
    } catch (e) {
        return new Response(JSON.stringify({ error: "Bad Request" }), { status: 400 });
    }
}
