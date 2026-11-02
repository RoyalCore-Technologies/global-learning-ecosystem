'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Compass, GraduationCap, Users, Sparkles } from 'lucide-react';

export function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Feed',
      href: '/explore',
      icon: Compass,
    },
    {
      label: 'Courses',
      href: '/courses',
      icon: GraduationCap,
    },
    {
      label: 'AI Core',
      href: '/ai-assistant',
      icon: Sparkles,
      isAi: true,
    },
    {
      label: 'Circles',
      href: '/communities',
      icon: Users,
    },
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around h-16 border-t border-surface-border/80 bg-surface-base/95 backdrop-blur-xl px-2">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors select-none',
              isActive
                ? item.isAi
                  ? 'text-brand-violet-400 font-bold'
                  : 'text-brand-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-center p-1 rounded-lg transition-transform',
                isActive && (item.isAi ? 'scale-110 bg-brand-violet-950/60' : 'scale-110 bg-brand-indigo-950/60')
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className="mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
