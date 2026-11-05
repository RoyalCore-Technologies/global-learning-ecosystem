'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState, LoadingSpinner } from '@/components/ui/feedback';
import { apiClient } from '@/lib/api-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Profile, Post, Course, CreatorChannel } from '@platform/types';
import {
  UserPlus,
  UserCheck,
  Edit3,
  Share2,
  BookOpen,
  Award,
  ExternalLink,
  Github,
  Linkedin,
  Globe,
  Calendar,
  Sparkles,
  CheckCircle2,
  Users,
  MessageSquare,
  AlertCircle,
  Radio,
  Clock,
} from 'lucide-react';

interface ProfileViewProps {
  username: string;
}

export function ProfileView({ username }: ProfileViewProps) {
  const [profile, setProfile] = useState<(Profile & { is_following?: boolean }) | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [channels, setChannels] = useState<CreatorChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [creatorContentLoading, setCreatorContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'courses' | 'about' | 'followers' | 'following'>('posts');
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // 1. Fetch current session user
  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) {
          setCurrentUserId(session.user.id);
        }
      });
    } catch {
      // Unauthenticated visitor
    }
  }, []);

  // 2. Fetch target profile
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient<Profile & { is_following?: boolean }>(`profiles/${username}`);
      if (res.data) {
        setProfile(res.data);
      } else {
        setError('Scholar profile not found.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load scholar profile.');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // 3. Fetch user's published posts
  useEffect(() => {
    if (!profile?.id) return;
    if (activeTab === 'posts') {
      setPostsLoading(true);
      apiClient<{ data: Post[] }>(`posts?author_id=${profile.id}&limit=20`)
        .then((res) => {
          if (res.data && Array.isArray((res.data as any).data)) {
            setPosts((res.data as any).data);
          } else if (Array.isArray(res.data)) {
            setPosts(res.data as any);
          }
        })
        .catch(() => setPosts([]))
        .finally(() => setPostsLoading(false));
    } else if (activeTab === 'followers') {
      setNetworkLoading(true);
      apiClient<{ data: Profile[] }>(`profiles/${profile.id}/followers`)
        .then((res) => {
          if (res.data && Array.isArray((res.data as any).data)) {
            setFollowers((res.data as any).data);
          }
        })
        .catch(() => setFollowers([]))
        .finally(() => setNetworkLoading(false));
    } else if (activeTab === 'following') {
      setNetworkLoading(true);
      apiClient<{ data: Profile[] }>(`profiles/${profile.id}/following`)
        .then((res) => {
          if (res.data && Array.isArray((res.data as any).data)) {
            setFollowing((res.data as any).data);
          }
        })
        .catch(() => setFollowing([]))
        .finally(() => setNetworkLoading(false));
    } else if (activeTab === 'courses') {
      setCreatorContentLoading(true);
      Promise.all([
        apiClient<Course[]>(`courses?instructor_id=${profile.id}&limit=20`),
        apiClient<{ data: CreatorChannel[] }>(`channels?owner_id=${profile.id}&limit=10`),
      ])
        .then(([coursesRes, channelsRes]) => {
          if (coursesRes.data && Array.isArray(coursesRes.data)) {
            setCourses(coursesRes.data);
          } else if (coursesRes.data && Array.isArray((coursesRes.data as any).data)) {
            setCourses((coursesRes.data as any).data);
          } else {
            setCourses([]);
          }

          if (channelsRes.data && Array.isArray((channelsRes.data as any).data)) {
            setChannels((channelsRes.data as any).data);
          } else if (channelsRes.data && Array.isArray(channelsRes.data)) {
            setChannels(channelsRes.data as any);
          } else {
            setChannels([]);
          }
        })
        .catch(() => {
          setCourses([]);
          setChannels([]);
        })
        .finally(() => setCreatorContentLoading(false));
    }
  }, [profile?.id, activeTab]);

  // Follow / Unfollow handler
  const handleToggleFollow = async () => {
    if (!profile || !currentUserId || isFollowLoading) return;

    setIsFollowLoading(true);
    const prevFollowing = !!profile.is_following;
    const prevCount = profile.follower_count || 0;

    // Optimistic UI update
    setProfile({
      ...profile,
      is_following: !prevFollowing,
      follower_count: prevFollowing ? Math.max(0, prevCount - 1) : prevCount + 1,
    });

    try {
      const res = await apiClient<{ isFollowing: boolean; followerCount: number }>(
        `profiles/${profile.id}/follow`,
        { method: 'POST' }
      );

      if (res.data) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                is_following: res.data!.isFollowing,
                follower_count: res.data!.followerCount,
              }
            : null
        );
      }
    } catch {
      // Rollback on failure
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              is_following: prevFollowing,
              follower_count: prevCount,
            }
          : null
      );
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const isOwnProfile = currentUserId === profile?.id;

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-xs text-slate-400 font-mono">Retrieving academic profile records...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !profile) {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto py-16 px-4">
          <EmptyState
            title="Scholar Not Found"
            description="The academic profile you are looking for does not exist, has been removed, or has changed username."
            actionLabel="Back to Knowledge Feed"
            onAction={() => (window.location.href = '/explore')}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6 pb-16">
        {/* Profile Banner & Identity Header */}
        <Card variant="elevated" className="overflow-hidden border-surface-border/80">
          {/* Header Cover Gradient */}
          <div className="h-32 sm:h-44 bg-gradient-to-r from-brand-indigo-950 via-slate-900 to-brand-violet-950 border-b border-surface-border/50 relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-indigo-500/10 via-transparent to-transparent" />
          </div>

          <div className="px-6 pb-6 pt-0 relative">
            {/* Avatar & Floating Actions Bar */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-16 sm:-mt-20 gap-4 mb-4">
              <div className="relative">
                <Avatar
                  src={profile.avatar_url}
                  name={profile.display_name}
                  size="xl"
                  className="w-24 h-24 sm:w-28 sm:h-28 ring-4 ring-surface-base shadow-xl text-2xl"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Share2 className="w-3.5 h-3.5" />}
                  onClick={handleShare}
                >
                  {copiedShare ? 'Copied Link!' : 'Share Profile'}
                </Button>

                {isOwnProfile ? (
                  <Link href="/profile/edit">
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                    >
                      Edit Profile
                    </Button>
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant={profile.is_following ? 'secondary' : 'primary'}
                    leftIcon={
                      profile.is_following ? (
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )
                    }
                    onClick={handleToggleFollow}
                    isLoading={isFollowLoading}
                  >
                    {profile.is_following ? 'Following' : 'Follow Scholar'}
                  </Button>
                )}
              </div>
            </div>

            {/* Profile Meta & Titles */}
            <div className="space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {profile.display_name}
                  </h1>
                  <Badge
                    roleType={profile.role}
                    isVerified={profile.verification_status === 'VERIFIED'}
                  />
                </div>
                <p className="text-xs sm:text-sm font-mono text-slate-400 mt-0.5">
                  @{profile.username}
                </p>
              </div>

              {profile.headline && (
                <p className="text-sm text-slate-200 font-medium leading-relaxed max-w-2xl">
                  {profile.headline}
                </p>
              )}

              {/* Stats Counters */}
              <div className="flex flex-wrap items-center gap-6 py-2 border-y border-surface-border/60 text-xs">
                <button
                  onClick={() => setActiveTab('posts')}
                  className="flex items-center gap-1.5 hover:text-brand-indigo-300 transition-colors"
                >
                  <span className="font-bold text-white text-sm">
                    {profile.posts_count ?? 0}
                  </span>
                  <span className="text-slate-400">Published Insights</span>
                </button>

                <button
                  onClick={() => setActiveTab('followers')}
                  className="flex items-center gap-1.5 hover:text-brand-indigo-300 transition-colors"
                >
                  <span className="font-bold text-white text-sm">
                    {profile.follower_count ?? 0}
                  </span>
                  <span className="text-slate-400">Followers</span>
                </button>

                <button
                  onClick={() => setActiveTab('following')}
                  className="flex items-center gap-1.5 hover:text-brand-indigo-300 transition-colors"
                >
                  <span className="font-bold text-white text-sm">
                    {profile.following_count ?? 0}
                  </span>
                  <span className="text-slate-400">Following</span>
                </button>
              </div>

              {/* External Scholarly & Web Links */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                {profile.github_url && (
                  <a
                    href={profile.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-white transition-colors"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>GitHub</span>
                  </a>
                )}
                {profile.linkedin_url && (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-brand-indigo-400 transition-colors"
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                    <span>LinkedIn</span>
                  </a>
                )}
                {profile.website_url && (
                  <a
                    href={profile.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Website</span>
                  </a>
                )}
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Scholar since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Profile Content Tabs */}
        <div className="space-y-4">
          <Tabs
            tabs={[
              { id: 'posts', label: 'Published Insights', count: profile.posts_count },
              { id: 'courses', label: 'Courses & Channels' },
              { id: 'about', label: 'Academic Credentials' },
              { id: 'followers', label: 'Followers', count: profile.follower_count },
              { id: 'following', label: 'Following', count: profile.following_count },
            ]}
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as any)}
          />

          {/* TAB 1: Published Posts */}
          {activeTab === 'posts' && (
            <div className="space-y-3">
              {postsLoading ? (
                <div className="py-12 flex justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : posts.length > 0 ? (
                posts.map((post) => (
                  <Card key={post.id} variant="default" className="hover:border-surface-border transition-all">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-surface-elevated text-brand-indigo-300 border border-surface-border">
                          {post.type}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <Link href={`/posts/${post.slug}`}>
                        <CardTitle className="text-base font-bold text-white hover:text-brand-indigo-300 transition-colors cursor-pointer mt-1">
                          {post.title}
                        </CardTitle>
                      </Link>
                    </CardHeader>
                    {post.summary && (
                      <CardContent className="pb-2">
                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                          {post.summary}
                        </p>
                      </CardContent>
                    )}
                    <CardFooter className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-surface-border/40">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1 text-emerald-400/90">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {post.upvote_count} Endorsements
                        </span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {post.comment_count} Discussions
                        </span>
                      </div>
                      <Link href={`/posts/${post.slug}`}>
                        <Button size="sm" variant="ghost" className="text-xs">
                          Read Article &rarr;
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <EmptyState
                  title="No published insights yet"
                  description="This scholar has not yet published peer tutorials, research articles, or project inquiries."
                />
              )}
            </div>
          )}

          {/* TAB 2: Courses & Channels */}
          {activeTab === 'courses' && (
            <div className="space-y-6">
              {creatorContentLoading ? (
                <div className="py-12 flex justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : (
                <>
                  {/* Channels Section */}
                  {channels.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <Radio className="w-4 h-4 text-emerald-400" />
                        Broadcast Channels ({channels.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {channels.map((ch) => (
                          <Card key={ch.id} variant="default" className="p-4 flex flex-col justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="font-bold text-white text-base hover:text-brand-indigo-300 transition-colors">
                                  {ch.name}
                                </h4>
                                <Badge variant="secondary" className="text-[10px]">
                                  {ch.subscriber_count} subscribers
                                </Badge>
                              </div>
                              {ch.description && (
                                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                                  {ch.description}
                                </p>
                              )}
                            </div>
                            <div className="mt-4 pt-3 border-t border-surface-border/50 flex items-center justify-between">
                              <span className="text-[11px] font-mono text-slate-400">/{ch.slug}</span>
                              <Link href={`/creator?channel=${ch.slug}`}>
                                <Button size="sm" variant="ghost" className="text-xs">
                                  Open Studio &rarr;
                                </Button>
                              </Link>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Courses Section */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-brand-indigo-400" />
                      Authored Curricula ({courses.length})
                    </h3>
                    {courses.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {courses.map((course) => (
                          <Card key={course.id} variant="default" className="p-4 flex flex-col justify-between hover:border-surface-border transition-all">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="text-[10px]">
                                  {course.level}
                                </Badge>
                                <span className="text-[11px] font-mono text-emerald-400">
                                  {course.tier === 'FREE' ? 'FREE' : `$${((course.price_cents || 0) / 100).toFixed(2)}`}
                                </span>
                              </div>
                              <Link href={`/courses/${course.id}`}>
                                <h4 className="font-bold text-white text-base hover:text-brand-indigo-300 transition-colors cursor-pointer">
                                  {course.title}
                                </h4>
                              </Link>
                              {course.summary && (
                                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                                  {course.summary}
                                </p>
                              )}
                            </div>
                            <div className="mt-4 pt-3 border-t border-surface-border/50 flex items-center justify-between text-xs text-slate-400">
                              <div className="flex items-center gap-3">
                                <span>{course.enrolled_count ?? 0} enrolled</span>
                              </div>
                              <Link href={`/courses/${course.id}`}>
                                <Button size="sm" variant="ghost" className="text-xs">
                                  View Syllabus &rarr;
                                </Button>
                              </Link>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : channels.length === 0 ? (
                      <EmptyState
                        title="No courses or channels yet"
                        description="This scholar has not yet published any learning curricula or broadcast channels."
                      />
                    ) : null}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: About & Academic Credentials */}
          {activeTab === 'about' && (
            <Card variant="default" className="space-y-6 p-6">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Scholar Biography
                </h3>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {profile.bio || 'No biography has been added by this scholar.'}
                </p>
              </div>

              {profile.skills && profile.skills.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Research Disciplines & Technical Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2.5 py-1 rounded-lg bg-surface-elevated text-xs font-mono text-slate-300 border border-surface-border"
                      >
                        #{skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* TAB 3: Followers */}
          {activeTab === 'followers' && (
            <div className="space-y-3">
              {networkLoading ? (
                <div className="py-12 flex justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : followers.length > 0 ? (
                followers.map((f) => (
                  <Card key={f.id} variant="default" className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar src={f.avatar_url} name={f.display_name} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/profile/${f.username}`}
                            className="font-semibold text-white text-sm hover:text-brand-indigo-300 transition-colors"
                          >
                            {f.display_name}
                          </Link>
                          <Badge roleType={f.role} className="text-[9px] px-1.5 py-0" />
                        </div>
                        <p className="text-[11px] text-slate-400">@{f.username}</p>
                      </div>
                    </div>
                    <Link href={`/profile/${f.username}`}>
                      <Button size="sm" variant="secondary">
                        View Scholar
                      </Button>
                    </Link>
                  </Card>
                ))
              ) : (
                <EmptyState
                  title="No followers yet"
                  description="When scholars follow this profile, they will be listed here."
                />
              )}
            </div>
          )}

          {/* TAB 4: Following */}
          {activeTab === 'following' && (
            <div className="space-y-3">
              {networkLoading ? (
                <div className="py-12 flex justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : following.length > 0 ? (
                following.map((f) => (
                  <Card key={f.id} variant="default" className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar src={f.avatar_url} name={f.display_name} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/profile/${f.username}`}
                            className="font-semibold text-white text-sm hover:text-brand-indigo-300 transition-colors"
                          >
                            {f.display_name}
                          </Link>
                          <Badge roleType={f.role} className="text-[9px] px-1.5 py-0" />
                        </div>
                        <p className="text-[11px] text-slate-400">@{f.username}</p>
                      </div>
                    </div>
                    <Link href={`/profile/${f.username}`}>
                      <Button size="sm" variant="secondary">
                        View Scholar
                      </Button>
                    </Link>
                  </Card>
                ))
              ) : (
                <EmptyState
                  title="Not following any scholars yet"
                  description="Scholars followed by this user will appear here."
                />
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
