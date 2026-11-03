'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AccordionItemProps {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function AccordionItem({
  id: _id,
  title,
  subtitle,
  badge,
  children,
  defaultOpen = false,
  className,
}: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        'rounded-xl border border-surface-border bg-surface-card/60 overflow-hidden transition-all',
        isOpen ? 'border-surface-border' : 'hover:border-surface-border/90',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-surface-elevated/40"
      >
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm tracking-tight">{title}</span>
            {badge}
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180 text-brand-indigo-400'
          )}
        />
      </button>

      {isOpen && (
        <div className="p-4 pt-1 border-t border-surface-border/50 bg-surface-base/30 text-xs sm:text-sm text-slate-300">
          {children}
        </div>
      )}
    </div>
  );
}

export interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

export function Accordion({ children, className }: AccordionProps) {
  return <div className={cn('space-y-3', className)}>{children}</div>;
}
