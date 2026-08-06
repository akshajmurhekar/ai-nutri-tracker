import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser + helper to build a client authenticated as a specific user.
 *
 * The server API routes create a client from the caller's JWTs (anon key +
 * Bearer access token) so that Postgres Row Level Security is enforced for
 * that user. The bare `client` here is only used for auth (sign in / out /
 * session) on the login page.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true },
});

/** A client bound to one user's access token — used inside API routes. */
export function createAuthedClient(token: string): SupabaseClient {
  return createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
