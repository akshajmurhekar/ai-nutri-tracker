'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { fetchBurn, logGymCalories } from '@/lib/api';
import type { BurnResponse, EnergyDay } from '@/lib/types';
import type { DayBreakdown } from '@/lib/aggregate';
import { useTheme } from './theme';
import BurnSetup from './BurnSetup';

const DISMISS_KEY = 'nourish-burn-dismissed';
const DAY_MS = 24 * 60 * 60 * 1000;
// "Not now" only hides the teaser briefly; it reappears after this long so the
// feature is never permanently lost.
const DISMISS_DAYS = 3;

/**
 * Whether a stored dismissal is still "in effect". We store an ISO timestamp;
 * only values newer than DISMISS_DAYS count. Anything else (missing, the legacy
 * `'1'` flag from before this change, or an old timestamp) is treated as
 * not-dismissed so the teaser shows again.
 */
function isDismissed(stored: string | null): boolean {
  if (!stored) return false;
  const t = Date.parse(stored);
  if (Number.isNaN(t)) return false; // legacy '1' flag → expired
  return Date.now() - t < DISMISS_DAYS * DAY_MS;
}

const EATEN_COLOR = '#10b981'; // emerald — matches the app's eaten/macro green
const BURNED_COLOR = '#0ea5e9'; // sky

/**
 * Daily calories-burned card. Shows a grouped bar comparison of calories eaten
 * vs calories burned (TDEE baseline + gym) for the last 7 days, plus a number
 * input to log today's gym calories on top of the TDEE. If the user hasn't set
 * up their metrics yet, shows the voluntary BurnSetup form instead.
 */
export default function BurnCard({
  token,
  week,
}: {
  token: string | null;
  week: DayBreakdown[];
}) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [burn, setBurn] = useState<BurnResponse | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? isDismissed(window.localStorage.getItem(DISMISS_KEY)) : false,
  );
  // Before the user opts in, show a blurred teaser; tapping Start reveals the form.
  const [showSetup, setShowSetup] = useState(false);
  const [gymInput, setGymInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Force a fresh TDEE compute on demand (skips the weekly throttle).
  async function handleRecalc() {
    if (!token || recalculating) return;
    setRecalculating(true);
    setError(null);
    try {
      const data = await fetchBurn(token, 7, true);
      setBurn(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not recalculate');
    } finally {
      setRecalculating(false);
    }
  }

  async function load() {
    if (!token) return;
    try {
      const data = await fetchBurn(token);
      setBurn(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load burn data');
    }
  }

  // Initial load and lazy TDEE refresh. Inline the fetch (rather than calling
  // `load`) so state updates land after an await, matching the weight card.
  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const data = await fetchBurn(token);
        if (!active) return;
        setBurn(data);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load burn data');
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleSaved() {
    await load();
  }

  // "Not now" from the teaser: hide briefly (stamped timestamp, honoured by
  // isDismissed for DISMISS_DAYS) rather than permanently.
  function handleDismiss() {
    if (typeof window !== 'undefined') window.localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setDismissed(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(gymInput);
    if (!Number.isFinite(value) || value < 0 || busy || !token) return;
    setBusy(true);
    setError(null);
    try {
      const day = await logGymCalories(token, value);
      setBurn((prev) => (prev ? { ...prev, days: replaceDay(prev.days, day) } : prev));
      setGymInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save gym calories');
    } finally {
      setBusy(false);
    }
  }

  // ---- Render states -------------------------------------------------------
  if (!burn) {
    return error ? (
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-red-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-red-400">
        {error}
      </section>
    ) : null;
  }

  if (!burn.hasMetrics) {
    if (dismissed) return null;
    if (!showSetup) {
      return <BurnTeaser onStart={() => setShowSetup(true)} onDismiss={handleDismiss} />;
    }
    // The form's ✕ cancels back to the teaser (onCancel); it never dismisses.
    return <BurnSetup token={token} onSaved={handleSaved} onCancel={() => setShowSetup(false)} />;
  }

  // ---- Merge eaten (from dashboard week) with burned (fetched) by date -----
  const dayByDate = new Map(burn.days.map((d) => [d.date, d]));
  const chartData = week.map((w) => {
    const day = dayByDate.get(w.fullDate);
    return {
      label: w.label,
      eaten: w.calories,
      burned: day ? day.total_burned : 0,
    };
  });

  const today = burn.days[burn.days.length - 1] as EnergyDay | undefined;
  const todayEaten = week.length ? week[week.length - 1].calories : 0;

  const axisTick = dark ? '#a1a1aa' : '#71717a';
  const gridColor = dark ? '#27272a' : '#e4e4e7';
  const label = dark ? '#e4e4e7' : '#3f3f46';
  const tooltipBg = dark ? '#18181b' : '#ffffff';
  const tooltipBorder = dark ? '#3f3f46' : '#d4d4d8';

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Calories burned 🔥
        </h2>
        {today && (
          <span className="text-xs text-zinc-500">
            today:{' '}
            <span className="font-semibold tabular-nums text-sky-600 dark:text-sky-400">
              {Math.round(today.total_burned)}
            </span>
            {today.tdee != null && (
              <span className="text-zinc-400">
                {' '}
                = TDEE {Math.round(today.tdee)}
                {today.gym_calories > 0 && ` + gym ${Math.round(today.gym_calories)}`}
              </span>
            )}
          </span>
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={5000}
          value={gymInput}
          onChange={(e) => setGymInput(e.target.value)}
          placeholder="Gym calories (optional)"
          disabled={busy || !token}
          className="w-44 min-w-0 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-sky-500/60 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          type="submit"
          disabled={busy || !token || !gymInput.trim()}
          className="ml-auto shrink-0 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50"
        >
          Log
        </button>
      </form>

      <p className="mt-1 text-[11px] text-zinc-400">
        Eating less than you burn → on track for weight loss.
      </p>

      {error && <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>}

      <div className="mt-4 flex items-center gap-4 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: EATEN_COLOR }} />
          Eaten
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BURNED_COLOR }} />
          Burned (TDEE + gym)
        </span>
      </div>

      <div className="mt-2 h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: axisTick, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: axisTick, fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
            <Tooltip
              cursor={{ fill: dark ? '#27272a' : '#f4f4f5' }}
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 12,
                fontSize: 12,
                color: label,
              }}
              labelStyle={{ color: label, fontWeight: 600 }}
              formatter={(value, name) => [`${typeof value === 'number' ? Math.round(value) : value} kcal`, String(name)]}
            />
            <Bar dataKey="eaten" fill={EATEN_COLOR} radius={[3, 3, 0, 0]} maxBarSize={14} name="Eaten" />
            <Bar dataKey="burned" fill={BURNED_COLOR} radius={[3, 3, 0, 0]} maxBarSize={14} name="Burned" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {today && today.tdee == null && (
        <p className="mt-2 text-xs text-zinc-400">
          No TDEE baseline yet — it appears after we estimate it from your weight.
        </p>
      )}
      {today && todayEaten > 0 && today.total_burned > 0 && (
        <p
          className={`mt-2 text-xs font-medium ${
            today.total_burned >= todayEaten
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {today.total_burned >= todayEaten
            ? 'You burned more than you ate today — on track.'
            : 'You ate more than you burned today.'}
        </p>
      )}

      <button
        type="button"
        onClick={handleRecalc}
        disabled={recalculating}
        title="Re-estimate your TDEE from your current weight"
        className="mt-3 text-[11px] font-medium text-zinc-400 transition hover:text-sky-600 hover:underline disabled:opacity-50 dark:text-zinc-500 dark:hover:text-sky-400"
      >
        {recalculating ? 'Recalculating…' : 'Recalculate TDEE'}
      </button>
    </section>
  );
}

/** Replaces one day in the burn window, keeping order. */
function replaceDay(days: EnergyDay[], updated: EnergyDay): EnergyDay[] {
  return days.map((d) => (d.date === updated.date ? updated : d));
}

/**
 * Blurred teaser shown before the user opts into the calories-burned feature.
 * A ghost (blurred) setup preview sits behind a clear overlay that explains what
 * data will be collected and why, with a Start button that reveals the form.
 */
function BurnTeaser({ onStart, onDismiss }: { onStart: () => void; onDismiss: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Ghost setup preview, blurred to imply there's a flow behind the blur */}
      <div aria-hidden className="pointer-events-none select-none">
        <div className="h-3 w-28 rounded bg-zinc-300 opacity-70 blur-[3px] dark:bg-zinc-700" />
        <div className="mt-3 flex items-center gap-2">
          <div className="h-10 w-24 rounded-xl bg-zinc-200 opacity-70 blur-[3px] dark:bg-zinc-800" />
          <div className="h-10 w-24 rounded-xl bg-zinc-200 opacity-70 blur-[3px] dark:bg-zinc-800" />
        </div>
        <div className="mt-3 flex h-16 items-end gap-2">
          {[30, 55, 40, 70, 50, 80, 60].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-zinc-300 opacity-70 blur-[3px] dark:bg-zinc-700"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-3 h-9 w-40 rounded-xl bg-sky-200 opacity-70 blur-[3px] dark:bg-sky-900/60" />
      </div>

      {/* Clear overlay: explanation + Start */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/70 p-4 text-center dark:bg-zinc-900/70">
        <p className="max-w-[30ch] text-xs italic leading-relaxed text-zinc-600 dark:text-zinc-300">
          Estimate how many calories you burn each day. We&apos;ll ask for your height, birth date
          and gender once, then combine it with your weight to build a daily burned baseline.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onStart}
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
          >
            Start
          </button>
          <button
            onClick={onDismiss}
            className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Not now
          </button>
        </div>
      </div>
    </section>
  );
}
