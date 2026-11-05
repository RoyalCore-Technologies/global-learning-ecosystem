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
import type {
  Course,
  CourseModule,
  Lesson,
  CourseEnrollment,
  AiScaffoldingMode,
  AiChatMessage,
  AiQueryResponseDto,
  AssessmentCheckResponseDto,
  SubmitAssessmentResultDto,
  AdaptiveRecommendationsDto,
} from '@platform/types';
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
  Video,
  Copy,
  Check,
  FileDown,
  ExternalLink,
  Brain,
  RefreshCw,
  Target,
  Lightbulb,
  ArrowRight,
  Send,
  GraduationCap,
  HelpCircle,
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
  const [activeTab, setActiveTab] = useState<'notes' | 'lab' | 'companion' | 'transcript' | 'resources' | 'qa'>('notes');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState('1x');
  const [currentProgressSec, setCurrentProgressSec] = useState(0);
  const [videoDurationSec, setVideoDurationSec] = useState<number>(0);
  const [completedLessonMap, setCompletedLessonMap] = useState<Record<string, boolean>>({});
  const [isTogglingProgress, setIsTogglingProgress] = useState(false);
  const [userCode, setUserCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Companion & Adaptive Learning State
  const [companionMode, setCompanionMode] = useState<AiScaffoldingMode>('EXPLANATION');
  const [companionLevel, setCompanionLevel] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('INTERMEDIATE');
  const [companionSessionId, setCompanionSessionId] = useState<string | null>(null);
  const [companionMessages, setCompanionMessages] = useState<AiChatMessage[]>([]);
  const [companionInput, setCompanionInput] = useState('');
  const [isGeneratingCompanion, setIsGeneratingCompanion] = useState(false);
  const [companionError, setCompanionError] = useState<string | null>(null);

  // Lesson Knowledge Check & Assessment State
  const [companionAssessment, setCompanionAssessment] = useState<AssessmentCheckResponseDto | null>(null);
  const [isGeneratingAssessment, setIsGeneratingAssessment] = useState(false);
  const [companionAnswers, setCompanionAnswers] = useState<Record<string, number>>({});
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<SubmitAssessmentResultDto | null>(null);

  // Adaptive Retention & Spaced-Repetition State
  const [adaptiveData, setAdaptiveData] = useState<AdaptiveRecommendationsDto | null>(null);
  const [isLoadingAdaptive, setIsLoadingAdaptive] = useState(false);
  const [showAdaptiveDrawer, setShowAdaptiveDrawer] = useState(false);

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
  const isAuthorizedToWatch = isEnrolled || !!activeLesson?.is_preview;

  const totalLessonsCount = allLessons.length;
  const completedLessonsCount = allLessons.filter((l) => completedLessonMap[l.id]).length;
  const progressPercent =
    enrollment?.progress_percentage ??
    (totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0);

  const effectiveDurationSec =
    videoDurationSec > 0
      ? videoDurationSec
      : (activeLesson?.duration_minutes || 30) * 60;

  const slidesResource = activeLesson?.resources?.find(
    (r) => r.type === 'SLIDES' || r.type === 'PDF' || r.url?.endsWith('.pdf')
  );

  // Sync starter code & reset player when active lesson changes
  useEffect(() => {
    if (activeLesson?.code_lab?.starter_code) {
      setUserCode(activeLesson.code_lab.starter_code);
    } else {
      setUserCode('');
    }
    setCurrentProgressSec(0);
    setVideoDurationSec(0);
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
    }
  }, [activeLesson?.id, activeLesson?.code_lab?.starter_code]);

  // Synchronize companion greeting and session per active lesson
  useEffect(() => {
    if (!activeLesson) return;
    setCompanionSessionId(null);
    setCompanionAssessment(null);
    setAssessmentResult(null);
    setCompanionAnswers({});
    setCompanionError(null);
    setCompanionMessages([
      {
        id: `init-${activeLesson.id}`,
        sender: 'ai',
        text: `Hello! I am your AI Learning Companion for "${activeLesson.title}".\n\nI can assist you with step-by-step conceptual proofs, Socratic dialogue, assignment code reviews, or generate a quick knowledge-check quiz based on this lesson's invariants.`,
        citations: [
          'Learnova Curriculum Peer-Verified Standard',
          'Academic Literature Grounding Engine',
        ],
        follow_up_questions: [
          `Can you explain the key intuition behind ${activeLesson.title}?`,
          `Walk me through an invariant proof for this lesson.`,
          `What are common failure modes or edge-cases in this topic?`,
        ],
        timestamp: 'Just now',
      },
    ]);
  }, [activeLesson?.id, activeLesson?.title]);

  const fetchAdaptiveRecommendations = useCallback(async () => {
    setIsLoadingAdaptive(true);
    try {
      const res = await apiClient<AdaptiveRecommendationsDto>('ai/adaptive/recommendations');
      if (res.success && res.data) {
        setAdaptiveData(res.data);
      }
    } catch (err) {
      console.warn('Failed to load adaptive recommendations:', err);
    } finally {
      setIsLoadingAdaptive(false);
    }
  }, []);

  const handleSendCompanionQuery = async (overrideText?: string) => {
    const text = (overrideText || companionInput).trim();
    if (!text || isGeneratingCompanion) return;

    setCompanionError(null);
    const userMsg: AiChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: 'Just now',
    };

    setCompanionMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setCompanionInput('');
    setIsGeneratingCompanion(true);

    try {
      const endpoint = companionSessionId
        ? `ai/sessions/${companionSessionId}/query`
        : 'ai/query';

      const payload = {
        query: text,
        mode: companionMode,
        context: {
          course_id: course?.id,
          lesson_id: activeLesson?.id,
          learner_level: companionLevel,
          current_lesson_title: activeLesson?.title,
          student_code: userCode || undefined,
        },
      };

      const res = await apiClient<{ response: AiQueryResponseDto; session_id: string }>(
        endpoint,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      if (res.success && res.data) {
        const { response: aiRes, session_id } = res.data;
        if (session_id) setCompanionSessionId(session_id);

        const aiMsg: AiChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: aiRes.text,
          codeSnippet: aiRes.codeSnippet,
          citations: aiRes.citations,
          follow_up_questions: aiRes.follow_up_questions,
          provider: aiRes.provider,
          model: aiRes.model,
          timestamp: 'Just now',
        };

        setCompanionMessages((prev) => [...prev, aiMsg]);
      } else {
        setCompanionError('Failed to generate response. Please try again.');
      }
    } catch (err: any) {
      setCompanionError(err.message || 'Error communicating with AI Companion service.');
    } finally {
      setIsGeneratingCompanion(false);
    }
  };

  const handleGenerateLessonAssessment = async () => {
    if (!activeLesson || isGeneratingAssessment) return;
    setIsGeneratingAssessment(true);
    setCompanionAssessment(null);
    setAssessmentResult(null);
    setCompanionAnswers({});
    setCompanionError(null);

    try {
      const res = await apiClient<AssessmentCheckResponseDto>('ai/assessments/generate', {
        method: 'POST',
        body: JSON.stringify({
          topic: activeLesson.title,
          level: companionLevel,
          context: {
            course_id: course?.id,
            lesson_id: activeLesson.id,
            learner_level: companionLevel,
          },
        }),
      });

      if (res.success && res.data) {
        setCompanionAssessment(res.data);
      } else {
        setCompanionError('Could not generate assessment quiz for this lesson.');
      }
    } catch (err: any) {
      setCompanionError(err.message || 'Failed to generate assessment.');
    } finally {
      setIsGeneratingAssessment(false);
    }
  };

  const handleSubmitLessonAssessment = async () => {
    if (!companionAssessment || isSubmittingAssessment) return;
    setIsSubmittingAssessment(true);

    try {
      const answersPayload = Object.entries(companionAnswers).map(([qId, optIdx]) => ({
        question_id: qId,
        selected_option_index: optIdx,
      }));

      const res = await apiClient<SubmitAssessmentResultDto>('ai/assessments/submit', {
        method: 'POST',
        body: JSON.stringify({
          assessment_id: companionAssessment.assessment_id,
          answers: answersPayload,
        }),
      });

      if (res.success && res.data) {
        setAssessmentResult(res.data);
        fetchAdaptiveRecommendations();
      }
    } catch (err: any) {
      setCompanionError(err.message || 'Failed to grade assessment.');
    } finally {
      setIsSubmittingAssessment(false);
    }
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) {
      setIsPlaying(!isPlaying);
      return;
    }
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleSeek = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return;
    const clamped = Math.max(0, Math.min(seconds, effectiveDurationSec));
    setCurrentProgressSec(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  const handleSpeedChange = (speedStr: string) => {
    setPlaybackSpeed(speedStr);
    const num = parseFloat(speedStr);
    if (videoRef.current && !isNaN(num)) {
      videoRef.current.playbackRate = num;
    }
  };

  const handleJumpToTimestamp = (timestampSec: number) => {
    handleSeek(timestampSec);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleCopyCode = async () => {
    if (!userCode) return;
    try {
      await navigator.clipboard.writeText(userCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleResetCode = () => {
    if (activeLesson?.code_lab?.starter_code) {
      setUserCode(activeLesson.code_lab.starter_code);
    }
  };

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
              {/* Real Video Element if video_url is present and authorized */}
              {isAuthorizedToWatch && activeLesson?.video_url ? (
                <video
                  ref={videoRef}
                  src={activeLesson.video_url}
                  className="absolute inset-0 w-full h-full object-contain z-0"
                  onTimeUpdate={(e) => {
                    setCurrentProgressSec(Math.floor(e.currentTarget.currentTime));
                  }}
                  onLoadedMetadata={(e) => {
                    if (e.currentTarget.duration && !isNaN(e.currentTarget.duration)) {
                      setVideoDurationSec(Math.floor(e.currentTarget.duration));
                    }
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
              ) : null}

              {/* Top Video Overlay Bar */}
              <div className="relative z-10 p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-2">
                  <Badge variant={activeLesson?.is_preview ? 'success' : 'ai'}>
                    {activeLesson?.is_preview ? 'Free Preview Lecture' : 'Verified Syllabus Lecture'}
                  </Badge>
                  <span className="text-xs text-white font-medium truncate max-w-sm">
                    {activeLesson?.title || 'Lecture Player'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {slidesResource ? (
                    <a
                      href={slidesResource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Download lecture slides"
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-xs flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Slides</span>
                    </a>
                  ) : null}
                  <button
                    aria-label="Share lesson link"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(window.location.href);
                        alert('Lecture link copied to clipboard!');
                      }
                    }}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Center Playback Canvas / Lock State */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-none">
                {!isAuthorizedToWatch ? (
                  /* Locked Lesson Screen */
                  <div className="space-y-3 max-w-md bg-black/85 p-6 rounded-2xl border border-white/10 backdrop-blur-md pointer-events-auto">
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
                ) : allLessons.length === 0 ? (
                  /* Zero Lessons Empty State */
                  <div className="space-y-2 max-w-md bg-black/75 p-6 rounded-2xl border border-white/10 backdrop-blur-sm pointer-events-auto">
                    <div className="w-12 h-12 rounded-2xl bg-surface-elevated text-brand-indigo-400 mx-auto flex items-center justify-center border border-surface-border">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Curriculum Under Preparation</h3>
                    <p className="text-xs text-slate-300">
                      The course author has not published any syllabus lessons yet. Check back shortly for updates.
                    </p>
                  </div>
                ) : !activeLesson?.video_url ? (
                  /* Honest Video Stream In Preparation Screen */
                  <div className="space-y-2 max-w-md bg-black/75 p-6 rounded-2xl border border-white/10 backdrop-blur-sm pointer-events-auto">
                    <div className="w-12 h-12 rounded-2xl bg-surface-elevated text-slate-400 mx-auto flex items-center justify-center border border-surface-border">
                      <Video className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Lecture Stream in Preparation</h3>
                    <p className="text-xs text-slate-300">
                      This syllabus lecture does not have an attached media stream yet. Review the verified concept notes, interactive code lab, and transcript below.
                    </p>
                  </div>
                ) : (
                  /* Active Player Controls */
                  <button
                    onClick={handleTogglePlay}
                    aria-label={isPlaying ? 'Pause lecture' : 'Play lecture'}
                    className={`w-16 h-16 rounded-full bg-brand-indigo-600/90 hover:bg-brand-indigo-500 text-white flex items-center justify-center shadow-xl hover:scale-105 transition-all backdrop-blur-sm pointer-events-auto ${
                      isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
                    }`}
                  >
                    {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                  </button>
                )}
              </div>

              {/* Bottom Video Controls Scrubber Bar */}
              <div className="relative z-10 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent space-y-2 pointer-events-auto">
                <div
                  role="slider"
                  aria-label="Video playback progress"
                  aria-valuenow={currentProgressSec}
                  aria-valuemin={0}
                  aria-valuemax={effectiveDurationSec}
                  tabIndex={0}
                  className="w-full h-1.5 rounded-full bg-white/20 cursor-pointer overflow-hidden relative focus:outline-none focus:ring-1 focus:ring-brand-indigo-400"
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') handleSeek(currentProgressSec + 5);
                    if (e.key === 'ArrowLeft') handleSeek(currentProgressSec - 5);
                  }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const percent = clickX / rect.width;
                    handleSeek(Math.round(percent * effectiveDurationSec));
                  }}
                >
                  <div
                    className="h-full bg-brand-indigo-500 rounded-full"
                    style={{
                      width: `${((currentProgressSec / effectiveDurationSec) * 100) || 0}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-white">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleTogglePlay}
                      className="hover:text-brand-indigo-400 transition-colors"
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleSeek(currentProgressSec - 10)}
                      className="hover:text-brand-indigo-400 transition-colors"
                      aria-label="Rewind 10 seconds"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-[11px] text-slate-300">
                      {formatTime(currentProgressSec)} / {formatTime(effectiveDurationSec)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 font-mono text-[11px] bg-white/10 px-2 py-0.5 rounded">
                      {['1x', '1.25x', '1.5x', '2x'].map((spd) => (
                        <button
                          key={spd}
                          onClick={() => handleSpeedChange(spd)}
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
                    <button
                      type="button"
                      aria-label="Toggle fullscreen"
                      onClick={() => {
                        if (videoRef.current?.requestFullscreen) {
                          videoRef.current.requestFullscreen();
                        }
                      }}
                      className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors focus:outline-none"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
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
                  { id: 'companion' as const, label: 'AI Companion & Socratic Tutor', icon: Sparkles },
                  { id: 'transcript' as const, label: 'Lecture Transcript', icon: FileText },
                  { id: 'resources' as const, label: 'Resources & Downloads', icon: FileDown },
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-brand-cyan-400" /> Verifiable Assignment Playground
                      </h2>
                      <p className="text-xs text-slate-400">
                        Interactive code scratchpad with formal invariant checks.
                      </p>
                    </div>
                    {activeLesson?.code_lab && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleResetCode}
                          leftIcon={<RotateCcw className="w-3 h-3" />}
                        >
                          Reset
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleCopyCode}
                          leftIcon={copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        >
                          {copiedCode ? 'Copied!' : 'Copy Code'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {activeLesson?.code_lab ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-surface-border bg-surface-subtle overflow-hidden">
                        <div className="px-4 py-2 bg-surface-base border-b border-surface-border flex items-center justify-between text-xs">
                          <span className="font-mono text-slate-300 font-semibold flex items-center gap-2">
                            <Code2 className="w-3.5 h-3.5 text-brand-cyan-400" />
                            {activeLesson.code_lab.filename || 'solution'}
                          </span>
                          <Badge variant="tier" className="text-[10px] uppercase">
                            {activeLesson.code_lab.language}
                          </Badge>
                        </div>
                        <textarea
                          value={userCode}
                          onChange={(e) => setUserCode(e.target.value)}
                          spellCheck={false}
                          className="w-full h-64 p-4 font-mono text-xs bg-surface-subtle text-slate-100 resize-y focus:outline-none focus:ring-1 focus:ring-brand-indigo-500/50 leading-relaxed"
                          placeholder="Write your solution here..."
                        />
                      </div>

                      {activeLesson.code_lab.test_assertions && (
                        <Card variant="elevated" className="p-4 space-y-2">
                          <h3 className="text-xs font-bold text-white flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Target Invariants &amp; Test Assertions
                          </h3>
                          <CodeBlock
                            code={activeLesson.code_lab.test_assertions}
                            language={activeLesson.code_lab.language}
                            filename="assertions"
                          />
                        </Card>
                      )}

                      <div className="p-3 rounded-lg bg-surface-elevated/40 border border-surface-border/60 text-[11px] text-slate-400 flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-brand-indigo-400 shrink-0 mt-0.5" />
                        <p>
                          <strong>Sandbox Scratchpad:</strong> Code changes are preserved locally during your session. Remote isolated container execution and proof verification are scheduled for Milestone M5.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Card className="p-8 text-center text-xs text-slate-400">
                      No interactive code lab specified for this lecture.
                    </Card>
                  )}
                </div>
              )}

              {/* Tab: AI Companion & Socratic Tutor */}
              {activeTab === 'companion' && (
                <div className="space-y-4">
                  {/* Companion Header Controls */}
                  <Card variant="elevated" className="p-4 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-surface-border/60">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-brand-indigo-400" /> Lesson AI Companion
                          </h2>
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {companionSessionId ? 'Continuous Session Active' : 'New Session'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400">
                          Real-time cognitive scaffolding grounded in peer-reviewed literature and course invariants.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setShowAdaptiveDrawer(!showAdaptiveDrawer);
                            if (!adaptiveData) fetchAdaptiveRecommendations();
                          }}
                          className="text-xs flex items-center gap-1.5"
                        >
                          <Target className="w-3.5 h-3.5 text-brand-cyan-400" />
                          <span>{showAdaptiveDrawer ? 'Hide Mastery & SM-2' : 'View Mastery & SM-2'}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={handleGenerateLessonAssessment}
                          isLoading={isGeneratingAssessment}
                          className="text-xs flex items-center gap-1.5"
                        >
                          <Brain className="w-3.5 h-3.5" />
                          <span>Lesson Knowledge Check</span>
                        </Button>
                      </div>
                    </div>

                    {/* Controls row: Mode & Level */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-slate-400">Mode:</span>
                        {[
                          { id: 'EXPLANATION' as const, label: 'Concept Breakdown' },
                          { id: 'SOCRATIC' as const, label: 'Socratic Dialogue' },
                          { id: 'PROOF' as const, label: 'Formal Proof' },
                          { id: 'CODE_ANALYSIS' as const, label: 'Code Review' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setCompanionMode(m.id)}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                              companionMode === m.id
                                ? 'bg-brand-indigo-600 text-white shadow-sm'
                                : 'bg-surface-subtle text-slate-400 hover:text-slate-200 hover:bg-surface-elevated'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400">Level:</span>
                        {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => setCompanionLevel(lvl)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-colors ${
                              companionLevel === lvl
                                ? 'bg-slate-200 text-slate-900 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </Card>

                  {/* Adaptive Mastery & SM-2 Retention Drawer */}
                  {showAdaptiveDrawer && (
                    <Card variant="elevated" className="p-5 space-y-4 border-brand-indigo-500/40 bg-brand-indigo-950/10">
                      <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-brand-indigo-400" />
                          <h3 className="text-sm font-bold text-white">
                            Adaptive Mastery &amp; SM-2 Spaced Repetition
                          </h3>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={fetchAdaptiveRecommendations}
                          isLoading={isLoadingAdaptive}
                          className="h-7 text-xs text-slate-400 hover:text-white"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {isLoadingAdaptive && !adaptiveData ? (
                        <div className="p-6 text-center text-xs text-slate-400">Loading mastery evidence...</div>
                      ) : adaptiveData ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="p-3 rounded-lg bg-surface-subtle border border-surface-border">
                              <span className="text-[10px] font-mono text-slate-400">OVERALL RETENTION</span>
                              <div className="text-xl font-bold text-white mt-1">
                                {adaptiveData.overall_mastery_percentage}%
                              </div>
                            </div>
                            <div className="p-3 rounded-lg bg-surface-subtle border border-surface-border">
                              <span className="text-[10px] font-mono text-slate-400">CONCEPTS TRACKED</span>
                              <div className="text-xl font-bold text-brand-cyan-400 mt-1">
                                {adaptiveData.total_concepts_tracked}
                              </div>
                            </div>
                            <div className="p-3 rounded-lg bg-surface-subtle border border-surface-border">
                              <span className="text-[10px] font-mono text-slate-400">REVIEWS DUE (SM-2)</span>
                              <div className="text-xl font-bold text-amber-400 mt-1">
                                {adaptiveData.due_reviews.length}
                              </div>
                            </div>
                            <div className="p-3 rounded-lg bg-surface-subtle border border-surface-border">
                              <span className="text-[10px] font-mono text-slate-400">KNOWLEDGE GAPS</span>
                              <div className="text-xl font-bold text-rose-400 mt-1">
                                {adaptiveData.knowledge_gaps.length}
                              </div>
                            </div>
                          </div>

                          {/* Recommended Actions */}
                          {adaptiveData.recommended_actions.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold text-slate-300">Recommended Next Steps:</h4>
                              <div className="space-y-2">
                                {adaptiveData.recommended_actions.map((act, idx) => (
                                  <div
                                    key={idx}
                                    className="p-3 rounded-lg bg-surface-subtle border border-surface-border/60 flex items-start justify-between gap-3 text-xs"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant={act.priority === 'HIGH' ? 'warning' : 'secondary'}
                                          className="text-[9px]"
                                        >
                                          {act.priority} PRIORITY
                                        </Badge>
                                        <span className="font-semibold text-white">{act.title}</span>
                                      </div>
                                      <p className="text-slate-400">{act.reason}</p>
                                    </div>
                                    {act.concept_tag && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        className="text-[11px] h-7 shrink-0"
                                        onClick={() => {
                                          handleSendCompanionQuery(
                                            `Explain the core invariant and common mistakes for concept: ${act.concept_tag}`
                                          );
                                          setShowAdaptiveDrawer(false);
                                        }}
                                      >
                                        Study Now
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-4">
                          Complete a lesson knowledge check to build your personalized mastery schedule.
                        </p>
                      )}
                    </Card>
                  )}

                  {/* Lesson Knowledge Check Modal/Inline View */}
                  {companionAssessment && (
                    <Card variant="elevated" className="p-5 space-y-4 border-brand-cyan-500/40 bg-surface-elevated/90">
                      <div className="flex items-center justify-between pb-3 border-b border-surface-border/60">
                        <div>
                          <div className="flex items-center gap-2">
                            <Brain className="w-4 h-4 text-brand-cyan-400" />
                            <h3 className="text-sm font-bold text-white">
                              Lesson Assessment: {companionAssessment.topic}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Adaptive quiz questions with SM-2 spaced repetition tracking.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCompanionAssessment(null)}
                          className="h-7 text-xs text-slate-400"
                        >
                          Close Quiz
                        </Button>
                      </div>

                      {/* Assessment Result Banner */}
                      {assessmentResult ? (
                        <div className="space-y-4">
                          <div
                            className={`p-4 rounded-xl border ${
                              assessmentResult.passed
                                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                                : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                            } flex items-center justify-between`}
                          >
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold">
                                {assessmentResult.passed ? 'Assessment Passed!' : 'Needs Revision'}
                              </h4>
                              <p className="text-xs opacity-90">
                                Score: {assessmentResult.score} / {assessmentResult.total_questions} (
                                {assessmentResult.percentage}%) — Concept mastery updated in database.
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={handleGenerateLessonAssessment}
                              isLoading={isGeneratingAssessment}
                            >
                              Retake Quiz
                            </Button>
                          </div>

                          <div className="space-y-3">
                            {assessmentResult.detailed_feedback.map((fb, idx) => (
                              <div
                                key={idx}
                                className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                                  fb.is_correct
                                    ? 'border-emerald-500/30 bg-emerald-950/10'
                                    : 'border-rose-500/30 bg-rose-950/10'
                                }`}
                              >
                                <div className="flex items-center justify-between font-semibold">
                                  <span className="text-white">Question {idx + 1}</span>
                                  <Badge
                                    variant={fb.is_correct ? 'success' : 'secondary'}
                                    className="text-[9px]"
                                  >
                                    {fb.is_correct ? 'Correct' : 'Incorrect'}
                                  </Badge>
                                </div>
                                <p className="text-slate-300">{fb.explanation}</p>
                                <div className="text-[10px] font-mono text-slate-400">
                                  Concept Invariant: {fb.concept_tag}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        /* Question options */
                        <div className="space-y-5">
                          {companionAssessment.questions.map((q, qIdx) => (
                            <div key={q.id} className="space-y-2 p-3.5 rounded-xl bg-surface-subtle border border-surface-border">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-xs font-semibold text-white">
                                  {qIdx + 1}. {q.prompt}
                                </h4>
                                <Badge variant="secondary" className="text-[9px] font-mono">
                                  {q.concept_tag}
                                </Badge>
                              </div>

                              <div className="space-y-1.5 pt-1">
                                {q.options.map((opt, optIdx) => (
                                  <label
                                    key={optIdx}
                                    className={`flex items-center gap-2.5 p-2.5 rounded-lg text-xs cursor-pointer border transition-colors ${
                                      companionAnswers[q.id] === optIdx
                                        ? 'bg-brand-indigo-950/40 border-brand-indigo-500/70 text-white'
                                        : 'bg-surface-elevated/40 border-surface-border/40 text-slate-300 hover:bg-surface-elevated'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={q.id}
                                      checked={companionAnswers[q.id] === optIdx}
                                      onChange={() =>
                                        setCompanionAnswers((prev) => ({
                                          ...prev,
                                          [q.id]: optIdx,
                                        }))
                                      }
                                      className="text-brand-indigo-600 focus:ring-brand-indigo-500"
                                    />
                                    <span>{opt}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}

                          <Button
                            size="sm"
                            variant="primary"
                            onClick={handleSubmitLessonAssessment}
                            isLoading={isSubmittingAssessment}
                            disabled={
                              Object.keys(companionAnswers).length !== companionAssessment.questions.length
                            }
                            className="w-full text-xs"
                          >
                            Submit Answers for Grading &amp; Mastery Tracking
                          </Button>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Chat Conversation Thread */}
                  <Card variant="elevated" className="p-4 space-y-4">
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                      {companionMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${
                            msg.sender === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {msg.sender === 'ai' && (
                            <div className="w-8 h-8 rounded-full bg-brand-indigo-600/20 border border-brand-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                              <Sparkles className="w-4 h-4 text-brand-indigo-400" />
                            </div>
                          )}

                          <div
                            className={`max-w-[85%] rounded-2xl p-4 text-xs space-y-2.5 leading-relaxed ${
                              msg.sender === 'user'
                                ? 'bg-brand-indigo-600 text-white'
                                : 'bg-surface-subtle border border-surface-border text-slate-200'
                            }`}
                          >
                            {msg.sender === 'ai' && (
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-surface-border/60 text-[10px]">
                                <span className="font-semibold text-brand-indigo-300">
                                  Learnova Academic AI Companion
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {msg.provider && (
                                    <span className="font-mono text-slate-400">
                                      {msg.provider}
                                    </span>
                                  )}
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-sans">
                                    AI-Generated Explanation — Not Verified Course Note
                                  </span>
                                </div>
                              </div>
                            )}

                            <p className="whitespace-pre-line">{msg.text}</p>

                            {msg.codeSnippet && (
                              <div className="pt-1">
                                <CodeBlock
                                  code={msg.codeSnippet.code}
                                  language={msg.codeSnippet.language}
                                  filename={msg.codeSnippet.filename || 'invariant-sample.ts'}
                                />
                              </div>
                            )}

                            {msg.citations && msg.citations.length > 0 && (
                              <div className="pt-2 border-t border-surface-border/40 space-y-1">
                                <span className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                                  <BookOpen className="w-3 h-3 text-slate-400" /> Literature References:
                                </span>
                                <ul className="list-disc list-inside text-[10px] text-slate-400 space-y-0.5">
                                  {msg.citations.map((c, i) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {msg.follow_up_questions && msg.follow_up_questions.length > 0 && (
                              <div className="pt-2 border-t border-surface-border/40 space-y-1.5">
                                <span className="text-[10px] font-mono text-brand-indigo-300">
                                  Deepen Concept (Quick Prompts):
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {msg.follow_up_questions.map((q, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => handleSendCompanionQuery(q)}
                                      className="text-left text-[11px] px-2.5 py-1 rounded bg-surface-elevated hover:bg-brand-indigo-600/20 border border-surface-border hover:border-brand-indigo-500/50 text-slate-300 hover:text-white transition-colors"
                                    >
                                      {q}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {isGeneratingCompanion && (
                        <div className="flex gap-3 items-center text-xs text-slate-400 pl-2">
                          <Sparkles className="w-4 h-4 text-brand-indigo-400 animate-spin" />
                          <span>Synthesizing peer-reviewed conceptual explanation...</span>
                        </div>
                      )}
                    </div>

                    {companionError && (
                      <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{companionError}</span>
                      </div>
                    )}

                    {/* Chat Input */}
                    <div className="pt-2 border-t border-surface-border/60 space-y-2">
                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>
                          Active Context: <strong>{activeLesson?.title || 'Lesson Invariants'}</strong> ({companionLevel})
                        </span>
                        <span className="font-mono">Server-Side Sandboxed Inference</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={companionInput}
                          onChange={(e) => setCompanionInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendCompanionQuery();
                          }}
                          placeholder={`Ask a question about ${activeLesson?.title || 'this lesson'}...`}
                          className="flex-1 bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-indigo-500"
                        />
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleSendCompanionQuery()}
                          isLoading={isGeneratingCompanion}
                          disabled={!companionInput.trim()}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Tab 3: Transcript */}
              {activeTab === 'transcript' && (
                <Card variant="elevated" className="p-5 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-brand-indigo-400" /> Interactive Timestamped Transcript
                    </h2>
                    <span className="text-[10px] text-slate-400">Click timestamp to jump player</span>
                  </div>
                  {activeLesson?.transcript && activeLesson.transcript.length > 0 ? (
                    <div className="space-y-2 text-xs">
                      {activeLesson.transcript.map((seg, idx) => {
                        const nextSeg = activeLesson.transcript?.[idx + 1];
                        const isActive =
                          currentProgressSec >= seg.timestamp_sec &&
                          (!nextSeg || currentProgressSec < nextSeg.timestamp_sec);

                        return (
                          <div
                            key={idx}
                            onClick={() => handleJumpToTimestamp(seg.timestamp_sec)}
                            className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-start gap-3 border ${
                              isActive
                                ? 'bg-brand-indigo-950/40 border-brand-indigo-500/50 text-white font-medium shadow-sm'
                                : 'hover:bg-surface-elevated border-transparent text-slate-300'
                            }`}
                          >
                            <span className="font-mono text-brand-indigo-400 font-semibold shrink-0 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {seg.label}
                            </span>
                            <p className="leading-relaxed">{seg.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Timestamped transcript will be available shortly for this lecture.
                    </p>
                  )}
                </Card>
              )}

              {/* Tab 4: Resources */}
              {activeTab === 'resources' && (
                <Card variant="elevated" className="p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileDown className="w-4 h-4 text-brand-indigo-400" /> Lecture Resources &amp; Downloads
                    </h2>
                    <span className="text-xs text-slate-400 font-mono">
                      {activeLesson?.resources?.length || 0} Assets
                    </span>
                  </div>

                  {activeLesson?.resources && activeLesson.resources.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeLesson.resources.map((res, idx) => (
                        <a
                          key={idx}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-xl bg-surface-subtle hover:bg-surface-elevated border border-surface-border hover:border-brand-indigo-500/50 transition-all flex items-center justify-between group"
                        >
                          <div className="space-y-1 min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="tier" className="text-[9px] uppercase">
                                {res.type}
                              </Badge>
                              {res.size_bytes && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {(res.size_bytes / 1024).toFixed(1)} KB
                                </span>
                              )}
                            </div>
                            <h3 className="text-xs font-semibold text-white group-hover:text-brand-indigo-300 truncate">
                              {res.title}
                            </h3>
                          </div>
                          <Download className="w-4 h-4 text-slate-400 group-hover:text-white shrink-0" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      No external resources or slides attached to this lecture.
                    </p>
                  )}
                </Card>
              )}

              {/* Tab 5: Q&A */}
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
