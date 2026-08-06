'use client';

import type { TodayTotals } from '@/lib/aggregate';

interface Card {
  label: string;
  value: number;
  unit: string;
  hint: string;
}

export default function SummaryCards({ today }: { today: TodayTotals }) {
  const cards: Card[] = [
    { label: 'Calories', value: today.calories, unit: 'kcal', hint: 'today' },
    { label: 'Protein', value: today.protein, unit: 'g', hint: 'today' },
    { label: 'Carbs', value: today.carbs, unit: 'g', hint: 'today' },
    { label: 'Fat', value: today.fat, unit: 'g', hint: 'today' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {c.label}
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {c.value.toLocaleString()}
            <span className="ml-1 text-sm font-medium text-zinc-400 dark:text-zinc-500">
              {c.unit}
            </span>
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
            {today.meals} meal(s) · {c.hint}
          </p>
        </div>
      ))}
    </div>
  );
}
