import { MEAL_TYPES, type MealType } from './constants';
import type { MealLog } from './types';

/** Local (yyyy-mm-dd) key for a timestamp, using the device timezone. */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface TodayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: number;
}

/** Sum nutrition for meals logged on the user's current local day. */
export function summarizeToday(logs: MealLog[]): TodayTotals {
  const today = localDayKey(new Date().toISOString());
  const todays = logs.filter((l) => localDayKey(l.created_at) === today);
  return {
    calories: round(todays.reduce((s, l) => s + Number(l.calories), 0)),
    protein: round(todays.reduce((s, l) => s + Number(l.protein), 0)),
    carbs: round(todays.reduce((s, l) => s + Number(l.carbs), 0)),
    fat: round(todays.reduce((s, l) => s + Number(l.fat), 0)),
    meals: todays.length,
  };
}

export interface DayBreakdown {
  label: string;
  fullDate: string;
  calories: number;
  // per-meal-type calorie totals (for stacked bars)
  byMealType: Record<MealType, number>;
}

/**
 * Builds an array of the last `days` local calendar days (oldest → newest),
 * each with calories summed per meal type. Missing days are zero-filled so the
 * chart always shows every slice.
 */
export function buildWeekly(logs: MealLog[], days = 7): DayBreakdown[] {
  const result: DayBreakdown[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDayKey(d.toISOString());
    result.push({
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      fullDate: key,
      calories: 0,
      byMealType: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
    });
  }
  // note: localDayKey(now) vs key built from setDate may differ by sub-day,
  // so map against the generated keys rather than recomputing.
  const indexByKey = new Map(result.map((r, idx) => [r.fullDate, idx]));

  for (const log of logs) {
    const idx = indexByKey.get(localDayKey(log.created_at));
    if (idx === undefined) continue;
    const cell = result[idx];
    const cals = Number(log.calories) || 0;
    cell.byMealType[log.meal_type] += cals;
    cell.calories += cals;
  }

  for (const cell of result) {
    for (const t of MEAL_TYPES) {
      cell.byMealType[t] = round(cell.byMealType[t]);
    }
    cell.calories = round(cell.calories);
  }

  return result;
}

function round(n: number): number {
  return Math.round(n);
}
