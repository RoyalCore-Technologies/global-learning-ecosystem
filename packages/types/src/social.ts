import { UserRole } from './roles.js';

export type VerificationStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export type PostType =
  | 'ARTICLE'
  | 'TUTORIAL'
  | 'QUESTION'
  | 'SNIPPET'
  | 'PROJECT_SHOWCASE';

export type PostStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'ARCHIVED'
  | 'REMOVED';

export type InteractionType =
  | 'UPVOTE_INSIGHTFUL'
  | 'BOOKMARK'
  | 'ENDORSE_ACCURACY';

export type NotificationType =
  | 'NEW_COMMENT'
  | 'POST_UPVOTE'
  | 'COURSE_MILESTONE'
  | 'SYSTEM_ALERT'
  | 'NEW_MESSAGE'
  | 'COMMUNITY_INVITE'
  | 'NEW_FOLLOWER'
  | 'ACCURACY_ENDORSEMENT';

export type ReportTarget =
  | 'POST'
  | 'COMMENT'
  | 'USER'
  | 'COMMUNITY';

export type ReportStatus =
  | 'PENDING'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'DISMISSED';

export interface NotificationPreferences {
  in_app: {
    comments: boolean;
    upvotes: boolean;
    endorsements: boolean;
    follows: boolean;
    system: boolean;
  };
  email: {
    weekly_digest: boolean;
    major_announcements: boolean;
  };
}

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  headline?: string | null;
  bio?: string | null;
  role: UserRole;
  verification_status: VerificationStatus;
  skills: string[];
  github_url?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  is_banned: boolean;
  notification_preferences: NotificationPreferences;
  created_at: string;
  updated_at: string;
  follower_count?: number;
  following_count?: number;
  posts_count?: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  community_id?: string | null;
  channel_id?: string | null;
  title: string;
  slug: string;
  summary?: string | null;
  content: string;
  type: PostType;
  status: PostStatus;
  cover_image_url?: string | null;
  view_count: number;
  upvote_count: number;
  comment_count: number;
  is_pinned: boolean;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string | null;
    role: UserRole;
    verification_status: VerificationStatus;
    headline?: string | null;
  };
  tags?: string[];
  user_interactions?: {
    has_upvoted: boolean;
    has_endorsed: boolean;
    has_bookmarked: boolean;
  };
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id?: string | null;
  content: string;
  is_pinned: boolean;
  is_solution: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string | null;
    role: UserRole;
    verification_status: VerificationStatus;
  };
  replies?: Comment[];
}

export interface Interaction {
  id: string;
  user_id: string;
  post_id: string;
  type: InteractionType;
  created_at: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  post_id: string;
  collection_name: string;
  notes?: string | null;
  created_at: string;
  post?: Post;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  resource_path?: string | null;
  is_read: boolean;
  created_at: string;
  actor?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string | null;
  };
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: string;
  status: ReportStatus;
  resolved_by?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  resolved_at?: string | null;
}
