'use client';

import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, PlusCircle, MessageSquare } from 'lucide-react';

const COMMUNITIES = [
  {
    name: 'Distributed Systems & Cloud Lab',
    slug: 'distributed-systems',
    description: 'Peer study circle for consensus algorithms, raft state machines, and geo-replicated data stores.',
    membersCount: 1420,
    discussionsCount: 380,
    tags: ['systems', 'rust', 'consensus'],
  },
  {
    name: 'Formal Verification & Software Correctness',
    slug: 'formal-verification',
    description: 'Reading group for TLA+, Coq, Lean 4, and formal methods in safety-critical systems.',
    membersCount: 890,
    discussionsCount: 195,
    tags: ['logic', 'tla-plus', 'correctness'],
  },
  {
    name: 'Neural Architectures & Deep Learning',
    slug: 'neural-architectures',
    description: 'Academic community discussing transformer memory hierarchies, attention scaling, and multimodal models.',
    membersCount: 2150,
    discussionsCount: 620,
    tags: ['ai', 'transformers', 'cuda'],
  },
  {
    name: 'Compiler Engineering & PL Theory',
    slug: 'compilers-pl',
    description: 'LLVM backends, type inference algorithms, WebAssembly runtimes, and intermediate representations.',
    membersCount: 1100,
    discussionsCount: 284,
    tags: ['compilers', 'llvm', 'wasm'],
  },
];

export default function CommunitiesPage() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border/60">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-brand-cyan-400" /> Academic Communities &amp; Circles
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Domain-specific study groups dedicated to deep inquiry rather than engagement farming.
            </p>
          </div>
          <Button size="sm" variant="secondary" leftIcon={<PlusCircle className="w-3.5 h-3.5" />}>
            Create Study Circle
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {COMMUNITIES.map((c) => (
            <Card
              key={c.slug}
              className="border-surface-border hover:border-brand-cyan-500/40 transition-all flex flex-col justify-between"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2.5 rounded-xl bg-brand-cyan-950/40 border border-brand-cyan-500/30 text-brand-cyan-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {c.membersCount} members
                  </span>
                </div>
                <CardTitle className="text-base text-white pt-2 leading-snug">
                  {c.name}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 leading-relaxed">
                  {c.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="flex flex-wrap gap-1.5">
                  {c.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-subtle text-slate-400 border border-surface-border"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="pt-3 border-t border-surface-border/60 flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> {c.discussionsCount} topics
                </span>
                <Button size="sm" variant="ghost" className="text-brand-cyan-400 hover:text-white">
                  Join Circle &rarr;
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
