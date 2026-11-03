/**
 * @platform/db
 * Database migration definitions, Supabase contracts, and RLS metadata for Learnova.
 */
export const DB_MODULE_VERSION = '0.5.0';

export const TABLES = {
  PROFILES: 'profiles',
  FOLLOWS: 'follows',
  CREATOR_CHANNELS: 'creator_channels',
  CHANNEL_SUBSCRIBERS: 'channel_subscribers',
  COMMUNITIES: 'communities',
  COMMUNITY_MEMBERS: 'community_members',
  POSTS: 'posts',
  TAGS: 'tags',
  POST_TAGS: 'post_tags',
  COMMENTS: 'comments',
  INTERACTIONS: 'interactions',
  BOOKMARKS: 'bookmarks',
  COURSES: 'courses',
  COURSE_MODULES: 'course_modules',
  LESSONS: 'lessons',
  COURSE_ENROLLMENTS: 'course_enrollments',
  LESSON_PROGRESS: 'lesson_progress',
  CONVERSATIONS: 'conversations',
  CONVERSATION_PARTICIPANTS: 'conversation_participants',
  MESSAGES: 'messages',
  NOTIFICATIONS: 'notifications',
  REPORTS: 'reports',
  SUBSCRIPTIONS: 'subscriptions',
  CREATOR_PAYOUT_RECORDS: 'creator_payout_records',
  ROLE_AUDIT_LOGS: 'role_audit_logs',
  SYSTEM_AUDIT_LOGS: 'system_audit_logs'
} as const;

export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  CONTENT_MEDIA: 'content-media',
  COURSE_MATERIALS: 'course-materials',
  PROJECT_ARTIFACTS: 'project-artifacts'
} as const;

export const SECURITY_FUNCTIONS = {
  PREVENT_UNAUTHORIZED_ROLE_ASSIGNMENT: 'prevent_unauthorized_role_assignment',
  HANDLE_NEW_USER: 'handle_new_user',
  IS_PLATFORM_ADMIN: 'is_platform_admin',
  IS_CONVERSATION_MEMBER: 'is_conversation_member',
  IS_COMMUNITY_MEMBER: 'is_community_member',
  PREVENT_AUDIT_LOG_TAMPERING: 'prevent_audit_log_tampering',
  BOOTSTRAP_INITIAL_ADMIN: 'bootstrap_initial_admin'
} as const;

export const SOCIAL_FUNCTIONS = {
  SYNC_POST_STATS: 'sync_post_stats',
  CREATE_SOCIAL_NOTIFICATION: 'create_social_notification'
} as const;

export const LEARNING_FUNCTIONS = {
  SYNC_COURSE_PROGRESS: 'sync_course_progress',
  SYNC_COURSE_ENROLLMENT_COUNT: 'sync_course_enrollment_count'
} as const;

export const CREATOR_COMMUNITY_FUNCTIONS = {
  SYNC_COMMUNITY_MEMBER_COUNT: 'sync_community_member_count',
  SYNC_CHANNEL_SUBSCRIBER_COUNT: 'sync_channel_subscriber_count'
} as const;
