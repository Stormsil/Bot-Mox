import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const hasSupabaseAuth = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseAuth) {
  console.warn(
    '[Supabase] Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in bot-mox/.env.'
  );
}

export const supabase: SupabaseClient | null = hasSupabaseAuth
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

