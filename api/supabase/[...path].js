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
        let supabasePath = url.pathname.replace('/api/supabase', '');
        // On Vercel, edge functions might receive paths without the /api prefix if rewritten incorrectly,
        // so we make sure we accurately extract the intended Supabase path
        if (supabasePath === url.pathname && url.pathname.includes('rest/v1')) {
            supabasePath = url.pathname.substring(url.pathname.indexOf('/rest/v1'));
        } else if (supabasePath === url.pathname && url.pathname.includes('storage/v1')) {
            supabasePath = url.pathname.substring(url.pathname.indexOf('/storage/v1'));
        } else if (supabasePath === url.pathname && url.pathname.includes('auth/v1')) {
            supabasePath = url.pathname.substring(url.pathname.indexOf('/auth/v1'));
        }

        // Clean query parameters: Remove any query parameter that matches the requested path OR is named 'path'
        // This is necessary because Vercel Rewrites might inject the captured path into the URL's query string.
        const cleanSearchParams = new URLSearchParams(url.search);
        cleanSearchParams.delete('path'); // Remove 'path=...' inserted by Vercel if any
        for (const [key, value] of Array.from(cleanSearchParams.entries())) {
            if (key.includes('rest/v1') || key.includes('storage/v1') || key.includes('auth/v1') || key.endsWith(supabasePath.replace(/^\//, ''))) {
                cleanSearchParams.delete(key);
            }
        }

        const cleanedSearch = cleanSearchParams.toString();
        supabasePath += cleanedSearch ? `?${cleanedSearch}` : '';

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
