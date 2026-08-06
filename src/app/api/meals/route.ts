import { NextRequest, NextResponse } from 'next/server';

import { authenticate } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/meals?days=N
 * Returns the last N days (default 8, max 90) of the caller's meals.
 * Aggregation (daily totals, 7-day breakdown) is done client-side in the
 * user's local timezone so the mobile dashboard is correct per user.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabase, user } = auth;

  const daysParam = request.nextUrl.searchParams.get('days');
  const days = Math.min(Math.max(Number(daysParam) || 8, 1), 90);
  const fromIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: logs, error: logsError } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', fromIso)
    .order('created_at', { ascending: true });

  if (logsError) {
    return NextResponse.json({ error: 'Failed to load meals' }, { status: 500 });
  }

  return NextResponse.json({ logs: logs ?? [] });
}

/**
 * DELETE /api/meals — deletes one of the caller's entries (RLS scopes it to
 * their own rows, so totals recompute correctly on the next fetch).
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabase, user } = auth;

  let body: { id?: unknown };
  try {
    body = (await request.json()) as { id?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  // RLS delete policy only permits deleting rows where user_id = auth.uid(),
  // so callers can never remove someone else's entry.
  const { error } = await supabase.from('meal_logs').delete().eq('id', id).eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete meal' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
