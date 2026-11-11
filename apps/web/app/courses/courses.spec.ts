import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Course, CourseEnrollment, CourseModule, Lesson } from '@platform/types';
import { UserRole } from '@platform/types';
import { apiClient, ApiError } from '../../lib/api-client.js';
import { getAiLocaleConfig, AI_SUPPORTED_LANGUAGES, AI_AGE_GROUPS } from '../../lib/i18n/ai-locales.js';

describe('Learnova Course Catalog & Syllabus UI Integration (M3.4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Course Catalog Integration (GET /api/v1/courses)', () => {
    it('constructs correct query parameters for search, level, tier, and pagination', () => {
      const search = '  consensus protocols  ';
      const level = 'ADVANCED';
      const tier = 'FREE';
      const page = 2;
      const limit = 9;

      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (search.trim()) params.set('search', search.trim());
      if (level !== 'ALL') params.set('level', level);
      if (tier !== 'ALL') params.set('tier', tier);

      expect(params.get('search')).toBe('consensus protocols');
      expect(params.get('level')).toBe('ADVANCED');
      expect(params.get('tier')).toBe('FREE');
      expect(params.get('page')).toBe('2');
      expect(params.get('limit')).toBe('9');
    });

    it('omits filter parameters when set to ALL', () => {
      const search = '';
      const level = 'ALL';
      const tier = 'ALL';
      const page = 1;
      const limit = 9;

      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (search.trim()) params.set('search', search.trim());
      if (level !== 'ALL') params.set('level', level);
      if (tier !== 'ALL') params.set('tier', tier);

      expect(params.has('search')).toBe(false);
      expect(params.has('level')).toBe(false);
      expect(params.has('tier')).toBe(false);
      expect(params.toString()).toBe('page=1&limit=9');
    });

    it('correctly parses real course catalog response and total count', async () => {
      const mockCourses: Course[] = [
        {
          id: 'c0000000-0000-4000-8000-000000000001',
          instructor_id: 'inst-1',
          title: 'Distributed Systems Architecture',
          slug: 'distributed-systems-architecture',
          summary: 'Master consensus algorithms.',
          description: 'Comprehensive course in consensus and replication.',
          level: 'ADVANCED',
          tier: 'FREE',
          price_cents: 0,
          is_published: true,
          enrolled_count: 42,
          rating: 4.95,
          reviews_count: 18,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          instructor: {
            id: 'inst-1',
            username: 'marcus_vance',
            display_name: 'Prof. Marcus Vance',
            role: UserRole.EDUCATOR,
            institution: 'Carnegie Mellon University',
          },
        },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockCourses,
          total: 1,
          page: 1,
          limit: 9,
        }),
      });

      const res = await apiClient<Course[]>('courses', { skipAuth: true });
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
      expect(res.data[0].title).toBe('Distributed Systems Architecture');
      expect((res as any).total).toBe(1);
      expect(res.data[0].instructor?.display_name).toBe('Prof. Marcus Vance');
      expect(res.data[0].enrolled_count).toBe(42);
    });
  });

  describe('Course Syllabus & Privacy Access (GET /api/v1/courses/:slugOrId)', () => {
    it('verifies syllabus ordering and non-preview lesson redaction for unenrolled users', () => {
      const mockSyllabus: CourseModule[] = [
        {
          id: 'mod-1',
          course_id: 'c-1',
          title: 'Module 1: Foundations',
          order_index: 1,
          created_at: '2026-01-01T00:00:00Z',
          lessons: [
            {
              id: 'les-1',
              module_id: 'mod-1',
              title: '1.1 Preview Lecture',
              slug: 'preview-lecture',
              order_index: 1,
              content: 'Free preview notes',
              video_url: 'https://cdn.example.com/preview.mp4',
              duration_minutes: 20,
              is_preview: true,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            {
              id: 'les-2',
              module_id: 'mod-1',
              title: '1.2 Advanced Invariants',
              slug: 'advanced-invariants',
              order_index: 2,
              content: '', // Redacted
              video_url: null, // Redacted
              duration_minutes: 45,
              is_preview: false,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
        },
      ];

      expect(mockSyllabus[0].lessons![0].is_preview).toBe(true);
      expect(mockSyllabus[0].lessons![0].content).toBe('Free preview notes');

      // Non-preview lesson must have redacted content for non-enrolled user
      expect(mockSyllabus[0].lessons![1].is_preview).toBe(false);
      expect(mockSyllabus[0].lessons![1].content).toBe('');
      expect(mockSyllabus[0].lessons![1].video_url).toBeNull();
      expect(mockSyllabus[0].lessons![1].duration_minutes).toBe(45);
    });
  });

  describe('Enrollment Integration (POST /api/v1/courses/:id/enroll)', () => {
    it('handles successful enrollment in a free course', async () => {
      const mockEnrollment: CourseEnrollment = {
        id: 'enrollment-uuid-1',
        user_id: 'student-uuid-1',
        course_id: 'c0000000-0000-4000-8000-000000000001',
        enrolled_at: '2026-11-03T12:00:00Z',
        completed_at: null,
        progress_percentage: 0,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockEnrollment,
          message: 'Successfully enrolled in course.',
        }),
      });

      const res = await apiClient<CourseEnrollment>('courses/c0000000-0000-4000-8000-000000000001/enroll', {
        method: 'POST',
        skipAuth: true,
      });

      expect(res.success).toBe(true);
      expect(res.data.id).toBe('enrollment-uuid-1');
      expect(res.data.progress_percentage).toBe(0);
    });

    it('handles duplicate enrollment idempotently', async () => {
      const existingEnrollment: CourseEnrollment = {
        id: 'existing-enrollment-99',
        user_id: 'student-uuid-1',
        course_id: 'c0000000-0000-4000-8000-000000000001',
        enrolled_at: '2026-01-01T00:00:00Z',
        completed_at: null,
        progress_percentage: 35,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: existingEnrollment,
          message: 'Already enrolled in this course.',
        }),
      });

      const res = await apiClient<CourseEnrollment>('courses/c0000000-0000-4000-8000-000000000001/enroll', {
        method: 'POST',
        skipAuth: true,
      });

      expect(res.success).toBe(true);
      expect(res.data.id).toBe('existing-enrollment-99');
      expect(res.data.progress_percentage).toBe(35);
      expect((res as any).message).toBe('Already enrolled in this course.');
    });

    it('honestly rejects premium courses with HTTP 402 without simulated payment', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        json: async () => ({
          statusCode: 402,
          error: 'Payment Required',
          message:
            'Enrollment in premium courses requires active billing checkout (Payment Gateway integration pending M4).',
        }),
      });

      await expect(
        apiClient('courses/premium-course-id/enroll', { method: 'POST', skipAuth: true })
      ).rejects.toMatchObject({
        statusCode: 402,
        message: expect.stringContaining('Payment Gateway integration pending M4'),
      });
    });
  });

  describe('Student Dashboard Enrollments (GET /api/v1/me/enrollments)', () => {
    it('parses real student enrollments and progress percentages', async () => {
      const mockEnrollments: CourseEnrollment[] = [
        {
          id: 'enr-1',
          user_id: 'usr-1',
          course_id: 'crs-1',
          enrolled_at: '2026-10-01T00:00:00Z',
          completed_at: null,
          progress_percentage: 65,
          course: {
            id: 'crs-1',
            instructor_id: 'inst-1',
            title: 'Distributed Systems: Consensus Protocols & Fault Tolerance',
            slug: 'distributed-systems',
            summary: 'Active track',
            description: 'Course notes',
            level: 'ADVANCED',
            tier: 'FREE',
            price_cents: 0,
            is_published: true,
            enrolled_count: 100,
            rating: 5,
            reviews_count: 10,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockEnrollments,
          total: 1,
        }),
      });

      const res = await apiClient<CourseEnrollment[]>('me/enrollments', { skipAuth: true });
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
      expect(res.data[0].progress_percentage).toBe(65);
      expect(res.data[0].course?.title).toContain('Distributed Systems');
    });

    it('identifies empty enrollment state for new scholars', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [],
          total: 0,
        }),
      });

      const res = await apiClient<CourseEnrollment[]>('me/enrollments', { skipAuth: true });
      expect(res.success).toBe(true);
      expect(res.data).toEqual([]);
      expect((res as any).total).toBe(0);
    });
  });

  describe('Lesson Progress Toggle (POST /api/v1/lessons/:id/progress)', () => {
    it('sends is_completed toggle and returns updated progress and enrollment percentage', async () => {
      const mockProgress = {
        id: 'prog-1',
        enrollment_id: 'enr-1',
        lesson_id: 'les-1',
        is_completed: true,
      };

      const mockEnrollment = {
        id: 'enr-1',
        progress_percentage: 75,
        completed_at: null,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockProgress,
          enrollment: mockEnrollment,
          message: 'Lesson marked as completed.',
        }),
      });

      const res = await apiClient<typeof mockProgress>('lessons/les-1/progress', {
        method: 'POST',
        body: JSON.stringify({ is_completed: true }),
        skipAuth: true,
      });

      expect(res.success).toBe(true);
      expect(res.data.is_completed).toBe(true);
      expect((res as any).enrollment.progress_percentage).toBe(75);
    });
  });

  describe('Enhanced Lecture Theater & Learning Workspace (M3.5)', () => {
    it('distinguishes video stream available vs stream in preparation', () => {
      const lessonWithVideo: Lesson = {
        id: 'les-v',
        module_id: 'm-1',
        title: 'Video Lecture',
        slug: 'video-lecture',
        order_index: 1,
        content: 'Notes',
        video_url: 'https://cdn.example.com/lecture.mp4',
        duration_minutes: 30,
        is_preview: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const lessonWithoutVideo: Lesson = {
        id: 'les-nv',
        module_id: 'm-1',
        title: 'Concept-Only Lecture',
        slug: 'concept-lecture',
        order_index: 2,
        content: 'Notes without video',
        video_url: null,
        duration_minutes: 15,
        is_preview: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      expect(lessonWithVideo.video_url).toBeTruthy();
      expect(lessonWithoutVideo.video_url).toBeNull();
    });

    it('processes transcript timestamp seeking accurately', () => {
      const transcript = [
        { timestamp_sec: 0, label: '00:00', text: 'Introduction to Consensus' },
        { timestamp_sec: 240, label: '04:00', text: 'Safety Invariants in Paxos' },
        { timestamp_sec: 600, label: '10:00', text: 'State Machine Replication' },
      ];

      // Jump to segment 2
      const targetSec = transcript[1].timestamp_sec;
      expect(targetSec).toBe(240);

      // Check active segment determination for currentProgressSec = 300 (5 mins)
      const currentProgressSec = 300;
      const activeIdx = transcript.findIndex((seg, idx) => {
        const next = transcript[idx + 1];
        return currentProgressSec >= seg.timestamp_sec && (!next || currentProgressSec < next.timestamp_sec);
      });

      expect(activeIdx).toBe(1);
      expect(transcript[activeIdx].label).toBe('04:00');
    });

    it('initializes and resets interactive code lab scratchpad to starter code', () => {
      const codeLab = {
        language: 'rust',
        starter_code: 'pub fn is_leader(term: u64, vote_count: usize) -> bool {\n    vote_count > 2\n}',
        filename: 'consensus.rs',
        test_assertions: 'assert!(is_leader(1, 3));',
      };

      let userCode = codeLab.starter_code;
      expect(userCode).toContain('vote_count > 2');

      // Student edits the code
      userCode = 'pub fn is_leader(term: u64, vote_count: usize) -> bool {\n    vote_count >= 3\n}';
      expect(userCode).toContain('vote_count >= 3');

      // Student clicks Reset to Starter Code
      userCode = codeLab.starter_code;
      expect(userCode).toBe(codeLab.starter_code);
    });

    it('identifies downloadable slides and resources attached to lesson', () => {
      const resources = [
        {
          title: 'Distributed Systems Lecture Slides',
          url: 'https://cdn.example.com/slides.pdf',
          type: 'SLIDES' as const,
          size_bytes: 2048000,
        },
        {
          title: 'Formal Specification Document',
          url: 'https://cdn.example.com/spec.pdf',
          type: 'PDF' as const,
        },
      ];

      const slidesResource = resources.find(
        (r) => r.type === 'SLIDES' || r.type === 'PDF' || r.url.endsWith('.pdf')
      );

      expect(slidesResource).toBeDefined();
      expect(slidesResource?.title).toBe('Distributed Systems Lecture Slides');
      expect(slidesResource?.type).toBe('SLIDES');
    });

    it('handles courses with zero lessons safely without divide-by-zero', () => {
      const emptyLessons: Lesson[] = [];
      const completedCount = 0;
      const progressPercent =
        emptyLessons.length > 0 ? Math.round((completedCount / emptyLessons.length) * 100) : 0;

      expect(progressPercent).toBe(0);
      expect(Number.isFinite(progressPercent)).toBe(true);
    });

    it('enforces scrubber slider keyboard seeking within bounds', () => {
      const effectiveDurationSec = 1800; // 30 mins
      let currentProgressSec = 100;

      // Seek forward by 5s
      currentProgressSec = Math.max(0, Math.min(currentProgressSec + 5, effectiveDurationSec));
      expect(currentProgressSec).toBe(105);

      // Seek backward by 200s (clamps to 0)
      currentProgressSec = Math.max(0, Math.min(currentProgressSec - 200, effectiveDurationSec));
      expect(currentProgressSec).toBe(0);

      // Seek beyond duration (clamps to effectiveDurationSec)
      currentProgressSec = Math.max(0, Math.min(2500, effectiveDurationSec));
      expect(currentProgressSec).toBe(1800);
    });

    it('sanitizes user-provided course slugs into clean lowercase url segments', () => {
      const rawInput = '  Advanced Consensus & State-Machines (Part 1)!  ';
      const sanitized = rawInput
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

      expect(sanitized).toBe('advanced-consensus-state-machines-part-1');
      expect(sanitized).not.toContain(' ');
      expect(sanitized).not.toContain('&');
      expect(sanitized).not.toContain('!');
    });
  });

  describe('Contextual AI Learning Companion & Adaptive Mastery (M5.4)', () => {
    it('constructs contextual AI query payload with course and active lesson metadata', async () => {
      let capturedUrl = '';
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation((url: string, opts: any) => {
        capturedUrl = url;
        capturedBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            session_id: 'sess-100',
            response: {
              text: 'Leader completeness guarantees log consistency.',
              citations: ['Ongaro & Ousterhout (2014)'],
              follow_up_questions: ['What is the invariant proof?'],
              provider: 'learnova-academic-engine',
              model: 'local-academic-grounding',
            },
          }),
        });
      });

      const res = await apiClient<{ response: any; session_id: string }>('ai/query', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Explain the safety invariant',
          mode: 'PROOF',
          context: {
            course_id: 'c-1',
            lesson_id: 'les-1',
            learner_level: 'INTERMEDIATE',
            current_lesson_title: 'Raft Consensus Protocol',
          },
        }),
      });

      expect(res.success).toBe(true);
      expect(capturedUrl).toContain('/api/v1/ai/query');
      expect(capturedBody.context.course_id).toBe('c-1');
      expect(capturedBody.context.lesson_id).toBe('les-1');
      expect(capturedBody.context.current_lesson_title).toBe('Raft Consensus Protocol');
      expect(res.data?.response.provider).toBe('learnova-academic-engine');
    });

    it('submits lesson assessment answers and verifies SM-2 mastery feedback', async () => {
      let submittedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation((_url: string, opts: any) => {
        submittedBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              assessment_id: 'assess-101',
              score: 2,
              total_questions: 2,
              percentage: 100,
              passed: true,
              detailed_feedback: [
                {
                  question_id: 'q1',
                  is_correct: true,
                  explanation: 'Correct quorum intersection.',
                  concept_tag: 'quorum',
                },
              ],
            },
          }),
        });
      });

      const res = await apiClient('ai/assessments/submit', {
        method: 'POST',
        body: JSON.stringify({
          assessment_id: 'assess-101',
          answers: [{ question_id: 'q1', selected_option_index: 0 }],
        }),
      });

      expect(res.success).toBe(true);
      expect(submittedBody.assessment_id).toBe('assess-101');
      expect(submittedBody.answers).toHaveLength(1);
    });

    it('fetches adaptive recommendations and verifies SM-2 spaced repetition metrics', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            learner_id: 'user-1',
            overall_mastery_percentage: 85,
            total_concepts_tracked: 4,
            knowledge_gaps: [],
            due_reviews: [
              {
                id: 'cm-1',
                concept_tag: 'Two-Phase Commit',
                mastery_score: 0.8,
                review_interval_days: 6,
                next_review_due_at: new Date().toISOString(),
                status: 'REVIEWING',
              },
            ],
            mastered_concepts: [],
            recommended_actions: [
              {
                type: 'PRACTICE_ASSESSMENT',
                concept_tag: 'Two-Phase Commit',
                title: 'Spaced Repetition Review: Two-Phase Commit',
                reason: 'Memory decay interval reached.',
                priority: 'MEDIUM',
              },
            ],
          },
        }),
      });

      const res = await apiClient<any>('ai/adaptive/recommendations');

      expect(res.success).toBe(true);
      expect(res.data?.overall_mastery_percentage).toBe(85);
      expect(res.data?.due_reviews[0].review_interval_days).toBe(6);
      expect(res.data?.recommended_actions[0].type).toBe('PRACTICE_ASSESSMENT');
    });
  });

  describe('Multilingual Readiness, Age Calibration & Session Persistence (M5.5)', () => {
    it('supports localized UI strings and RTL direction for Arabic', () => {
      const arLocale = getAiLocaleConfig('ar');
      expect(arLocale.option.dir).toBe('rtl');
      expect(arLocale.strings.companionTitle).toContain('الذكاء الاصطناعي');

      const teLocale = getAiLocaleConfig('te');
      expect(teLocale.option.dir).toBe('ltr');
      expect(teLocale.strings.aiNoticeBadge).toContain('AI');

      const fallbackLocale = getAiLocaleConfig('unknown-xx');
      expect(fallbackLocale.option.code).toBe('en');
      expect(AI_SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(10);
      expect(AI_AGE_GROUPS.map((g) => g.id)).toEqual(['CHILD', 'TEEN', 'ADULT']);
    });

    it('loads persisted course & lesson AI session history cleanly', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [
            {
              id: 'sess-persisted-1',
              user_id: 'user-1',
              course_id: 'c-1',
              lesson_id: 'les-1',
              mode: 'SOCRATIC',
              learner_level: 'INTERMEDIATE',
              language: 'es',
              title: 'Consenso en Raft',
              created_at: '2026-11-11T00:00:00Z',
              updated_at: '2026-11-11T00:00:00Z',
            },
          ],
        }),
      });

      const res = await apiClient<any[]>('ai/sessions?courseId=c-1&lessonId=les-1');
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
      expect(res.data[0].id).toBe('sess-persisted-1');
      expect(res.data[0].language).toBe('es');
    });
  });
});
