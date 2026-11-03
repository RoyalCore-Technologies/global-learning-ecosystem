import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoursesService } from './courses.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@platform/types';

describe('CoursesService', () => {
  let service: CoursesService;
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

    service = new CoursesService(mockDatabaseService);
  });

  describe('getCourses', () => {
    it('returns public published courses for guest users', async () => {
      const mockCourses = [
        { id: 'c1', title: 'Course 1', is_published: true },
        { id: 'c2', title: 'Course 2', is_published: true },
      ];

      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.range = vi.fn().mockResolvedValue({ data: mockCourses, error: null, count: 2 });

      mockSupabaseClient.from.mockReturnValue(chain);

      const result = await service.getCourses({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(chain.eq).toHaveBeenCalledWith('is_published', true);
    });

    it('allows instructors to view their own drafts along with published courses', async () => {
      const instructorId = 'instructor-uuid-1';
      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.or = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.range = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });

      mockSupabaseClient.from.mockReturnValue(chain);

      await service.getCourses({ page: 1, limit: 10 }, instructorId, UserRole.EDUCATOR);

      expect(chain.or).toHaveBeenCalledWith(`is_published.eq.true,instructor_id.eq.${instructorId}`);
    });

    it('allows admin users to view all courses without publication filters', async () => {
      const adminId = 'admin-uuid-1';
      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.range = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });

      mockSupabaseClient.from.mockReturnValue(chain);

      await service.getCourses({ page: 1, limit: 10 }, adminId, UserRole.ADMIN);

      expect(chain.eq).toBeUndefined();
    });

    it('applies level, tier, instructor, and search filters', async () => {
      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.or = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.range = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });

      mockSupabaseClient.from.mockReturnValue(chain);

      await service.getCourses({
        level: 'ADVANCED',
        tier: 'PREMIUM',
        instructor_id: 'inst-1',
        search: 'distributed',
      });

      expect(chain.eq).toHaveBeenCalledWith('level', 'ADVANCED');
      expect(chain.eq).toHaveBeenCalledWith('tier', 'PREMIUM');
      expect(chain.eq).toHaveBeenCalledWith('instructor_id', 'inst-1');
      expect(chain.or).toHaveBeenCalledWith('title.ilike.%distributed%,summary.ilike.%distributed%');
    });
  });

  describe('getCourseBySlugOrId', () => {
    it('throws NotFoundException if course does not exist', async () => {
      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

      mockSupabaseClient.from.mockReturnValue(chain);

      await expect(service.getCourseBySlugOrId('non-existent-slug')).rejects.toThrow(
        NotFoundException
      );
    });

    it('hides unpublished draft course from unauthorized users (privacy check)', async () => {
      const draftCourse = {
        id: 'course-1',
        slug: 'draft-course',
        instructor_id: 'instructor-1',
        is_published: false,
      };

      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: draftCourse, error: null });

      mockSupabaseClient.from.mockReturnValue(chain);

      await expect(
        service.getCourseBySlugOrId('draft-course', 'random-user-id', UserRole.STUDENT)
      ).rejects.toThrow(NotFoundException);
    });

    it('allows instructor to view their own draft course', async () => {
      const draftCourse = {
        id: 'c0000000-0000-4000-8000-000000000001',
        slug: 'draft-course',
        instructor_id: 'instructor-1',
        is_published: false,
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: draftCourse, error: null }),
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
        return {};
      });

      const result = await service.getCourseBySlugOrId(
        draftCourse.id,
        'instructor-1',
        UserRole.EDUCATOR
      );
      expect(result.id).toBe(draftCourse.id);
    });

    it('redacts non-preview lesson contents for unenrolled public users', async () => {
      const publicCourse = {
        id: 'course-1',
        slug: 'public-course',
        instructor_id: 'instructor-1',
        is_published: true,
      };

      const mockModule = { id: 'mod-1', course_id: 'course-1', title: 'Module 1', order_index: 1 };
      const mockLessons = [
        {
          id: 'les-1',
          module_id: 'mod-1',
          title: 'Preview Lecture',
          slug: 'preview-lecture',
          order_index: 1,
          duration_minutes: 15,
          is_preview: true,
          content: 'Free preview markdown content',
          video_url: 'https://cdn.example.com/preview.mp4',
        },
        {
          id: 'les-2',
          module_id: 'mod-1',
          title: 'Deep Dive Lesson',
          slug: 'deep-dive-lesson',
          order_index: 2,
          duration_minutes: 50,
          is_preview: false,
          content: 'Secret premium course notes',
          video_url: 'https://cdn.example.com/premium.mp4',
          transcript: [{ timestamp_sec: 10, label: '0:10', text: 'Important point' }],
          code_lab: { language: 'python', starter_code: 'import torch' },
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: publicCourse, error: null }),
              }),
            }),
          };
        }
        if (table === 'course_modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [mockModule], error: null }),
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
        return {};
      });

      const result = await service.getCourseBySlugOrId('public-course');

      expect(result.modules).toHaveLength(1);
      const lessons = result.modules![0].lessons!;
      expect(lessons).toHaveLength(2);

      // Lesson 1 is preview: content and video are preserved
      expect(lessons[0].content).toBe('Free preview markdown content');
      expect(lessons[0].video_url).toBe('https://cdn.example.com/preview.mp4');

      // Lesson 2 is NOT preview: content and video are redacted
      expect(lessons[1].content).toBe('');
      expect(lessons[1].video_url).toBeNull();
      expect(lessons[1].transcript).toEqual([]);
      expect(lessons[1].code_lab).toBeNull();
      expect(lessons[1].title).toBe('Deep Dive Lesson');
      expect(lessons[1].duration_minutes).toBe(50);
    });

    it('provides full lesson contents to enrolled students', async () => {
      const publicCourse = {
        id: 'course-1',
        slug: 'enrolled-course',
        instructor_id: 'instructor-1',
        is_published: true,
      };

      const mockEnrollment = {
        id: 'enroll-1',
        user_id: 'student-1',
        course_id: 'course-1',
        progress_percentage: 50,
      };

      const mockModule = { id: 'mod-1', course_id: 'course-1', title: 'Module 1', order_index: 1 };
      const mockLessons = [
        {
          id: 'les-2',
          module_id: 'mod-1',
          title: 'Deep Dive Lesson',
          slug: 'deep-dive-lesson',
          order_index: 1,
          duration_minutes: 50,
          is_preview: false,
          content: 'Secret premium course notes',
          video_url: 'https://cdn.example.com/premium.mp4',
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: publicCourse, error: null }),
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
                order: vi.fn().mockResolvedValue({ data: [mockModule], error: null }),
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
              eq: vi.fn().mockResolvedValue({
                data: [{ lesson_id: 'les-2', is_completed: true }],
                error: null,
              }),
            }),
          };
        }
        return {};
      });

      const result = await service.getCourseBySlugOrId(
        'enrolled-course',
        'student-1',
        UserRole.STUDENT
      );

      expect(result.user_enrollment).toBeDefined();
      const lesson = result.modules![0].lessons![0];
      expect(lesson.content).toBe('Secret premium course notes');
      expect(lesson.video_url).toBe('https://cdn.example.com/premium.mp4');
      expect(lesson.user_progress?.is_completed).toBe(true);
    });
  });

  describe('createCourse', () => {
    it('creates a course and derives instructor_id strictly from JWT user', async () => {
      const instructorId = 'educator-1';
      const dto = {
        title: 'Quantum Algorithms in Practice',
        description: 'Complete hands-on course in quantum computing',
        level: 'INTERMEDIATE' as const,
        tier: 'PREMIUM' as const,
        price_cents: 4900,
      };

      const mockCreated = {
        id: 'new-course-id',
        instructor_id: instructorId,
        title: dto.title,
        slug: 'quantum-algorithms-in-practice-xyz',
        ...dto,
      };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockCreated, error: null }),
          }),
        }),
      });

      const result = await service.createCourse(instructorId, dto);

      expect(result.id).toBe('new-course-id');
      expect(result.instructor_id).toBe(instructorId);
    });
  });

  describe('updateCourse', () => {
    it('throws ForbiddenException if non-instructor and non-admin attempts update', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'course-1', instructor_id: 'owner-id' },
              error: null,
            }),
          }),
        }),
      });

      await expect(
        service.updateCourse('course-1', 'intruder-id', false, { title: 'Hacked Title' })
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows instructor owner to update course', async () => {
      const existing = { id: 'course-1', instructor_id: 'instructor-1' };
      const updated = { ...existing, title: 'Updated Title' };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updated, error: null }),
            }),
          }),
        }),
      });

      const result = await service.updateCourse('course-1', 'instructor-1', false, {
        title: 'Updated Title',
      });
      expect(result.title).toBe('Updated Title');
    });

    it('allows platform admin to update any course', async () => {
      const existing = { id: 'course-1', instructor_id: 'instructor-1' };
      const updated = { ...existing, title: 'Admin Title' };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updated, error: null }),
            }),
          }),
        }),
      });

      const result = await service.updateCourse('course-1', 'admin-id', true, {
        title: 'Admin Title',
      });
      expect(result.title).toBe('Admin Title');
    });
  });

  describe('deleteCourse', () => {
    it('throws ForbiddenException if non-instructor attempts deletion', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'course-1', instructor_id: 'owner-id' },
              error: null,
            }),
          }),
        }),
      });

      await expect(service.deleteCourse('course-1', 'intruder-id', false)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('allows instructor owner to delete course', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'course-1', instructor_id: 'instructor-1' },
              error: null,
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      await expect(
        service.deleteCourse('course-1', 'instructor-1', false)
      ).resolves.not.toThrow();
    });
  });

  describe('createModule & createLesson', () => {
    it('creates module when called by course instructor', async () => {
      const course = { id: 'course-1', instructor_id: 'instructor-1' };
      const mockCreatedModule = { id: 'mod-1', course_id: 'course-1', title: 'Module 1', order_index: 1 };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: course, error: null }),
              }),
            }),
          };
        }
        if (table === 'course_modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockCreatedModule, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await service.createModule('course-1', 'instructor-1', false, {
        title: 'Module 1',
      });
      expect(result.id).toBe('mod-1');
    });

    it('throws ForbiddenException when adding module to someone elses course', async () => {
      const course = { id: 'course-1', instructor_id: 'original-instructor' };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: course, error: null }),
          }),
        }),
      });

      await expect(
        service.createModule('course-1', 'intruder-id', false, { title: 'Hacked Module' })
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates lesson when called by course instructor', async () => {
      const moduleRecord = { id: 'mod-1', course_id: 'course-1' };
      const course = { id: 'course-1', instructor_id: 'instructor-1' };
      const mockCreatedLesson = {
        id: 'les-1',
        module_id: 'mod-1',
        title: 'Lesson 1',
        order_index: 1,
        content: 'Lesson content',
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'course_modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: moduleRecord, error: null }),
              }),
            }),
          };
        }
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: course, error: null }),
              }),
            }),
          };
        }
        if (table === 'lessons') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockCreatedLesson, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await service.createLesson('mod-1', 'instructor-1', false, {
        title: 'Lesson 1',
        content: 'Lesson content',
      });
      expect(result.id).toBe('les-1');
    });

    it('throws ForbiddenException when adding lesson to another instructors module', async () => {
      const moduleRecord = { id: 'mod-1', course_id: 'course-1' };
      const course = { id: 'course-1', instructor_id: 'original-instructor' };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'course_modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: moduleRecord, error: null }),
              }),
            }),
          };
        }
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: course, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        service.createLesson('mod-1', 'intruder-id', false, {
          title: 'Hacked Lesson',
          content: 'Hack',
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('sanitizes custom slugs on creation into url-safe format', async () => {
      const mockCreated = {
        id: 'new-id',
        instructor_id: 'inst-1',
        title: 'Formal Invariants',
        slug: 'formal-invariants-spec-1',
      };

      let capturedPayload: any = null;

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            insert: vi.fn().mockImplementation((payload) => {
              capturedPayload = payload;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockCreated, error: null }),
                }),
              };
            }),
          };
        }
        return {};
      });

      await service.createCourse('inst-1', {
        title: 'Formal Invariants',
        description: 'Testing formal invariants in distributed systems.',
        slug: '  Formal Invariants & Spec (1)!  ',
      });

      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.slug).toBe('formal-invariants-spec-1');
      expect(capturedPayload.slug).not.toContain(' ');
      expect(capturedPayload.slug).not.toContain('&');
    });

    it('returns empty module array when course has no curriculum modules', async () => {
      const emptyCourse = {
        id: 'c-empty',
        instructor_id: 'inst-1',
        title: 'Empty Course Track',
        slug: 'empty-course',
        is_published: true,
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: emptyCourse, error: null }),
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
        return {};
      });

      const res = await service.getCourseBySlugOrId('empty-course');
      expect(res.id).toBe('c-empty');
      expect(res.modules).toEqual([]);
    });
  });
});
