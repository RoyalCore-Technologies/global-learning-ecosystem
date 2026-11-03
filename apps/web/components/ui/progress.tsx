import React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  max?: number;
  showLabel?: boolean;
  colorScheme?: 'indigo' | 'emerald' | 'cyan' | 'amber' | 'gradient';
}

export function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  colorScheme = 'gradient',
  className,
  ...props
}: ProgressBarProps) {
  const percentage = Math.min(Math.max(Math.round((value / max) * 100), 0), 100);

  const fillColors = {
    indigo: 'bg-brand-indigo-500',
    emerald: 'bg-emerald-500',
    cyan: 'bg-brand-cyan-500',
    amber: 'bg-amber-500',
    gradient: 'bg-gradient-to-r from-brand-indigo-500 to-brand-cyan-400',
  }[colorScheme];

  return (
    <div className={cn('w-full space-y-1', className)} {...props}>
      {showLabel && (
        <div className="flex justify-between items-center text-[11px] text-slate-400">
          <span>Progress</span>
          <span className="font-semibold text-white">{percentage}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        className="w-full h-2 rounded-full bg-surface-subtle overflow-hidden"
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300 ease-out', fillColors)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
