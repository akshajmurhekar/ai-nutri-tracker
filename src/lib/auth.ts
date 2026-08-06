import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

import { createAuthedClient } from './supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthedContext {
  supabase: SupabaseClient;
  user: User;
}

/**
 * Authenticates a request from its `Authorization: Bearer <access token>`
 * header. Returns a Supabase client bound to that user (so RLS applies) and
 * the verified user, or `null` when the token is missing/invalid.
 */
export async function authenticate(request: NextRequest): Promise<AuthedContext | null> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return null;
  }

  const supabase = createAuthedClient(token);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return { supabase, user: data.user };
}
