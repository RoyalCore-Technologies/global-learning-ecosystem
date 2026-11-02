'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Bell, Sparkles, Menu, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { LearnovaLogo } from '@/components/brand/learnova-logo';

interface TopNavbarProps {
  onToggleMobileMenu?: () => void;
}

export function TopNavbar({ onToggleMobileMenu }: TopNavbarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 sm:px-6 border-b border-surface-border/80 bg-surface-base/85 backdrop-blur-xl">
      {/* Left: Mobile Brand & Hamburger */}
      <div className="flex items-center gap-3 md:hidden">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 -ml-2 text-slate-400 hover:text-white rounded-xl hover:bg-surface-elevated transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <LearnovaLogo size="sm" showTagline={false} href="/dashboard" />
      </div>

      {/* Center: Global Search Input */}
      <div className="hidden sm:flex items-center flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search concepts, courses, research papers, educators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-12 rounded-xl bg-surface-card/60 border border-surface-border/80 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-indigo-500 focus:ring-1 focus:ring-brand-indigo-500 transition-all"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-surface-elevated rounded border border-surface-border">
              /
            </kbd>
          </div>
        </div>
      </div>

      {/* Right: Quick Actions, AI Tutor Prompt, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Ask AI Quick Action Button */}
        <Link href="/ai-assistant">
          <Button
            size="sm"
            variant="ai"
            leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            className="hidden sm:inline-flex"
          >
            Ask AI Tutor
          </Button>
        </Link>

        {/* Share Knowledge Post CTA */}
        <Link href="/explore/create">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<PlusCircle className="w-3.5 h-3.5 text-brand-indigo-400" />}
            className="hidden lg:inline-flex"
          >
            Create Insight
          </Button>
        </Link>

        {/* Notifications Button */}
        <Link
          href="/notifications"
          className="relative p-2 text-slate-400 hover:text-white rounded-xl hover:bg-surface-elevated transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-indigo-500 ring-2 ring-surface-base" />
        </Link>

        {/* Profile Avatar Quick Menu Link */}
        <Link href="/dashboard/profile" className="ml-1 focus:outline-none">
          <Avatar name="Alex Rivera" isOnline size="sm" />
        </Link>
      </div>
    </header>
  );
}
