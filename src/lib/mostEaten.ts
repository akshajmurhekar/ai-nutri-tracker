import { MEAL_TYPES, type MealType } from './constants';
import type { MealLog } from './types';

/**
 * "Most eaten" quick-paste suggestions for the log form.
 *
 * For each meal type we group the user's past logs into repeat-meal buckets
 * (by Gemini's canonical `short_name`, falling back to `description` then the
 * normalized raw text for rows logged before the column existed), rank by
 * frequency then recency, and keep the top few as pills.
 *
 * The result is cached in localStorage so the pills render instantly on load,
 * before the network round-trip — same cache-then-refetch pattern as the
 * greeting-name cache in `src/lib/storage.ts`.
 */
const CACHE_KEY = 'nourish-most-eaten';

/** Max pills to show per meal type. */
export const MOST_EATEN_COUNT = 3;

export interface Suggestion {
  /** Short canonical label shown on the pill (e.g. "rice and roti"). */
  label: string;
  /** Full original text to paste into the field (most recent raw_text here). */
  rawText: string;
}

export type MostEatenMap = Record<MealType, Suggestion[]>;

/** Key used to group logs into repeat-meal buckets; null → treat as unmatched. */
function groupKey(log: MealLog): string | null {
  if (log.short_name) return log.short_name;
  if (log.description) return log.description;
  return log.raw_text || null;
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function computeMostEaten(logs: MealLog[]): MostEatenMap {
  const map: MostEatenMap = { breakfast: [], lunch: [], dinner: [], snack: [] };

  type Bucket = { count: number; lastIso: string; label: string; rawText: string };
  const buckets: Record<MealType, Map<string, Bucket>> = {
    breakfast: new Map(),
    lunch: new Map(),
    dinner: new Map(),
    snack: new Map(),
  };

  for (const log of logs) {
    const key = groupKey(log);
    if (!key) continue;
    const norm = normalizeText(key);
    if (!norm) continue;

    const byType = buckets[log.meal_type] ?? buckets.snack;
    const existing = byType.get(norm);
    if (existing) {
      existing.count += 1;
      if (log.created_at > existing.lastIso) {
        existing.lastIso = log.created_at;
        existing.label = key;
        existing.rawText = log.raw_text;
      }
    } else {
      byType.set(norm, {
        count: 1,
        lastIso: log.created_at,
        label: key,
        rawText: log.raw_text,
      });
    }
  }

  for (const t of MEAL_TYPES) {
    map[t] = [...buckets[t].values()]
      .sort((a, b) => b.count - a.count || b.lastIso.localeCompare(a.lastIso))
      .slice(0, MOST_EATEN_COUNT)
      .map((b) => ({ label: b.label, rawText: b.rawText }));
  }

  return map;
}

export function getCachedMostEaten(): MostEatenMap | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MostEatenMap>;
    // Reject a malformed or truncated cache outright.
    for (const t of MEAL_TYPES) {
      if (!Array.isArray(parsed[t])) return null;
    }
    return parsed as MostEatenMap;
  } catch {
    return null;
  }
}

export function setCachedMostEaten(data: MostEatenMap | null) {
  if (typeof window === 'undefined') return;
  try {
    if (data) localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage unavailable — app still works, just not cached */
  }
}
