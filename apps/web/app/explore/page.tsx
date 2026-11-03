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
import { CodeBlock } from '@/components/ui/code-block';
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
  Send,
  X,
  TrendingUp,
  ShieldCheck,
  Award,
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

  // New Post Composer State
  const [isComposing, setIsComposing] = useState(false);
  const [composeTitle, setComposeTitle] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [composeType, setComposeType] = useState<'ARTICLE' | 'TUTORIAL' | 'QUESTION' | 'DISCUSSION'>('ARTICLE');
  const [composeCategory, setComposeCategory] = useState('systems');
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);

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

  // Handle Post Publishing
  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTitle.trim() || !composeContent.trim()) return;

    if (!currentUserId) {
      setActionFeedback('Please sign in to publish a knowledge post.');
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }

    setIsSubmittingPost(true);
    try {
      const slug = composeTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
        .slice(0, 80) + `-${Date.now().toString(36)}`;

      const res = await apiClient<Post>('posts', {
        method: 'POST',
        body: JSON.stringify({
          title: composeTitle.trim(),
          slug,
          content: composeContent.trim(),
          type: composeType,
          category: composeCategory,
        }),
      });

      if (res.data) {
        setPosts((prev) => [res.data!, ...prev]);
        setComposeTitle('');
        setComposeContent('');
        setIsComposing(false);
        setActionFeedback('Insight published successfully to the Knowledge Feed!');
        setTimeout(() => setActionFeedback(null), 4000);
      }
    } catch (err: any) {
      setActionFeedback(err.message || 'Failed to publish post.');
      setTimeout(() => setActionFeedback(null), 4000);
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'TUTORIAL':
        return <Code2 className="w-3.5 h-3.5 text-brand-indigo-400" />;
      case 'ARTICLE':
        return <BookOpen className="w-3.5 h-3.5 text-brand-cyan-400" />;
      case 'QUESTION':
        return <HelpCircle className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <FolderGit2 className="w-3.5 h-3.5 text-brand-emerald-400" />;
    }
  };

  // Right-side Academic Scaffolding Panel (Stitch Design)
  const rightAside = (
    <div className="space-y-6">
      {/* Knowledge Grounding Standard */}
      <Card variant="elevated" className="border-brand-indigo-500/30 p-5 space-y-3">
        <div className="flex items-center gap-2 text-brand-indigo-300 font-semibold text-xs tracking-wide uppercase">
          <ShieldCheck className="w-4 h-4 text-brand-indigo-400" />
          Academic Grounding Standard
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Learnova replaces engagement algorithms with <span className="text-white font-semibold">peer accuracy verification</span>.
          Educators and researchers mathematically validate preprints and insights before they reach student curriculums.
        </p>
        <div className="pt-2 border-t border-surface-border/60 flex items-center justify-between text-[11px] text-slate-400">
          <span>Your Role:</span>
          <Badge roleType={currentUserRole as any} isVerified={currentUserRole !== 'STUDENT'} />
        </div>
      </Card>

      {/* Trending Research Focus */}
      <Card variant="elevated" className="border-surface-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-brand-cyan-400" /> Trending Topics
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Peer-Curated</span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            { tag: 'distributed-systems', label: 'Distributed Systems' },
            { tag: 'flash-attention', label: 'FlashAttention-3' },
            { tag: 'formal-methods', label: 'TLA+ Verification' },
            { tag: 'byzantine-faults', label: 'Byzantine Faults' },
            { tag: 'compilers', label: 'Rust Compiler Kernels' },
            { tag: 'neural-networks', label: 'Transformer Attention' },
          ].map((item) => (
            <button
              key={item.tag}
              onClick={() => {
                setSearchQuery(item.tag);
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-surface-subtle hover:bg-surface-elevated border border-surface-border text-slate-300 hover:text-brand-cyan-300 transition-colors"
            >
              #{item.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Top Endorsed Scholars */}
      <Card variant="elevated" className="border-surface-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-400" /> Top Endorsed Scholars
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Accuracy &gt; 95%</span>
        </div>
        <div className="space-y-3 pt-1">
          {[
            {
              name: 'Prof. Marcus Vance',
              username: 'marcus_vance',
              role: 'EDUCATOR' as const,
              inst: 'Carnegie Mellon University',
              endorsements: '2,480',
            },
            {
              name: 'Dr. Sarah Lin',
              username: 'sarah_lin',
              role: 'RESEARCHER' as const,
              inst: 'Stanford AI Lab',
              endorsements: '3,120',
            },
            {
              name: 'Dr. Elena Rostova',
              username: 'elena_rostova',
              role: 'RESEARCHER' as const,
              inst: 'ETH Zurich',
              endorsements: '1,890',
            },
          ].map((scholar) => (
            <Link
              key={scholar.username}
              href={`/profile/${scholar.username}`}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-subtle/60 transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={scholar.name} size="sm" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate group-hover:text-brand-indigo-300 transition-colors">
                    {scholar.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{scholar.inst}</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                {scholar.endorsements} ✓
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <AppShell rightAside={rightAside}>
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

        {/* Global Feedback Banner */}
        {actionFeedback && (
          <div className="p-3 rounded-xl bg-brand-indigo-950/70 border border-brand-indigo-500/40 text-xs text-brand-indigo-200 flex items-center gap-2 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-brand-indigo-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Inline Post Composer (Stitch Design) */}
        {isComposing ? (
          <Card variant="elevated" className="border-brand-indigo-500/40 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-border/60 pb-3">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-brand-indigo-400" /> Publish Knowledge Insight
              </span>
              <button
                type="button"
                onClick={() => setIsComposing(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-elevated transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePublishPost} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Insight Title or Thesis
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Formal Proof of Safety in Raft Consensus under Network Partitions"
                  value={composeTitle}
                  onChange={(e) => setComposeTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle/80 border border-surface-border text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-indigo-500 focus:ring-1 focus:ring-brand-indigo-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Publication Type
                  </label>
                  <select
                    value={composeType}
                    onChange={(e) => setComposeType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-subtle/80 border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500"
                  >
                    <option value="ARTICLE">Research Article</option>
                    <option value="TUTORIAL">Educational Tutorial</option>
                    <option value="QUESTION">Academic Inquiry / Question</option>
                    <option value="DISCUSSION">Peer Discussion</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Academic Field
                  </label>
                  <select
                    value={composeCategory}
                    onChange={(e) => setComposeCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-subtle/80 border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500"
                  >
                    <option value="systems">Distributed Systems</option>
                    <option value="ai">AI & Machine Learning</option>
                    <option value="cs">Computer Science</option>
                    <option value="math">Mathematics & Logic</option>
                    <option value="security">Information Security</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Insight Content (Supports Markdown & Code)
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain the mathematical formulation, proof invariant, or architectural solution..."
                  value={composeContent}
                  onChange={(e) => setComposeContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle/80 border border-surface-border text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-indigo-500 focus:ring-1 focus:ring-brand-indigo-500 transition-all font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsComposing(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  isLoading={isSubmittingPost}
                  rightIcon={<Send className="w-3.5 h-3.5" />}
                >
                  Publish to Peer Network
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <div
            onClick={() => setIsComposing(true)}
            className="p-4 rounded-2xl border border-surface-border/80 bg-surface-card/60 hover:bg-surface-elevated/40 hover:border-brand-indigo-500/40 cursor-pointer transition-all flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <Avatar name="Scholar" size="sm" />
              <span className="text-xs text-slate-400">
                Share a research insight, mathematical derivation, or peer inquiry...
              </span>
            </div>
            <Button size="sm" variant="secondary" leftIcon={<PlusCircle className="w-3.5 h-3.5" />}>
              Create Insight
            </Button>
          </div>
        )}

        {/* Feed Sorting & Discipline Navigation */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 p-1 bg-surface-elevated/50 rounded-xl border border-surface-border text-xs">
              <button
                onClick={() => setActiveSort('recent')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeSort === 'recent'
                    ? 'bg-brand-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Chronological
              </button>
              <button
                onClick={() => setActiveSort('endorsed')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeSort === 'endorsed'
                    ? 'bg-brand-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Most Endorsed
              </button>
              <button
                onClick={() => setActiveSort('following')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeSort === 'following'
                    ? 'bg-brand-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Following Scholars
              </button>
            </div>

            {/* Filter Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search feed topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-surface-card border border-surface-border text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-indigo-500"
              />
            </div>
          </div>

          {/* Academic Categories Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === c.id
                    ? 'bg-white text-slate-900 font-semibold shadow-sm'
                    : 'bg-surface-elevated/40 text-slate-400 hover:text-slate-200 hover:bg-surface-elevated border border-surface-border/50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feed Posts List */}
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
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white text-sm group-hover:text-brand-indigo-300 transition-colors">
                              {post.author.display_name}
                            </span>
                            {post.author.role && (
                              <Badge roleType={post.author.role as any} isVerified={post.author.role !== 'STUDENT'} />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {post.author.headline || `@${post.author.username}`}
                          </p>
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Avatar name="Anonymous Scholar" size="sm" />
                        <span className="text-xs text-slate-400">Anonymous Scholar</span>
                      </div>
                    )}

                    {/* Post Type & Category Badges */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-elevated text-slate-300 border border-surface-border flex items-center gap-1">
                        {getPostTypeIcon(post.type)} {post.type}
                      </span>
                    </div>
                  </div>

                  <Link href={`/posts/${post.slug}`} className="block group pt-2">
                    <CardTitle className="text-lg font-bold text-white group-hover:text-brand-indigo-400 transition-colors leading-snug">
                      {post.title}
                    </CardTitle>
                  </Link>
                </CardHeader>

                <CardContent className="space-y-3">
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-3">
                    {post.content}
                  </p>

                  {/* Code snippet rendering if post contains code block */}
                  {post.content.includes('```') && (
                    <CodeBlock
                      code={post.content.split('```')[1]?.replace(/^[a-z]+\n/, '') || ''}
                      language={post.content.split('```')[1]?.split('\n')[0] || 'typescript'}
                    />
                  )}

                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-subtle text-slate-400 border border-surface-border/50"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-surface-border/50">
                  <div className="flex items-center gap-3">
                    {/* Accuracy Endorsement Button */}
                    <button
                      onClick={() => handleToggleInteraction(post.id, 'ENDORSE_ACCURACY')}
                      aria-label="Endorse accuracy of this post"
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                        post.user_interactions?.has_endorsed
                          ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300 font-semibold'
                          : 'border-surface-border hover:border-emerald-500/30 text-slate-300 hover:text-emerald-300 hover:bg-surface-elevated'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 ${
                          post.user_interactions?.has_endorsed
                            ? 'text-emerald-400 fill-emerald-400/20'
                            : 'text-emerald-400'
                        }`}
                      />
                      <span className="hidden sm:inline text-[11px]">
                        {post.user_interactions?.has_endorsed ? 'Endorsed' : 'Endorse'}
                      </span>
                    </button>

                    {/* Insightful Upvote Button */}
                    <button
                      onClick={() => handleToggleInteraction(post.id, 'UPVOTE_INSIGHTFUL')}
                      aria-label="Mark insight as valuable"
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                        post.user_interactions?.has_upvoted
                          ? 'border-brand-indigo-500/50 bg-brand-indigo-950/40 text-brand-indigo-300 font-semibold'
                          : 'border-surface-border hover:border-brand-indigo-500/30 text-slate-300 hover:text-brand-indigo-300 hover:bg-surface-elevated'
                      }`}
                    >
                      <Sparkles
                        className={`w-3.5 h-3.5 ${
                          post.user_interactions?.has_upvoted
                            ? 'text-brand-indigo-400 fill-brand-indigo-400/20'
                            : 'text-brand-indigo-400'
                        }`}
                      />
                      <span className="font-mono text-xs">{post.upvote_count || 0}</span>
                      <span className="hidden sm:inline text-[11px]">Insightful</span>
                    </button>

                    {/* Comments Count */}
                    <Link
                      href={`/posts/${post.slug}#discussion`}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-surface-elevated text-slate-400 hover:text-white transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="font-mono text-xs">{post.comment_count || 0}</span>
                      <span className="hidden sm:inline text-[11px]">Discussions</span>
                    </Link>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Bookmark Action */}
                    <button
                      onClick={() => handleToggleBookmark(post.id)}
                      aria-label="Save to bookmarks"
                      className={`p-1.5 rounded-lg border transition-all ${
                        post.user_interactions?.has_bookmarked
                          ? 'border-brand-cyan-500/50 bg-brand-cyan-950/40 text-brand-cyan-300'
                          : 'border-surface-border hover:border-surface-border text-slate-400 hover:text-white hover:bg-surface-elevated'
                      }`}
                    >
                      <Bookmark
                        className={`w-4 h-4 ${
                          post.user_interactions?.has_bookmarked
                            ? 'fill-brand-cyan-400 text-brand-cyan-400'
                            : ''
                        }`}
                      />
                    </button>

                    {/* View Full Insight Link */}
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
              icon={Compass}
              title="No knowledge posts found"
              description="No publications match your selected discipline or filter criteria. Be the first scholar to publish an insight."
              actionLabel="Publish First Insight"
              onAction={() => setIsComposing(true)}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
