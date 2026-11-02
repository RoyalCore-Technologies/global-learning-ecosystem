'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopNavbar } from './top-navbar';
import { MobileBottomNav } from './mobile-bottom-nav';
import { LearnovaLogo } from '@/components/brand/learnova-logo';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  X,
  Sparkles,
  GraduationCap,
  Compass,
  Users,
  LayoutDashboard,
  Video,
  MessageSquare,
  LogOut,
} from 'lucide-react';
import Link from 'next/link';

interface AppShellProps {
  children: React.ReactNode;
  rightAside?: React.ReactNode;
}

export function AppShell({ children, rightAside }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      setMobileMenuOpen(false);
      router.push('/auth/login');
      router.refresh();
    } catch (err) {
      console.error('[Learnova Auth] Mobile sign out failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-surface-base text-slate-100 flex flex-col antialiased">
      <div className="flex flex-1">
        {/* Desktop Sticky Sidebar */}
        <Sidebar />

        {/* Mobile Slide-Over Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-surface-base/80 backdrop-blur-md"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Drawer Content */}
            <div className="relative w-4/5 max-w-xs bg-surface-base border-r border-surface-border p-6 flex flex-col justify-between z-10 shadow-2xl">
              <div>
                <div className="flex items-center justify-between pb-6 border-b border-surface-border">
                  <LearnovaLogo size="sm" showTagline href="/dashboard" />
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="mt-6 space-y-1">
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-surface-elevated"
                  >
                    <LayoutDashboard className="w-4 h-4 text-brand-indigo-400" />
                    <span>Dashboard</span>
                  </Link>
                  <Link
                    href="/explore"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-surface-elevated"
                  >
                    <Compass className="w-4 h-4 text-brand-cyan-400" />
                    <span>Knowledge Feed</span>
                  </Link>
                  <Link
                    href="/courses"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-surface-elevated"
                  >
                    <GraduationCap className="w-4 h-4 text-emerald-400" />
                    <span>Courses & Tracks</span>
                  </Link>
                  <Link
                    href="/communities"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-surface-elevated"
                  >
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>Communities</span>
                  </Link>
                  <Link
                    href="/ai-assistant"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-brand-violet-300 bg-brand-violet-950/40 border border-brand-violet-500/20"
                  >
                    <Sparkles className="w-4 h-4 text-brand-violet-400" />
                    <span>AI Learning Core</span>
                  </Link>
                  <Link
                    href="/creator"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-surface-elevated"
                  >
                    <Video className="w-4 h-4 text-rose-400" />
                    <span>Creator Studio</span>
                  </Link>
                  <Link
                    href="/messages"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-surface-elevated"
                  >
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                    <span>Direct Messages</span>
                  </Link>
                </nav>
              </div>

              {/* Drawer Footer with Accessible Mobile Sign Out */}
              <div className="pt-6 border-t border-surface-border space-y-4">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sign Out</span>
                </button>
                <div className="text-[11px] text-slate-500">
                  Learnova Platform &middot; Knowledge Over Popularity
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Workspace Column */}
        <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
          <TopNavbar onToggleMobileMenu={() => setMobileMenuOpen(true)} />

          <div className="flex-1 flex">
            {/* Main Scrollable Canvas */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
              {children}
            </main>

            {/* Contextual Right Column (when present on large viewports) */}
            {rightAside && (
              <aside className="hidden xl:block w-80 p-6 border-l border-surface-border shrink-0">
                {rightAside}
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
