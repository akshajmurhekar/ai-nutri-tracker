import type { MealType } from './constants';

export interface MealLog {
  id: string;
  user_id: string;
  created_at: string;
  meal_type: MealType;
  raw_text: string;
  description: string | null;
  short_name: string | null;
  components: string[] | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Quota {
  allowed?: boolean;
  queries_used_today: number;
  daily_limit: number;
}

export interface MealsResponse {
  logs: MealLog[];
}

export interface WeightEntry {
  id: string;
  user_id: string;
  date: string; // yyyy-mm-dd
  weight_kg: number;
  created_at: string;
}

export interface LogFoodSuccess {
  meal: MealLog;
  quota: Quota;
}

/** One calendar day's energy-expenditure row (from `energy_logs`). */
export interface EnergyDay {
  date: string; // yyyy-mm-dd
  bmr: number | null;
  tdee: number | null;
  gym_calories: number;
  /** tdee + gym_calories (0 when no baseline yet). */
  total_burned: number;
}

export interface BurnResponse {
  hasMetrics: boolean;
  tdeeUpdatedAt: string | null;
  days: EnergyDay[];
}

export interface BurnMetrics {
  height_cm: number | null;
  birth_date: string | null;
  gender: 'male' | 'female' | null;
}

/** A day that had gym calories logged (for the History tab). */
export interface BurnLogEntry {
  date: string; // yyyy-mm-dd
  gym_calories: number;
}

export interface ApiError {
  status: number;
  error: string;
  rejection_reason?: string | null;
  quota?: Quota;
}
