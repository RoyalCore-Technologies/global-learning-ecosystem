import React from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  roleBadge?: string;
}

export function Avatar({
  src,
  name = 'Learner',
  size = 'md',
  isOnline,
  roleBadge,
  className,
  ...props
}: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  }[size];

  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'L';

  // Deterministic harmonic background color for avatar initials
  const colorHash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorVariants = [
    'bg-indigo-900 text-indigo-200 border-indigo-700/50',
    'bg-emerald-900 text-emerald-200 border-emerald-700/50',
    'bg-violet-900 text-violet-200 border-violet-700/50',
    'bg-cyan-900 text-cyan-200 border-cyan-700/50',
    'bg-amber-900 text-amber-200 border-amber-700/50',
  ];
  const colorClass = colorVariants[colorHash % colorVariants.length];

  return (
    <div className={cn('relative inline-flex shrink-0 select-none', className)} {...props}>
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full border overflow-hidden font-bold tracking-tight',
          sizeClasses,
          colorClass
        )}
      >
        {src && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {isOnline !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-surface-base',
            size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3',
            isOnline ? 'bg-emerald-500' : 'bg-slate-600'
          )}
        />
      )}
    </div>
  );
}
