'use client';

import { FormEvent, useState } from 'react';

import { saveMetrics } from '@/lib/api';

/**
 * Voluntary onboarding for the calories-burned (TDEE) feature. Asked once:
 * height, birth date, gender. The ✕ cancels back to the teaser (onCancel) —
 * it does NOT dismiss the feature (the teaser's "Not now" handles that).
 * Metrics are only saved when the user explicitly submits.
 */
export default function BurnSetup({
  token,
  onSaved,
  onCancel,
}: {
  token: string | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [height, setHeight] = useState('');
  const [birth, setBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cm = Number(height);
    if (!Number.isFinite(cm) || cm <= 0 || !birth || !gender || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveMetrics(token!, { height_cm: cm, birth_date: birth, gender });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    'rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-sky-500/60 dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Estimate your calories burned 🔥
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Optional: set up a daily burned-calorie baseline (TDEE). Enter your details once — we will
            estimate it for you and update it weekly.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Back to teaser"
          title="Back"
          className="shrink-0 rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          ✕
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <label>
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">Height (cm)</span>
            <input
              type="number"
              inputMode="numeric"
              min={100}
              max={250}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="e.g. 172"
              className={`${inputCls} mt-1 w-full`}
            />
          </label>
          <label>
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">Birth date</span>
            <input
              type="date"
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
              className={`${inputCls} mt-1 w-full`}
            />
          </label>
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-wide text-zinc-500">Gender</span>
          <div className="mt-1 flex gap-2">
            {(['male', 'female'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium capitalize transition ${
                  gender === g
                    ? 'bg-sky-500 text-white'
                    : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy || !token || !height.trim() || !birth || !gender}
          className="rounded-xl bg-sky-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50"
        >
          Save and estimate
        </button>
      </form>
    </section>
  );
}
