import { NextRequest, NextResponse } from 'next/server';

import { authenticate } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/meals
 * Returns the last ~8 days of meals and the caller's current quota row.
 * Aggregation (daily totals, 7-day breakdown) is done client-side in the
 * user's local timezone so the mobile dashboard is correct per user.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabase, user } = auth;

  // 8 days of margin so the client can build a full 7-day window in its tz.
  const fromIso = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

  const { data: logs, error: logsError } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', fromIso)
    .order('created_at', { ascending: true });

  if (logsError) {
    return NextResponse.json({ error: 'Failed to load meals' }, { status: 500 });
  }

  const { data: quotaRow } = await supabase
    .from('user_quotas')
    .select('queries_used_today, daily_limit')
    .eq('user_id', user.id)
    .maybeSingle();

  const quota = quotaRow ?? { queries_used_today: 0, daily_limit: 600 };

  return NextResponse.json({ logs: logs ?? [], quota });
}
