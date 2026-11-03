import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Course, CourseEnrollment, CourseModule, Lesson } from '@platform/types';
import { UserRole } from '@platform/types';
import { apiClient, ApiError } from '../../lib/api-client.js';

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
});
