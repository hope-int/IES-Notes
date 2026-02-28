export const config = {
    runtime: 'edge', // Using Edge Functions for minimum latency
};

const ALLOWED_ORIGINS = [
    'https://hope-edu-hub.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
];

export default async function handler(req) {
    const origin = req.headers.get('origin');

    // Strict CORS: Only allow our domains
    const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin);
    const corsHeaders = {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info, x-session-id',
        'Access-Control-Max-Age': '86400',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Security Check 1: Enforce Allowed Origins
    // (In production, you might want to strictly reject if not allowed,
    // but returning a default CORS header often prevents browser access anyway)
    if (origin && !isAllowedOrigin) {
        return new Response(JSON.stringify({ error: 'Unauthorized Origin' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const url = new URL(req.url);

        // Security Check 2: Path Validation (SSRF Prevention)
        // Only allow specific Supabase public API paths
        const supabasePath = url.pathname.replace('/api/supabase', '') + url.search;
        const validPathPrefixes = ['/rest/v1/', '/storage/v1/', '/auth/v1/', '/graphql/v1/', '/rpc/check_rate_limit'];

        const isValidPath = validPathPrefixes.some(prefix => supabasePath.startsWith(prefix));
        if (!isValidPath) {
            return new Response(JSON.stringify({ error: 'Forbidden API Path' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Read Supabase URL from Edge environment variables
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const targetUrl = `${SUPABASE_URL}${supabasePath}`;

        // Create a new request object to forward
        const modifiedRequest = new Request(targetUrl, {
            method: req.method,
            headers: req.headers,
            body: req.body,
            redirect: 'manual',
        });

        // Forward Client Session ID if present
        const sessionId = req.headers.get('x-session-id');
        if (sessionId) {
            modifiedRequest.headers.set('x-session-id', sessionId);
        }

        // Fetch from the real Supabase
        const response = await fetch(modifiedRequest);

        // Forward the response back to the client, combining our strict CORS
        const responseHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
            responseHeaders.set(key, value);
        });

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: 'Proxy Error', details: e.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
}
