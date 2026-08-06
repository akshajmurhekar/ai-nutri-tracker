'use client';

import { MEAL_TYPE_COLORS, MEAL_TYPE_LABELS, type MealType } from '@/lib/constants';
import type { MealLog } from '@/lib/types';

interface MealDetailModalProps {
  meal: MealLog;
  deleting: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export default function MealDetailModal({ meal, deleting, onClose, onDelete }: MealDetailModalProps) {
  const type = meal.meal_type as MealType;
  const color = MEAL_TYPE_COLORS[type];
  const when = new Date(meal.created_at);

  const macros = [
    { label: 'Calories', value: Math.round(Number(meal.calories)), unit: 'kcal' },
    { label: 'Protein', value: Math.round(Number(meal.protein)), unit: 'g' },
    { label: 'Carbs', value: Math.round(Number(meal.carbs)), unit: 'g' },
    { label: 'Fat', value: Math.round(Number(meal.fat)), unit: 'g' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold capitalize"
            style={{ backgroundColor: color, color: '#171717' }}
          >
            {MEAL_TYPE_LABELS[type]}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {/* Date & time */}
        <p className="mt-3 text-sm text-zinc-500">
          {when.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          {' · '}
          {when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </p>

        {/* What was eaten */}
        <h2 className="mt-2 text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
          {meal.description || meal.raw_text}
        </h2>
        {meal.description && (
          <p className="mt-1 text-sm text-zinc-400">
            <span className="text-zinc-500">You typed:</span> “{meal.raw_text}”
          </p>
        )}

        {/* Macros */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {macros.map((m) => (
            <div key={m.label} className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">{m.label}</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {m.value}
                <span className="ml-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">{m.unit}</span>
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={() => onDelete(meal.id)}
          disabled={deleting}
          className="mt-4 w-full rounded-xl border border-red-500/30 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete entry'}
        </button>
      </div>
    </div>
  );
}
