
import { createClient } from '@supabase/supabase-js';

// These environment variables will need to be set in a .env file
const supabaseUrl = 'https://baykbturtkzleeazyodr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'hope-edu-auth',
    }
});
