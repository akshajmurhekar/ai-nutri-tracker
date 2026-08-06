'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase/client';
import Footer from '@/components/Footer';
import { ThemeToggle } from '@/components/theme';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(error.message);
          return;
        }
        router.replace('/');
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) {
          setError(error.message);
          return;
        }
        if (data.session) {
          // Sign-ups are auto-confirmed — straight in.
          router.replace('/');
          router.refresh();
        } else {
          // Email confirmation is required — ask them to check their inbox.
          setInfo('Check your email to confirm your account, then sign in.');
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const input =
    'rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none transition focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-800 dark:bg-zinc-900';

  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-x-hidden">
      <div className="absolute right-4 top-[max(env(safe-area-inset-top),1rem)]">
        <ThemeToggle />
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6">
      <div className="mb-8">
        <p className="text-4xl font-bold tracking-tight">Nourish</p>
        <p className="mt-1 text-sm text-zinc-500">Track your meals, hit your macros.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {mode === 'up' && (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Name
            <input
              type="text"
              required
              maxLength={50}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={input}
              placeholder="Your name"
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
            placeholder="you@example.com"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Password
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
            placeholder="••••••••"
          />
        </label>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-xl bg-emerald-500 py-3 text-base font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        {mode === 'in' ? (
          <>
            Need an account?{' '}
            <button
              onClick={() => {
                setMode('up');
                setError(null);
                setInfo(null);
              }}
              className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-200"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              onClick={() => {
                setMode('in');
                setError(null);
                setInfo(null);
              }}
              className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-200"
            >
              Sign in
            </button>
          </>
        )}
      </p>
      </div>

      <Footer />
    </main>
  );
}
