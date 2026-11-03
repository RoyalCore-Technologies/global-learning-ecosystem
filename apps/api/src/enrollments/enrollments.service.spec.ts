import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnrollmentsService } from './enrollments.service.js';
import { DatabaseService } from '../database/database.service.js';
import {
  ForbiddenException,
  NotFoundException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;
  let mockDatabaseService: DatabaseService;
  let mockSupabaseClient: any;

  beforeEach(() => {
    mockSupabaseClient = {
      from: vi.fn(),
    };

    mockDatabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
      getAdminClient: vi.fn().mockReturnValue(mockSupabaseClient),
    } as unknown as DatabaseService;

    service = new EnrollmentsService(mockDatabaseService);
  });

  describe('enrollInCourse', () => {
    it('successfully enrolls in a published free course', async () => {
      const userId = 'student-uuid-1';
      const courseId = 'course-uuid-free';

      const mockCourse = {
        id: courseId,
        title: 'Introduction to Algorithms',
        slug: 'intro-algorithms',
        tier: 'FREE',
        price_cents: 0,
        is_published: true,
      };

      const mockNewEnrollment = {
        id: 'enrollment-1',
        user_id: userId,
        course_id: courseId,
        progress_percentage: 0,
        completed_at: null,
        enrolled_at: new Date().toISOString(),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockCourse, error: null }),
              }),
            }),
          };
        }
        if (table === 'course_enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockNewEnrollment, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await service.enrollInCourse(userId, courseId);

      expect(result.isExisting).toBe(false);
      expect(result.enrollment.id).toBe('enrollment-1');
      expect(result.enrollment.course_id).toBe(courseId);
    });

    it('honestly rejects enrollment in a premium course (HTTP 402 Payment Required)', async () => {
      const userId = 'student-uuid-1';
      const courseId = 'course-uuid-premium';

      const mockCourse = {
        id: courseId,
        title: 'Advanced Distributed Systems Masterclass',
        slug: 'advanced-distributed-systems',
        tier: 'PREMIUM',
        price_cents: 4900,
        is_published: true,
      };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockCourse, error: null }),
          }),
        }),
      });

      await expect(service.enrollInCourse(userId, courseId)).rejects.toThrow(HttpException);

      try {
        await service.enrollInCourse(userId, courseId);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
        expect(err.getResponse().message).toContain('Payment Gateway integration pending M4');
      }
    });

    it('returns existing enrollment idempotently if student is already enrolled', async () => {
      const userId = 'student-uuid-1';
      const courseId = 'course-uuid-free';

      const mockCourse = {
        id: courseId,
        title: 'Introduction to Algorithms',
        slug: 'intro-algorithms',
        tier: 'FREE',
        price_cents: 0,
        is_published: true,
      };

      const mockExistingEnrollment = {
        id: 'existing-enrollment-99',
        user_id: userId,
        course_id: courseId,
        progress_percentage: 45,
        completed_at: null,
        enrolled_at: '2026-01-01T00:00:00Z',
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockCourse, error: null }),
              }),
            }),
          };
        }
        if (table === 'course_enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockExistingEnrollment, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await service.enrollInCourse(userId, courseId);

      expect(result.isExisting).toBe(true);
      expect(result.enrollment.id).toBe('existing-enrollment-99');
      expect(result.enrollment.progress_percentage).toBe(45);
    });

    it('throws NotFoundException if course does not exist', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      await expect(service.enrollInCourse('user-1', 'non-existent-course')).rejects.toThrow(
        NotFoundException
      );
    });

    it('throws NotFoundException if course is unpublished', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'draft-id', is_published: false },
              error: null,
            }),
          }),
        }),
      });

      await expect(service.enrollInCourse('user-1', 'draft-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getMyEnrollments', () => {
    it('returns paginated list of enrollments for authenticated user', async () => {
      const userId = 'student-uuid-1';
      const mockEnrollments = [
        {
          id: 'enroll-1',
          user_id: userId,
          course_id: 'c-1',
          progress_percentage: 80,
          course: { id: 'c-1', title: 'Course 1' },
        },
        {
          id: 'enroll-2',
          user_id: userId,
          course_id: 'c-2',
          progress_percentage: 20,
          course: { id: 'c-2', title: 'Course 2' },
        },
      ];

      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.range = vi.fn().mockResolvedValue({ data: mockEnrollments, error: null, count: 2 });

      mockSupabaseClient.from.mockReturnValue(chain);

      const result = await service.getMyEnrollments(userId, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(chain.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('throws InternalServerErrorException on database error', async () => {
      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.range = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB connection error' } });

      mockSupabaseClient.from.mockReturnValue(chain);

      await expect(
        service.getMyEnrollments('user-1', { page: 1, limit: 10 })
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateLessonProgress', () => {
    it('marks lesson as completed when student is enrolled', async () => {
      const userId = 'student-1';
      const lessonId = 'lesson-1';
      const moduleId = 'mod-1';
      const courseId = 'course-1';

      const mockLesson = { id: lessonId, module_id: moduleId, title: 'Lesson 1' };
      const mockModule = { id: moduleId, course_id: courseId };
      const mockEnrollment = {
        id: 'enrollment-1',
        user_id: userId,
        course_id: courseId,
        progress_percentage: 0,
      };

      const mockCreatedProgress = {
        id: 'prog-1',
        enrollment_id: 'enrollment-1',
        lesson_id: lessonId,
        is_completed: true,
      };

      const mockRefreshedEnrollment = {
        ...mockEnrollment,
        progress_percentage: 50,
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'lessons') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockLesson, error: null }),
              }),
            }),
          };
        }
        if (table === 'course_modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockModule, error: null }),
              }),
            }),
          };
        }
        if (table === 'course_enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockEnrollment, error: null }),
                }),
                single: vi.fn().mockResolvedValue({ data: mockRefreshedEnrollment, error: null }),
              }),
            }),
          };
        }
        if (table === 'lesson_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockCreatedProgress, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await service.updateLessonProgress(userId, lessonId, true);

      expect(result.progress.is_completed).toBe(true);
      expect(result.enrollment.progress_percentage).toBe(50);
    });

    it('marks lesson as incomplete when requested', async () => {
      const userId = 'student-1';
      const lessonId = 'lesson-1';
      const moduleId = 'mod-1';
      const courseId = 'course-1';

      const mockLesson = { id: lessonId, module_id: moduleId, title: 'Lesson 1' };
      const mockModule = { id: moduleId, course_id: courseId };
      const mockEnrollment = {
        id: 'enrollment-1',
        user_id: userId,
        course_id: courseId,
        progress_percentage: 100,
      };

      const mockExistingProgress = {
        id: 'prog-1',
        enrollment_id: 'enrollment-1',
        lesson_id: lessonId,
        is_completed: true,
      };

      const mockUpdatedProgress = {
        ...mockExistingProgress,
        is_completed: false,
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'lessons') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockLesson, error: null }),
              }),
            }),
          };
        }
        if (table === 'course_modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockModule, error: null }),
              }),
            }),
          };
        }
        if (table === 'course_enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockEnrollment, error: null }),
                }),
                single: vi.fn().mockResolvedValue({
                  data: { ...mockEnrollment, progress_percentage: 0 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'lesson_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockExistingProgress, error: null }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockUpdatedProgress, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await service.updateLessonProgress(userId, lessonId, false);

      expect(result.progress.is_completed).toBe(false);
      expect(result.enrollment.progress_percentage).toBe(0);
    });

    it('throws ForbiddenException if student is not enrolled in the parent course', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'lessons') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'l1', module_id: 'm1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'course_modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'm1', course_id: 'c1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'course_enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(service.updateLessonProgress('student-intruder', 'l1', true)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('throws NotFoundException if lesson does not exist', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      await expect(service.updateLessonProgress('student-1', 'fake-lesson', true)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getCourseProgress', () => {
    it('calculates course and module progress accurately for enrolled student', async () => {
      const userId = 'student-1';
      const courseId = 'course-uuid-1';

      const mockCourse = { id: courseId, title: 'Calculus I', slug: 'calculus-1' };
      const mockEnrollment = {
        id: 'enroll-1',
        user_id: userId,
        course_id: courseId,
        progress_percentage: 50,
        enrolled_at: '2026-01-01T00:00:00Z',
        completed_at: null,
      };

      const mockModules = [
        { id: 'mod-1', title: 'Limits & Continuity', order_index: 1 },
        { id: 'mod-2', title: 'Derivatives', order_index: 2 },
      ];

      const mockLessons = [
        { id: 'les-1', module_id: 'mod-1', title: 'Intuition of Limits', order_index: 1 },
        { id: 'les-2', module_id: 'mod-1', title: 'Epsilon-Delta Definition', order_index: 2 },
        { id: 'les-3', module_id: 'mod-2', title: 'Power Rule', order_index: 1 },
        { id: 'les-4', module_id: 'mod-2', title: 'Chain Rule', order_index: 2 },
      ];

      const mockProgressRows = [
        { lesson_id: 'les-1', is_completed: true, completed_at: '2026-01-02T00:00:00Z' },
        { lesson_id: 'les-2', is_completed: true, completed_at: '2026-01-03T00:00:00Z' },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockCourse, error: null }),
              }),
            }),
          };
        }
        if (table === 'course_enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockEnrollment, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'course_modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockModules, error: null }),
              }),
            }),
          };
        }
        if (table === 'lessons') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockLessons, error: null }),
              }),
            }),
          };
        }
        if (table === 'lesson_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockProgressRows, error: null }),
            }),
          };
        }
        return {};
      });

      const result = await service.getCourseProgress(userId, courseId);

      expect(result.course_id).toBe(courseId);
      expect(result.total_lessons).toBe(4);
      expect(result.completed_lessons).toBe(2);
      expect(result.progress_percentage).toBe(50);
      expect(result.is_completed).toBe(false);
      expect(result.completed_lesson_ids).toEqual(['les-1', 'les-2']);

      expect(result.modules).toHaveLength(2);
      expect(result.modules[0].title).toBe('Limits & Continuity');
      expect(result.modules[0].total_lessons).toBe(2);
      expect(result.modules[0].completed_lessons).toBe(2);
      expect(result.modules[0].progress_percentage).toBe(100);

      expect(result.modules[1].title).toBe('Derivatives');
      expect(result.modules[1].total_lessons).toBe(2);
      expect(result.modules[1].completed_lessons).toBe(0);
      expect(result.modules[1].progress_percentage).toBe(0);
    });

    it('safely handles course with zero lessons', async () => {
      const userId = 'student-1';
      const courseId = 'course-uuid-empty';

      const mockCourse = { id: courseId, title: 'Upcoming Topic', slug: 'upcoming-topic' };
      const mockEnrollment = {
        id: 'enroll-empty',
        user_id: userId,
        course_id: courseId,
        progress_percentage: 0,
        enrolled_at: '2026-01-01T00:00:00Z',
        completed_at: null,
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockCourse, error: null }),
              }),
            }),
          };
        }
        if (table === 'course_enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockEnrollment, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'course_modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'lesson_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {};
      });

      const result = await service.getCourseProgress(userId, courseId);

      expect(result.total_lessons).toBe(0);
      expect(result.completed_lessons).toBe(0);
      expect(result.progress_percentage).toBe(0);
      expect(result.is_completed).toBe(false);
      expect(result.modules).toEqual([]);
    });

    it('throws NotFoundException if student is not enrolled in course', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'c1', title: 'Course 1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'course_enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(service.getCourseProgress('unenrolled-user', 'c1')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
