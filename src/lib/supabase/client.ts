import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser (client-side) Supabase client. Uses cookie-based sessions via
 * @supabase/ssr so the user stays logged in across browser closes — much more
 * reliable on mobile than localStorage.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(url, anonKey);

/** A raw server-side client bound to one user's access token (used in API routes). */
export function createAuthedClient(token: string): SupabaseClient {
  return createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
