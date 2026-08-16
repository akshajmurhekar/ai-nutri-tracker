import { NextRequest, NextResponse } from 'next/server';

import { authenticate } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MIN_HEIGHT_CM = 100;
const MAX_HEIGHT_CM = 250;

interface MetricsBody {
  height_cm?: unknown;
  birth_date?: unknown;
  gender?: unknown;
}

/**
 * POST /api/me/metrics — saves the voluntary metrics (height, birth date,
 * gender) used to estimate TDEE. Does NOT call Gemini here; it clears the
 * `tdee_updated_at` stamp so the next /api/burn GET (which runs on card mount)
 * performs the refresh. Keeps a single code path for the (throttled) compute.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabase, user } = auth;

  let body: MetricsBody;
  try {
    body = (await request.json()) as MetricsBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const height_cm = Number(body.height_cm);
  if (!Number.isFinite(height_cm) || height_cm < MIN_HEIGHT_CM || height_cm > MAX_HEIGHT_CM) {
    return NextResponse.json(
      { error: `Height must be between ${MIN_HEIGHT_CM} and ${MAX_HEIGHT_CM} cm` },
      { status: 400 },
    );
  }

  const gender = body.gender;
  if (gender !== 'male' && gender !== 'female') {
    return NextResponse.json({ error: 'gender must be male or female' }, { status: 400 });
  }

  const birth_date = typeof body.birth_date === 'string' ? body.birth_date.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
    return NextResponse.json({ error: 'birth_date must be yyyy-mm-dd' }, { status: 400 });
  }
  const dob = new Date(birth_date + 'T00:00:00Z');
  if (Number.isNaN(dob.getTime())) {
    return NextResponse.json({ error: 'birth_date is not a valid date' }, { status: 400 });
  }
  if (dob.getTime() >= Date.now()) {
    return NextResponse.json({ error: 'birth_date must be in the past' }, { status: 400 });
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .update({
      height_cm: Math.round(height_cm),
      birth_date,
      gender,
      // Force a refresh on the card's next fetch.
      tdee_updated_at: null,
    })
    .eq('user_id', user.id)
    .select()
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'Failed to save your metrics' }, { status: 500 });
  }

  return NextResponse.json({ hasMetrics: true });
}
