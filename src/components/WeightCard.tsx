'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { fetchWeights, logWeight } from '@/lib/api';
import type { WeightEntry } from '@/lib/types';
import { useTheme } from './theme';

const CHART_TYPE_KEY = 'nourish-weight-chart-type';
type ChartType = 'line' | 'bar';

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function avg7At(entries: WeightEntry[], date: Date): number | null {
  const end = localDateStr(date);
  const start = localDateStr(new Date(date.getTime() - 6 * 86400000));
  const inWindow = entries.filter((e) => e.date >= start && e.date <= end);
  if (!inWindow.length) return null;
  const sum = inWindow.reduce((s, e) => s + Number(e.weight_kg), 0);
  return sum / inWindow.length;
}

export default function WeightCard({ token }: { token: string | null }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  // Read the persisted line/bar choice lazily. This only runs on the client
  // (the toggle isn't rendered until data loads after mount), so reading
  // localStorage here avoids a hydration mismatch.
  const [chartType, setChartType] = useState<ChartType>(() => {
    if (typeof window === 'undefined') return 'line';
    const saved = window.localStorage.getItem(CHART_TYPE_KEY);
    return saved === 'bar' ? 'bar' : 'line';
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  function setChartTypeAndSave(t: ChartType) {
    setChartType(t);
    if (typeof window !== 'undefined') window.localStorage.setItem(CHART_TYPE_KEY, t);
  }

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await fetchWeights(token);
        setEntries(data);
        const today = localDateStr(new Date());
        const todays = data.find((e) => e.date === today);
        if (todays) setInput(String(todays.weight_kg));
      } catch {
        setError('Could not load weight');
      } finally {
        setLoaded(true);
      }
    })();
  }, [token]);

  const today = localDateStr(new Date());
  const hasToday = entries.some((e) => e.date === today);

  // Stats across calendar weeks.
  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

    const inLast7 = entries.filter((e) => {
      const d = parseDate(e.date);
      return d > weekAgo && d <= now;
    });
    const inPrev7 = entries.filter((e) => {
      const d = parseDate(e.date);
      return d > twoWeeksAgo && d <= weekAgo;
    });
    const avg = (arr: WeightEntry[]) =>
      arr.length ? arr.reduce((s, e) => s + Number(e.weight_kg), 0) / arr.length : null;

    const weeklyAvg = avg(inLast7);
    const prevAvg = avg(inPrev7);
    const delta = weeklyAvg != null && prevAvg != null ? weeklyAvg - prevAvg : null;
    const todays = entries.find((e) => e.date === today);

    return { weeklyAvg, delta, todaysWeight: todays?.weight_kg ?? null };
  }, [entries, today]);

  // Chart over the last 30 logged days (clamped to 30 points).
  const chart = useMemo(() => {
    return entries
      .slice(-30)
      .map((e) => {
        const d = parseDate(e.date);
        return {
          label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          weight: Number(e.weight_kg),
          avg7: avg7At(entries, d) != null ? Number(avg7At(entries, d)!.toFixed(1)) : null,
        };
      });
  }, [entries]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(input);
    if (!Number.isFinite(value) || value <= 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await logWeight(token!, value);
      setEntries((prev) => {
        const rest = prev.filter((w) => w.date !== saved.date);
        return [...rest, saved].sort((a, b) => a.date.localeCompare(b.date));
      });
      setInput(String(saved.weight_kg));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save weight');
    } finally {
      setBusy(false);
    }
  }

  const axisTick = dark ? '#a1a1aa' : '#71717a';
  const gridColor = dark ? '#27272a' : '#e4e4e7';
  const label = dark ? '#e4e4e7' : '#3f3f46';
  const tooltipBg = dark ? '#18181b' : '#ffffff';
  const tooltipBorder = dark ? '#3f3f46' : '#d4d4d8';

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Weight (kg)</h2>
        {loaded && stats.todaysWeight != null && (
          <span className="text-xs text-zinc-500">
            today: <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">{stats.todaysWeight}</span>
          </span>
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min={20}
          max={400}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. 70.5"
          disabled={busy || !token}
          className="w-32 min-w-0 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-base outline-none transition focus:border-emerald-500/60 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <span className="text-sm text-zinc-500">kg</span>
        <button
          type="submit"
          disabled={busy || !token || !input.trim()}
          className="ml-auto shrink-0 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {hasToday ? 'Update' : 'Log'}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>}

      {loaded && entries.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-zinc-100 p-2 dark:bg-zinc-800">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">7d avg</p>
              <p className="text-base font-semibold tabular-nums">
                {stats.weeklyAvg != null ? stats.weeklyAvg.toFixed(1) : '–'}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-100 p-2 dark:bg-zinc-800">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">last 30d</p>
              <p className="text-base font-semibold tabular-nums">
                {chart.length ? chart[chart.length - 1].weight.toFixed(1) : '–'}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-100 p-2 dark:bg-zinc-800">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Δ wk</p>
              <p
                className={`text-base font-semibold tabular-nums ${
                  stats.delta == null
                    ? ''
                    : stats.delta > 0
                      ? 'text-red-500 dark:text-red-400'
                      : stats.delta < 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : ''
                }`}
              >
                {stats.delta != null ? `${stats.delta > 0 ? '+' : ''}${stats.delta.toFixed(1)}` : '–'}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-1">
            {(['line', 'bar'] as ChartType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setChartTypeAndSave(t)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${
                  chartType === t
                    ? 'bg-emerald-500 text-white'
                    : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mt-2 h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axisTick, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fill: axisTick, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: 12,
                    fontSize: 12,
                    color: label,
                  }}
                  labelStyle={{ color: label, fontWeight: 600 }}
                />
                {chartType === 'bar' && (
                  <Bar dataKey="weight" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={24} name="Weight" />
                )}
                {chartType === 'line' && (
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    name="Weight"
                  />
                )}
                <Line type="monotone" dataKey="avg7" stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="7d avg" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {loaded && entries.length === 0 && (
        <p className="mt-3 text-xs text-zinc-400">
          Log your weight once a day — a weekly average and trend chart appear after your first entry.
        </p>
      )}
    </section>
  );
}
