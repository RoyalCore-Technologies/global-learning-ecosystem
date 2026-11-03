'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, LoadingSpinner } from '@/components/ui/feedback';
import { apiClient } from '@/lib/api-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Post, Comment, Profile } from '@platform/types';
import {
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Bookmark,
  Share2,
  MessageSquare,
  Pin,
  Check,
  Trash2,
  CornerDownRight,
  Send,
  Eye,
  Calendar,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface PostDetailViewProps {
  slug: string;
}

export function PostDetailView({ slug }: PostDetailViewProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('STUDENT');

  // Interaction States
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [hasEndorsed, setHasEndorsed] = useState(false);
  const [hasBookmarked, setHasBookmarked] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [copiedShare, setCopiedShare] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Comment Creation State
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // 1. Current Session
  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) {
          setCurrentUserId(session.user.id);
          const role = (session.user.app_metadata?.role as string) || 'STUDENT';
          setCurrentUserRole(role);
        }
      });
    } catch {
      // Unauthenticated visitor
    }
  }, []);

  // 2. Fetch Post
  const fetchPost = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient<Post>(`posts/${slug}`);
      if (res.data) {
        setPost(res.data);
        setUpvoteCount(res.data.upvote_count || 0);
        if (res.data.user_interactions) {
          setHasUpvoted(res.data.user_interactions.has_upvoted);
          setHasEndorsed(res.data.user_interactions.has_endorsed);
          setHasBookmarked(res.data.user_interactions.has_bookmarked);
        }
      } else {
        setError('Knowledge post not found.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load post.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  // 3. Fetch Comments
  const fetchComments = useCallback(async (postId: string) => {
    setCommentsLoading(true);
    try {
      const res = await apiClient<Comment[]>(`posts/${postId}/comments`);
      if (res.data && Array.isArray(res.data)) {
        setComments(res.data);
      }
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (post?.id) {
      fetchComments(post.id);
    }
  }, [post?.id, fetchComments]);

  // Handle Endorsement / Upvote Toggle
  const handleToggleInteraction = async (type: 'UPVOTE_INSIGHTFUL' | 'ENDORSE_ACCURACY') => {
    if (!post || !currentUserId) {
      setActionFeedback('Please sign in to endorse or vote on knowledge posts.');
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }

    if (type === 'ENDORSE_ACCURACY') {
      const isEligible =
        currentUserRole === 'EDUCATOR' ||
        currentUserRole === 'RESEARCHER' ||
        currentUserRole === 'ADMIN';

      if (!isEligible) {
        setActionFeedback('Academic accuracy endorsements require verified EDUCATOR or RESEARCHER credentials.');
        setTimeout(() => setActionFeedback(null), 4000);
        return;
      }
    }

    try {
      const res = await apiClient<{ isInteracted: boolean; type: string; currentCount: number }>(
        `posts/${post.id}/interactions`,
        {
          method: 'POST',
          body: JSON.stringify({ type }),
        }
      );

      if (res.data) {
        if (type === 'ENDORSE_ACCURACY') {
          setHasEndorsed(res.data.isInteracted);
          setUpvoteCount((prev) => (res.data!.isInteracted ? prev + 1 : Math.max(0, prev - 1)));
        } else {
          setHasUpvoted(res.data.isInteracted);
          setUpvoteCount((prev) => (res.data!.isInteracted ? prev + 1 : Math.max(0, prev - 1)));
        }
      }
    } catch (err: any) {
      setActionFeedback(err.message || 'Failed to toggle interaction.');
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  // Handle Bookmark Toggle
  const handleToggleBookmark = async () => {
    if (!post || !currentUserId) {
      setActionFeedback('Please sign in to save posts to your reading list.');
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }

    try {
      const res = await apiClient<{ isBookmarked: boolean }>(`posts/${post.id}/bookmarks`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (res.data) {
        setHasBookmarked(res.data.isBookmarked);
        setActionFeedback(res.data.isBookmarked ? 'Post saved to reading list.' : 'Post removed from reading list.');
        setTimeout(() => setActionFeedback(null), 2500);
      }
    } catch (err: any) {
      setActionFeedback(err.message || 'Failed to save bookmark.');
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  // Submit Comment
  const handleAddComment = async (parentId?: string) => {
    if (!post || !currentUserId) {
      setActionFeedback('Please sign in to participate in academic discussions.');
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }

    const content = parentId ? replyText.trim() : newCommentText.trim();
    if (!content) return;

    setSubmittingComment(true);
    try {
      const res = await apiClient<Comment>(`posts/${post.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content,
          parent_comment_id: parentId || undefined,
        }),
      });

      if (res.data) {
        if (parentId) {
          setReplyingToId(null);
          setReplyText('');
        } else {
          setNewCommentText('');
        }
        // Refresh comments tree
        fetchComments(post.id);
      }
    } catch (err: any) {
      setActionFeedback(err.message || 'Failed to submit comment.');
      setTimeout(() => setActionFeedback(null), 3000);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Toggle Comment Pin
  const handleTogglePin = async (commentId: string) => {
    try {
      await apiClient(`comments/${commentId}/pin`, { method: 'POST' });
      if (post) fetchComments(post.id);
    } catch (err: any) {
      setActionFeedback(err.message || 'Failed to pin comment.');
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  // Toggle Accepted Solution
  const handleToggleSolution = async (commentId: string) => {
    try {
      await apiClient(`comments/${commentId}/solution`, { method: 'POST' });
      if (post) fetchComments(post.id);
    } catch (err: any) {
      setActionFeedback(err.message || 'Failed to mark solution.');
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  // Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    try {
      await apiClient(`comments/${commentId}`, { method: 'DELETE' });
      if (post) fetchComments(post.id);
    } catch (err: any) {
      setActionFeedback(err.message || 'Failed to delete comment.');
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const isPostAuthor = currentUserId === post?.author_id;

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-xs text-slate-400 font-mono">Loading knowledge post...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !post) {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto py-16 px-4">
          <EmptyState
            title="Knowledge Post Not Found"
            description="The post you are seeking does not exist, has been archived, or you do not have permission to view it."
            actionLabel="Return to Feed"
            onAction={() => (window.location.href = '/explore')}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Knowledge Feed</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-surface-elevated text-brand-indigo-300 border border-surface-border">
              {post.type}
            </span>
          </div>
        </div>

        {/* Global Action Banner Toast */}
        {actionFeedback && (
          <div className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border flex items-center gap-2 text-xs text-brand-indigo-200">
            <AlertCircle className="w-4 h-4 text-brand-indigo-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Main Post Card */}
        <Card variant="elevated" className="overflow-hidden">
          <CardHeader className="space-y-4 pb-4 border-b border-surface-border/60">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
              {post.title}
            </h1>

            {/* Author Attribution Card */}
            {post.author && (
              <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                <Link
                  href={`/profile/${post.author.username}`}
                  className="flex items-center gap-3 group"
                >
                  <Avatar
                    src={post.author.avatar_url}
                    name={post.author.display_name}
                    size="md"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm group-hover:text-brand-indigo-300 transition-colors">
                        {post.author.display_name}
                      </span>
                      <Badge
                        roleType={post.author.role}
                        isVerified={post.author.verification_status === 'VERIFIED'}
                        className="text-[9px] px-1.5 py-0"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      @{post.author.username} {post.author.headline ? `· ${post.author.headline}` : ''}
                    </p>
                  </div>
                </Link>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {new Date(post.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{post.view_count || 0} reads</span>
                  </div>
                </div>
              </div>
            )}
          </CardHeader>

          {/* Post Summary & Markdown Body */}
          <CardContent className="space-y-6 pt-6 text-slate-200">
            {post.summary && (
              <div className="p-4 rounded-xl bg-surface-base/80 border border-surface-border/80 text-xs sm:text-sm text-slate-300 leading-relaxed italic border-l-2 border-l-brand-indigo-500">
                {post.summary}
              </div>
            )}

            {/* Markdown Body Text */}
            <div className="prose prose-invert prose-sm sm:prose-base max-w-none leading-relaxed space-y-4 whitespace-pre-wrap font-sans text-slate-200">
              {post.content}
            </div>

            {/* Topic Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-4 border-t border-surface-border/40">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-mono px-2.5 py-1 rounded bg-surface-subtle text-slate-400 border border-surface-border"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </CardContent>

          {/* Interactive Footer Actions */}
          <CardFooter className="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-surface-border/60 bg-surface-subtle/30">
            <div className="flex items-center gap-3">
              {/* Academic Accuracy Endorsement Button */}
              <button
                onClick={() => handleToggleInteraction('ENDORSE_ACCURACY')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  hasEndorsed
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                    : 'bg-surface-elevated text-slate-300 border-surface-border hover:border-emerald-500/40 hover:text-emerald-300'
                }`}
                title="Academic Accuracy Endorsement (Educator/Researcher credentials)"
              >
                <CheckCircle2 className={`w-4 h-4 ${hasEndorsed ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>Peer Accuracy Endorsement</span>
              </button>

              {/* Insightful Vote Button */}
              <button
                onClick={() => handleToggleInteraction('UPVOTE_INSIGHTFUL')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  hasUpvoted
                    ? 'bg-brand-indigo-950/80 text-brand-indigo-300 border-brand-indigo-500/50'
                    : 'bg-surface-elevated text-slate-300 border-surface-border hover:border-brand-indigo-500/40 hover:text-brand-indigo-300'
                }`}
                title="Mark post as insightful"
              >
                <Sparkles className={`w-4 h-4 ${hasUpvoted ? 'text-brand-indigo-400' : 'text-slate-400'}`} />
                <span>{upvoteCount} Insightful</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Bookmark Toggle Button */}
              <button
                onClick={handleToggleBookmark}
                className={`p-2 rounded-xl border text-xs transition-colors ${
                  hasBookmarked
                    ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                    : 'bg-surface-elevated text-slate-400 border-surface-border hover:text-white'
                }`}
                title="Save to Reading List"
              >
                <Bookmark className="w-4 h-4" />
              </button>

              {/* Share Button */}
              <button
                onClick={handleShare}
                className="p-2 rounded-xl bg-surface-elevated text-slate-400 border border-surface-border hover:text-white transition-colors"
                title="Share link"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </CardFooter>
        </Card>

        {/* Discussions & Peer Inquiries Section */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-indigo-400" />
              Academic Discussions ({comments.length})
            </h2>
          </div>

          {/* New Discussion Comment Box */}
          <Card variant="default" className="p-4 space-y-3">
            <textarea
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Contribute scholarly inquiries, peer reviews, or constructive citations..."
              rows={3}
              maxLength={5000}
              className="w-full rounded-xl bg-surface-card border border-surface-border p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-indigo-500 transition-colors"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Send className="w-3.5 h-3.5" />}
                onClick={() => handleAddComment()}
                isLoading={submittingComment && !replyingToId}
                disabled={!newCommentText.trim()}
              >
                Post Scholarly Comment
              </Button>
            </div>
          </Card>

          {/* Threaded Comments Tree */}
          <div className="space-y-3">
            {commentsLoading ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : comments.length > 0 ? (
              comments.map((rootComment) => (
                <CommentItemCard
                  key={rootComment.id}
                  comment={rootComment}
                  isPostAuthor={isPostAuthor}
                  currentUserId={currentUserId}
                  replyingToId={replyingToId}
                  replyText={replyText}
                  setReplyingToId={setReplyingToId}
                  setReplyText={setReplyText}
                  onAddReply={(parentId) => handleAddComment(parentId)}
                  onTogglePin={(id) => handleTogglePin(id)}
                  onToggleSolution={(id) => handleToggleSolution(id)}
                  onDeleteComment={(id) => handleDeleteComment(id)}
                  submitting={submittingComment}
                />
              ))
            ) : (
              <EmptyState
                title="No discussion comments yet"
                description="Be the first peer to provide an academic review or ask a clarifying question."
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// Subcomponent: Comment Item & Recursive Threaded Replies
interface CommentItemCardProps {
  comment: Comment;
  isPostAuthor: boolean;
  currentUserId: string | null;
  replyingToId: string | null;
  replyText: string;
  setReplyingToId: (id: string | null) => void;
  setReplyText: (text: string) => void;
  onAddReply: (parentId: string) => void;
  onTogglePin: (id: string) => void;
  onToggleSolution: (id: string) => void;
  onDeleteComment: (id: string) => void;
  submitting: boolean;
}

function CommentItemCard({
  comment,
  isPostAuthor,
  currentUserId,
  replyingToId,
  replyText,
  setReplyingToId,
  setReplyText,
  onAddReply,
  onTogglePin,
  onToggleSolution,
  onDeleteComment,
  submitting,
}: CommentItemCardProps) {
  const isAuthor = currentUserId === comment.author_id;
  const isReplying = replyingToId === comment.id;

  return (
    <Card
      variant="default"
      className={`p-4 space-y-3 transition-colors ${
        comment.is_solution
          ? 'border-emerald-500/50 bg-emerald-950/20'
          : comment.is_pinned
          ? 'border-brand-indigo-500/40 bg-brand-indigo-950/20'
          : ''
      }`}
    >
      {/* Badges Bar (Pinned / Accepted Solution) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {comment.author && (
            <Link href={`/profile/${comment.author.username}`} className="flex items-center gap-2 group">
              <Avatar
                src={comment.author.avatar_url}
                name={comment.author.display_name}
                size="sm"
              />
              <span className="font-semibold text-white text-xs group-hover:text-brand-indigo-300 transition-colors">
                {comment.author.display_name}
              </span>
              <Badge
                roleType={comment.author.role}
                isVerified={comment.author.verification_status === 'VERIFIED'}
                className="text-[8px] px-1 py-0"
              />
            </Link>
          )}

          <span className="text-[10px] text-slate-500 font-mono">
            {new Date(comment.created_at).toLocaleDateString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {comment.is_solution && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 border border-emerald-500/40 text-emerald-300">
              <Check className="w-3 h-3 text-emerald-400" /> Accepted Solution
            </span>
          )}

          {comment.is_pinned && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-indigo-950 border border-brand-indigo-500/40 text-brand-indigo-300">
              <Pin className="w-3 h-3 text-brand-indigo-400" /> Pinned
            </span>
          )}
        </div>
      </div>

      {/* Comment Body */}
      <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap pl-1">
        {comment.content}
      </p>

      {/* Comment Actions */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-surface-border/40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (isReplying) {
                setReplyingToId(null);
                setReplyText('');
              } else {
                setReplyingToId(comment.id);
                setReplyText('');
              }
            }}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <CornerDownRight className="w-3.5 h-3.5" />
            <span>{isReplying ? 'Cancel' : 'Reply'}</span>
          </button>

          {isPostAuthor && (
            <>
              <button
                onClick={() => onTogglePin(comment.id)}
                className={`flex items-center gap-1 transition-colors ${
                  comment.is_pinned ? 'text-brand-indigo-400 font-medium' : 'hover:text-white'
                }`}
              >
                <Pin className="w-3 h-3" />
                <span>{comment.is_pinned ? 'Unpin' : 'Pin'}</span>
              </button>

              <button
                onClick={() => onToggleSolution(comment.id)}
                className={`flex items-center gap-1 transition-colors ${
                  comment.is_solution ? 'text-emerald-400 font-medium' : 'hover:text-white'
                }`}
              >
                <Check className="w-3 h-3" />
                <span>{comment.is_solution ? 'Unmark Solution' : 'Accept Solution'}</span>
              </button>
            </>
          )}
        </div>

        {(isAuthor || isPostAuthor) && (
          <button
            onClick={() => onDeleteComment(comment.id)}
            className="text-slate-500 hover:text-rose-400 transition-colors p-1"
            title="Delete Comment"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Inline Reply Input Box */}
      {isReplying && (
        <div className="pt-2 pl-4 border-l-2 border-brand-indigo-500/50 space-y-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={`Reply to ${comment.author?.display_name || 'scholar'}...`}
            rows={2}
            className="w-full rounded-xl bg-surface-card border border-surface-border p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-indigo-500"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setReplyingToId(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => onAddReply(comment.id)}
              isLoading={submitting}
              disabled={!replyText.trim()}
            >
              Post Reply
            </Button>
          </div>
        </div>
      )}

      {/* Nested Replies Rendering */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="pl-4 sm:pl-6 pt-2 border-l border-surface-border/60 space-y-2.5">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="p-3 rounded-xl bg-surface-base/60 border border-surface-border/60 space-y-2">
              <div className="flex items-center justify-between">
                {reply.author && (
                  <Link href={`/profile/${reply.author.username}`} className="flex items-center gap-2 group">
                    <Avatar
                      src={reply.author.avatar_url}
                      name={reply.author.display_name}
                      size="sm"
                      className="w-6 h-6 text-[10px]"
                    />
                    <span className="font-semibold text-white text-xs group-hover:text-brand-indigo-300 transition-colors">
                      {reply.author.display_name}
                    </span>
                    <Badge
                      roleType={reply.author.role}
                      isVerified={reply.author.verification_status === 'VERIFIED'}
                      className="text-[8px] px-1 py-0"
                    />
                  </Link>
                )}
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(reply.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed pl-1">{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
