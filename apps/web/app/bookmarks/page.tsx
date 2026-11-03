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
import type { Bookmark } from '@platform/types';
import {
  Bookmark as BookmarkIcon,
  Trash2,
  CheckCircle2,
  MessageSquare,
  BookOpen,
  ArrowRight,
} from 'lucide-react';

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient<{ data: Bookmark[] }>('bookmarks?limit=50');
      if (res.data) {
        const bms = (res.data as any).data || res.data;
        if (Array.isArray(bms)) {
          setBookmarks(bms);
        }
      }
    } catch {
      setBookmarks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const handleRemoveBookmark = async (postId: string) => {
    try {
      await apiClient(`posts/${postId}/bookmarks`, { method: 'POST', body: JSON.stringify({}) });
      setBookmarks((prev) => prev.filter((b) => b.post_id !== postId));
    } catch {
      // Ignored
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6 pb-16">
        {/* Header */}
        <div className="pb-2 border-b border-surface-border/60">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BookmarkIcon className="w-6 h-6 text-brand-indigo-400" /> Reading List & Saved Insights
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Scholarly articles, peer tutorials, and research preprints saved for offline study and reference.
          </p>
        </div>

        {/* Bookmarks List */}
        <div className="space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <LoadingSpinner size="lg" />
              <p className="text-xs text-slate-400 font-mono">Loading your reading list...</p>
            </div>
          ) : bookmarks.length > 0 ? (
            bookmarks.map((bm) => {
              const post = bm.post;
              if (!post) return null;

              return (
                <Card
                  key={bm.id}
                  className="hover:border-surface-border transition-all border-surface-border/70"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-4">
                      {post.author ? (
                        <Link
                          href={`/profile/${post.author.username}`}
                          className="flex items-center gap-2 group"
                        >
                          <Avatar
                            src={post.author.avatar_url}
                            name={post.author.display_name}
                            size="sm"
                          />
                          <span className="font-semibold text-white text-xs group-hover:text-brand-indigo-300 transition-colors">
                            {post.author.display_name}
                          </span>
                          <Badge
                            roleType={post.author.role}
                            isVerified={post.author.verification_status === 'VERIFIED'}
                            className="text-[8px] px-1 py-0"
                          />
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">Anonymous Scholar</span>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-amber-300 border border-amber-500/30">
                          {bm.collection_name || 'Reading List'}
                        </span>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-surface-elevated text-brand-indigo-300 border border-surface-border">
                          {post.type}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    <Link href={`/posts/${post.slug}`}>
                      <h2 className="text-base font-bold text-white hover:text-brand-indigo-300 transition-colors cursor-pointer">
                        {post.title}
                      </h2>
                    </Link>

                    {post.summary && (
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                        {post.summary}
                      </p>
                    )}

                    {bm.notes && (
                      <p className="text-[11px] text-amber-200/90 italic bg-amber-950/20 p-2 rounded-lg border border-amber-500/20">
                        Note: {bm.notes}
                      </p>
                    )}
                  </CardContent>

                  <CardFooter className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-surface-border/40">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 text-emerald-400/90">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {post.upvote_count || 0} Endorsements
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {post.comment_count || 0} Discussions
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRemoveBookmark(post.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-surface-elevated transition-colors"
                        title="Remove from reading list"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <Link href={`/posts/${post.slug}`}>
                        <Button size="sm" variant="ghost" className="text-xs">
                          Read Now &rarr;
                        </Button>
                      </Link>
                    </div>
                  </CardFooter>
                </Card>
              );
            })
          ) : (
            <EmptyState
              title="Reading List is empty"
              description="Save interesting tutorials, papers, and code snippets from the Knowledge Feed to reference later."
              actionLabel="Discover Knowledge"
              onAction={() => (window.location.href = '/explore')}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
