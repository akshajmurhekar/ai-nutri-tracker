import { MEAL_TYPES, type MealType } from './constants';
import type { MealLog } from './types';

/**
 * "Most eaten" quick-paste suggestions for the log form.
 *
 * Two mutually-exclusive behaviors, decided per meal type:
 *
 *  1. STABLE-CORE detection: when a meal type has BOTH a component that recurs
 *     across many entries (e.g. rotis + rice in most lunches) AND a component
 *     that varies (a curry that changes daily), the pill becomes just the
 *     STABLE core ("2 rotis, 150g rice") so the user taps it and types the
 *     day's side. Components are Gemini's per-item breakdown.
 *
 *  2. WHOLE-MEAL fallback: when there's no varying component (nothing to strip —
 *     e.g. a snack that's always identical) or the rows are legacy (no
 *     `components` yet), reuse the old behavior: group by short_name/description
 *     and surface the most-eaten whole entries.
 *
 * The result is cached in localStorage so pills render instantly on load,
 * before the network round-trip — same cache-then-refetch pattern as the
 * greeting-name cache in `src/lib/storage.ts`.
 */
const CACHE_KEY = 'nourish-most-eaten';

/** Max pills to show per meal type. */
export const MOST_EATEN_COUNT = 3;

/** A component is "stable" if present in >= this share of a meal type's rows. */
const CORE_SHARE = 0.5;
/** And only once the meal type has at least this many component-bearing rows. */
const CORE_MIN_COUNT = 2;

export interface Suggestion {
  /** Label shown on the pill (short canonical name, or the stable core). */
  label: string;
  /** Full text pasted into the field on tap. */
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

/**
 * Detects the stable core of a meal type. Returns the joined core text (e.g.
 * "2 rotis, 150g rice") when a recurring core exists AND at least one other
 * component varies (so stripping it is worthwhile); otherwise null.
 */
function computeCore(typed: MealLog[]): string | null {
  const withComp = typed.filter((l) => Array.isArray(l.components) && l.components.length > 0);
  if (withComp.length < CORE_MIN_COUNT) return null;

  // Frequency of each normalized component across this meal type.
  // key -> { count, orig: latest original wording, lastIso }
  const freq = new Map<string, { count: number; orig: string; lastIso: string }>();
  for (const log of withComp) {
    for (const c of log.components!) {
      const norm = normalizeText(c);
      if (!norm) continue;
      const existing = freq.get(norm);
      if (existing) {
        existing.count += 1;
        if (log.created_at > existing.lastIso) {
          existing.lastIso = log.created_at;
          existing.orig = c;
        }
      } else {
        freq.set(norm, { count: 1, orig: c, lastIso: log.created_at });
      }
    }
  }

  const threshold = Math.max(CORE_MIN_COUNT, Math.ceil(CORE_SHARE * withComp.length));
  const stable = [...freq.values()].filter((e) => e.count >= threshold);

  // Reduce only when something actually varies below the bar. If every
  // component is stable there's nothing to strip — fall back to whole meals.
  if (stable.length === 0 || stable.length >= freq.size) return null;

  // Order the stable core the way it appears in the most recent entry, which
  // reads most naturally when pasted ("2 rotis, 150g rice").
  const latest = withComp.reduce((a, b) => (a.created_at >= b.created_at ? a : b));
  const order = new Map(latest.components!.map((c, i) => [normalizeText(c), i]));
  stable.sort(
    (a, b) =>
      (order.get(normalizeText(a.orig)) ?? 999) - (order.get(normalizeText(b.orig)) ?? 999),
  );

  return stable.map((e) => e.orig).join(', ');
}

/** Old behavior: top-N whole entries grouped by short_name/description/raw. */
function wholeMealTop(typed: MealLog[], n: number): Suggestion[] {
  type Bucket = { count: number; lastIso: string; label: string; rawText: string };
  const buckets = new Map<string, Bucket>();

  for (const log of typed) {
    const key = groupKey(log);
    if (!key) continue;
    const norm = normalizeText(key);
    if (!norm) continue;

    const existing = buckets.get(norm);
    if (existing) {
      existing.count += 1;
      if (log.created_at > existing.lastIso) {
        existing.lastIso = log.created_at;
        existing.label = key;
        existing.rawText = log.raw_text;
      }
    } else {
      buckets.set(norm, {
        count: 1,
        lastIso: log.created_at,
        label: key,
        rawText: log.raw_text,
      });
    }
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count || b.lastIso.localeCompare(a.lastIso))
    .slice(0, n)
    .map((b) => ({ label: b.label, rawText: b.rawText }));
}

export function computeMostEaten(logs: MealLog[]): MostEatenMap {
  const map: MostEatenMap = { breakfast: [], lunch: [], dinner: [], snack: [] };

  for (const t of MEAL_TYPES) {
    const typed = logs.filter((l) => l.meal_type === t);
    const core = computeCore(typed);
    map[t] = core ? [{ label: core, rawText: core }] : wholeMealTop(typed, MOST_EATEN_COUNT);
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
