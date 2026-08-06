'use client';

import { FormEvent, useRef, useState } from 'react';

import { MEAL_TYPES, MEAL_TYPE_LABELS, MEAL_TYPE_COLORS, MAX_RAW_TEXT, type MealType } from '@/lib/constants';

interface LogFormProps {
  onLogged: (mealType: MealType, rawText: string) => Promise<{ ok: boolean; message?: string }>;
}

export default function LogForm({ onLogged }: LogFormProps) {
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cleaned = text.trim();
    if (!cleaned || busy) return;

    setBusy(true);
    setFeedback(null);

    const result = await onLogged(mealType, cleaned);

    setBusy(false);
    if (result.ok) {
      setFeedback({ tone: 'success', text: `${MEAL_TYPE_LABELS[mealType]} logged ✓` });
      setText('');
      inputRef.current?.focus();
    } else {
      setFeedback({ tone: 'error', text: result.message ?? 'Could not log this item.' });
    }
  }

  const charsLeft = MAX_RAW_TEXT - text.length;
  const inactive =
    'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200';

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* Meal type segmented toggle */}
      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {MEAL_TYPES.map((t) => {
          const active = mealType === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setMealType(t)}
              aria-pressed={active}
              className={`rounded-xl px-2 py-2.5 text-sm font-medium capitalize transition ${
                active ? 'shadow' : inactive
              }`}
              style={
                active
                  ? { backgroundColor: MEAL_TYPE_COLORS[t], color: '#171717' }
                  : undefined
              }
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Natural-language input */}
      <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-2 focus-within:border-emerald-500/60 focus-within:ring-4 focus-within:ring-emerald-500/10 dark:border-zinc-800 dark:bg-zinc-900">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_RAW_TEXT))}
          placeholder="e.g. 353g matar paneer & 3 roti"
          disabled={busy}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="shrink-0 rounded-xl bg-emerald-500 px-5 py-2.5 text-base font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? '…' : 'Log'}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
        <span
          className={
            feedback?.tone === 'error'
              ? 'text-red-500 dark:text-red-400'
              : feedback?.tone === 'success'
                ? 'text-emerald-600 dark:text-emerald-400'
                : ''
          }
        >
          {feedback?.text ?? 'Natural language is fine — be as specific as you like.'}
        </span>
        <span className="shrink-0">{charsLeft} chars left</span>
      </div>
    </form>
  );
}
