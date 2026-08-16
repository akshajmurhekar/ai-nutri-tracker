import { NextRequest, NextResponse } from 'next/server';

import { authenticate } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_NAME = 50;

/** GET /api/me — returns the user's greeting data and whether a name is set. */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabase, user } = auth;

  const email = user.email?.toLowerCase() ?? '';
  const fallback = email.split('@')[0] || 'there';

  // A real name only exists when it was captured (e.g. at sign-up). We persist
  // it so the greeting works; invite users have none, so they get the setup
  // flow (name + password) instead.
  const realName = (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined);

  const row: Record<string, string> = { user_id: user.id, email };
  if (realName) row.display_name = realName;

  const { data: profile, error: upsertError } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single();

  if (upsertError || !profile) {
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }

  return NextResponse.json({
    name: profile.display_name ?? fallback,
    email,
    needsName: !profile.display_name,
    needsMetrics: !profile.height_cm || !profile.birth_date || !profile.gender,
  });
}

/** PATCH /api/me — set the display name (used for the greeting). */
export async function PATCH(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabase, user } = auth;

  let body: { name?: unknown };
  try {
    body = (await request.json()) as { name?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Enter your name' }, { status: 400 });
  }
  if (name.length > MAX_NAME) {
    return NextResponse.json({ error: `Name must be ${MAX_NAME} characters or fewer` }, { status: 400 });
  }

  const email = user.email?.toLowerCase() ?? '';

  // Ensure a profile row exists, then set the name.
  await supabase.from('profiles').upsert({ user_id: user.id, email }, { onConflict: 'user_id' });

  const { data: profile, error } = await supabase
    .from('profiles')
    .update({ display_name: name })
    .eq('user_id', user.id)
    .select()
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'Failed to save your name' }, { status: 500 });
  }

  return NextResponse.json({ name: profile.display_name, email, needsName: false });
}
