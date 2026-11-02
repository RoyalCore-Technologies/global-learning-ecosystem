import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, FolderSearch, RefreshCw } from 'lucide-react';
import { Button } from './button';

export function LoadingSpinner({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  }[size];

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('inline-flex items-center justify-center animate-spin text-brand-indigo-400', sizeClasses, className)}
    >
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="opacity-90"
        />
      </svg>
    </div>
  );
}

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-surface-elevated/80', className)}
      {...props}
    />
  );
}

export function EmptyState({
  icon: Icon = FolderSearch,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  icon?: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-surface-border bg-surface-card/30',
        className
      )}
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-elevated text-brand-indigo-400 mb-4 border border-surface-border shadow-inner">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-slate-400 max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-6">
          <Button size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while fetching knowledge data.',
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-rose-500/20 bg-rose-950/20 text-rose-200',
        className
      )}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-900/40 text-rose-400 mb-3 border border-rose-500/30">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-rose-100">{title}</h3>
      <p className="mt-1 text-xs text-rose-300/80 max-w-sm">{message}</p>
      {onRetry && (
        <div className="mt-5">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={onRetry}
            className="border-rose-500/40 hover:bg-rose-950/50 text-rose-200"
          >
            Retry Request
          </Button>
        </div>
      )}
    </div>
  );
}
