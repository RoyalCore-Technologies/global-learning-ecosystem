'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LearnovaLogo } from '@/components/brand/learnova-logo';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  Compass,
  GraduationCap,
  Users,
  Sparkles,
  Video,
  MessageSquare,
  Bookmark,
  LogOut,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ className, isCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push('/auth/login');
      router.refresh();
    } catch (err) {
      console.error('[Learnova Auth] Logout failed:', err);
    }
  };

  const mainNav = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      label: 'Knowledge Feed',
      href: '/explore',
      icon: Compass,
      badge: 'Live',
    },
    {
      label: 'Courses & Tracks',
      href: '/courses',
      icon: GraduationCap,
      badge: undefined,
    },
    {
      label: 'Communities',
      href: '/communities',
      icon: Users,
      badge: undefined,
    },
    {
      label: 'AI Learning Core',
      href: '/ai-assistant',
      icon: Sparkles,
      badge: 'AI',
      isAi: true,
    },
    {
      label: 'Creator Studio',
      href: '/creator',
      icon: Video,
      badge: undefined,
    },
  ];

  const secondaryNav = [
    {
      label: 'Messages',
      href: '/messages',
      icon: MessageSquare,
      badge: '3',
    },
    {
      label: 'Bookmarks',
      href: '/bookmarks',
      icon: Bookmark,
      badge: undefined,
    },
  ];

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen sticky top-0 z-30 border-r border-surface-border bg-surface-base/95 backdrop-blur-xl transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-64',
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center h-16 px-6 border-b border-surface-border/60">
        <LearnovaLogo
          size={isCollapsed ? 'sm' : 'md'}
          showWordmark={!isCollapsed}
          showTagline={!isCollapsed}
          href="/dashboard"
        />
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-6 space-y-6">
        {/* Main Learning & Social Ecosystems */}
        <div className="space-y-1">
          {!isCollapsed && (
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Ecosystems
            </p>
          )}
          {mainNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all group select-none',
                  isActive
                    ? 'bg-brand-indigo-600/15 text-white font-semibold border border-brand-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-surface-elevated/70'
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <div
                  className={cn(
                    'flex items-center justify-center rounded-lg p-1.5 transition-colors',
                    isActive
                      ? item.isAi
                        ? 'bg-brand-violet-600 text-white'
                        : 'bg-brand-indigo-600 text-white'
                      : item.isAi
                      ? 'text-brand-violet-400 group-hover:text-brand-violet-300'
                      : 'text-slate-400 group-hover:text-slate-200'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                </div>
                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                          item.isAi
                            ? 'bg-brand-violet-950/80 text-violet-300 border border-violet-500/30'
                            : 'bg-surface-elevated text-slate-300'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>

        {/* Secondary Navigation */}
        <div className="space-y-1 pt-4 border-t border-surface-border/60">
          {!isCollapsed && (
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Personal Space
            </p>
          )}
          {secondaryNav.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all group select-none',
                  isActive
                    ? 'bg-surface-elevated text-white font-semibold border border-surface-border'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-surface-elevated/70'
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 group-hover:text-slate-200">
                  <Icon className="w-4 h-4 shrink-0" />
                </div>
                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-indigo-600 text-white">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* User Status Footer */}
      <div className="p-4 border-t border-surface-border/60 bg-surface-card/40">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name="Alex Rivera" isOnline size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">Alex Rivera</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge roleType="STUDENT" className="text-[9px] px-1.5 py-0" />
                  <span className="text-[10px] text-slate-400 truncate">Computer Science</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/dashboard/profile"
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-elevated transition-colors"
                title="View Profile"
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
              <button
                onClick={handleSignOut}
                className="text-slate-400 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-950/30 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Avatar name="Alex Rivera" isOnline size="sm" />
            <button
              onClick={handleSignOut}
              className="text-slate-400 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-950/30 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
