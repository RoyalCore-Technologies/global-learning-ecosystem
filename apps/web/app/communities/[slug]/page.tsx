'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/feedback';
import { apiClient, ApiError } from '@/lib/api-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Community, CommunityMember, Post, CommunityRole } from '@platform/types';
import {
  Users,
  Lock,
  Globe,
  PlusCircle,
  MessageSquare,
  Shield,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Settings,
  Flag,
  Share2,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function CommunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; name: string } | null>(null);
  const [community, setCommunity] = useState<(Community & { user_membership?: { role: CommunityRole; joined_at: string } | null }) | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'DISCUSSIONS' | 'ROSTER' | 'ABOUT'>('DISCUSSIONS');

  // Membership action loading
  const [isJoiningLeaving, setIsJoiningLeaving] = useState(false);

  // New Post Dialog
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Report Dialog
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Check auth
  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profileRes = await apiClient<{ role: string; display_name: string }>('profiles/me');
          setCurrentUser({
            id: session.user.id,
            role: profileRes.data?.role || 'STUDENT',
            name: profileRes.data?.display_name || 'User',
          });
        }
      } catch {
        setCurrentUser(null);
      }
    }
    checkAuth();
  }, []);

  // Fetch Community details
  const fetchCommunityData = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient<Community & { user_membership?: { role: CommunityRole; joined_at: string } | null }>(
        `communities/${slug}`
      );

      if (res.success && res.data) {
        setCommunity(res.data);

        // Fetch community posts and members in parallel
        const [postsRes, membersRes] = await Promise.all([
          apiClient<Post[]>(`posts?community_id=${res.data.id}&limit=20`),
          apiClient<CommunityMember[]>(`communities/${res.data.id}/members`),
        ]);

        if (postsRes.success && Array.isArray(postsRes.data)) {
          setPosts(postsRes.data);
        }
        if (membersRes.success && Array.isArray(membersRes.data)) {
          setMembers(membersRes.data);
        }
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load community details.');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchCommunityData();
  }, [fetchCommunityData]);

  // Handle Join Community
  const handleJoin = async () => {
    if (!currentUser) {
      router.push(`/auth/login?next=/communities/${slug}`);
      return;
    }
    if (!community) return;

    setIsJoiningLeaving(true);
    try {
      const res = await apiClient<CommunityMember>(`communities/${community.id}/join`, {
        method: 'POST',
      });
      if (res.success) {
        await fetchCommunityData();
      }
    } catch (err) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to join circle.');
    } finally {
      setIsJoiningLeaving(false);
    }
  };

  // Handle Leave Community
  const handleLeave = async () => {
    if (!currentUser || !community) return;

    setIsJoiningLeaving(true);
    try {
      const res = await apiClient(`communities/${community.id}/leave`, {
        method: 'POST',
      });
      if (res.success) {
        await fetchCommunityData();
      }
    } catch (err) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to leave circle.');
    } finally {
      setIsJoiningLeaving(false);
    }
  };

  // Handle Create Post in Community
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !community) return;

    setIsSubmittingPost(true);
    setPostError(null);

    try {
      const res = await apiClient<Post>('posts', {
        method: 'POST',
        body: JSON.stringify({
          title: postTitle.trim(),
          content: postContent.trim(),
          community_id: community.id,
          type: 'QUESTION',
        }),
      });

      if (res.success && res.data) {
        const createdPost = res.data;
        setIsNewPostOpen(false);
        setPostTitle('');
        setPostContent('');
        setPosts((prev) => [createdPost, ...prev]);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setPostError(apiErr.message || 'Failed to publish post to community.');
    } finally {
      setIsSubmittingPost(false);
    }
  };

  // Handle Report Community
  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !community) return;

    setIsSubmittingReport(true);
    try {
      const res = await apiClient('moderation/reports', {
        method: 'POST',
        body: JSON.stringify({
          target_type: 'COMMUNITY',
          target_id: community.id,
          reason: reportReason.trim(),
        }),
      });
      if (res.success) {
        setReportSuccess(true);
        setTimeout(() => {
          setIsReportOpen(false);
          setReportSuccess(false);
          setReportReason('');
        }, 1500);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to file report.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Role management (LEAD promoting to MODERATOR or vice versa)
  const handlePromoteRole = async (targetUserId: string, newRole: CommunityRole) => {
    if (!community) return;
    try {
      const res = await apiClient<CommunityMember>(`communities/${community.id}/members/${targetUserId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      if (res.success) {
        setMembers((prev) =>
          prev.map((m) => (m.user_id === targetUserId ? { ...m, role: newRole } : m))
        );
      }
    } catch (err) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to update member role.');
    }
  };

  // Kick member (LEAD/creator only)
  const handleRemoveMember = async (targetUserId: string) => {
    if (!community) return;
    if (!confirm('Are you sure you want to remove this scholar from the circle?')) return;

    try {
      const res = await apiClient(`communities/${community.id}/members/${targetUserId}`, {
        method: 'DELETE',
      });
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.user_id !== targetUserId));
      }
    } catch (err) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to remove member.');
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="w-full h-36 rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="w-1/3 h-8" />
            <Skeleton className="w-1/2 h-4" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !community) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto py-12">
          <ErrorState
            title="Unable to Access Circle"
            message={error || 'The requested community was not found or access is restricted.'}
            onRetry={() => router.push('/communities')}
          />
        </div>
      </AppShell>
    );
  }

  const isMember = !!community.user_membership;
  const userRole = community.user_membership?.role;
  const isLeadOrCreator = userRole === 'LEAD' || community.creator_id === currentUser?.id || currentUser?.role === 'ADMIN';

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back navigation */}
        <Link
          href="/communities"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Circles
        </Link>

        {/* Community Hero Banner */}
        <div className="relative rounded-2xl overflow-hidden border border-surface-border bg-gradient-to-br from-surface-card via-surface-card to-surface-subtle shadow-xl">
          <div className="h-32 bg-gradient-to-r from-brand-cyan-950/40 via-surface-subtle to-purple-950/30 border-b border-surface-border/60" />

          <div className="p-6 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12">
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 rounded-2xl bg-surface-card border-2 border-surface-border flex items-center justify-center text-brand-cyan-400 shadow-lg">
                {community.is_private ? (
                  <Lock className="w-9 h-9 text-amber-400" />
                ) : (
                  <Users className="w-9 h-9 text-brand-cyan-400" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {community.name}
                  </h1>
                  {community.is_private ? (
                    <Badge variant="warning" className="text-[10px]">Private Circle</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Public Circle</Badge>
                  )}
                  {isMember && (
                    <Badge variant="success" className="text-[10px]">
                      {userRole === 'LEAD' ? 'Circle Lead' : userRole === 'MODERATOR' ? 'Moderator' : 'Joined'}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{community.member_count} {community.member_count === 1 ? 'member' : 'members'}</span>
                  <span>•</span>
                  <span>Created {new Date(community.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 self-start sm:self-end">
              {isMember ? (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
                    onClick={() => setIsNewPostOpen(true)}
                  >
                    Start Discussion
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<UserMinus className="w-3.5 h-3.5" />}
                    isLoading={isJoiningLeaving}
                    onClick={handleLeave}
                  >
                    Leave
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                  isLoading={isJoiningLeaving}
                  onClick={handleJoin}
                >
                  Join Circle
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                aria-label="Report community"
                onClick={() => setIsReportOpen(true)}
              >
                <Flag className="w-3.5 h-3.5 text-slate-400 hover:text-red-400" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-surface-border/60 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('DISCUSSIONS')}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'DISCUSSIONS'
                ? 'bg-brand-cyan-500/20 text-brand-cyan-300 border border-brand-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Discussions ({posts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ROSTER')}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'ROSTER'
                ? 'bg-brand-cyan-500/20 text-brand-cyan-300 border border-brand-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Member Roster ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ABOUT')}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'ABOUT'
                ? 'bg-brand-cyan-500/20 text-brand-cyan-300 border border-brand-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Charter &amp; Rules
          </button>
        </div>

        {/* Tab 1: Discussions Feed */}
        {activeTab === 'DISCUSSIONS' && (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No Community Discussions Yet"
                description="Pose a challenging technical inquiry or share recent findings with fellow circle members."
                actionLabel={isMember ? 'Post Inquiry' : undefined}
                onAction={isMember ? () => setIsNewPostOpen(true) : undefined}
              />
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <Card key={post.id} className="border-surface-border hover:border-brand-cyan-500/30 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={post.author?.avatar_url || undefined}
                            name={post.author?.display_name || 'Author'}
                            size="sm"
                          />
                          <span className="font-medium text-slate-300">{post.author?.display_name}</span>
                          <span className="text-slate-600">•</span>
                          <span>{new Date(post.created_at).toLocaleDateString()}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">{post.type}</Badge>
                      </div>
                      <Link href={`/posts/${post.slug}`}>
                        <CardTitle className="text-base text-white pt-2 hover:text-brand-cyan-300 transition-colors">
                          {post.title}
                        </CardTitle>
                      </Link>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-300 line-clamp-3">
                      {post.summary || post.content}
                    </CardContent>
                    <CardFooter className="pt-2 border-t border-surface-border/40 text-[11px] text-slate-400 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span>{post.upvote_count} endorsements</span>
                        <span>{post.comment_count} replies</span>
                      </div>
                      <Link href={`/posts/${post.slug}`}>
                        <Button size="sm" variant="ghost" className="text-xs text-brand-cyan-400">
                          Join Discussion
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Member Roster */}
        {activeTab === 'ROSTER' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="p-3 bg-surface-card border border-surface-border rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      src={m.profile?.avatar_url || undefined}
                      name={m.profile?.display_name || 'Member'}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {m.profile?.display_name || 'Member'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        Joined {new Date(m.joined_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge
                      variant={m.role === 'LEAD' ? 'default' : m.role === 'MODERATOR' ? 'warning' : 'secondary'}
                      className="text-[10px]"
                    >
                      {m.role}
                    </Badge>

                    {/* Leader Controls: promote, change role, or remove */}
                    {isLeadOrCreator && m.user_id !== community.creator_id && m.user_id !== currentUser?.id && (
                      <div className="flex items-center gap-1">
                        <select
                          aria-label="Change member role"
                          value={m.role}
                          onChange={(e) => handlePromoteRole(m.user_id, e.target.value as CommunityRole)}
                          className="text-[10px] bg-surface-subtle border border-surface-border rounded px-1.5 py-0.5 text-slate-300 focus:outline-none"
                        >
                          <option value="MEMBER">Member</option>
                          <option value="MODERATOR">Mod</option>
                          <option value="LEAD">Lead</option>
                        </select>
                        <button
                          type="button"
                          aria-label="Remove member"
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: About & Rules */}
        {activeTab === 'ABOUT' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <Card className="border-surface-border">
                <CardHeader>
                  <CardTitle className="text-sm text-white">Circle Charter</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {community.description || 'No charter description provided.'}
                </CardContent>
              </Card>

              <Card className="border-surface-border">
                <CardHeader>
                  <CardTitle className="text-sm text-white">Inquiry Standards &amp; Code of Conduct</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-300 space-y-2">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand-cyan-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Academic Rigor:</strong> Back assertions with citations, formal proofs, benchmarks, or reproducible code.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand-cyan-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Respectful Disagreement:</strong> Critique ideas vigorously while treating contributors with collegial dignity.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand-cyan-400 mt-0.5 flex-shrink-0" />
                    <span><strong>No Engagement Farming:</strong> Low-effort promotion, unsolicited marketing, and spam result in immediate removal.</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-surface-border">
                <CardHeader>
                  <CardTitle className="text-sm text-white">Circle Metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-300">
                  <div className="flex justify-between py-1 border-b border-surface-border/40">
                    <span className="text-slate-400">Privacy Status</span>
                    <span className="font-medium text-white">{community.is_private ? 'Private (Invite Only)' : 'Public'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-border/40">
                    <span className="text-slate-400">Total Scholars</span>
                    <span className="font-medium text-white">{community.member_count}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-border/40">
                    <span className="text-slate-400">Circle Founder</span>
                    <span className="font-medium text-white">{community.creator?.display_name || 'Founder'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Created On</span>
                    <span className="font-medium text-white">{new Date(community.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Start Discussion Dialog */}
        <Dialog
          isOpen={isNewPostOpen}
          onClose={() => setIsNewPostOpen(false)}
          title={`Start Discussion in ${community.name}`}
          description="Inquiries posted here will be immediately visible to fellow scholars in this circle."
          maxWidth="md"
        >
          <form onSubmit={handleCreatePost} className="space-y-4 pt-2">
            {postError && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-lg">
                {postError}
              </div>
            )}

            <div>
              <label htmlFor="post-title" className="block text-xs font-medium text-slate-300 mb-1">
                Discussion Topic / Inquiry Title *
              </label>
              <input
                id="post-title"
                type="text"
                required
                minLength={3}
                maxLength={250}
                placeholder="e.g. Formal proof boundaries in Raft leader election"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded-lg text-white focus:outline-none focus:border-brand-cyan-500"
              />
            </div>

            <div>
              <label htmlFor="post-content" className="block text-xs font-medium text-slate-300 mb-1">
                Content &amp; Context *
              </label>
              <textarea
                id="post-content"
                required
                rows={5}
                placeholder="Share your hypothesis, questions, formulas, or benchmarks..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded-lg text-white focus:outline-none focus:border-brand-cyan-500 resize-none font-mono text-[11px]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsNewPostOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmittingPost}
              >
                Publish Inquiry
              </Button>
            </div>
          </form>
        </Dialog>

        {/* Report Community Dialog */}
        <Dialog
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          title="Report Academic Circle"
          description="Flag potential violations of scientific ethics, harassment, or platform conduct to human moderators."
          maxWidth="sm"
        >
          <form onSubmit={handleReport} className="space-y-4 pt-2">
            {reportSuccess ? (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Report filed for human moderation.
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="report-reason" className="block text-xs font-medium text-slate-300 mb-1">
                    Reason for report *
                  </label>
                  <textarea
                    id="report-reason"
                    required
                    rows={4}
                    placeholder="Provide specific context regarding the violation..."
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded-lg text-white focus:outline-none focus:border-red-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsReportOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    size="sm"
                    isLoading={isSubmittingReport}
                  >
                    Submit Report
                  </Button>
                </div>
              </>
            )}
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}
