'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/feedback';
import { apiClient, ApiError } from '@/lib/api-client';
import type { Course, CourseLevel, ContentTier } from '@platform/types';
import {
  GraduationCap,
  Clock,
  BookOpen,
  Users,
  Star,
  Search,
  Filter,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [myEnrollmentCount, setMyEnrollmentCount] = useState<number | null>(null);

  const limit = 9;

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1); // Reset to page 1 on new search
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch course catalog
  const fetchCourses = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', limit.toString());

    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    }
    if (selectedLevel !== 'ALL') {
      params.set('level', selectedLevel);
    }
    if (selectedTier !== 'ALL') {
      params.set('tier', selectedTier);
    }

    try {
      const res = await apiClient<Course[]>(`courses?${params.toString()}`);
      if (res.success && Array.isArray(res.data)) {
        setCourses(res.data);
        setTotal((res as any).total ?? res.data.length);
      } else {
        setCourses([]);
        setTotal(0);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to retrieve course catalog.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, selectedLevel, selectedTier]);

  // Check user active enrollments count
  useEffect(() => {
    async function checkMyEnrollments() {
      try {
        const res = await apiClient<any>('me/enrollments?limit=1', { skipAuth: false });
        if (res.success) {
          setMyEnrollmentCount((res as any).total ?? (res.data?.length || 0));
        }
      } catch {
        // User not logged in or endpoint unauthenticated
        setMyEnrollmentCount(null);
      }
    }
    checkMyEnrollments();
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedLevel('ALL');
    setSelectedTier('ALL');
    setPage(1);
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border/60">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-brand-indigo-400" /> Structured Courses &amp; Tracks
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Milestone-driven curriculum verified by university educators and industry researchers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {myEnrollmentCount !== null && (
              <Link href="/dashboard">
                <Button size="sm" variant="secondary" leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}>
                  My Enrolled Tracks ({myEnrollmentCount})
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 rounded-2xl bg-surface-card/60 border border-surface-border/70 backdrop-blur-sm space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search tracks by keyword, topic, or protocol (e.g., Consensus, Raft)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface-elevated/70 border border-surface-border text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-indigo-500 focus:ring-1 focus:ring-brand-indigo-500 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Level Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Level:
              </span>
              <select
                aria-label="Filter courses by difficulty level"
                value={selectedLevel}
                onChange={(e) => {
                  setSelectedLevel(e.target.value);
                  setPage(1);
                }}
                className="h-10 px-3 rounded-xl bg-surface-elevated/70 border border-surface-border text-xs text-slate-200 focus:outline-none focus:border-brand-indigo-500"
              >
                <option value="ALL">All Levels</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>

            {/* Tier Filter */}
            <div className="flex items-center gap-2">
              <select
                aria-label="Filter courses by pricing tier"
                value={selectedTier}
                onChange={(e) => {
                  setSelectedTier(e.target.value);
                  setPage(1);
                }}
                className="h-10 px-3 rounded-xl bg-surface-elevated/70 border border-surface-border text-xs text-slate-200 focus:outline-none focus:border-brand-indigo-500"
              >
                <option value="ALL">All Tiers</option>
                <option value="FREE">Free Track</option>
                <option value="PREMIUM">Premium Track</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          /* Loading Skeletons */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Card key={idx} className="border-surface-border p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-12 w-full" />
                <div className="flex items-center gap-2 pt-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2.5 w-32" />
                  </div>
                </div>
                <Skeleton className="h-9 w-full mt-4" />
              </Card>
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <ErrorState
            title="Failed to Load Courses"
            message={error}
            onRetry={fetchCourses}
          />
        ) : courses.length === 0 ? (
          /* Empty State */
          <EmptyState
            icon={BookOpen}
            title="No Courses Found"
            description={
              debouncedSearch || selectedLevel !== 'ALL' || selectedTier !== 'ALL'
                ? 'No published tracks matched your active filters. Try broadening your search or resetting filters.'
                : 'There are no published courses available in the catalog at this time.'
            }
            actionLabel={debouncedSearch || selectedLevel !== 'ALL' || selectedTier !== 'ALL' ? 'Reset Filters' : undefined}
            onAction={debouncedSearch || selectedLevel !== 'ALL' || selectedTier !== 'ALL' ? handleResetFilters : undefined}
          />
        ) : (
          /* Course Grid */
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => {
                const instructorName =
                  course.instructor?.display_name ||
                  course.instructor?.username ||
                  'Verified Educator';
                const instructorInst =
                  course.instructor?.institution ||
                  course.instructor?.headline ||
                  'Learnova Academy';
                const coursePath = `/courses/${course.slug || course.id}`;

                return (
                  <Card
                    key={course.id}
                    className="border-surface-border hover:border-brand-indigo-500/50 transition-all flex flex-col justify-between group hover:shadow-xl hover:shadow-brand-indigo-950/20"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={course.tier === 'FREE' ? 'secondary' : 'tier'}>
                          {course.tier}
                        </Badge>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-slate-300">
                          {course.level}
                        </span>
                      </div>
                      <CardTitle className="text-base text-white pt-2 leading-snug group-hover:text-brand-indigo-300 transition-colors">
                        {course.title}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400 line-clamp-3">
                        {course.summary || course.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0">
                      {/* Instructor Information */}
                      <div className="flex items-center gap-2.5 pt-3 border-t border-surface-border/50">
                        <Avatar
                          name={instructorName}
                          src={course.instructor?.avatar_url || undefined}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">
                            {instructorName}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {instructorInst}
                          </p>
                        </div>
                      </div>

                      {/* Course Metadata Stats */}
                      <div className="grid grid-cols-3 gap-1 pt-2 text-[10px] text-slate-400 border-t border-surface-border/30">
                        <span className="flex items-center gap-1 truncate" title={`${course.enrolled_count} Students Enrolled`}>
                          <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{course.enrolled_count} enrolled</span>
                        </span>
                        <span className="flex items-center gap-1 justify-center truncate">
                          {course.rating > 0 ? (
                            <>
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                              <span className="font-semibold text-slate-200">{course.rating.toFixed(1)}</span>
                            </>
                          ) : (
                            <span className="text-slate-500">New Track</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1 justify-end font-mono text-slate-300">
                          {course.tier === 'FREE' || !course.price_cents ? (
                            <span className="text-emerald-400 font-bold">Free</span>
                          ) : (
                            `$${(course.price_cents / 100).toFixed(2)}`
                          )}
                        </span>
                      </div>
                    </CardContent>

                    <CardFooter className="pt-3 border-t border-surface-border/60">
                      <Link href={coursePath} className="w-full">
                        <Button size="sm" className="w-full group-hover:bg-brand-indigo-600 transition-colors" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                          View Syllabus &amp; Enroll
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-6 border-t border-surface-border/60 text-xs text-slate-400">
                <span>
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} courses
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<ChevronLeft className="w-4 h-4" />}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="font-mono text-slate-300 px-2">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    rightIcon={<ChevronRight className="w-4 h-4" />}
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
