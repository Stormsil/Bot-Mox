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

export const supabase: SupabaseClient | null = hasSupabaseAuth
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
