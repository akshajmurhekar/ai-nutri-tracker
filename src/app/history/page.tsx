'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { deleteMeal, fetchMeals, getAccessToken } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import { localDayKey } from '@/lib/aggregate';
import { MEAL_TYPE_COLORS, type MealType } from '@/lib/constants';
import type { MealLog } from '@/lib/types';

import Footer from '@/components/Footer';
import { ThemeToggle } from '@/components/theme';

interface DayGroup {
  key: string;
  label: string;
  calories: number;
  meals: MealLog[];
}

export default function HistoryPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await getAccessToken();
      if (!t) {
        router.replace('/login');
        return;
      }
      setToken(t);
      try {
        const data = await fetchMeals(t, 30);
        setLogs(data.logs);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load your history');
      }
    })();
  }, [router]);

  const groups = useMemo(() => {
    const byKey = new Map<string, DayGroup>();
    for (const m of logs) {
      const key = localDayKey(m.created_at);
      let g = byKey.get(key);
      if (!g) {
        const d = new Date(m.created_at);
        g = {
          key,
          label: d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
          calories: 0,
          meals: [],
        };
        byKey.set(key, g);
      }
      g.meals.push(m);
      g.calories += Number(m.calories);
    }
    return [...byKey.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [logs]);

  async function handleDelete(id: string) {
    if (!token) return;
    if (!window.confirm('Delete this entry?')) return;
    setDeleting(id);
    try {
      await deleteMeal(token, id);
      setLogs((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete entry');
    } finally {
      setDeleting(null);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1.5rem)]">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">History</h1>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Dashboard
          </Link>
          <ThemeToggle />
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {groups.length === 0 && !error ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Nothing logged yet. Add your first meal on the dashboard.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{g.label}</h2>
              <span className="text-xs tabular-nums text-zinc-500">{g.calories} kcal</span>
            </div>
            <div className="flex flex-col gap-2">
              {g.meals.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: MEAL_TYPE_COLORS[m.meal_type as MealType] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {m.description || m.raw_text}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {new Date(m.created_at).toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}{' '}
                      · {m.meal_type}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
                    {Number(m.calories)} kcal
                  </span>
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={deleting === m.id}
                    aria-label="Delete entry"
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {deleting === m.id ? '…' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <Footer />
    </div>
  );
}
