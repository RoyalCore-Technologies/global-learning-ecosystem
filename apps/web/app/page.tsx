import React from 'react';
import Link from 'next/link';
import { LearnovaLogo } from '@/components/brand/learnova-logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Compass,
  GraduationCap,
  Users,
  Sparkles,
  Video,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Code2,
  Lock,
} from 'lucide-react';

export default function HomePage() {
  const ecosystems = [
    {
      title: 'Knowledge-First Social Feed',
      description:
        'A feed ranked by academic accuracy and peer review rather than rage-bait or algorithmic popularity metrics.',
      icon: Compass,
      color: 'text-brand-indigo-400',
      badge: 'Social Graph',
    },
    {
      title: 'Structured Curriculum & Tracks',
      description:
        'Modular, milestone-driven courses created by verified educators with hands-on projects and peer assessments.',
      icon: GraduationCap,
      color: 'text-emerald-400',
      badge: 'Education',
    },
    {
      title: 'Subject Circles & Communities',
      description:
        'Domain-specific student and researcher circles centered on deep inquiry, reading groups, and problem sets.',
      icon: Users,
      color: 'text-brand-cyan-400',
      badge: 'Communities',
    },
    {
      title: 'AI Learning Core',
      description:
        'Context-aware cognitive tutoring, concept synthesis, and intelligent assistance without hallucinations.',
      icon: Sparkles,
      color: 'text-brand-violet-400',
      badge: 'AI Engine',
    },
    {
      title: 'Creator Publications & Studios',
      description:
        'Empowering educators and researchers to publish verified video series, monographs, and technical digests.',
      icon: Video,
      color: 'text-amber-400',
      badge: 'Monetization',
    },
    {
      title: 'Zero-Trust Academic Security',
      description:
        'PostgreSQL Row-Level Security ensuring tamper-proof credentials, immutable audit trails, and strict role isolation.',
      icon: ShieldCheck,
      color: 'text-rose-400',
      badge: 'Security',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-base text-slate-100 flex flex-col antialiased selection:bg-brand-indigo-500 selection:text-white">
      {/* Top Header / Navigation */}
      <header className="sticky top-0 z-30 h-16 border-b border-surface-border/80 bg-surface-base/80 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between">
        <LearnovaLogo size="md" showTagline />

        <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
          <Link href="/explore" className="hover:text-white transition-colors">
            Knowledge Feed
          </Link>
          <Link href="/courses" className="hover:text-white transition-colors">
            Courses
          </Link>
          <Link href="/communities" className="hover:text-white transition-colors">
            Communities
          </Link>
          <Link href="/ai-assistant" className="hover:text-brand-violet-300 flex items-center gap-1 transition-colors">
            <Sparkles className="w-3.5 h-3.5 text-brand-violet-400" />
            AI Core
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/auth/login">
            <Button size="sm" variant="ghost">
              Sign In
            </Button>
          </Link>
          <Link href="/auth/register">
            <Button size="sm" variant="primary">
              Join Learnova
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-16 sm:py-24 text-center relative overflow-hidden">
        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-brand-indigo-600/20 via-brand-violet-600/15 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-indigo-500/30 bg-brand-indigo-950/40 text-brand-indigo-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-brand-indigo-400" />
            <span>Learnova &middot; Where Knowledge Connects</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
            Knowledge Over Popularity.{' '}
            <span className="block mt-1 bg-gradient-to-r from-brand-indigo-400 via-brand-violet-400 to-brand-cyan-400 bg-clip-text text-transparent">
              Learning Over Endless Scrolling.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            The unified social and educational ecosystem where students, educators, creators, and
            researchers collaborate, master structured tracks, and share verified insights.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link href="/dashboard">
              <Button size="lg" rightIcon={<ArrowRight className="w-5 h-5" />}>
                Enter Learner Dashboard
              </Button>
            </Link>
            <Link href="/explore">
              <Button size="lg" variant="secondary" leftIcon={<Compass className="w-5 h-5" />}>
                Browse Knowledge Feed
              </Button>
            </Link>
          </div>

          {/* Trust Guarantees */}
          <div className="pt-6 flex flex-wrap justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Peer Accuracy Endorsements
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Verified Educator Credentials
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Zero-Trust Security Foundation
            </span>
          </div>
        </div>

        {/* 6 Platform Ecosystems Grid */}
        <section className="relative z-10 max-w-6xl w-full mt-24 text-left space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              One Unified Ecosystem. Infinite Knowledge.
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              Engineered to combine the collaboration of modern social platforms with the rigor of
              world-class universities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
            {ecosystems.map((eco) => {
              const Icon = eco.icon;
              return (
                <Card
                  key={eco.title}
                  className="border-surface-border hover:border-brand-indigo-500/40 transition-all hover:shadow-brand-glow/20 group"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className={`p-2.5 rounded-xl bg-surface-elevated/80 border border-surface-border ${eco.color} group-hover:scale-105 transition-transform`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {eco.badge}
                      </Badge>
                    </div>
                    <CardTitle className="text-base text-white pt-2">{eco.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-xs text-slate-400 leading-relaxed">
                      {eco.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border/80 bg-surface-base/95 px-6 sm:px-12 py-8 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LearnovaLogo size="sm" showTagline={false} />
          <span>&copy; {new Date().getFullYear()} Learnova Platform. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/explore" className="hover:text-slate-300 transition-colors">
            Knowledge Feed
          </Link>
          <Link href="/dashboard" className="hover:text-slate-300 transition-colors">
            Dashboard
          </Link>
          <Link href="/api/health" className="hover:text-slate-300 transition-colors">
            System Health Probe
          </Link>
        </div>
      </footer>
    </div>
  );
}
