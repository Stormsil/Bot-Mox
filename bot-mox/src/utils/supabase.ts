import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRuntimeConfig, readRuntimeString } from '../config/runtime-config';

const runtimeConfig = getRuntimeConfig();
const supabaseUrl =
  readRuntimeString(runtimeConfig.supabaseUrl) ||
  String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey =
  readRuntimeString(runtimeConfig.supabaseAnonKey) ||
  String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const hasSupabaseAuth = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseAuth) {
  console.warn(
    '[Supabase] Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (dev: bot-mox/.env; docker: runtime-config.js).',
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
