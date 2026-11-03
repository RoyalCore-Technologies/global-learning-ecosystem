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
import type { Post } from '@platform/types';
import {
  Compass,
  CheckCircle2,
  MessageSquare,
  Bookmark,
  Share2,
  Filter,
  Sparkles,
  Search,
  BookOpen,
  Code2,
  HelpCircle,
  FolderGit2,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';

export default function ExploreFeedPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeType, setActiveType] = useState<string>('ALL');
  const [activeSort, setActiveSort] = useState<'recent' | 'endorsed' | 'following'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('STUDENT');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'All Knowledge' },
    { id: 'systems', label: 'Distributed Systems' },
    { id: 'ai', label: 'AI & Machine Learning' },
    { id: 'cs', label: 'Computer Science' },
    { id: 'math', label: 'Mathematics & Logic' },
    { id: 'research', label: 'Peer Review Preprints' },
  ];

  // 1. Fetch current session
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

  // 2. Fetch real posts from backend
  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const typeParam = activeType !== 'ALL' ? `&type=${activeType}` : '';
      const tagParam = activeCategory !== 'all' ? `&tag=${activeCategory}` : '';
      const searchParam = searchQuery.trim() ? `&search=${encodeURIComponent(searchQuery.trim())}` : '';

      const res = await apiClient<{ data: Post[] }>(
        `posts?feed=${activeSort}${typeParam}${tagParam}${searchParam}&limit=25`
      );

      if (res.data && Array.isArray((res.data as any).data)) {
        setPosts((res.data as any).data);
      } else if (Array.isArray(res.data)) {
        setPosts(res.data as any);
      } else {
        setPosts([]);
      }
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [activeSort, activeType, activeCategory, searchQuery]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Handle Academic Endorsement & Insightful Votes
  const handleToggleInteraction = async (postId: string, type: 'UPVOTE_INSIGHTFUL' | 'ENDORSE_ACCURACY') => {
    if (!currentUserId) {
      setActionFeedback('Please sign in to endorse or upvote knowledge posts.');
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
      const res = await apiClient<{ isInteracted: boolean }>(`posts/${postId}/interactions`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      });

      if (res.data) {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== postId) return p;
            const diff = res.data!.isInteracted ? 1 : -1;
            return {
              ...p,
              upvote_count: Math.max(0, (p.upvote_count || 0) + diff),
              user_interactions: {
                has_upvoted: type === 'UPVOTE_INSIGHTFUL' ? res.data!.isInteracted : !!p.user_interactions?.has_upvoted,
                has_endorsed: type === 'ENDORSE_ACCURACY' ? res.data!.isInteracted : !!p.user_interactions?.has_endorsed,
                has_bookmarked: !!p.user_interactions?.has_bookmarked,
              },
            };
          })
        );
      }
    } catch (err: any) {
      setActionFeedback(err.message || 'Failed to record interaction.');
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  // Handle Bookmarks
  const handleToggleBookmark = async (postId: string) => {
    if (!currentUserId) {
      setActionFeedback('Please sign in to bookmark posts.');
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }

    try {
      const res = await apiClient<{ isBookmarked: boolean }>(`posts/${postId}/bookmarks`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (res.data) {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== postId) return p;
            return {
              ...p,
              user_interactions: {
                has_upvoted: !!p.user_interactions?.has_upvoted,
                has_endorsed: !!p.user_interactions?.has_endorsed,
                has_bookmarked: res.data!.isBookmarked,
              },
            };
          })
        );
        setActionFeedback(res.data.isBookmarked ? 'Saved to reading list.' : 'Removed from reading list.');
        setTimeout(() => setActionFeedback(null), 2500);
      }
    } catch (err: any) {
      setActionFeedback(err.message || 'Failed to bookmark post.');
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto pb-16">
        {/* Knowledge Feed Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border/60">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Compass className="w-6 h-6 text-brand-indigo-400" /> Knowledge Feed
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Curated educational content verified through peer accuracy endorsements.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={activeType === 'ALL' ? 'primary' : 'outline'}
              onClick={() => setActiveType('ALL')}
            >
              All Types
            </Button>
            <Button
              size="sm"
              variant={activeType === 'TUTORIAL' ? 'primary' : 'outline'}
              onClick={() => setActiveType('TUTORIAL')}
            >
              Tutorials
            </Button>
            <Button
              size="sm"
              variant={activeType === 'ARTICLE' ? 'primary' : 'outline'}
              onClick={() => setActiveType('ARTICLE')}
            >
              Articles
            </Button>
            <Button
              size="sm"
              variant={activeType === 'QUESTION' ? 'primary' : 'outline'}
              onClick={() => setActiveType('QUESTION')}
            >
              Questions
            </Button>
          </div>
        </div>

        {/* Global Action Toast Banner */}
        {actionFeedback && (
          <div className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border flex items-center gap-2 text-xs text-brand-indigo-200">
            <AlertCircle className="w-4 h-4 text-brand-indigo-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Academic Discipline Tabs */}
        <Tabs
          tabs={categories}
          activeTab={activeCategory}
          onChange={(id) => setActiveCategory(id)}
        />

        {/* Feed Sorting & Search Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-elevated/40 p-3 rounded-2xl border border-surface-border">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveSort('recent')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeSort === 'recent'
                  ? 'bg-brand-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-surface-elevated'
              }`}
            >
              Recent Discourse
            </button>
            <button
              onClick={() => setActiveSort('endorsed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeSort === 'endorsed'
                  ? 'bg-brand-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-surface-elevated'
              }`}
            >
              Peer Endorsed
            </button>
            <button
              onClick={() => setActiveSort('following')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeSort === 'following'
                  ? 'bg-brand-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-surface-elevated'
              }`}
            >
              Following
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search concepts or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-56 h-8 pl-8 pr-3 rounded-xl bg-surface-base border border-surface-border text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-indigo-500"
            />
          </div>
        </div>

        {/* Knowledge Posts Stream */}
        <div className="space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <LoadingSpinner size="lg" />
              <p className="text-xs text-slate-400 font-mono">Fetching latest peer knowledge...</p>
            </div>
          ) : posts.length > 0 ? (
            posts.map((post) => (
              <Card
                key={post.id}
                className="hover:border-surface-border transition-all border-surface-border/70"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-4">
                    {/* Author Attribution */}
                    {post.author ? (
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
                          <p className="text-[10px] text-slate-400">
                            @{post.author.username} {post.author.headline ? `· ${post.author.headline}` : ''}
                          </p>
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Avatar name="Learner" size="md" />
                        <span className="text-xs text-slate-400">Anonymous Scholar</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-surface-elevated text-brand-indigo-300 border border-surface-border">
                        {post.type}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <Link href={`/posts/${post.slug}`}>
                    <h2 className="text-base sm:text-lg font-bold text-white leading-snug hover:text-brand-indigo-300 transition-colors cursor-pointer">
                      {post.title}
                    </h2>
                  </Link>

                  {post.summary && (
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                      {post.summary}
                    </p>
                  )}

                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-subtle text-slate-400 border border-surface-border"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-surface-border/50">
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Academic Accuracy Endorsement Button */}
                    <button
                      onClick={() => handleToggleInteraction(post.id, 'ENDORSE_ACCURACY')}
                      className={`flex items-center gap-1.5 transition-colors font-medium ${
                        post.user_interactions?.has_endorsed
                          ? 'text-emerald-400'
                          : 'hover:text-emerald-400 text-slate-400'
                      }`}
                      title="Academic accuracy endorsement (Educators & Researchers)"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{post.upvote_count || 0} Endorsements</span>
                    </button>

                    {/* Insightful Vote Button */}
                    <button
                      onClick={() => handleToggleInteraction(post.id, 'UPVOTE_INSIGHTFUL')}
                      className={`flex items-center gap-1.5 transition-colors ${
                        post.user_interactions?.has_upvoted
                          ? 'text-brand-indigo-400 font-semibold'
                          : 'hover:text-brand-indigo-400 text-slate-400'
                      }`}
                      title="Mark post as insightful"
                    >
                      <Sparkles className="w-4 h-4 text-brand-indigo-400" />
                      <span>Insightful</span>
                    </button>

                    {/* Discussion Link */}
                    <Link
                      href={`/posts/${post.slug}`}
                      className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
                      title="Comments & Discussion"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{post.comment_count || 0} Discussions</span>
                    </Link>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleBookmark(post.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        post.user_interactions?.has_bookmarked
                          ? 'text-amber-400 bg-surface-elevated'
                          : 'text-slate-400 hover:text-white hover:bg-surface-elevated'
                      }`}
                      title="Bookmark post"
                    >
                      <Bookmark className="w-4 h-4" />
                    </button>
                    <Link href={`/posts/${post.slug}`}>
                      <Button size="sm" variant="ghost" className="text-xs h-7 px-2">
                        Read &rarr;
                      </Button>
                    </Link>
                  </div>
                </CardFooter>
              </Card>
            ))
          ) : (
            <EmptyState
              title="No posts found in this feed"
              description="Be the first educator or researcher to publish a verified tutorial, article, or inquiry in this field."
              actionLabel="Reset Search & Filters"
              onAction={() => {
                setActiveCategory('all');
                setActiveType('ALL');
                setActiveSort('recent');
                setSearchQuery('');
              }}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
