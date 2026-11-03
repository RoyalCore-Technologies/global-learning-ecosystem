import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { CourseQueryDto } from './dto/course-query.dto.js';
import type { CreateCourseDto } from './dto/create-course.dto.js';
import type { UpdateCourseDto } from './dto/update-course.dto.js';
import type { CreateModuleDto } from './dto/create-module.dto.js';
import type { UpdateModuleDto } from './dto/update-module.dto.js';
import type { CreateLessonDto } from './dto/create-lesson.dto.js';
import type { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { UserRole } from '@platform/types';
import type {
  Course,
  CourseModule,
  Lesson,
  CourseEnrollment,
} from '@platform/types';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Helper to validate UUID format.
   */
  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
  }

  /**
   * Generates a clean URL slug from title.
   */
  private generateSlug(title: string): string {
    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return `${baseSlug}-${randomSuffix}`.substring(0, 80);
  }

  /**
   * 1. Public course catalog with pagination, level, tier, and search filters.
   */
  async getCourses(
    query: CourseQueryDto,
    currentUserId?: string,
    currentUserRole?: UserRole
  ): Promise<{ data: Course[]; total: number; page: number; limit: number }> {
    const client = this.databaseService.getClient();
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let coursesQuery = client
      .from('courses')
      .select('*, instructor:instructor_id(id, username, display_name, avatar_url, role, headline, institution)', {
        count: 'exact',
      });

    // Public catalog returns published courses, unless viewed by instructor or admin
    if (currentUserRole === UserRole.ADMIN) {
      // Admins can see all courses
    } else if (currentUserId) {
      coursesQuery = coursesQuery.or(`is_published.eq.true,instructor_id.eq.${currentUserId}`);
    } else {
      coursesQuery = coursesQuery.eq('is_published', true);
    }

    if (query.level) {
      coursesQuery = coursesQuery.eq('level', query.level);
    }

    if (query.tier) {
      coursesQuery = coursesQuery.eq('tier', query.tier);
    }

    if (query.instructor_id) {
      coursesQuery = coursesQuery.eq('instructor_id', query.instructor_id);
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      coursesQuery = coursesQuery.or(`title.ilike.${term},summary.ilike.${term}`);
    }

    // Default order by enrolled_count DESC, created_at DESC
    coursesQuery = coursesQuery
      .order('enrolled_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data: courses, error, count } = await coursesQuery;

    if (error) {
      this.logger.error(`Failed to fetch courses: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve course catalog.');
    }

    return {
      data: (courses || []) as Course[],
      total: count || 0,
      page,
      limit,
    };
  }

  /**
   * 2. Course syllabus with instructor profile, ordered modules and lessons.
   * Protects non-preview lesson content for users without enrollment or authorized access.
   */
  async getCourseBySlugOrId(
    slugOrId: string,
    currentUserId?: string,
    currentUserRole?: UserRole
  ): Promise<Course> {
    const client = this.databaseService.getClient();

    let courseQuery = client
      .from('courses')
      .select('*, instructor:instructor_id(id, username, display_name, avatar_url, role, headline, institution)');

    if (this.isUUID(slugOrId)) {
      courseQuery = courseQuery.eq('id', slugOrId);
    } else {
      courseQuery = courseQuery.eq('slug', slugOrId);
    }

    const { data: course, error } = await courseQuery.maybeSingle();

    if (error || !course) {
      throw new NotFoundException('Course not found.');
    }

    // Privacy rule: Never leak unpublished courses to unauthorized users
    if (!course.is_published) {
      const isInstructor = currentUserId && course.instructor_id === currentUserId;
      const isAdmin = currentUserRole === UserRole.ADMIN;
      if (!isInstructor && !isAdmin) {
        throw new NotFoundException('Course not found.');
      }
    }

    // Determine access permissions (instructor, admin, or enrolled student)
    let hasFullAccess = false;
    let enrollmentRecord: CourseEnrollment | null = null;

    if (currentUserId) {
      if (course.instructor_id === currentUserId || currentUserRole === UserRole.ADMIN) {
        hasFullAccess = true;
      } else {
        const { data: enrollment } = await client
          .from('course_enrollments')
          .select('*')
          .eq('user_id', currentUserId)
          .eq('course_id', course.id)
          .maybeSingle();

        if (enrollment) {
          hasFullAccess = true;
          enrollmentRecord = enrollment as CourseEnrollment;
        }
      }
    }

    // Fetch ordered modules
    const { data: modules, error: modError } = await client
      .from('course_modules')
      .select('*')
      .eq('course_id', course.id)
      .order('order_index', { ascending: true });

    if (modError) {
      this.logger.error(`Failed to fetch modules: ${modError.message}`);
      throw new InternalServerErrorException('Failed to retrieve course syllabus.');
    }

    const moduleList = modules || [];
    const moduleIds = moduleList.map((m) => m.id);

    // Fetch ordered lessons
    let lessonList: Lesson[] = [];
    if (moduleIds.length > 0) {
      const { data: lessons, error: lessError } = await client
        .from('lessons')
        .select('*')
        .in('module_id', moduleIds)
        .order('order_index', { ascending: true });

      if (lessError) {
        this.logger.error(`Failed to fetch lessons: ${lessError.message}`);
        throw new InternalServerErrorException('Failed to retrieve course lessons.');
      }
      lessonList = (lessons || []) as Lesson[];
    }

    // If user is enrolled, query lesson_progress map
    const progressMap: Record<string, boolean> = {};
    if (enrollmentRecord) {
      const { data: progressRows } = await client
        .from('lesson_progress')
        .select('lesson_id, is_completed')
        .eq('enrollment_id', enrollmentRecord.id);

      (progressRows || []).forEach((row) => {
        progressMap[row.lesson_id] = row.is_completed;
      });
    }

    // Assemble module and lesson tree with privacy redactions
    const modulesWithLessons: CourseModule[] = moduleList.map((mod) => {
      const modLessons = lessonList
        .filter((l) => l.module_id === mod.id)
        .map((l) => {
          const isCompleted = progressMap[l.id] || false;

          if (hasFullAccess || l.is_preview) {
            return {
              ...l,
              user_progress: enrollmentRecord
                ? {
                    id: '',
                    enrollment_id: enrollmentRecord.id,
                    lesson_id: l.id,
                    is_completed: isCompleted,
                    last_accessed_at: new Date().toISOString(),
                  }
                : null,
            };
          }

          // Non-preview lessons without full access: redact content, video, and lab
          return {
            id: l.id,
            module_id: l.module_id,
            title: l.title,
            slug: l.slug,
            order_index: l.order_index,
            duration_minutes: l.duration_minutes,
            is_preview: false,
            content: '',
            video_url: null,
            transcript: [],
            code_lab: null,
            resources: [],
            created_at: l.created_at,
            updated_at: l.updated_at,
            user_progress: null,
          };
        });

      return {
        ...mod,
        lessons: modLessons,
      };
    });

    return {
      ...course,
      modules: modulesWithLessons,
      user_enrollment: enrollmentRecord,
    } as Course;
  }

  /**
   * 3. Create a new course. Instructor ID is derived strictly from JWT.
   */
  async createCourse(instructorId: string, dto: CreateCourseDto): Promise<Course> {
    const client = this.databaseService.getClient();

    const rawSlug = dto.slug?.trim()
      ? dto.slug
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')
      : this.generateSlug(dto.title);
    const slug = rawSlug || this.generateSlug(dto.title);

    // Verify slug uniqueness
    const { data: existingSlug } = await client
      .from('courses')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug;

    const { data: newCourse, error } = await client
      .from('courses')
      .insert({
        instructor_id: instructorId,
        title: dto.title.trim(),
        slug: finalSlug,
        summary: dto.summary?.trim() || null,
        description: dto.description.trim(),
        level: dto.level || 'BEGINNER',
        tier: dto.tier || 'FREE',
        price_cents: dto.price_cents || 0,
        is_published: dto.is_published || false,
        thumbnail_url: dto.thumbnail_url || null,
      })
      .select('*, instructor:instructor_id(id, username, display_name, avatar_url, role, headline, institution)')
      .single();

    if (error || !newCourse) {
      this.logger.error(`Failed to create course: ${error?.message}`);
      throw new InternalServerErrorException('Failed to create course.');
    }

    return newCourse as Course;
  }

  /**
   * 4. Update an existing course with ownership enforcement.
   */
  async updateCourse(
    courseId: string,
    instructorId: string,
    isAdmin: boolean,
    dto: UpdateCourseDto
  ): Promise<Course> {
    const client = this.databaseService.getClient();

    const { data: course } = await client
      .from('courses')
      .select('id, instructor_id')
      .eq('id', courseId)
      .maybeSingle();

    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    if (course.instructor_id !== instructorId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to modify this course.');
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.title !== undefined) updatePayload.title = dto.title.trim();
    if (dto.slug !== undefined) {
      updatePayload.slug = dto.slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    }
    if (dto.summary !== undefined) updatePayload.summary = dto.summary?.trim() || null;
    if (dto.description !== undefined) updatePayload.description = dto.description.trim();
    if (dto.level !== undefined) updatePayload.level = dto.level;
    if (dto.tier !== undefined) updatePayload.tier = dto.tier;
    if (dto.price_cents !== undefined) updatePayload.price_cents = dto.price_cents;
    if (dto.is_published !== undefined) updatePayload.is_published = dto.is_published;
    if (dto.thumbnail_url !== undefined) updatePayload.thumbnail_url = dto.thumbnail_url;

    const { data: updated, error } = await client
      .from('courses')
      .update(updatePayload)
      .eq('id', courseId)
      .select('*, instructor:instructor_id(id, username, display_name, avatar_url, role, headline, institution)')
      .single();

    if (error || !updated) {
      this.logger.error(`Failed to update course: ${error?.message}`);
      throw new InternalServerErrorException('Failed to update course.');
    }

    return updated as Course;
  }

  /**
   * 5. Delete an existing course with ownership enforcement.
   */
  async deleteCourse(courseId: string, instructorId: string, isAdmin: boolean): Promise<void> {
    const client = this.databaseService.getClient();

    const { data: course } = await client
      .from('courses')
      .select('id, instructor_id')
      .eq('id', courseId)
      .maybeSingle();

    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    if (course.instructor_id !== instructorId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete this course.');
    }

    const { error } = await client.from('courses').delete().eq('id', courseId);

    if (error) {
      this.logger.error(`Failed to delete course: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete course.');
    }
  }

  /**
   * 6. Add a module to a course.
   */
  async createModule(
    courseId: string,
    instructorId: string,
    isAdmin: boolean,
    dto: CreateModuleDto
  ): Promise<CourseModule> {
    const client = this.databaseService.getClient();

    const { data: course } = await client
      .from('courses')
      .select('id, instructor_id')
      .eq('id', courseId)
      .maybeSingle();

    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    if (course.instructor_id !== instructorId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to add modules to this course.');
    }

    let orderIndex = dto.order_index;
    if (!orderIndex) {
      const { data: maxMod } = await client
        .from('course_modules')
        .select('order_index')
        .eq('course_id', courseId)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle();

      orderIndex = (maxMod?.order_index || 0) + 1;
    }

    const { data: newModule, error } = await client
      .from('course_modules')
      .insert({
        course_id: courseId,
        title: dto.title.trim(),
        order_index: orderIndex,
      })
      .select()
      .single();

    if (error || !newModule) {
      this.logger.error(`Failed to create module: ${error?.message}`);
      throw new InternalServerErrorException('Failed to create module.');
    }

    return newModule as CourseModule;
  }

  /**
   * 7. Update an existing module.
   */
  async updateModule(
    moduleId: string,
    instructorId: string,
    isAdmin: boolean,
    dto: UpdateModuleDto
  ): Promise<CourseModule> {
    const client = this.databaseService.getClient();

    const { data: moduleRecord } = await client
      .from('course_modules')
      .select('id, course_id')
      .eq('id', moduleId)
      .maybeSingle();

    if (!moduleRecord) {
      throw new NotFoundException('Module not found.');
    }

    const { data: course } = await client
      .from('courses')
      .select('id, instructor_id')
      .eq('id', moduleRecord.course_id)
      .maybeSingle();

    if (!course) {
      throw new NotFoundException('Parent course not found.');
    }

    if (course.instructor_id !== instructorId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to modify this module.');
    }

    const updatePayload: Record<string, unknown> = {};
    if (dto.title !== undefined) updatePayload.title = dto.title.trim();
    if (dto.order_index !== undefined) updatePayload.order_index = dto.order_index;

    const { data: updated, error } = await client
      .from('course_modules')
      .update(updatePayload)
      .eq('id', moduleId)
      .select()
      .single();

    if (error || !updated) {
      this.logger.error(`Failed to update module: ${error?.message}`);
      throw new InternalServerErrorException('Failed to update module.');
    }

    return updated as CourseModule;
  }

  /**
   * 8. Delete a module.
   */
  async deleteModule(moduleId: string, instructorId: string, isAdmin: boolean): Promise<void> {
    const client = this.databaseService.getClient();

    const { data: moduleRecord } = await client
      .from('course_modules')
      .select('id, course_id')
      .eq('id', moduleId)
      .maybeSingle();

    if (!moduleRecord) {
      throw new NotFoundException('Module not found.');
    }

    const { data: course } = await client
      .from('courses')
      .select('id, instructor_id')
      .eq('id', moduleRecord.course_id)
      .maybeSingle();

    if (!course) {
      throw new NotFoundException('Parent course not found.');
    }

    if (course.instructor_id !== instructorId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete this module.');
    }

    const { error } = await client.from('course_modules').delete().eq('id', moduleId);

    if (error) {
      this.logger.error(`Failed to delete module: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete module.');
    }
  }

  /**
   * 9. Add a lesson to a module.
   */
  async createLesson(
    moduleId: string,
    instructorId: string,
    isAdmin: boolean,
    dto: CreateLessonDto
  ): Promise<Lesson> {
    const client = this.databaseService.getClient();

    const { data: moduleRecord } = await client
      .from('course_modules')
      .select('id, course_id')
      .eq('id', moduleId)
      .maybeSingle();

    if (!moduleRecord) {
      throw new NotFoundException('Module not found.');
    }

    const { data: course } = await client
      .from('courses')
      .select('id, instructor_id')
      .eq('id', moduleRecord.course_id)
      .maybeSingle();

    if (!course) {
      throw new NotFoundException('Parent course not found.');
    }

    if (course.instructor_id !== instructorId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to add lessons to this module.');
    }

    const slug = dto.slug?.trim() || this.generateSlug(dto.title);

    let orderIndex = dto.order_index;
    if (!orderIndex) {
      const { data: maxLesson } = await client
        .from('lessons')
        .select('order_index')
        .eq('module_id', moduleId)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle();

      orderIndex = (maxLesson?.order_index || 0) + 1;
    }

    const { data: newLesson, error } = await client
      .from('lessons')
      .insert({
        module_id: moduleId,
        title: dto.title.trim(),
        slug,
        order_index: orderIndex,
        content: dto.content.trim(),
        video_url: dto.video_url || null,
        duration_minutes: dto.duration_minutes || 0,
        is_preview: dto.is_preview || false,
        transcript: dto.transcript || [],
        code_lab: dto.code_lab || null,
        resources: dto.resources || [],
      })
      .select()
      .single();

    if (error || !newLesson) {
      this.logger.error(`Failed to create lesson: ${error?.message}`);
      throw new InternalServerErrorException('Failed to create lesson.');
    }

    return newLesson as Lesson;
  }

  /**
   * 10. Update an existing lesson.
   */
  async updateLesson(
    lessonId: string,
    instructorId: string,
    isAdmin: boolean,
    dto: UpdateLessonDto
  ): Promise<Lesson> {
    const client = this.databaseService.getClient();

    const { data: lessonRecord } = await client
      .from('lessons')
      .select('id, module_id')
      .eq('id', lessonId)
      .maybeSingle();

    if (!lessonRecord) {
      throw new NotFoundException('Lesson not found.');
    }

    const { data: moduleRecord } = await client
      .from('course_modules')
      .select('id, course_id')
      .eq('id', lessonRecord.module_id)
      .maybeSingle();

    if (!moduleRecord) {
      throw new NotFoundException('Parent module not found.');
    }

    const { data: course } = await client
      .from('courses')
      .select('id, instructor_id')
      .eq('id', moduleRecord.course_id)
      .maybeSingle();

    if (!course) {
      throw new NotFoundException('Parent course not found.');
    }

    if (course.instructor_id !== instructorId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to modify this lesson.');
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.title !== undefined) updatePayload.title = dto.title.trim();
    if (dto.slug !== undefined) updatePayload.slug = dto.slug.trim();
    if (dto.order_index !== undefined) updatePayload.order_index = dto.order_index;
    if (dto.content !== undefined) updatePayload.content = dto.content.trim();
    if (dto.video_url !== undefined) updatePayload.video_url = dto.video_url;
    if (dto.duration_minutes !== undefined) updatePayload.duration_minutes = dto.duration_minutes;
    if (dto.is_preview !== undefined) updatePayload.is_preview = dto.is_preview;
    if (dto.transcript !== undefined) updatePayload.transcript = dto.transcript;
    if (dto.code_lab !== undefined) updatePayload.code_lab = dto.code_lab;
    if (dto.resources !== undefined) updatePayload.resources = dto.resources;

    const { data: updated, error } = await client
      .from('lessons')
      .update(updatePayload)
      .eq('id', lessonId)
      .select()
      .single();

    if (error || !updated) {
      this.logger.error(`Failed to update lesson: ${error?.message}`);
      throw new InternalServerErrorException('Failed to update lesson.');
    }

    return updated as Lesson;
  }

  /**
   * 11. Delete a lesson.
   */
  async deleteLesson(lessonId: string, instructorId: string, isAdmin: boolean): Promise<void> {
    const client = this.databaseService.getClient();

    const { data: lessonRecord } = await client
      .from('lessons')
      .select('id, module_id')
      .eq('id', lessonId)
      .maybeSingle();

    if (!lessonRecord) {
      throw new NotFoundException('Lesson not found.');
    }

    const { data: moduleRecord } = await client
      .from('course_modules')
      .select('id, course_id')
      .eq('id', lessonRecord.module_id)
      .maybeSingle();

    if (!moduleRecord) {
      throw new NotFoundException('Parent module not found.');
    }

    const { data: course } = await client
      .from('courses')
      .select('id, instructor_id')
      .eq('id', moduleRecord.course_id)
      .maybeSingle();

    if (!course) {
      throw new NotFoundException('Parent course not found.');
    }

    if (course.instructor_id !== instructorId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete this lesson.');
    }

    const { error } = await client.from('lessons').delete().eq('id', lessonId);

    if (error) {
      this.logger.error(`Failed to delete lesson: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete lesson.');
    }
  }
}
