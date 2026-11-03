import { UserRole } from './roles.js';

export type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS';
export type ContentTier = 'FREE' | 'PREMIUM';

export interface TranscriptSegment {
  timestamp_sec: number;
  label: string;
  text: string;
}

export interface CodeLab {
  language: string;
  starter_code: string;
  solution_code?: string;
  filename?: string;
  test_assertions?: string;
}

export interface LessonResource {
  title: string;
  url: string;
  type: 'SLIDES' | 'PDF' | 'CODE' | 'EXTERNAL';
  size_bytes?: number;
}

export interface CourseInstructorSummary {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  role: UserRole;
  headline?: string | null;
  institution?: string | null;
}

export interface Course {
  id: string;
  instructor_id: string;
  title: string;
  slug: string;
  summary?: string | null;
  description: string;
  level: CourseLevel;
  tier: ContentTier;
  price_cents: number;
  is_published: boolean;
  thumbnail_url?: string | null;
  enrolled_count: number;
  rating: number;
  reviews_count: number;
  created_at: string;
  updated_at: string;
  instructor?: CourseInstructorSummary;
  modules?: CourseModule[];
  user_enrollment?: CourseEnrollment | null;
}

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  created_at: string;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  slug: string;
  order_index: number;
  content: string;
  video_url?: string | null;
  duration_minutes: number;
  is_preview: boolean;
  transcript?: TranscriptSegment[];
  code_lab?: CodeLab | null;
  resources?: LessonResource[];
  created_at: string;
  updated_at: string;
  user_progress?: LessonProgress | null;
}

export interface CourseEnrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  completed_at?: string | null;
  progress_percentage: number;
  course?: Course;
}

export interface LessonProgress {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  is_completed: boolean;
  completed_at?: string | null;
  last_accessed_at: string;
}

export interface CourseReview {
  id: string;
  course_id: string;
  user_id: string;
  rating: number;
  content?: string | null;
  is_accuracy_endorsed: boolean;
  created_at: string;
  author?: CourseInstructorSummary;
}

// -----------------------------------------------------------------------------
// DTO Interfaces for API requests
// -----------------------------------------------------------------------------

export interface CreateCourseDto {
  title: string;
  slug?: string;
  summary?: string;
  description: string;
  level?: CourseLevel;
  tier?: ContentTier;
  price_cents?: number;
  is_published?: boolean;
  thumbnail_url?: string;
}

export interface UpdateCourseDto {
  title?: string;
  slug?: string;
  summary?: string;
  description?: string;
  level?: CourseLevel;
  tier?: ContentTier;
  price_cents?: number;
  is_published?: boolean;
  thumbnail_url?: string;
}

export interface CreateModuleDto {
  title: string;
  order_index?: number;
}

export interface UpdateModuleDto {
  title?: string;
  order_index?: number;
}

export interface CreateLessonDto {
  title: string;
  slug?: string;
  order_index?: number;
  content: string;
  video_url?: string;
  duration_minutes?: number;
  is_preview?: boolean;
  transcript?: TranscriptSegment[];
  code_lab?: CodeLab;
  resources?: LessonResource[];
}

export interface UpdateLessonDto {
  title?: string;
  slug?: string;
  order_index?: number;
  content?: string;
  video_url?: string;
  duration_minutes?: number;
  is_preview?: boolean;
  transcript?: TranscriptSegment[];
  code_lab?: CodeLab;
  resources?: LessonResource[];
}

export interface EnrollCourseDto {
  course_id: string;
}

export interface UpdateLessonProgressDto {
  is_completed: boolean;
}
