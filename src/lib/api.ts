import type { LogFoodSuccess, MealsResponse, Quota, WeightEntry } from './types';
import { supabase } from './supabase/client';

/** Current access token, or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;

  // Access tokens expire after ~1 hour. Browsers throttle background timers, so
  // the client's auto-refresh can be delayed after a long idle period and leave
  // us about to send an expired token (which yields "Unauthorized"). Refresh
  // on demand via the long-lived refresh token before returning.
  const expiresAt = session.expires_at ?? 0;
  if (expiresAt && Date.now() >= expiresAt * 1000) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session) return null;
    return refreshed.session.access_token;
  }

  return session.access_token;
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

export async function fetchMeals(token: string, days = 8): Promise<MealsResponse> {
  const res = await fetch(`/api/meals?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error((await res.json().catch(() => ({})))?.error ?? 'Failed to load meals');
  }
  return res.json();
}

export async function fetchWeights(token: string, days = 90): Promise<WeightEntry[]> {
  const res = await fetch(`/api/weight?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error((await res.json().catch(() => ({})))?.error ?? 'Failed to load weight');
  }
  const data = (await res.json()) as { weights: WeightEntry[] };
  return data.weights ?? [];
}

export async function logWeight(token: string, weightKg: number): Promise<WeightEntry> {
  const res = await fetch('/api/weight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ weight_kg: weightKg }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? 'Could not save weight');
  }
  return data.weight;
}

export async function deleteMeal(token: string, id: string): Promise<void> {
  const res = await fetch('/api/meals', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? 'Failed to delete meal');
  }
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
