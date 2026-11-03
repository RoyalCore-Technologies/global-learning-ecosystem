'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { ProgressBar } from '@/components/ui/progress';
import { CodeBlock } from '@/components/ui/code-block';
import { Accordion, AccordionItem } from '@/components/ui/accordion';
import { Skeleton, ErrorState, EmptyState } from '@/components/ui/feedback';
import { apiClient, ApiError } from '@/lib/api-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Course, CourseModule, Lesson, CourseEnrollment } from '@platform/types';
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  CheckCircle2,
  Clock,
  BookOpen,
  Code2,
  MessageSquare,
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  Lock,
  Sparkles,
  AlertCircle,
  Award,
} from 'lucide-react';

export default function CourseLectureInterfacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const courseSlugOrId = resolvedParams.id;
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Enrollment State
  const [enrollment, setEnrollment] = useState<CourseEnrollment | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentMessage, setEnrollmentMessage] = useState<string | null>(null);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);

  // Player & Lesson Navigation State
  const [activeLessonId, setActiveLessonId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'notes' | 'lab' | 'transcript' | 'qa'>('notes');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState('1x');
  const [currentProgressSec, setCurrentProgressSec] = useState(0);
  const [completedLessonMap, setCompletedLessonMap] = useState<Record<string, boolean>>({});
  const [isTogglingProgress, setIsTogglingProgress] = useState(false);

  // Fetch course details from GET /api/v1/courses/:slugOrId
  const fetchCourseData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient<Course>(`courses/${courseSlugOrId}`);
      if (res.success && res.data) {
        const fetchedCourse = res.data;
        setCourse(fetchedCourse);
        setEnrollment(fetchedCourse.user_enrollment || null);

        // Build completed lessons map from API syllabus response
        const completedMap: Record<string, boolean> = {};
        const modules = fetchedCourse.modules || [];
        let firstLessonId = '';

        modules.forEach((mod) => {
          (mod.lessons || []).forEach((les) => {
            if (!firstLessonId) firstLessonId = les.id;
            if (les.user_progress?.is_completed) {
              completedMap[les.id] = true;
            }
          });
        });

        setCompletedLessonMap(completedMap);
        if (!activeLessonId && firstLessonId) {
          setActiveLessonId(firstLessonId);
        }
      } else {
        setError('Course not found or is currently unavailable.');
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.statusCode === 404) {
        setError('This course does not exist or has not been published yet.');
      } else {
        setError(apiErr.message || 'Failed to retrieve course details.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [courseSlugOrId, activeLessonId]);

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData]);

  // Handle Enrollment Action: POST /api/v1/courses/:id/enroll
  const handleEnroll = async () => {
    if (!course) return;

    // Check if user is logged in
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      router.push(`/auth/login?next=${encodeURIComponent(window.location.pathname)}&message=Please sign in to enroll`);
      return;
    }

    setIsEnrolling(true);
    setEnrollmentMessage(null);
    setEnrollmentError(null);

    try {
      const res = await apiClient<CourseEnrollment>(`courses/${course.id}/enroll`, {
        method: 'POST',
      });

      if (res.success && res.data) {
        setEnrollment(res.data);
        setEnrollmentMessage((res as any).message || 'Successfully enrolled in course!');
        // Refresh course to get unredacted lesson content
        await fetchCourseData();
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.statusCode === 402) {
        setEnrollmentError(
          'Enrollment in premium tracks requires active billing checkout (Payment Gateway integration pending M4). Thank you for your patience!'
        );
      } else {
        setEnrollmentError(apiErr.message || 'Failed to enroll in course. Please try again.');
      }
    } finally {
      setIsEnrolling(false);
    }
  };

  // Handle Toggle Lesson Complete: POST /api/v1/lessons/:id/progress
  const handleToggleLessonComplete = async (lessonId: string) => {
    if (!isEnrolled) {
      setEnrollmentError('You must be enrolled in this course to record lesson progress.');
      return;
    }

    const currentStatus = !!completedLessonMap[lessonId];
    const newStatus = !currentStatus;

    // Optimistic UI update
    setCompletedLessonMap((prev) => ({
      ...prev,
      [lessonId]: newStatus,
    }));
    setIsTogglingProgress(true);

    try {
      const res = await apiClient<any>(`lessons/${lessonId}/progress`, {
        method: 'POST',
        body: JSON.stringify({ is_completed: newStatus }),
      });

      const enrollmentRes = (res as any).enrollment;
      if (res.success && enrollmentRes) {
        setEnrollment((prev) =>
          prev
            ? {
                ...prev,
                progress_percentage: enrollmentRes.progress_percentage,
                completed_at: enrollmentRes.completed_at,
              }
            : null
        );
      }
    } catch (err) {
      // Rollback optimistic update
      setCompletedLessonMap((prev) => ({
        ...prev,
        [lessonId]: currentStatus,
      }));
      const apiErr = err as ApiError;
      setEnrollmentError(apiErr.message || 'Failed to update progress.');
    } finally {
      setIsTogglingProgress(false);
    }
  };

  const isEnrolled = !!enrollment;
  const modules: CourseModule[] = course?.modules || [];
  const allLessons: Lesson[] = modules.flatMap((m) => m.lessons || []);
  const activeLesson: Lesson | undefined =
    allLessons.find((l) => l.id === activeLessonId) || allLessons[0];

  const totalLessonsCount = allLessons.length;
  const completedLessonsCount = allLessons.filter((l) => completedLessonMap[l.id]).length;
  const progressPercent =
    enrollment?.progress_percentage ??
    (totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6 max-w-7xl mx-auto pb-16">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="aspect-video w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !course) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto py-12">
          <ErrorState
            title="Course Unavailable"
            message={error || 'The requested track could not be loaded.'}
            onRetry={fetchCourseData}
          />
          <div className="mt-6 text-center">
            <Link href="/courses">
              <Button size="sm" variant="secondary" leftIcon={<ChevronLeft className="w-4 h-4" />}>
                Browse Course Catalog
              </Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const instructorName =
    course.instructor?.display_name || course.instructor?.username || 'Verified Educator';
  const instructorInstitution =
    course.instructor?.institution || course.instructor?.headline || 'Learnova Academy';

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Course Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border/60">
          <div className="space-y-1 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/courses"
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> All Courses
              </Link>
              <span className="text-slate-600">/</span>
              <Badge variant={course.tier === 'FREE' ? 'secondary' : 'tier'}>
                {course.tier} Track
              </Badge>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-slate-300">
                {course.level}
              </span>
              {isEnrolled && (
                <Badge variant="success" className="text-[10px]">
                  Enrolled Student
                </Badge>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              {course.title}
            </h1>

            <div className="flex items-center gap-2 pt-0.5">
              <Avatar
                name={instructorName}
                src={course.instructor?.avatar_url || undefined}
                size="xs"
              />
              <span className="text-xs text-slate-300 font-semibold">{instructorName}</span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400">{instructorInstitution}</span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400">{course.enrolled_count} students</span>
            </div>
          </div>

          {/* Enrollment / Progress Actions Header */}
          <div className="flex items-center gap-3">
            {isEnrolled ? (
              <>
                <div className="min-w-[140px] hidden md:block">
                  <ProgressBar
                    value={progressPercent}
                    showLabel
                    colorScheme="gradient"
                    className="w-full"
                  />
                </div>
                {activeLesson && (
                  <Button
                    size="sm"
                    variant={completedLessonMap[activeLesson.id] ? 'secondary' : 'primary'}
                    leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    isLoading={isTogglingProgress}
                    onClick={() => handleToggleLessonComplete(activeLesson.id)}
                  >
                    {completedLessonMap[activeLesson.id] ? 'Completed' : 'Mark Lesson Complete'}
                  </Button>
                )}
              </>
            ) : (
              <Button
                size="md"
                variant="primary"
                isLoading={isEnrolling}
                onClick={handleEnroll}
              >
                {course.tier === 'FREE' || !course.price_cents
                  ? 'Enroll for Free'
                  : `Enroll in Track ($${(course.price_cents / 100).toFixed(2)})`}
              </Button>
            )}
          </div>
        </div>

        {/* Informational Alerts */}
        {enrollmentMessage && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {enrollmentMessage}
            </span>
            <button onClick={() => setEnrollmentMessage(null)} className="text-emerald-400 hover:text-white text-xs">
              ✕
            </button>
          </div>
        )}

        {enrollmentError && (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              {enrollmentError}
            </span>
            <button onClick={() => setEnrollmentError(null)} className="text-amber-400 hover:text-white text-xs shrink-0 ml-2">
              ✕
            </button>
          </div>
        )}

        {/* Main Interface: Player + Tabs (Left) vs Curriculum Drawer (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols): Lecture Player + Multi-Tab Workspace */}
          <div className="lg:col-span-2 space-y-6">
            {/* 16:9 Lecture Player Canvas */}
            <div className="relative aspect-video rounded-2xl bg-black border border-surface-border overflow-hidden shadow-2xl flex flex-col justify-between group">
              {/* Top Video Overlay Bar */}
              <div className="relative z-10 p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={activeLesson?.is_preview ? 'success' : 'ai'}>
                    {activeLesson?.is_preview ? 'Free Preview Lecture' : 'Verified Syllabus Lecture'}
                  </Badge>
                  <span className="text-xs text-white font-medium truncate max-w-sm">
                    {activeLesson?.title || 'Lecture Player'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Download lecture slides"
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-xs flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Slides</span>
                  </button>
                  <button
                    aria-label="Share lesson link"
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Center Playback Canvas / Lock State */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                {!isEnrolled && !activeLesson?.is_preview ? (
                  /* Locked Lesson Screen */
                  <div className="space-y-3 max-w-md bg-black/75 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
                    <div className="w-12 h-12 rounded-2xl bg-surface-elevated text-amber-400 mx-auto flex items-center justify-center border border-surface-border">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Enrollment Required</h3>
                    <p className="text-xs text-slate-300">
                      This lecture is protected for enrolled students. Enroll to access video lectures, verified code labs, and milestone exercises.
                    </p>
                    <Button size="sm" variant="primary" onClick={handleEnroll} isLoading={isEnrolling}>
                      {course.tier === 'FREE' || !course.price_cents
                        ? 'Enroll for Free'
                        : `Enroll in Track ($${(course.price_cents / 100).toFixed(2)})`}
                    </Button>
                  </div>
                ) : (
                  /* Active Player Controls */
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    aria-label={isPlaying ? 'Pause lecture' : 'Play lecture'}
                    className="w-16 h-16 rounded-full bg-brand-indigo-600/90 hover:bg-brand-indigo-500 text-white flex items-center justify-center shadow-xl hover:scale-105 transition-all backdrop-blur-sm"
                  >
                    {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                  </button>
                )}
              </div>

              {/* Bottom Video Controls Scrubber Bar */}
              <div className="relative z-10 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent space-y-2">
                <div
                  className="w-full h-1.5 rounded-full bg-white/20 cursor-pointer overflow-hidden relative"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const percent = clickX / rect.width;
                    const durationSec = (activeLesson?.duration_minutes || 30) * 60;
                    setCurrentProgressSec(Math.round(percent * durationSec));
                  }}
                >
                  <div
                    className="h-full bg-brand-indigo-500 rounded-full"
                    style={{
                      width: `${
                        ((currentProgressSec / ((activeLesson?.duration_minutes || 30) * 60)) * 100) || 0
                      }%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-white">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="hover:text-brand-indigo-400 transition-colors"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setCurrentProgressSec(Math.max(0, currentProgressSec - 10))}
                      className="hover:text-brand-indigo-400 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-[11px] text-slate-300">
                      {formatTime(currentProgressSec)} / {formatTime((activeLesson?.duration_minutes || 30) * 60)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 font-mono text-[11px] bg-white/10 px-2 py-0.5 rounded">
                      {['1x', '1.25x', '1.5x', '2x'].map((spd) => (
                        <button
                          key={spd}
                          onClick={() => setPlaybackSpeed(spd)}
                          className={`px-1 rounded ${
                            playbackSpeed === spd
                              ? 'bg-brand-indigo-500 text-white font-bold'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {spd}
                        </button>
                      ))}
                    </div>
                    <Maximize2 className="w-4 h-4 text-slate-300 hover:text-white cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Multi-Tab Learning Workspace */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-surface-border pb-2 overflow-x-auto no-scrollbar">
                {[
                  { id: 'notes' as const, label: 'Concept Notes & Proofs', icon: BookOpen },
                  { id: 'lab' as const, label: 'Interactive Code Lab', icon: Code2 },
                  { id: 'transcript' as const, label: 'Lecture Transcript', icon: FileText },
                  { id: 'qa' as const, label: 'Peer Q&A & Endorsements', icon: MessageSquare },
                ].map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-brand-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-surface-elevated'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Notes & Concepts */}
              {activeTab === 'notes' && (
                <Card variant="elevated" className="p-6 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-brand-indigo-400" />{' '}
                      {activeLesson?.title || 'Lesson Core Concepts'}
                    </h2>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                      Peer Verified
                    </span>
                  </div>

                  {activeLesson?.content ? (
                    <div className="prose prose-invert prose-xs text-slate-300 leading-relaxed font-sans space-y-3 whitespace-pre-line">
                      {activeLesson.content}
                    </div>
                  ) : !isEnrolled && !activeLesson?.is_preview ? (
                    <div className="p-8 text-center space-y-3 rounded-xl bg-surface-subtle/50 border border-surface-border">
                      <Lock className="w-8 h-8 text-amber-400 mx-auto" />
                      <h3 className="text-sm font-bold text-white">Full Notes Restricted</h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        In-depth mathematical proofs, implementation walk-throughs, and lecture notes are unlocked upon course enrollment.
                      </p>
                      <Button size="sm" onClick={handleEnroll} isLoading={isEnrolling}>
                        Enroll to Unlock Content
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No notes provided for this lesson.</p>
                  )}
                </Card>
              )}

              {/* Tab 2: Code Lab */}
              {activeTab === 'lab' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-brand-cyan-400" /> Verifiable Assignment Playground
                      </h2>
                      <p className="text-xs text-slate-400">
                        Inspect the implementation and verify safety conditions.
                      </p>
                    </div>
                  </div>

                  {activeLesson?.code_lab ? (
                    <CodeBlock
                      code={activeLesson.code_lab.starter_code}
                      language={activeLesson.code_lab.language}
                      filename={activeLesson.code_lab.filename || 'solution'}
                    />
                  ) : (
                    <Card className="p-6 text-center text-xs text-slate-400">
                      No interactive code lab specified for this lecture.
                    </Card>
                  )}
                </div>
              )}

              {/* Tab 3: Transcript */}
              {activeTab === 'transcript' && (
                <Card variant="elevated" className="p-5 space-y-3">
                  <h2 className="text-sm font-bold text-white pb-2 border-b border-surface-border/60">
                    Interactive Timestamped Transcript
                  </h2>
                  {activeLesson?.transcript && activeLesson.transcript.length > 0 ? (
                    <div className="space-y-2 text-xs">
                      {activeLesson.transcript.map((seg, idx) => (
                        <div
                          key={idx}
                          onClick={() => setCurrentProgressSec(seg.timestamp_sec)}
                          className="p-2.5 rounded-lg hover:bg-surface-elevated cursor-pointer transition-colors flex items-start gap-3 group"
                        >
                          <span className="font-mono text-brand-indigo-400 group-hover:underline shrink-0">
                            {seg.label}
                          </span>
                          <p className="text-slate-300 leading-relaxed">{seg.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Timestamped transcript will be available shortly for this lecture.
                    </p>
                  )}
                </Card>
              )}

              {/* Tab 4: Q&A */}
              {activeTab === 'qa' && (
                <Card variant="elevated" className="p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-brand-indigo-400" /> Discussion &amp; Clarifications
                    </h2>
                    <Button size="sm" variant="secondary">
                      Ask Question
                    </Button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Join peer researchers and students discussing {activeLesson?.title || 'this course'}.
                  </p>
                </Card>
              )}
            </div>
          </div>

          {/* Right Column (1 Col): Curriculum & Modules Drawer (Syllabus) */}
          <div className="space-y-4">
            <Card variant="elevated" className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border/60">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand-indigo-400" /> Course Syllabus
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {completedLessonsCount}/{totalLessonsCount} Done
                </span>
              </div>

              {modules.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Curriculum modules are being finalized for this track.
                </p>
              ) : (
                <Accordion className="space-y-3">
                  {modules.map((m) => {
                    const moduleLessons = m.lessons || [];
                    const isOpen = moduleLessons.some((l) => l.id === activeLessonId);

                    return (
                      <AccordionItem
                        key={m.id}
                        id={m.id}
                        title={m.title}
                        defaultOpen={isOpen}
                      >
                        <div className="space-y-1 pt-1">
                          {moduleLessons.map((lesson) => {
                            const isCurrent = lesson.id === activeLessonId;
                            const isDone = !!completedLessonMap[lesson.id];
                            const isLocked = !isEnrolled && !lesson.is_preview;

                            return (
                              <div
                                key={lesson.id}
                                onClick={() => setActiveLessonId(lesson.id)}
                                className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between text-xs ${
                                  isCurrent
                                    ? 'bg-brand-indigo-600/20 border border-brand-indigo-500/50 text-white font-medium'
                                    : 'hover:bg-surface-elevated/70 text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  {isEnrolled ? (
                                    <button
                                      type="button"
                                      aria-label={isDone ? 'Mark lesson incomplete' : 'Mark lesson complete'}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleLessonComplete(lesson.id);
                                      }}
                                      className="shrink-0"
                                    >
                                      <CheckCircle2
                                        className={`w-4 h-4 ${
                                          isDone
                                            ? 'text-emerald-400 fill-emerald-400/20'
                                            : 'text-slate-600 hover:text-slate-400'
                                        }`}
                                      />
                                    </button>
                                  ) : isLocked ? (
                                    <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  ) : (
                                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 px-1 rounded border border-emerald-500/30">
                                      Free
                                    </span>
                                  )}
                                  <span className="truncate">{lesson.title}</span>
                                </div>
                                <span className="font-mono text-[10px] text-slate-500 shrink-0">
                                  {lesson.duration_minutes ? `${lesson.duration_minutes}m` : 'Lecture'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}

              {/* Bottom Navigation Controls */}
              {allLessons.length > 1 && (
                <div className="pt-3 border-t border-surface-border/60 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<ChevronLeft className="w-4 h-4" />}
                    disabled={allLessons.findIndex((l) => l.id === activeLessonId) <= 0}
                    onClick={() => {
                      const idx = allLessons.findIndex((l) => l.id === activeLessonId);
                      if (idx > 0) setActiveLessonId(allLessons[idx - 1].id);
                    }}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    rightIcon={<ChevronRight className="w-4 h-4" />}
                    disabled={
                      allLessons.findIndex((l) => l.id === activeLessonId) >= allLessons.length - 1
                    }
                    onClick={() => {
                      const idx = allLessons.findIndex((l) => l.id === activeLessonId);
                      if (idx < allLessons.length - 1) {
                        setActiveLessonId(allLessons[idx + 1].id);
                      }
                    }}
                  >
                    Next Lesson
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
