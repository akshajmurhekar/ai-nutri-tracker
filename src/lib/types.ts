import type { MealType } from './constants';

export interface MealLog {
  id: string;
  user_id: string;
  created_at: string;
  meal_type: MealType;
  raw_text: string;
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
  quota: Quota;
}

export interface LogFoodSuccess {
  meal: MealLog;
  quota: Quota;
}

export interface ApiError {
  status: number;
  error: string;
  rejection_reason?: string | null;
  quota?: Quota;
}
