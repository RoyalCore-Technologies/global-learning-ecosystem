'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/feedback';
import { apiClient, ApiError } from '@/lib/api-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Course, CourseModule, Lesson, CourseLevel, ContentTier } from '@platform/types';
import { UserRole } from '@platform/types';
import {
  Video,
  PlusCircle,
  TrendingUp,
  Users,
  DollarSign,
  FileText,
  CheckCircle2,
  Clock,
  Sparkles,
  Eye,
  MessageSquare,
  ShieldCheck,
  Edit3,
  Trash2,
  MoreVertical,
  Upload,
  BookOpen,
  ArrowRight,
  Filter,
  Lock,
  Plus,
  Code2,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export default function CreatorPage() {
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; name: string } | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab Filter
  const [activeTab, setActiveTab] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');

  // New Course Modal State
  const [isNewCourseModalOpen, setIsNewCourseModalOpen] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseSlug, setCourseSlug] = useState('');
  const [courseSummary, setCourseSummary] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [courseLevel, setCourseLevel] = useState<CourseLevel>('BEGINNER');
  const [courseTier, setCourseTier] = useState<ContentTier>('FREE');
  const [coursePriceCents, setCoursePriceCents] = useState<number>(0);
  const [isPublishedInitial, setIsPublishedInitial] = useState(false);
  const [isSubmittingCourse, setIsSubmittingCourse] = useState(false);
  const [courseModalError, setCourseModalError] = useState<string | null>(null);

  // Syllabus Drawer / Editor State
  const [isSyllabusModalOpen, setIsSyllabusModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isLoadingSyllabus, setIsLoadingSyllabus] = useState(false);
  const [syllabusError, setSyllabusError] = useState<string | null>(null);

  // New Module Form State
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [isSubmittingModule, setIsSubmittingModule] = useState(false);

  // New Lesson Form State
  const [activeModuleForLesson, setActiveModuleForLesson] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonDuration, setNewLessonDuration] = useState<number>(30);
  const [newLessonIsPreview, setNewLessonIsPreview] = useState(false);
  const [newLessonContent, setNewLessonContent] = useState('');
  const [newLessonVideoUrl, setNewLessonVideoUrl] = useState('');
  const [newLessonCodeLang, setNewLessonCodeLang] = useState('rust');
  const [newLessonCodeStarter, setNewLessonCodeStarter] = useState('');
  const [newLessonCodeAssertions, setNewLessonCodeAssertions] = useState('');
  const [newLessonResourceUrl, setNewLessonResourceUrl] = useState('');
  const [isSubmittingLesson, setIsSubmittingLesson] = useState(false);

  // Load User Session
  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const role = (session.user.app_metadata?.role as string) || 'STUDENT';
          const name =
            (session.user.user_metadata?.display_name as string) ||
            (session.user.user_metadata?.full_name as string) ||
            session.user.email?.split('@')[0] ||
            'Creator';
          setCurrentUser({ id: session.user.id, role, name });
        }
      } catch {
        // Guest user
      }
    }
    loadUser();
  }, []);

  // Fetch Courses for this Instructor
  const fetchInstructorCourses = useCallback(async (instructorId?: string) => {
    const id = instructorId || currentUser?.id;
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient<Course[]>(`courses?instructor_id=${id}&limit=50`);
      if (res.success && Array.isArray(res.data)) {
        setCourses(res.data);
      } else {
        setCourses([]);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load creator publications.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.id) {
      fetchInstructorCourses(currentUser.id);
    } else {
      setIsLoading(false);
    }
  }, [currentUser, fetchInstructorCourses]);

  // Load Full Syllabus for Course Editor
  const openSyllabusEditor = async (courseId: string) => {
    setIsSyllabusModalOpen(true);
    setIsLoadingSyllabus(true);
    setSyllabusError(null);

    try {
      const res = await apiClient<Course>(`courses/${courseId}`);
      if (res.success && res.data) {
        setSelectedCourse(res.data);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setSyllabusError(apiErr.message || 'Failed to load course syllabus.');
    } finally {
      setIsLoadingSyllabus(false);
    }
  };

  // Create New Course: POST /api/v1/courses
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsSubmittingCourse(true);
    setCourseModalError(null);

    try {
      const res = await apiClient<Course>('courses', {
        method: 'POST',
        body: JSON.stringify({
          title: courseTitle.trim(),
          slug: courseSlug.trim() || undefined,
          summary: courseSummary.trim() || undefined,
          description: courseDescription.trim(),
          level: courseLevel,
          tier: courseTier,
          price_cents: courseTier === 'PREMIUM' ? coursePriceCents : 0,
          is_published: isPublishedInitial,
        }),
      });

      if (res.success && res.data) {
        setIsNewCourseModalOpen(false);
        setCourseTitle('');
        setCourseSlug('');
        setCourseSummary('');
        setCourseDescription('');
        setCoursePriceCents(0);
        await fetchInstructorCourses(currentUser.id);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setCourseModalError(apiErr.message || 'Failed to create course track.');
    } finally {
      setIsSubmittingCourse(false);
    }
  };

  // Toggle Publish Status: PATCH /api/v1/courses/:id
  const handleTogglePublish = async (course: Course) => {
    try {
      const res = await apiClient<Course>(`courses/${course.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          is_published: !course.is_published,
        }),
      });

      if (res.success) {
        setCourses((prev) =>
          prev.map((c) => (c.id === course.id ? { ...c, is_published: !c.is_published } : c))
        );
        if (selectedCourse?.id === course.id) {
          setSelectedCourse((prev) => (prev ? { ...prev, is_published: !prev.is_published } : null));
        }
      }
    } catch (err) {
      const apiErr = err as ApiError;
      alert(`Failed to update publication status: ${apiErr.message}`);
    }
  };

  // Add Module to Course: POST /api/v1/courses/:id/modules
  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !newModuleTitle.trim()) return;

    setIsSubmittingModule(true);
    try {
      const res = await apiClient<CourseModule>(`courses/${selectedCourse.id}/modules`, {
        method: 'POST',
        body: JSON.stringify({
          title: newModuleTitle.trim(),
        }),
      });

      if (res.success && res.data) {
        setNewModuleTitle('');
        // Refresh syllabus
        const updatedCourse = await apiClient<Course>(`courses/${selectedCourse.id}`);
        if (updatedCourse.success && updatedCourse.data) {
          setSelectedCourse(updatedCourse.data);
        }
      }
    } catch (err) {
      const apiErr = err as ApiError;
      alert(`Failed to add module: ${apiErr.message}`);
    } finally {
      setIsSubmittingModule(false);
    }
  };

  // Add Lesson to Module: POST /api/v1/modules/:id/lessons
  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !activeModuleForLesson || !newLessonTitle.trim()) return;

    setIsSubmittingLesson(true);
    try {
      const res = await apiClient<Lesson>(`modules/${activeModuleForLesson}/lessons`, {
        method: 'POST',
        body: JSON.stringify({
          title: newLessonTitle.trim(),
          duration_minutes: newLessonDuration,
          is_preview: newLessonIsPreview,
          content: newLessonContent.trim(),
          video_url: newLessonVideoUrl.trim() || undefined,
          code_lab: newLessonCodeStarter.trim()
            ? {
                language: newLessonCodeLang,
                starter_code: newLessonCodeStarter.trim(),
                filename: `solution.${newLessonCodeLang === 'rust' ? 'rs' : newLessonCodeLang === 'python' ? 'py' : 'ts'}`,
                test_assertions: newLessonCodeAssertions.trim() || undefined,
              }
            : undefined,
          resources: newLessonResourceUrl.trim()
            ? [
                {
                  title: `${newLessonTitle.trim()} Slides & Materials`,
                  url: newLessonResourceUrl.trim(),
                  type: 'SLIDES' as const,
                },
              ]
            : undefined,
        }),
      });

      if (res.success && res.data) {
        setActiveModuleForLesson(null);
        setNewLessonTitle('');
        setNewLessonContent('');
        setNewLessonVideoUrl('');
        setNewLessonCodeStarter('');
        setNewLessonCodeAssertions('');
        setNewLessonResourceUrl('');
        // Refresh syllabus
        const updatedCourse = await apiClient<Course>(`courses/${selectedCourse.id}`);
        if (updatedCourse.success && updatedCourse.data) {
          setSelectedCourse(updatedCourse.data);
        }
      }
    } catch (err) {
      const apiErr = err as ApiError;
      alert(`Failed to add lesson: ${apiErr.message}`);
    } finally {
      setIsSubmittingLesson(false);
    }
  };

  // Delete Course: DELETE /api/v1/courses/:id
  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course and its syllabus? This action cannot be undone.')) {
      return;
    }

    try {
      await apiClient(`courses/${courseId}`, { method: 'DELETE' });
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
      if (selectedCourse?.id === courseId) {
        setIsSyllabusModalOpen(false);
        setSelectedCourse(null);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      alert(`Failed to delete course: ${apiErr.message}`);
    }
  };

  // Delete Module: DELETE /api/v1/modules/:id
  const handleDeleteModule = async (moduleId: string) => {
    if (!selectedCourse) return;
    if (!confirm('Delete this module and all of its associated lessons?')) return;

    try {
      await apiClient(`modules/${moduleId}`, { method: 'DELETE' });
      const updated = await apiClient<Course>(`courses/${selectedCourse.id}`);
      if (updated.success && updated.data) {
        setSelectedCourse(updated.data);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      alert(`Failed to delete module: ${apiErr.message}`);
    }
  };

  // Delete Lesson: DELETE /api/v1/lessons/:id
  const handleDeleteLesson = async (lessonId: string) => {
    if (!selectedCourse) return;
    if (!confirm('Delete this lesson?')) return;

    try {
      await apiClient(`lessons/${lessonId}`, { method: 'DELETE' });
      const updated = await apiClient<Course>(`courses/${selectedCourse.id}`);
      if (updated.success && updated.data) {
        setSelectedCourse(updated.data);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      alert(`Failed to delete lesson: ${apiErr.message}`);
    }
  };

  // Filter Courses based on Tab
  const filteredCourses = courses.filter((c) => {
    if (activeTab === 'PUBLISHED') return c.is_published;
    if (activeTab === 'DRAFT') return !c.is_published;
    return true;
  });

  // Calculate Real Instructor Stats
  const totalStudents = courses.reduce((sum, c) => sum + (c.enrolled_count || 0), 0);
  const publishedCount = courses.filter((c) => c.is_published).length;
  const ratedCourses = courses.filter((c) => c.rating > 0);
  const avgRating =
    ratedCourses.length > 0
      ? (ratedCourses.reduce((sum, c) => sum + Number(c.rating), 0) / ratedCourses.length).toFixed(1)
      : '—';

  const isInstructorRole =
    currentUser?.role &&
    [UserRole.EDUCATOR, UserRole.CREATOR, UserRole.RESEARCHER, UserRole.ADMIN].includes(
      currentUser.role as any
    );

  return (
    <AppShell>
      <div className="space-y-8 max-w-6xl mx-auto pb-16">
        {/* Creator Studio Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-surface-border/60">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Video className="w-6 h-6 text-amber-400" /> Creator Studio &amp; Publishing Dashboard
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Author certified courses, research monographs, and milestone-driven educational curricula.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="primary"
              leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
              onClick={() => setIsNewCourseModalOpen(true)}
            >
              New Course Track
            </Button>
          </div>
        </div>

        {/* Role Notice Banner if Student */}
        {!isInstructorRole && currentUser && (
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Academic Creator Certification</p>
              <p className="text-slate-300 mt-0.5 leading-relaxed">
                Course creation is governed by Learnova&apos;s Zero-Trust academic protocol. Verified educators, researchers, and creators author peer-reviewed tracks. You may create drafts; platform verification applies upon release.
              </p>
            </div>
          </div>
        )}

        {/* Real Creator Analytics Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card variant="elevated" className="p-5 space-y-2 border-surface-border">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-brand-indigo-400" /> Total Enrolled Students
            </span>
            <p className="text-2xl font-bold text-white">{totalStudents.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400">Across all published tracks</p>
          </Card>

          <Card variant="elevated" className="p-5 space-y-2 border-surface-border">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Average Track Rating
            </span>
            <p className="text-2xl font-bold text-emerald-400 font-mono">
              {avgRating !== '—' ? `${avgRating} ★` : '—'}
            </p>
            <p className="text-[11px] text-slate-400">
              {ratedCourses.length} rated tracks
            </p>
          </Card>

          <Card variant="elevated" className="p-5 space-y-2 border-surface-border">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-brand-cyan-400" /> Authored Curricula
            </span>
            <p className="text-2xl font-bold text-white">{courses.length}</p>
            <p className="text-[11px] text-slate-400">{publishedCount} Published • {courses.length - publishedCount} Drafts</p>
          </Card>

          <Card variant="elevated" className="p-5 space-y-2 border-surface-border">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-400" /> Monetization Status
            </span>
            <p className="text-2xl font-bold text-white font-mono">
              {courses.filter((c) => c.tier === 'PREMIUM').length} Premium
            </p>
            <p className="text-[11px] text-slate-400">Checkout gateway opens in M4</p>
          </Card>
        </div>

        {/* Content Management Table (Real Backend Courses) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border/60">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-indigo-400" /> Course Tracks &amp; Syllabus Manager
              </h2>
              <p className="text-xs text-slate-400">
                Author and manage your verified academic tracks, curriculum modules, and interactive lectures.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-surface-elevated/60 rounded-xl border border-surface-border text-xs">
              {(['ALL', 'PUBLISHED', 'DRAFT'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-brand-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab === 'ALL'
                    ? `All (${courses.length})`
                    : tab === 'PUBLISHED'
                    ? `Published (${publishedCount})`
                    : `Drafts (${courses.length - publishedCount})`}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <ErrorState title="Failed to Load Courses" message={error} onRetry={() => fetchInstructorCourses()} />
          ) : filteredCourses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={activeTab === 'ALL' ? 'No Course Tracks Yet' : `No ${activeTab.toLowerCase()} courses`}
              description="Create a structured course track with milestone modules, verifiable code labs, and certified lectures."
              actionLabel="Create First Track"
              onAction={() => setIsNewCourseModalOpen(true)}
            />
          ) : (
            <div className="rounded-2xl border border-surface-border overflow-hidden bg-surface-card/60 shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-elevated/70 text-slate-400 font-semibold border-b border-surface-border/70 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Title &amp; Tier</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Level</th>
                      <th className="py-3.5 px-4">Enrolled</th>
                      <th className="py-3.5 px-4">Rating</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border/50 text-slate-200">
                    {filteredCourses.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-elevated/40 transition-colors group">
                        <td className="py-3.5 px-4 max-w-sm">
                          <p className="font-semibold text-white group-hover:text-brand-indigo-300 transition-colors line-clamp-1">
                            {c.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-slate-400">
                              {c.tier === 'FREE' ? 'Free Track' : `$${((c.price_cents || 0) / 100).toFixed(2)}`}
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="text-[10px] font-mono text-brand-indigo-400">
                              /{c.slug}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant={c.is_published ? 'success' : 'secondary'}>
                            {c.is_published ? 'Published' : 'Draft'}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          {c.level}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          {c.enrolled_count} students
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          {c.rating > 0 ? (
                            <span className="text-amber-400">{Number(c.rating).toFixed(1)} ★</span>
                          ) : (
                            <span className="text-slate-500">Unrated</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs px-2.5"
                              onClick={() => openSyllabusEditor(c.id)}
                            >
                              Manage Syllabus
                            </Button>
                            <Button
                              size="sm"
                              variant={c.is_published ? 'outline' : 'primary'}
                              className="h-7 text-xs px-2.5"
                              onClick={() => handleTogglePublish(c)}
                            >
                              {c.is_published ? 'Unpublish' : 'Publish'}
                            </Button>
                            <Link href={`/courses/${c.slug || c.id}`}>
                              <Button size="sm" variant="ghost" className="h-7 text-xs px-2">
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                              onClick={() => handleDeleteCourse(c.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal 1: Create New Course Track */}
        <Dialog
          isOpen={isNewCourseModalOpen}
          onClose={() => setIsNewCourseModalOpen(false)}
          title="Create New Structured Course Track"
          description="Author a certified academic course with syllabus modules, interactive code labs, and verifiable lectures."
          maxWidth="lg"
        >
          <form onSubmit={handleCreateCourse} className="space-y-4 pt-1">
            {courseModalError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs">
                {courseModalError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Course Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Distributed Systems Architecture: Consensus & Consistency"
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Difficulty Level
                </label>
                <select
                  value={courseLevel}
                  onChange={(e) => setCourseLevel(e.target.value as CourseLevel)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500"
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                  <option value="ALL_LEVELS">All Levels</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pricing Tier
                </label>
                <select
                  value={courseTier}
                  onChange={(e) => setCourseTier(e.target.value as ContentTier)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500"
                >
                  <option value="FREE">Free Track</option>
                  <option value="PREMIUM">Premium Track</option>
                </select>
              </div>
            </div>

            {courseTier === 'PREMIUM' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Price in Cents (e.g. 4900 = $49.00)
                </label>
                <input
                  type="number"
                  min="0"
                  value={coursePriceCents}
                  onChange={(e) => setCoursePriceCents(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Short Summary (Tagline)
              </label>
              <input
                type="text"
                placeholder="Brief summary for catalog cards"
                value={courseSummary}
                onChange={(e) => setCourseSummary(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Detailed Course Description *
              </label>
              <textarea
                required
                rows={4}
                placeholder="Comprehensive syllabus description, prerequisites, and learning objectives..."
                value={courseDescription}
                onChange={(e) => setCourseDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500 font-sans"
              />
            </div>

            <div className="p-3 rounded-xl bg-surface-elevated/60 border border-surface-border flex items-center justify-between text-xs">
              <span className="text-slate-300">Publish immediately to Student Course Catalog</span>
              <input
                type="checkbox"
                checked={isPublishedInitial}
                onChange={(e) => setIsPublishedInitial(e.target.checked)}
                className="rounded text-brand-indigo-600 focus:ring-brand-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border/60">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsNewCourseModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmittingCourse}
                rightIcon={<Upload className="w-3.5 h-3.5" />}
              >
                Create Course Track
              </Button>
            </div>
          </form>
        </Dialog>

        {/* Modal 2: Syllabus & Module/Lesson Manager */}
        <Dialog
          isOpen={isSyllabusModalOpen}
          onClose={() => {
            setIsSyllabusModalOpen(false);
            setSelectedCourse(null);
            setActiveModuleForLesson(null);
          }}
          title={selectedCourse ? `Syllabus: ${selectedCourse.title}` : 'Course Syllabus Manager'}
          description="Build modules, lecture notes, video streaming configurations, and verifiable code labs."
          maxWidth="2xl"
        >
          {isLoadingSyllabus ? (
            <div className="py-8 space-y-3">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : syllabusError ? (
            <ErrorState title="Failed to load syllabus" message={syllabusError} />
          ) : selectedCourse ? (
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
              {/* Modules List */}
              <div className="space-y-4">
                {(selectedCourse.modules || []).length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center border border-dashed border-surface-border rounded-xl">
                    No modules created yet. Add your first syllabus module below.
                  </p>
                ) : (
                  (selectedCourse.modules || []).map((mod, modIdx) => (
                    <Card key={mod.id} variant="elevated" className="border-surface-border p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-brand-indigo-400 font-bold">
                            Module {modIdx + 1}:
                          </span>
                          <h3 className="text-sm font-bold text-white">{mod.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs px-2"
                            leftIcon={<Plus className="w-3 h-3" />}
                            onClick={() => setActiveModuleForLesson(mod.id)}
                          >
                            Add Lesson
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2 text-rose-400 hover:text-rose-300"
                            onClick={() => handleDeleteModule(mod.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Lessons inside Module */}
                      <div className="space-y-2 pl-2">
                        {(mod.lessons || []).length === 0 ? (
                          <p className="text-[11px] text-slate-500 italic py-1">
                            No lessons in this module. Click &quot;Add Lesson&quot; to author lectures.
                          </p>
                        ) : (
                          (mod.lessons || []).map((l, lIdx) => (
                            <div
                              key={l.id}
                              className="p-2 rounded-xl bg-surface-subtle/60 border border-surface-border/60 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <span className="font-mono text-[10px] text-slate-500 shrink-0">
                                  {modIdx + 1}.{lIdx + 1}
                                </span>
                                <span className="font-medium text-white truncate">{l.title}</span>
                                {l.is_preview && (
                                  <Badge variant="success" className="text-[9px] px-1 py-0 shrink-0">
                                    Preview
                                  </Badge>
                                )}
                                {l.code_lab && (
                                  <Badge variant="tier" className="text-[9px] px-1 py-0 shrink-0">
                                    Code Lab
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-mono text-[10px] text-slate-400">
                                  {l.duration_minutes}m
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLesson(l.id)}
                                  className="text-slate-500 hover:text-rose-400 transition-colors"
                                  title="Delete Lesson"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Inline Lesson Authoring Form for this Module */}
                      {activeModuleForLesson === mod.id && (
                        <form onSubmit={handleAddLesson} className="p-3.5 rounded-xl bg-surface-elevated/70 border border-brand-indigo-500/40 space-y-3 mt-3 animate-in fade-in">
                          <div className="flex items-center justify-between pb-1 border-b border-surface-border/60">
                            <span className="text-xs font-bold text-brand-indigo-300">
                              New Lesson in {mod.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveModuleForLesson(null)}
                              className="text-xs text-slate-400 hover:text-white"
                            >
                              ✕ Cancel
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                                Lesson Title *
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. 1.1 Leader Election Invariants"
                                value={newLessonTitle}
                                onChange={(e) => setNewLessonTitle(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                                Duration (mins)
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={newLessonDuration}
                                onChange={(e) => setNewLessonDuration(Number(e.target.value))}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                                Video Stream URL (optional)
                              </label>
                              <input
                                type="url"
                                placeholder="https://cdn.example.com/lecture.mp4"
                                value={newLessonVideoUrl}
                                onChange={(e) => setNewLessonVideoUrl(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                                Slides / Materials URL (optional)
                              </label>
                              <input
                                type="url"
                                placeholder="https://cdn.example.com/slides.pdf"
                                value={newLessonResourceUrl}
                                onChange={(e) => setNewLessonResourceUrl(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`preview-${mod.id}`}
                              checked={newLessonIsPreview}
                              onChange={(e) => setNewLessonIsPreview(e.target.checked)}
                              className="rounded text-brand-indigo-600 focus:ring-brand-indigo-500"
                            />
                            <label htmlFor={`preview-${mod.id}`} className="text-xs text-slate-300 cursor-pointer">
                              Free Preview Lecture (Accessible without enrollment)
                            </label>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                              Concept Notes &amp; Mathematical Invariants (Markdown) *
                            </label>
                            <textarea
                              required
                              rows={4}
                              placeholder="Include theorem statements, formal invariants, proof outlines..."
                              value={newLessonContent}
                              onChange={(e) => setNewLessonContent(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500 font-mono"
                            />
                          </div>

                          {/* Code Lab Option */}
                          <div className="p-2.5 rounded-lg bg-surface-base border border-surface-border space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-brand-cyan-400 flex items-center gap-1">
                                <Code2 className="w-3.5 h-3.5" /> Verifiable Code Lab (Optional)
                              </span>
                              <select
                                value={newLessonCodeLang}
                                onChange={(e) => setNewLessonCodeLang(e.target.value)}
                                className="px-2 py-0.5 rounded bg-surface-subtle border border-surface-border text-[10px] text-white"
                              >
                                <option value="rust">Rust</option>
                                <option value="python">Python</option>
                                <option value="typescript">TypeScript</option>
                              </select>
                            </div>
                            <textarea
                              rows={3}
                              placeholder="Starter code template for assignment verification..."
                              value={newLessonCodeStarter}
                              onChange={(e) => setNewLessonCodeStarter(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-surface-subtle border border-surface-border text-[11px] text-white focus:outline-none font-mono"
                            />
                            <textarea
                              rows={2}
                              placeholder="Formal test assertions or verification invariants (optional)..."
                              value={newLessonCodeAssertions}
                              onChange={(e) => setNewLessonCodeAssertions(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-surface-subtle border border-surface-border text-[11px] text-white focus:outline-none font-mono"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setActiveModuleForLesson(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              variant="primary"
                              size="sm"
                              className="h-7 text-xs"
                              isLoading={isSubmittingLesson}
                            >
                              Save Lesson
                            </Button>
                          </div>
                        </form>
                      )}
                    </Card>
                  ))
                )}
              </div>

              {/* Add New Module Form */}
              <form onSubmit={handleAddModule} className="p-4 rounded-xl bg-surface-elevated/40 border border-dashed border-surface-border flex items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder="New Module Title (e.g. Module 3: Byzantine Fault Tolerance)"
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  isLoading={isSubmittingModule}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Add Module
                </Button>
              </form>
            </div>
          ) : null}
        </Dialog>
      </div>
    </AppShell>
  );
}
