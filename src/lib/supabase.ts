
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    // Warn only in development, or handle gracefully
    if (process.env.NODE_ENV === 'development') {
        console.warn(
            'Supabase environment variables are missing. Please check .env.local'
        );
    }
}

// Create use-case specific clients if needed, but for now a single instance
export const supabase = createClient(
    supabaseUrl || '',
    supabaseAnonKey || ''
);
