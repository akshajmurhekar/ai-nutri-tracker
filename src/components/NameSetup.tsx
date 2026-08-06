'use client';

import { FormEvent, useState } from 'react';

import { supabase } from '@/lib/supabase/client';

interface NameSetupProps {
  email: string;
  onSaved: (name: string) => Promise<void>;
}

export default function NameSetup({ email, onSaved }: NameSetupProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const cleanedName = name.trim();
    if (!cleanedName || password.length < 6) return;

    setBusy(true);
    setError(null);

    // Set a real password so the user can sign out and back in later.
    const { error: pwdError } = await supabase.auth.updateUser({ password });
    if (pwdError) {
      setError(pwdError.message);
      setBusy(false);
      return;
    }

    try {
      await onSaved(cleanedName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your name');
      setBusy(false);
    }
  }

  const input =
    'min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-base outline-none transition focus:border-emerald-500/60 dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold">Finish setting up your account</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Choose a name we can greet you by, and set a password for future sign-ins.
      </p>

      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 50))}
          placeholder="Your name"
          maxLength={50}
          required
          autoFocus
          className={input}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Set a password (min 6 characters)"
          minLength={6}
          required
          autoComplete="new-password"
          className={input}
        />
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy || !name.trim() || password.length < 6}
          className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save & continue'}
        </button>
      </form>

      <p className="mt-3 text-xs text-zinc-400">Signed in as {email}</p>
    </div>
  );
}
