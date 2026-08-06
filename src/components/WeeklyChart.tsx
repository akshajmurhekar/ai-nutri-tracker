'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { MEAL_TYPES, MEAL_TYPE_COLORS, MEAL_TYPE_LABELS, type MealType } from '@/lib/constants';
import type { DayBreakdown } from '@/lib/aggregate';
import { useTheme } from './theme';

export default function WeeklyChart({ week }: { week: DayBreakdown[] }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const axisTick = dark ? '#a1a1aa' : '#71717a';
  const gridColor = dark ? '#27272a' : '#e4e4e7';
  const label = dark ? '#e4e4e7' : '#3f3f46';
  const tooltipBg = dark ? '#18181b' : '#ffffff';
  const tooltipBorder = dark ? '#3f3f46' : '#d4d4d8';

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Last 7 days</h2>
        <ul className="flex flex-wrap gap-3">
          {MEAL_TYPES.map((t: MealType) => (
            <li key={t} className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: MEAL_TYPE_COLORS[t] }}
              />
              {MEAL_TYPE_LABELS[t]}
            </li>
          ))}
        </ul>
      </div>

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={week} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: axisTick, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: axisTick, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ fill: dark ? '#ffffff0d' : '#0000000d' }}
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 12,
                fontSize: 12,
                color: label,
              }}
              labelStyle={{ color: label, fontWeight: 600 }}
            />
            {MEAL_TYPES.map((t: MealType) => (
              <Bar
                key={t}
                dataKey={`byMealType.${t}`}
                stackId="cal"
                fill={MEAL_TYPE_COLORS[t]}
                name={MEAL_TYPE_LABELS[t]}
                radius={t === 'snack' ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={36}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
