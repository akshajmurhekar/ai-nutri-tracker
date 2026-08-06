import type { LogFoodSuccess, MealsResponse, Quota } from './types';
import { supabase } from './supabase/client';

/** Current access token, or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export interface MeProfile {
  name: string;
  email: string;
  needsName: boolean;
}

export async function fetchMe(token: string): Promise<MeProfile> {
  const res = await fetch('/api/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error((await res.json().catch(() => ({})))?.error ?? 'Failed to load profile');
  }
  return res.json();
}

export async function saveProfileName(token: string, name: string): Promise<MeProfile> {
  const res = await fetch('/api/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? 'Could not save your name');
  }
  return data;
}

export async function fetchMeals(token: string): Promise<MealsResponse> {
  const res = await fetch('/api/meals', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error((await res.json().catch(() => ({})))?.error ?? 'Failed to load meals');
  }
  return res.json();
}

export type LogFoodResult =
  | { ok: true; data: LogFoodSuccess }
  | { ok: false; status: number; error: string; rejectionReason?: string | null; quota?: Quota };

export async function logFood(
  token: string,
  mealType: string,
  rawText: string,
): Promise<LogFoodResult> {
  let res: Response;
  try {
    res = await fetch('/api/log-food', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ meal_type: mealType, raw_text: rawText }),
    });
  } catch {
    return { ok: false, status: 0, error: 'Network error — check your connection' };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, status: res.status, error: 'Unexpected server response' };
  }

  if (res.ok) {
    return { ok: true, data: json as LogFoodSuccess };
  }

  const err = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  return {
    ok: false,
    status: res.status,
    error: typeof err.error === 'string' ? err.error : 'Something went wrong',
    rejectionReason: typeof err.rejection_reason === 'string' ? err.rejection_reason : null,
    quota: err.quota as Quota | undefined,
  };
}
