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

/** Calories-burned / TDEE feature. */
/** How often (in days) a user's TDEE is recomputed from their weekly weight. */
export const ENERGY_REFRESH_DAYS = 7;
/** Number of calendar days the burn dashboard shows / backfills. */
export const ENERGY_WINDOW_DAYS = 7;
/** Gym calories logged on top of TDEE are capped at this many kcal/day. */
export const MAX_GYM_CALORIES = 5000;
/** Caps on Gemini's BMR/TDEE estimate so one bad reply can't corrupt rows. */
export const ENERGY_LIMITS = {
  bmr: { min: 800, max: 5000 },
  tdee: { min: 900, max: 7000 },
} as const;
