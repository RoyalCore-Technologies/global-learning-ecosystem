'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton, EmptyState } from '@/components/ui/feedback';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { apiClient, streamAiClient, ApiError } from '@/lib/api-client';
import type {
  CourseEnrollment,
  AdaptiveRecommendationsDto,
} from '@platform/types';
import {
  Sparkles,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Award,
  Users,
  Compass,
  CheckCircle2,
  Clock,
  Send,
  MessageSquare,
  GraduationCap,
  AlertCircle,
  Target,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [userName, setUserName] = useState<string>('Scholar');
  const [userRole, setUserRole] = useState<string>('STUDENT');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiIsFallback, setAiIsFallback] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Enrollments & Adaptive Learning State
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [isLoadingEnrollments, setIsLoadingEnrollments] = useState<boolean>(true);
  const [adaptiveData, setAdaptiveData] = useState<AdaptiveRecommendationsDto | null>(null);

  useEffect(() => {
    let isLoggedIn = false;
    try {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          isLoggedIn = true;
          const name =
            (session.user.user_metadata?.display_name as string) ||
            (session.user.user_metadata?.full_name as string) ||
            session.user.email?.split('@')[0] ||
            'Scholar';
          setUserName(name);
          const role = (session.user.app_metadata?.role as string) || 'STUDENT';
          setUserRole(role);

          apiClient<AdaptiveRecommendationsDto>('ai/adaptive/recommendations')
            .then((res) => {
              if (res.success && res.data) {
                setAdaptiveData(res.data);
              }
            })
            .catch(() => {});
        }
      });
    } catch {
      // Unauthenticated
    }

    // Fetch real student enrollments: GET /api/v1/me/enrollments
    async function loadEnrollments() {
      setIsLoadingEnrollments(true);
      try {
        const res = await apiClient<CourseEnrollment[]>('me/enrollments?limit=5');
        if (res.success && Array.isArray(res.data)) {
          setEnrollments(res.data);
        } else {
          setEnrollments([]);
        }
      } catch {
        setEnrollments([]);
      } finally {
        setIsLoadingEnrollments(false);
      }
    }

    loadEnrollments();
    void isLoggedIn;
  }, []);

  const handleAskAi = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = aiPrompt.trim();
    if (!query || isAskingAi) return;

    setIsAskingAi(true);
    setAiError(null);
    setAiResponse('');
    setAiIsFallback(false);

    try {
      await streamAiClient(
        'ai/query/stream',
        {
          query,
          mode: 'EXPLANATION',
          context: {
            learner_level: 'INTERMEDIATE',
            course_id: enrollments[0]?.course_id,
          },
        },
        (chunk) => {
          if (chunk.event === 'delta' && chunk.delta) {
            setAiResponse((prev) => (prev || '') + chunk.delta);
          } else if (chunk.event === 'complete' && chunk.response) {
            setAiResponse(chunk.response.text);
            setAiIsFallback(!!chunk.response.is_fallback);
          } else if (chunk.event === 'error') {
            throw new ApiError(500, 'STREAM_ERROR', chunk.error || 'AI service unavailable.');
          }
        }
      );
    } catch (err) {
      setAiResponse(null);
      const apiErr = err as ApiError;
      setAiError(
        apiErr?.statusCode === 401
          ? 'Sign in to query the server-side AI Learning Core.'
          : apiErr?.message || 'AI Learning Core is currently unavailable.'
      );
    } finally {
      setIsAskingAi(false);
    }
  };

  const primaryEnrollment = enrollments[0];
  const primaryCourse = primaryEnrollment?.course;
  const primaryCourseHref = primaryCourse
    ? `/courses/${primaryCourse.slug || primaryCourse.id}`
    : '/courses';

  const rightAside = (
    <div className="space-y-6">
      {/* Learning Velocity / Streak */}
      <Card className="bg-surface-elevated/40 border-surface-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Study Velocity</CardTitle>
            <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
              <TrendingUp className="w-3.5 h-3.5" /> 7-Day Streak
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Weekly Study Goal</span>
            <span className="text-white font-semibold">12.5 / 15 hrs</span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-subtle overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-indigo-500 to-brand-cyan-400 rounded-full w-[83%]" />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 text-center text-[10px]">
            <div className="p-2 rounded-lg bg-surface-subtle/60 border border-surface-border">
              <p className="font-bold text-white text-sm">{enrollments.length}</p>
              <p className="text-slate-400">Enrolled</p>
            </div>
            <div className="p-2 rounded-lg bg-surface-subtle/60 border border-surface-border">
              <p className="font-bold text-emerald-400 text-sm">9</p>
              <p className="text-slate-400">Reviews</p>
            </div>
            <div className="p-2 rounded-lg bg-surface-subtle/60 border border-surface-border">
              <p className="font-bold text-brand-indigo-400 text-sm">340</p>
              <p className="text-slate-400">Karma</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggested Academic Communities */}
      <Card className="bg-surface-elevated/40 border-surface-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Active Communities</CardTitle>
          <CardDescription className="text-xs">Peer-led study circles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              name: 'Distributed Systems & Cloud',
              members: '1,420 members',
              tag: 'Systems',
            },
            {
              name: 'Formal Verification & Rust',
              members: '890 members',
              tag: 'Security',
            },
            {
              name: 'Neural Architectures Lab',
              members: '2,150 members',
              tag: 'AI/ML',
            },
          ].map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between p-2.5 rounded-xl bg-surface-subtle/40 border border-surface-border/50 hover:border-brand-indigo-500/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                <p className="text-[10px] text-slate-400">{c.members}</p>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2.5">
                Join
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <AppShell rightAside={rightAside}>
      <div className="space-y-8">
        {/* Welcome & Learner Status Banner */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-brand-indigo-950/80 via-surface-card to-surface-card border border-brand-indigo-500/30 shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge roleType={userRole as any} isVerified={userRole !== 'STUDENT'} />
              <Badge variant="secondary" className="text-slate-300">
                {primaryCourse ? `Track: ${primaryCourse.title}` : 'Active Track: Computer Science & Systems'}
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Welcome back, {userName}.
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Knowledge over popularity. Your learning environment is configured with verified peer reviews and formal academic rigor.
            </p>

            <div className="pt-2 flex flex-wrap gap-3">
              <Link href={primaryCourseHref}>
                <Button size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  {primaryCourse ? 'Resume Course' : 'Explore Courses'}
                </Button>
              </Link>
              <Link href="/explore">
                <Button size="md" variant="secondary" leftIcon={<Compass className="w-4 h-4" />}>
                  Browse Knowledge Feed
                </Button>
              </Link>
            </div>
          </div>

          <div className="absolute -right-16 -top-16 w-80 h-80 bg-brand-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* AI Learning Core Interactive Prompt */}
        <Card className="border-brand-violet-500/30 bg-surface-card/60 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute -left-20 -top-20 w-48 h-48 bg-brand-violet-600/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand-violet-950/80 border border-brand-violet-500/30 text-brand-violet-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base text-white">AI Learning Core</CardTitle>
                  <CardDescription className="text-xs">
                    Synthesize complex concepts, debug algorithms, or summarize papers
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/ai-assistant">
                  <Button size="sm" variant="secondary" className="text-xs">
                    Open Full Studio
                  </Button>
                </Link>
                <Badge variant="ai">Cognitive Scaffolding</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAskAi} className="flex gap-2">
              <input
                type="text"
                placeholder="E.g., Explain consensus algorithms or compare Raft vs Byzantine Fault Tolerance..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="flex-1 h-11 px-4 rounded-xl bg-surface-elevated/70 border border-surface-border text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-violet-500 focus:ring-1 focus:ring-brand-violet-500 transition-all"
              />
              <Button
                type="submit"
                variant="ai"
                size="md"
                isLoading={isAskingAi}
                disabled={!aiPrompt.trim()}
                rightIcon={<Send className="w-3.5 h-3.5" />}
              >
                Inquire
              </Button>
            </form>

            {aiError && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {aiResponse && (
              <div className="p-4 rounded-xl bg-brand-violet-950/30 border border-brand-violet-500/30 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-1.5 border-b border-brand-violet-500/20">
                  <div className="flex items-center gap-1.5 text-brand-violet-300 font-bold">
                    <Sparkles className="w-3.5 h-3.5" /> Learnova AI Cognitive Tutor
                  </div>
                  <div className="flex items-center gap-1.5">
                    {aiIsFallback && (
                      <Badge variant="warning" className="text-[10px]">
                        Offline Academic Fallback
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      AI-Generated Guidance
                    </Badge>
                  </div>
                </div>
                {aiResponse}
              </div>
            )}

            {adaptiveData && (
              <div className="pt-2 border-t border-surface-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Target className="w-4 h-4 text-brand-cyan-400 shrink-0" />
                  <span>
                    SM-2 Mastery: <strong>{adaptiveData.overall_mastery_percentage}%</strong> across{' '}
                    <strong>{adaptiveData.total_concepts_tracked}</strong> tracked concepts (
                    {adaptiveData.due_reviews.length} reviews due)
                  </span>
                </div>
                <Link href="/ai-assistant" className="text-brand-cyan-400 hover:text-brand-cyan-300 font-semibold">
                  View Adaptive Schedule &rarr;
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Active Learning Curriculum Track (Connected to real enrollments) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-brand-indigo-400" /> Current Course &amp; Milestone
            </h2>
            <Link
              href="/courses"
              className="text-xs font-semibold text-brand-indigo-400 hover:text-brand-indigo-300"
            >
              Browse Course Catalog &rarr;
            </Link>
          </div>

          {isLoadingEnrollments ? (
            <Card className="border-surface-border p-6 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </Card>
          ) : primaryCourse ? (
            <Card className="border-surface-border hover:border-brand-indigo-500/40 transition-colors">
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={primaryCourse.tier === 'FREE' ? 'secondary' : 'tier'} className="text-[10px]">
                      {primaryCourse.tier}
                    </Badge>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-slate-300">
                      {primaryCourse.level}
                    </span>
                    {primaryEnrollment.completed_at && (
                      <Badge variant="success" className="text-[10px]">
                        Track Completed
                      </Badge>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-white">
                    {primaryCourse.title}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {primaryCourse.summary || primaryCourse.description}
                  </p>

                  {/* Progress bar */}
                  <div className="pt-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Track Progress</span>
                      <span className="text-emerald-400 font-bold">
                        {primaryEnrollment.progress_percentage}% Complete
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-subtle overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${primaryEnrollment.progress_percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col gap-2 justify-center">
                  <Link href={primaryCourseHref}>
                    <Button size="md" className="w-full">
                      Resume Course
                    </Button>
                  </Link>
                  <Link href="/courses">
                    <Button size="md" variant="secondary" className="w-full">
                      Catalog Syllabi
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="border-surface-border border-dashed p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-elevated text-brand-indigo-400 mx-auto flex items-center justify-center border border-surface-border">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No Active Course Enrollments</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Explore structured tracks verified by university educators and industry researchers to begin tracking milestones.
              </p>
              <div className="pt-2">
                <Link href="/courses">
                  <Button size="sm">Explore Course Catalog</Button>
                </Link>
              </div>
            </Card>
          )}
        </div>

        {/* Knowledge Feed Spotlight (Peer-Reviewed Top Insight) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" /> Peer-Endorsed Knowledge Spotlight
            </h2>
            <Link
              href="/explore"
              className="text-xs font-semibold text-brand-indigo-400 hover:text-brand-indigo-300"
            >
              Browse Knowledge Feed &rarr;
            </Link>
          </div>

          <Card className="border-surface-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name="Dr. Elena Rostova" size="sm" isOnline />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Dr. Elena Rostova</span>
                      <Badge roleType="RESEARCHER" isVerified className="text-[9px] px-1.5 py-0" />
                    </div>
                    <span className="text-[10px] text-slate-400">
                      ETH Zurich &middot; Distributed Systems Lab &middot; 4h ago
                    </span>
                  </div>
                </div>
                <Badge variant="success">Endorsed Accuracy (98%)</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <h3 className="text-base font-bold text-white hover:text-brand-indigo-300 transition-colors cursor-pointer">
                Why Strong Eventual Consistency Outperforms Traditional Two-Phase Commit in Geo-Replicated Stores
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                A formal mathematical examination of Conflict-Free Replicated Data Types (CRDTs)
                under network partition scenarios. We demonstrate how state-based CvRDT lattices
                guarantee convergence without centralized coordination bottlenecks.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-subtle text-slate-300 border border-surface-border">
                  #distributed-systems
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-subtle text-slate-300 border border-surface-border">
                  #crdt
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-subtle text-slate-300 border border-surface-border">
                  #consensus
                </span>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-surface-border/50">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors cursor-pointer font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 142 Accuracy Endorsements
                </span>
                <span className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
                  <MessageSquare className="w-4 h-4" /> 38 Academic Comments
                </span>
              </div>
              <Button size="sm" variant="ghost" className="text-xs text-brand-indigo-400">
                Read Full Paper &rarr;
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
