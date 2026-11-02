'use client';

import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { GraduationCap, Clock, BookOpen, Users, Star } from 'lucide-react';
import Link from 'next/link';

const COURSES = [
  {
    id: 'distributed-systems',
    title: 'Distributed Systems Architecture: Consensus & Consistency',
    description:
      'Master state machine replication, Paxos, Raft, Byzantine fault tolerance, and vector clocks with verifiable Rust assignments.',
    level: 'ADVANCED',
    instructor: {
      name: 'Prof. Marcus Vance',
      role: 'EDUCATOR' as const,
      institution: 'Carnegie Mellon University',
    },
    modulesCount: 8,
    durationHours: 32,
    enrolledCount: 1840,
    rating: 4.9,
    tier: 'FREE' as const,
  },
  {
    id: 'deep-learning-foundations',
    title: 'Deep Learning Systems & GPU Memory Optimization',
    description:
      'Hardware-aware transformer training, tensor parallelism, FlashAttention kernel architecture, and quantization strategies.',
    level: 'ADVANCED',
    instructor: {
      name: 'Dr. Sarah Lin',
      role: 'RESEARCHER' as const,
      institution: 'Stanford AI Lab',
    },
    modulesCount: 10,
    durationHours: 45,
    enrolledCount: 3210,
    rating: 4.95,
    tier: 'PREMIUM' as const,
  },
  {
    id: 'formal-verification',
    title: 'Program Synthesis & Formal Verification with TLA+',
    description:
      'Mathematically prove software correctness before writing code. Model distributed protocols and detect concurrency race conditions.',
    level: 'INTERMEDIATE',
    instructor: {
      name: 'Dr. Elena Rostova',
      role: 'RESEARCHER' as const,
      institution: 'ETH Zurich',
    },
    modulesCount: 6,
    durationHours: 24,
    enrolledCount: 940,
    rating: 4.88,
    tier: 'FREE' as const,
  },
];

export default function CoursesPage() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border/60">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-brand-indigo-400" /> Structured Courses &amp; Tracks
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Milestone-driven curriculum verified by university educators and industry researchers.
            </p>
          </div>
          <Button size="sm" variant="secondary">
            My Enrolled Tracks (1)
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {COURSES.map((course) => (
            <Card
              key={course.id}
              className="border-surface-border hover:border-brand-indigo-500/40 transition-all flex flex-col justify-between"
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
                <CardTitle className="text-base text-white pt-2 leading-snug">
                  {course.title}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 line-clamp-3">
                  {course.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center gap-2 pt-2 border-t border-surface-border/50">
                  <Avatar name={course.instructor.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">
                      {course.instructor.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {course.instructor.institution}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 pt-2 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-slate-500" /> {course.modulesCount} modules
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" /> {course.durationHours} hrs
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> {course.rating}
                  </span>
                </div>
              </CardContent>

              <CardFooter className="pt-3 border-t border-surface-border/60">
                <Link href={`/courses/${course.id}`} className="w-full">
                  <Button size="sm" className="w-full">
                    View Syllabus &amp; Enroll
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
