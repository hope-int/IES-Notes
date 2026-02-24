import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://baykbturtkzleeazyodr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJheWtidHVydGt6bGVlYXp5b2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDAxNjgsImV4cCI6MjA4NTc3NjE2OH0.jPYeIDiFi1LgV0PHifbTXKouFlsWAmI7mjyV3K1Yzx0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    console.log("Starting Supabase connection test...");
    const start = Date.now();
    try {
        const { data, error } = await supabase.from('departments').select('name').limit(1);
        const duration = Date.now() - start;
        if (error) {
            console.error("Connection failed after", duration, "ms:", error.message);
        } else {
            console.log("Connection successful in", duration, "ms!");
            console.log("Data sample:", data);
        }
    } catch (err) {
        console.error("Unexpected error:", err);
    }
}

test();
