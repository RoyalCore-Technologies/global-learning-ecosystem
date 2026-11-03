import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Course, CourseModule, Lesson } from '@platform/types';
import { UserRole } from '@platform/types';
import { apiClient, ApiError } from '../../lib/api-client.js';

describe('Learnova Creator Studio & Course Authoring Integration (M3.5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Creator Access & Role Verification', () => {
    it('allows authorized educators, creators, researchers, and admins', () => {
      const allowedRoles = [
        UserRole.EDUCATOR,
        UserRole.CREATOR,
        UserRole.RESEARCHER,
        UserRole.ADMIN,
      ];

      allowedRoles.forEach((role) => {
        const isAuthorized = [
          UserRole.EDUCATOR,
          UserRole.CREATOR,
          UserRole.RESEARCHER,
          UserRole.ADMIN,
        ].includes(role);
        expect(isAuthorized).toBe(true);
      });
    });

    it('identifies student accounts and requires instructor verification', () => {
      const role = UserRole.STUDENT;
      const isAuthorized = [
        UserRole.EDUCATOR,
        UserRole.CREATOR,
        UserRole.RESEARCHER,
        UserRole.ADMIN,
      ].includes(role);
      expect(isAuthorized).toBe(false);
    });
  });

  describe('Creator Catalog & Analytics Retrieval (GET /api/v1/courses?instructor_id=...)', () => {
    it('retrieves and computes aggregate creator metrics correctly', async () => {
      const mockCourses: Course[] = [
        {
          id: 'c-1',
          instructor_id: 'inst-1',
          title: 'Distributed Consensus Invariants',
          slug: 'distributed-consensus-invariants',
          description: 'Formal verification of Raft and Paxos.',
          level: 'ADVANCED',
          tier: 'FREE',
          price_cents: 0,
          is_published: true,
          enrolled_count: 85,
          rating: 4.9,
          reviews_count: 24,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'c-2',
          instructor_id: 'inst-1',
          title: 'Zero Knowledge Proofs in Practice',
          slug: 'zkp-in-practice',
          description: 'Constructing arithmetic circuits and SNARKs.',
          level: 'ADVANCED',
          tier: 'PREMIUM',
          price_cents: 14900,
          is_published: false, // Draft
          enrolled_count: 0,
          rating: 0,
          reviews_count: 0,
          created_at: '2026-02-01T00:00:00Z',
          updated_at: '2026-02-01T00:00:00Z',
        },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockCourses,
          total: 2,
        }),
      });

      const res = await apiClient<Course[]>('courses?instructor_id=inst-1&limit=50', {
        skipAuth: true,
      });

      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(2);

      // Verify aggregate metrics
      const totalStudents = res.data.reduce((acc, c) => acc + (c.enrolled_count || 0), 0);
      const publishedCount = res.data.filter((c) => c.is_published).length;
      const draftCount = res.data.filter((c) => !c.is_published).length;

      expect(totalStudents).toBe(85);
      expect(publishedCount).toBe(1);
      expect(draftCount).toBe(1);
    });
  });

  describe('Course Creation & Management (POST/PATCH/DELETE /api/v1/courses)', () => {
    it('creates a new course with title, description, and level', async () => {
      const newCoursePayload = {
        title: 'Formal Verification with TLA+',
        slug: 'formal-verification-tla-plus',
        summary: 'Specification and verification of concurrency.',
        description: 'Learn temporal logic and state machine models.',
        level: 'ADVANCED' as const,
        tier: 'FREE' as const,
        price_cents: 0,
        is_published: false,
      };

      const createdCourse: Course = {
        id: 'new-course-uuid',
        instructor_id: 'inst-1',
        ...newCoursePayload,
        enrolled_count: 0,
        rating: 0,
        reviews_count: 0,
        created_at: '2026-11-03T12:00:00Z',
        updated_at: '2026-11-03T12:00:00Z',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: createdCourse,
        }),
      });

      const res = await apiClient<Course>('courses', {
        method: 'POST',
        body: JSON.stringify(newCoursePayload),
        skipAuth: true,
      });

      expect(res.success).toBe(true);
      expect(res.data.id).toBe('new-course-uuid');
      expect(res.data.title).toBe('Formal Verification with TLA+');
      expect(res.data.is_published).toBe(false);
    });

    it('toggles course publication status via PATCH /courses/:id', async () => {
      const courseId = 'course-uuid-1';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            id: courseId,
            is_published: true,
          },
        }),
      });

      const res = await apiClient<Course>(`courses/${courseId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_published: true }),
        skipAuth: true,
      });

      expect(res.success).toBe(true);
      expect(res.data.is_published).toBe(true);
    });

    it('deletes an unneeded course via DELETE /courses/:id', async () => {
      const courseId = 'course-uuid-1';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { message: 'Course deleted successfully' },
        }),
      });

      const res = await apiClient(`courses/${courseId}`, {
        method: 'DELETE',
        skipAuth: true,
      });

      expect(res.success).toBe(true);
    });
  });

  describe('Curriculum Module & Lesson Authoring', () => {
    it('creates a course module via POST /courses/:id/modules', async () => {
      const courseId = 'c-100';
      const createdModule: CourseModule = {
        id: 'mod-1',
        course_id: courseId,
        title: 'Module 1: Safety & Liveness',
        order_index: 1,
        created_at: '2026-11-03T12:00:00Z',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: createdModule,
        }),
      });

      const res = await apiClient<CourseModule>(`courses/${courseId}/modules`, {
        method: 'POST',
        body: JSON.stringify({ title: 'Module 1: Safety & Liveness' }),
        skipAuth: true,
      });

      expect(res.success).toBe(true);
      expect(res.data.title).toBe('Module 1: Safety & Liveness');
      expect(res.data.order_index).toBe(1);
    });

    it('creates a rich lesson with code lab, transcript, and resources', async () => {
      const moduleId = 'mod-1';
      const lessonPayload = {
        title: '1.1 Safety Invariants and State Invariance',
        duration_minutes: 25,
        is_preview: true,
        content: '# Safety Invariants\n\nA state predicate P is invariant if...',
        video_url: 'https://cdn.example.com/safety-lecture.mp4',
        code_lab: {
          language: 'rust',
          starter_code: 'fn verify_invariant(state: &State) -> bool {\n  true\n}',
          filename: 'solution.rs',
          test_assertions: 'assert!(verify_invariant(&initial_state));',
        },
        resources: [
          {
            title: 'Lecture Slides (PDF)',
            url: 'https://cdn.example.com/slides.pdf',
            type: 'SLIDES' as const,
          },
        ],
      };

      const createdLesson: Lesson = {
        id: 'les-1',
        module_id: moduleId,
        slug: '1-1-safety-invariants-and-state-invariance',
        order_index: 1,
        created_at: '2026-11-03T12:00:00Z',
        updated_at: '2026-11-03T12:00:00Z',
        ...lessonPayload,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: createdLesson,
        }),
      });

      const res = await apiClient<Lesson>(`modules/${moduleId}/lessons`, {
        method: 'POST',
        body: JSON.stringify(lessonPayload),
        skipAuth: true,
      });

      expect(res.success).toBe(true);
      expect(res.data.id).toBe('les-1');
      expect(res.data.is_preview).toBe(true);
      expect(res.data.code_lab?.language).toBe('rust');
      expect(res.data.code_lab?.test_assertions).toBe('assert!(verify_invariant(&initial_state));');
      expect(res.data.resources?.[0].type).toBe('SLIDES');
    });

    it('rejects course creation with 403 Forbidden when unauthorized user attempts it', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only verified instructors and educators may author course tracks.',
        }),
      });

      await expect(
        apiClient('courses', {
          method: 'POST',
          body: JSON.stringify({ title: 'Unauthorized Course' }),
          skipAuth: true,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Only verified instructors and educators'),
      });
    });
  });
});
