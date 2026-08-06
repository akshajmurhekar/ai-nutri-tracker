import { NextRequest, NextResponse } from 'next/server';

import { MEAL_TYPES, MAX_RAW_TEXT } from '@/lib/constants';
import { authenticate } from '@/lib/auth';
import { parseMeal } from '@/lib/gemini';

interface LogFoodBody {
  raw_text?: unknown;
  meal_type?: unknown;
}

/**
 * POST /api/log-food
 *
 * Flow: authenticate → atomically check+increment quota → call Gemini
 * (structured output) → reject non-food (400, not logged) → insert meal.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabase, user } = auth;

  // ---- Parse & validate input -------------------------------------------
  let body: LogFoodBody;
  try {
    body = (await request.json()) as LogFoodBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raw_text = typeof body.raw_text === 'string' ? body.raw_text.trim() : '';
  const meal_type = body.meal_type;

  if (!raw_text) {
    return NextResponse.json({ error: 'raw_text is required' }, { status: 400 });
  }
  if (raw_text.length > MAX_RAW_TEXT) {
    return NextResponse.json(
      { error: `raw_text must be ${MAX_RAW_TEXT} characters or fewer` },
      { status: 400 },
    );
  }
  if (typeof meal_type !== 'string' || !MEAL_TYPES.includes(meal_type as (typeof MEAL_TYPES)[number])) {
    return NextResponse.json(
      { error: `meal_type must be one of: ${MEAL_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  // ---- Atomic quota check + increment (before any LLM spend) ------------
  const { data: quotaData, error: quotaError } = await supabase.rpc(
    'increment_quota_if_within_limit',
    { p_user_id: user.id },
  );

  if (quotaError || !Array.isArray(quotaData) || quotaData.length === 0) {
    return NextResponse.json({ error: 'Failed to check quota' }, { status: 500 });
  }

  const quota = quotaData[0] as { allowed: boolean; used_today: number; day_limit: number };
  const quotaView = {
    allowed: quota.allowed,
    queries_used_today: quota.used_today,
    daily_limit: quota.day_limit,
  };

  if (!quota.allowed) {
    return NextResponse.json(
      { error: 'Daily query limit reached', quota: quotaView },
      { status: 429 },
    );
  }

  // ---- Call Gemini with structured output --------------------------------
  let parsed;
  try {
    parsed = await parseMeal(raw_text);
  } catch {
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 });
  }

  // ---- Guardrail: reject non-food / prompt-injection, do NOT log ---------
  if (!parsed.is_food) {
    return NextResponse.json(
      {
        error: 'Not a food entry',
        rejection_reason: parsed.rejection_reason,
        quota: quotaView,
      },
      { status: 400 },
    );
  }

  // Macros should be present for food; be defensive about a bad parse.
  if (
    parsed.calories === null ||
    parsed.protein === null ||
    parsed.carbs === null ||
    parsed.fat === null
  ) {
    return NextResponse.json(
      {
        error: 'Could not parse nutrition for this entry',
        quota: quotaView,
      },
      { status: 422 },
    );
  }

  // ---- Persist -------------------------------------------------------------
  const { data: meal, error: insertError } = await supabase
    .from('meal_logs')
    .insert({
      user_id: user.id,
      meal_type,
      raw_text,
      description: parsed.description,
      calories: parsed.calories,
      protein: parsed.protein,
      carbs: parsed.carbs,
      fat: parsed.fat,
    })
    .select()
    .single();

  if (insertError || !meal) {
    return NextResponse.json({ error: 'Failed to save meal' }, { status: 500 });
  }

  return NextResponse.json(
    {
      meal,
      quota: quotaView,
    },
    { status: 201 },
  );
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
