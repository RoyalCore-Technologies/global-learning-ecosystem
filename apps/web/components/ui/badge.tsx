import React from 'react';
import { cn } from '@/lib/utils';
import { ROLE_THEMES } from '@platform/ui';
import { CheckCircle2, Sparkles } from 'lucide-react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger' | 'ai' | 'tier';
  roleType?: 'STUDENT' | 'BEGINNER' | 'EDUCATOR' | 'CREATOR' | 'RESEARCHER' | 'ADMIN';
  isVerified?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  roleType,
  isVerified = false,
  children,
  ...props
}: BadgeProps) {
  // If roleType is provided, render using institutional role styling
  if (roleType && ROLE_THEMES[roleType]) {
    const roleConfig = ROLE_THEMES[roleType];
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border tracking-wide uppercase',
          roleConfig.badgeClass,
          className
        )}
        {...props}
      >
        {roleConfig.label}
        {isVerified && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
      </span>
    );
  }

  const baseStyles =
    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide';

  const variants = {
    default: 'bg-brand-indigo-950/60 text-brand-indigo-300 border border-brand-indigo-500/30',
    secondary: 'bg-surface-subtle text-slate-300 border border-surface-border',
    outline: 'border border-slate-700 text-slate-300',
    success: 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30',
    warning: 'bg-amber-950/60 text-amber-300 border border-amber-500/30',
    danger: 'bg-rose-950/60 text-rose-300 border border-rose-500/30',
    ai: 'bg-gradient-to-r from-brand-indigo-950/80 to-brand-violet-950/80 text-violet-300 border border-violet-500/30 shadow-violet-glow',
    tier: 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold',
  };

  return (
    <span className={cn(baseStyles, variants[variant], className)} {...props}>
      {variant === 'ai' && <Sparkles className="w-3 h-3 text-violet-400 shrink-0" />}
      {children}
    </span>
  );
}
