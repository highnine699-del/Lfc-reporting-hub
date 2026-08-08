import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = !!(supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'your_supabase_project_url' && 
  supabaseAnonKey !== 'your_supabase_anon_key' &&
  supabaseUrl.startsWith('http'));

if (!isConfigured) {
  console.warn('Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

// @ts-ignore - Using placeholder values when not configured
export const supabase = createClient(
  supabaseUrl || 'https://xyz.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF_iHHwOYRHYD4M5Ng4s_nj3c',
  {
    auth: {
      autoRefreshToken: isConfigured,
      persistSession: isConfigured,
      detectSessionInUrl: isConfigured,
    },
  }
);

export const isSupabaseConfigured = isConfigured;
