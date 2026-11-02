'use client';

import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, PlusCircle, TrendingUp, Users, DollarSign, FileText } from 'lucide-react';

export default function CreatorPage() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border/60">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Video className="w-6 h-6 text-amber-400" /> Creator Studio &amp; Publications
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Author verified educational series, monographs, and research publications.
            </p>
          </div>
          <Button size="sm" variant="primary" leftIcon={<PlusCircle className="w-3.5 h-3.5" />}>
            New Publication
          </Button>
        </div>

        {/* Creator Performance Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-surface-border p-5 space-y-1">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-brand-indigo-400" /> Active Channel Subscribers
            </span>
            <p className="text-2xl font-bold text-white">4,820</p>
            <p className="text-[10px] text-emerald-400 font-semibold">+18% this month</p>
          </Card>

          <Card className="border-surface-border p-5 space-y-1">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-brand-cyan-400" /> Published Insights &amp; Papers
            </span>
            <p className="text-2xl font-bold text-white">24</p>
            <p className="text-[10px] text-slate-400">98.4% Peer Accuracy Rating</p>
          </Card>

          <Card className="border-surface-border p-5 space-y-1">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Creator Payouts (Est.)
            </span>
            <p className="text-2xl font-bold text-white">$1,640.00</p>
            <p className="text-[10px] text-slate-400">Freemium course &amp; subscriber shares</p>
          </Card>
        </div>

        {/* Channel Status */}
        <Card className="border-surface-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Active Publication Channel</CardTitle>
                <CardDescription className="text-xs">
                  Distributed Systems &amp; Low-Level Runtimes
                </CardDescription>
              </div>
              <Badge variant="success">Verified Academic Channel</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Your channel is certified for publishing institutional course curricula.
              All publications automatically receive peer review invitations across the
              researcher network before being pushed to student feeds.
            </p>
          </CardContent>
          <CardFooter className="flex items-center justify-between pt-3 border-t border-surface-border/60">
            <span className="text-xs text-slate-400 font-mono">Channel slug: /channel/systems-runtimes</span>
            <Button size="sm" variant="outline">
              Manage Publication Settings
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AppShell>
  );
}
