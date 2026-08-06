export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export const MEAL_TYPE_COLORS: Record<MealType, string> = {
  breakfast: '#f59e0b', // amber
  lunch: '#10b981', // emerald
  dinner: '#6366f1', // indigo
  snack: '#ec4899', // pink
};

/** Max chars accepted from the input bar (anti-abuse). */
export const MAX_RAW_TEXT = 500;

/** Caps on what the model may return, so one bogus entry can't blow up the DB. */
export const MACRO_LIMITS = {
  calories: 20000,
  protein: 2000,
  carbs: 5000,
  fat: 2000,
} as const;
