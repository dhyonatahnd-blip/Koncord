import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

export async function ensureSupabaseAnonymousSession(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: current } = await supabase.auth.getSession();
    if (current.session?.user?.id) {
      return current.session.user.id;
    }
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) return null;
    return data.user?.id || null;
  } catch {
    return null;
  }
}
