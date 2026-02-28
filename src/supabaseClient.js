
import { createClient } from '@supabase/supabase-js';

// These environment variables will need to be set in a .env file
const supabaseUrlRaw = import.meta.env.VITE_SUPABASE_URL;
// Supabase requires an absolute URL, so if we are using the local proxy (/api/supabase), we need to append the origin
const supabaseUrl = supabaseUrlRaw && supabaseUrlRaw.startsWith('/')
    ? `${window.location.origin}${supabaseUrlRaw}`
    : supabaseUrlRaw;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'hope-edu-auth',
    }
});
