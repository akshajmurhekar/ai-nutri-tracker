'use client';

import type { Quota } from '@/lib/types';

export default function QuotaIndicator({ quota }: { quota: Quota }) {
  const used = quota.queries_used_today ?? 0;
  const limit = quota.daily_limit ?? 600;
  const remaining = Math.max(limit - used, 0);
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const low = remaining <= Math.max(Math.round(limit * 0.1), 10);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {remaining.toLocaleString()} / {limit.toLocaleString()} queries left today
        </span>
        {low && (
          <span className="font-semibold text-amber-600 dark:text-amber-400">low</span>
        )}
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all ${low ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
