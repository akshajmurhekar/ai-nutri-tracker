'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  fetchMe,
  fetchMeals,
  getAccessToken,
  logFood,
  saveProfileName,
  type MeProfile,
} from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import { buildWeekly, summarizeToday } from '@/lib/aggregate';
import type { MealLog } from '@/lib/types';
import type { MealType } from '@/lib/constants';

import Footer from './Footer';
import LogForm from './LogForm';
import NameSetup from './NameSetup';
import SummaryCards from './SummaryCards';
import WeeklyChart from './WeeklyChart';
import { ThemeToggle } from './theme';

export default function Dashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await getAccessToken();
      if (!t) {
        router.replace('/login');
        return;
      }
      setToken(t);
      try {
        const [me, data] = await Promise.all([fetchMe(t), fetchMeals(t)]);
        setProfile(me);
        setLogs(data.logs);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load your data');
      }
    })();
  }, [router]);

  const handleLogged = useCallback(
    async (mealType: MealType, rawText: string) => {
      if (!token) return { ok: false };
      const res = await logFood(token, mealType, rawText);
      if (res.ok) {
        setLogs((prev) =>
          [...prev, res.data.meal].sort((a, b) => a.created_at.localeCompare(b.created_at)),
        );
        return { ok: true };
      }
      return {
        ok: false,
        message: res.status === 429 ? `Daily limit reached (${res.quota?.daily_limit ?? 600}/day)` : res.error,
      };
    },
    [token],
  );

  async function handleNameSaved(name: string) {
    if (!token) return;
    const updated = await saveProfileName(token, name);
    setProfile(updated);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  const today = summarizeToday(logs);
  const week = buildWeekly(logs, 7);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">
            Hi {profile?.name ?? 'friend'} 👋
          </h1>
          <p className="text-xs text-zinc-500">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      </header>

      {profile?.needsName && profile.email && (
        <NameSetup email={profile.email} onSaved={handleNameSaved} />
      )}

      <LogForm onLogged={handleLogged} />

      {loadError ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {loadError}
        </p>
      ) : (
        <>
          <SummaryCards today={today} />
          <WeeklyChart week={week} />
        </>
      )}

      <Footer />
    </div>
  );
}
