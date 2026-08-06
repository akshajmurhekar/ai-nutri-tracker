'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
import { getCachedName, setCachedName } from '@/lib/storage';
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
  // Greet from the cached name so the header renders instantly, then let the
  // network confirm it. Avoids the "Hi friend → Hi <name>" flash.
  const [displayName, setDisplayName] = useState<string | null>(() => getCachedName());
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

      // Fast path: the name usually already lives on the session, so prefer it
      // without waiting on the DB-backed /api/me call.
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const metaName = session?.user?.user_metadata?.name as string | undefined;
        if (typeof metaName === 'string' && metaName.trim()) {
          setDisplayName(metaName);
          setCachedName(metaName);
        }
      } catch {
        /* ignore — the DB-backed fetch below will supply the name */
      }

      try {
        const [me, data] = await Promise.all([fetchMe(t), fetchMeals(t)]);
        setProfile(me);
        setDisplayName(me.name);
        setCachedName(me.name);
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
    setDisplayName(updated.name);
    setCachedName(updated.name);
  }

  async function handleSignOut() {
    setCachedName(null);
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  const today = summarizeToday(logs);
  const week = buildWeekly(logs, 7);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1.5rem)]">
      {/* Header */}
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">
            Hi {displayName ?? profile?.name ?? 'friend'} 👋
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
          <Link
            href="/history"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            History
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
