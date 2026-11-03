import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { EnrollmentQueryDto } from './dto/enrollment-query.dto.js';
import type {
  CourseEnrollment,
  LessonProgress,
  CourseProgressSummary,
  ModuleProgressSummary,
  LessonProgressSummary,
} from '@platform/types';

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Helper to validate UUID format.
   */
  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
  }

  /**
   * 1. Enroll user in a course.
   * - Enforces authentication and publication status.
   * - Restricts premium courses honestly without pretending fake payment.
   * - Idempotent: returns existing enrollment if already enrolled.
   */
  async enrollInCourse(
    userId: string,
    courseIdOrSlug: string
  ): Promise<{ enrollment: CourseEnrollment; isExisting: boolean }> {
    const client = this.databaseService.getClient();

    let courseQuery = client
      .from('courses')
      .select('id, title, slug, tier, price_cents, is_published, instructor_id');

    if (this.isUUID(courseIdOrSlug)) {
      courseQuery = courseQuery.eq('id', courseIdOrSlug);
    } else {
      courseQuery = courseQuery.eq('slug', courseIdOrSlug);
    }

    const { data: course, error: courseError } = await courseQuery.maybeSingle();

    if (courseError || !course) {
      throw new NotFoundException('Course not found.');
    }

    if (!course.is_published) {
      throw new NotFoundException('Course not found or is not published.');
    }

    // Enforce pricing tier honestly
    const isFree = course.tier === 'FREE' || !course.price_cents || course.price_cents === 0;
    if (!isFree) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          error: 'Payment Required',
          message:
            'Enrollment in premium courses requires active billing checkout (Payment Gateway integration pending M4).',
        },
        HttpStatus.PAYMENT_REQUIRED
      );
    }

    // Check if user is already enrolled (idempotency)
    const { data: existingEnrollment } = await client
      .from('course_enrollments')
      .select('*, course:course_id(id, title, slug, summary, level, tier, price_cents, thumbnail_url, enrolled_count, rating, reviews_count)')
      .eq('user_id', userId)
      .eq('course_id', course.id)
      .maybeSingle();

    if (existingEnrollment) {
      return {
        enrollment: existingEnrollment as CourseEnrollment,
        isExisting: true,
      };
    }

    // Insert new enrollment (database trigger sync_course_enrollment_count handles course counter)
    const { data: newEnrollment, error: insertError } = await client
      .from('course_enrollments')
      .insert({
        user_id: userId,
        course_id: course.id,
        progress_percentage: 0.0,
        completed_at: null,
      })
      .select('*, course:course_id(id, title, slug, summary, level, tier, price_cents, thumbnail_url, enrolled_count, rating, reviews_count)')
      .single();

    if (insertError || !newEnrollment) {
      // Race condition safety: if duplicate unique constraint hit concurrently
      if (insertError?.code === '23505') {
        const { data: racedEnrollment } = await client
          .from('course_enrollments')
          .select('*, course:course_id(id, title, slug, summary, level, tier, price_cents, thumbnail_url, enrolled_count, rating, reviews_count)')
          .eq('user_id', userId)
          .eq('course_id', course.id)
          .single();

        return {
          enrollment: racedEnrollment as CourseEnrollment,
          isExisting: true,
        };
      }

      this.logger.error(`Failed to enroll user ${userId} in course ${course.id}: ${insertError?.message}`);
      throw new InternalServerErrorException('Failed to complete course enrollment.');
    }

    return {
      enrollment: newEnrollment as CourseEnrollment,
      isExisting: false,
    };
  }

  /**
   * 2. Get current user's enrollments with course details and pagination.
   */
  async getMyEnrollments(
    userId: string,
    query: EnrollmentQueryDto
  ): Promise<{ data: CourseEnrollment[]; total: number; page: number; limit: number }> {
    const client = this.databaseService.getClient();
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: enrollments, error, count } = await client
      .from('course_enrollments')
      .select(
        '*, course:course_id(id, title, slug, summary, level, tier, price_cents, thumbnail_url, enrolled_count, rating, reviews_count, instructor:instructor_id(id, username, display_name, avatar_url, role, headline, institution))',
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('enrolled_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.error(`Failed to fetch enrollments for user ${userId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve user enrollments.');
    }

    return {
      data: (enrollments || []) as CourseEnrollment[],
      total: count || 0,
      page,
      limit,
    };
  }

  /**
   * 3. Update lesson progress for the enrolled user.
   * - Validates lesson and course existence.
   * - Validates that the requesting user is enrolled.
   * - Records or updates progress.
   * - Database trigger sync_course_progress recalculates course completion automatically.
   */
  async updateLessonProgress(
    userId: string,
    lessonId: string,
    isCompleted: boolean = true
  ): Promise<{ progress: LessonProgress; enrollment: CourseEnrollment }> {
    const client = this.databaseService.getClient();

    // 1. Verify lesson exists and retrieve parent module
    const { data: lesson, error: lessonError } = await client
      .from('lessons')
      .select('id, module_id, title')
      .eq('id', lessonId)
      .maybeSingle();

    if (lessonError || !lesson) {
      throw new NotFoundException('Lesson not found.');
    }

    // 2. Verify parent module exists and retrieve course_id
    const { data: moduleRecord, error: moduleError } = await client
      .from('course_modules')
      .select('id, course_id')
      .eq('id', lesson.module_id)
      .maybeSingle();

    if (moduleError || !moduleRecord) {
      throw new NotFoundException('Module for this lesson not found.');
    }

    // 3. Verify user enrollment in this course
    const { data: enrollment, error: enrollError } = await client
      .from('course_enrollments')
      .select('id, user_id, course_id, progress_percentage, completed_at, enrolled_at')
      .eq('user_id', userId)
      .eq('course_id', moduleRecord.course_id)
      .maybeSingle();

    if (enrollError || !enrollment) {
      throw new ForbiddenException('You must be enrolled in this course to record lesson progress.');
    }

    // 4. Upsert lesson progress row
    const { data: existingProgress } = await client
      .from('lesson_progress')
      .select('id, is_completed')
      .eq('enrollment_id', enrollment.id)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    const now = new Date().toISOString();
    let progressRecord: LessonProgress;

    if (existingProgress) {
      const { data: updated, error: updateError } = await client
        .from('lesson_progress')
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? now : null,
          last_accessed_at: now,
        })
        .eq('id', existingProgress.id)
        .select()
        .single();

      if (updateError || !updated) {
        this.logger.error(`Failed to update lesson progress: ${updateError?.message}`);
        throw new InternalServerErrorException('Failed to update lesson progress.');
      }
      progressRecord = updated as LessonProgress;
    } else {
      const { data: inserted, error: insertError } = await client
        .from('lesson_progress')
        .insert({
          enrollment_id: enrollment.id,
          lesson_id: lessonId,
          is_completed: isCompleted,
          completed_at: isCompleted ? now : null,
          last_accessed_at: now,
        })
        .select()
        .single();

      if (insertError || !inserted) {
        this.logger.error(`Failed to insert lesson progress: ${insertError?.message}`);
        throw new InternalServerErrorException('Failed to record lesson progress.');
      }
      progressRecord = inserted as LessonProgress;
    }

    // 5. Query updated enrollment progress from database (updated by sync_course_progress trigger)
    const { data: refreshedEnrollment } = await client
      .from('course_enrollments')
      .select('id, user_id, course_id, progress_percentage, completed_at, enrolled_at')
      .eq('id', enrollment.id)
      .single();

    return {
      progress: progressRecord,
      enrollment: (refreshedEnrollment || enrollment) as CourseEnrollment,
    };
  }

  /**
   * 4. Get course progress summary for the authenticated enrolled user.
   * - Calculates overall progress, completed lesson IDs, and module-wise breakdown.
   * - Safely handles zero-lesson courses.
   */
  async getCourseProgress(
    userId: string,
    courseIdOrSlug: string
  ): Promise<CourseProgressSummary> {
    const client = this.databaseService.getClient();

    let courseQuery = client
      .from('courses')
      .select('id, title, slug');

    if (this.isUUID(courseIdOrSlug)) {
      courseQuery = courseQuery.eq('id', courseIdOrSlug);
    } else {
      courseQuery = courseQuery.eq('slug', courseIdOrSlug);
    }

    const { data: course, error: courseError } = await courseQuery.maybeSingle();

    if (courseError || !course) {
      throw new NotFoundException('Course not found.');
    }

    // Verify user enrollment
    const { data: enrollment, error: enrollError } = await client
      .from('course_enrollments')
      .select('id, user_id, course_id, progress_percentage, completed_at, enrolled_at')
      .eq('user_id', userId)
      .eq('course_id', course.id)
      .maybeSingle();

    if (enrollError || !enrollment) {
      throw new NotFoundException('You are not enrolled in this course.');
    }

    // Retrieve modules and lessons
    const { data: modules, error: modError } = await client
      .from('course_modules')
      .select('id, title, order_index')
      .eq('course_id', course.id)
      .order('order_index', { ascending: true });

    if (modError) {
      this.logger.error(`Failed to fetch modules: ${modError.message}`);
      throw new InternalServerErrorException('Failed to retrieve course curriculum.');
    }

    const moduleList = modules || [];
    const moduleIds = moduleList.map((m) => m.id);

    let lessonList: any[] = [];
    if (moduleIds.length > 0) {
      const { data: lessons, error: lessError } = await client
        .from('lessons')
        .select('id, module_id, title, slug, order_index, duration_minutes, is_preview')
        .in('module_id', moduleIds)
        .order('order_index', { ascending: true });

      if (lessError) {
        this.logger.error(`Failed to fetch lessons: ${lessError.message}`);
        throw new InternalServerErrorException('Failed to retrieve course lessons.');
      }
      lessonList = lessons || [];
    }

    // Retrieve lesson progress rows
    const { data: progressRows, error: progError } = await client
      .from('lesson_progress')
      .select('lesson_id, is_completed, completed_at, last_accessed_at')
      .eq('enrollment_id', enrollment.id);

    if (progError) {
      this.logger.error(`Failed to fetch progress: ${progError.message}`);
      throw new InternalServerErrorException('Failed to retrieve lesson progress.');
    }

    const progressMap = new Map<
      string,
      { is_completed: boolean; completed_at?: string | null; last_accessed_at?: string | null }
    >();
    const completedLessonIds: string[] = [];

    (progressRows || []).forEach((row) => {
      progressMap.set(row.lesson_id, {
        is_completed: row.is_completed,
        completed_at: row.completed_at,
        last_accessed_at: row.last_accessed_at,
      });
      if (row.is_completed) {
        completedLessonIds.push(row.lesson_id);
      }
    });

    const totalLessons = lessonList.length;
    const completedLessons = completedLessonIds.length;
    const isCompleted = totalLessons > 0 && completedLessons >= totalLessons;
    const computedPercentage =
      totalLessons > 0 ? Number(((completedLessons / totalLessons) * 100).toFixed(2)) : 0;

    // Module-wise progress aggregation
    const moduleSummaries: ModuleProgressSummary[] = moduleList.map((mod) => {
      const modLessons = lessonList.filter((l) => l.module_id === mod.id);
      const modCompleted = modLessons.filter((l) => progressMap.get(l.id)?.is_completed).length;
      const modTotal = modLessons.length;
      const modProgress =
        modTotal > 0 ? Number(((modCompleted / modTotal) * 100).toFixed(2)) : 0;

      const lessonSummaries: LessonProgressSummary[] = modLessons.map((l) => {
        const prog = progressMap.get(l.id);
        return {
          id: l.id,
          title: l.title,
          slug: l.slug,
          order_index: l.order_index,
          duration_minutes: l.duration_minutes,
          is_preview: l.is_preview,
          is_completed: prog?.is_completed || false,
          completed_at: prog?.completed_at || null,
          last_accessed_at: prog?.last_accessed_at || null,
        };
      });

      return {
        id: mod.id,
        title: mod.title,
        order_index: mod.order_index,
        total_lessons: modTotal,
        completed_lessons: modCompleted,
        progress_percentage: modProgress,
        lessons: lessonSummaries,
      };
    });

    return {
      course_id: course.id,
      course_title: course.title,
      enrollment_id: enrollment.id,
      enrolled_at: enrollment.enrolled_at,
      completed_at: enrollment.completed_at || (isCompleted ? new Date().toISOString() : null),
      is_completed: isCompleted,
      total_lessons: totalLessons,
      completed_lessons: completedLessons,
      progress_percentage: enrollment.progress_percentage ?? computedPercentage,
      completed_lesson_ids: completedLessonIds,
      modules: moduleSummaries,
    };
  }
}
