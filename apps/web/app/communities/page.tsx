'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/feedback';
import { apiClient, ApiError } from '@/lib/api-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Community, CreatorChannel } from '@platform/types';
import {
  Users,
  PlusCircle,
  MessageSquare,
  Search,
  Lock,
  Globe,
  Radio,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Shield,
  CheckCircle2,
  Tv,
} from 'lucide-react';

export default function CommunitiesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; name: string } | null>(null);

  // View Mode: Communities vs Creator Channels
  const [activeTab, setActiveTab] = useState<'COMMUNITIES' | 'CHANNELS'>('COMMUNITIES');

  // Communities State
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoadingCommunities, setIsLoadingCommunities] = useState(true);
  const [communitiesError, setCommunitiesError] = useState<string | null>(null);

  // Channels State
  const [channels, setChannels] = useState<CreatorChannel[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState<'ALL' | 'PUBLIC' | 'PRIVATE'>('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 8;

  // Create Community Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCommName, setNewCommName] = useState('');
  const [newCommSlug, setNewCommSlug] = useState('');
  const [newCommDesc, setNewCommDesc] = useState('');
  const [newCommIsPrivate, setNewCommIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Check auth status
  useEffect(() => {
    async function checkUser() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profileRes = await apiClient<{ role: string; display_name: string }>('profiles/me');
          setCurrentUser({
            id: session.user.id,
            role: profileRes.data?.role || 'STUDENT',
            name: profileRes.data?.display_name || session.user.email?.split('@')[0] || 'User',
          });
        }
      } catch {
        setCurrentUser(null);
      }
    }
    checkUser();
  }, []);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch Communities
  const fetchCommunities = useCallback(async () => {
    setIsLoadingCommunities(true);
    setCommunitiesError(null);

    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', limit.toString());

    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    }
    if (privacyFilter === 'PUBLIC') {
      params.set('is_private', 'false');
    } else if (privacyFilter === 'PRIVATE') {
      params.set('is_private', 'true');
    }

    try {
      const res = await apiClient<Community[]>(`communities?${params.toString()}`);
      if (res.success && Array.isArray(res.data)) {
        setCommunities(res.data);
        setTotal((res as any).total ?? res.data.length);
      } else {
        setCommunities([]);
        setTotal(0);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setCommunitiesError(apiErr.message || 'Failed to retrieve academic communities.');
    } finally {
      setIsLoadingCommunities(false);
    }
  }, [page, limit, debouncedSearch, privacyFilter]);

  // Fetch Channels
  const fetchChannels = useCallback(async () => {
    setIsLoadingChannels(true);
    setChannelsError(null);

    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', limit.toString());
    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    }

    try {
      const res = await apiClient<CreatorChannel[]>(`channels?${params.toString()}`);
      if (res.success && Array.isArray(res.data)) {
        setChannels(res.data);
        setTotal((res as any).total ?? res.data.length);
      } else {
        setChannels([]);
        setTotal(0);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setChannelsError(apiErr.message || 'Failed to retrieve creator channels.');
    } finally {
      setIsLoadingChannels(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    if (activeTab === 'COMMUNITIES') {
      fetchCommunities();
    } else {
      fetchChannels();
    }
  }, [activeTab, fetchCommunities, fetchChannels]);

  // Handle Community Creation
  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      router.push('/auth/login?next=/communities');
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);

    try {
      const res = await apiClient<Community>('communities', {
        method: 'POST',
        body: JSON.stringify({
          name: newCommName.trim(),
          slug: newCommSlug.trim() || undefined,
          description: newCommDesc.trim() || undefined,
          is_private: newCommIsPrivate,
        }),
      });

      if (res.success && res.data) {
        setIsCreateModalOpen(false);
        setNewCommName('');
        setNewCommSlug('');
        setNewCommDesc('');
        setNewCommIsPrivate(false);
        router.push(`/communities/${res.data.slug}`);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setCreateError(apiErr.message || 'Failed to create community.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border/60">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-brand-cyan-400" /> Academic Communities &amp; Channels
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Domain-specific study groups and broadcast academies dedicated to deep technical inquiry.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={activeTab === 'COMMUNITIES' ? 'primary' : 'ghost'}
              onClick={() => {
                setActiveTab('COMMUNITIES');
                setPage(1);
              }}
              leftIcon={<Users className="w-3.5 h-3.5" />}
            >
              Study Circles
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'CHANNELS' ? 'primary' : 'ghost'}
              onClick={() => {
                setActiveTab('CHANNELS');
                setPage(1);
              }}
              leftIcon={<Radio className="w-3.5 h-3.5" />}
            >
              Broadcast Channels
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
              onClick={() => {
                if (!currentUser) {
                  router.push('/auth/login?next=/communities');
                } else {
                  setIsCreateModalOpen(true);
                }
              }}
            >
              New Circle
            </Button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-card border border-surface-border/80 p-3 rounded-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={activeTab === 'COMMUNITIES' ? 'Search study circles by title or topics...' : 'Search creator channels...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-cyan-500 transition-colors"
            />
          </div>

          {activeTab === 'COMMUNITIES' && (
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-[11px] text-slate-400 font-medium mr-1">Privacy:</span>
              <button
                type="button"
                onClick={() => { setPrivacyFilter('ALL'); setPage(1); }}
                className={`text-[11px] px-2.5 py-1 rounded-md transition-all ${
                  privacyFilter === 'ALL'
                    ? 'bg-brand-cyan-500/20 text-brand-cyan-300 font-medium border border-brand-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => { setPrivacyFilter('PUBLIC'); setPage(1); }}
                className={`text-[11px] px-2.5 py-1 rounded-md transition-all ${
                  privacyFilter === 'PUBLIC'
                    ? 'bg-brand-cyan-500/20 text-brand-cyan-300 font-medium border border-brand-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Public
              </button>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => { setPrivacyFilter('PRIVATE'); setPage(1); }}
                  className={`text-[11px] px-2.5 py-1 rounded-md transition-all ${
                    privacyFilter === 'PRIVATE'
                      ? 'bg-brand-cyan-500/20 text-brand-cyan-300 font-medium border border-brand-cyan-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  My Private Circles
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content Section: Communities */}
        {activeTab === 'COMMUNITIES' && (
          <div>
            {isLoadingCommunities ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="border-surface-border">
                    <CardHeader className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="w-8 h-8 rounded-lg" />
                        <Skeleton className="w-16 h-4" />
                      </div>
                      <Skeleton className="w-3/4 h-5" />
                      <Skeleton className="w-full h-12" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : communitiesError ? (
              <ErrorState
                title="Error Loading Circles"
                message={communitiesError}
                onRetry={fetchCommunities}
              />
            ) : communities.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No Academic Circles Found"
                description={
                  debouncedSearch
                    ? `No communities matching "${debouncedSearch}". Try broadening your query.`
                    : 'Be the first to establish a collaborative academic study circle.'
                }
                actionLabel={currentUser ? 'Create Study Circle' : 'Sign in to Create'}
                onAction={() => {
                  if (currentUser) setIsCreateModalOpen(true);
                  else router.push('/auth/login?next=/communities');
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {communities.map((c) => (
                  <Card
                    key={c.id}
                    className="border-surface-border hover:border-brand-cyan-500/40 transition-all flex flex-col justify-between"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="p-2.5 rounded-xl bg-brand-cyan-950/40 border border-brand-cyan-500/30 text-brand-cyan-400">
                          {c.is_private ? <Lock className="w-4 h-4 text-amber-400" /> : <Globe className="w-4 h-4" />}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {c.is_private ? (
                            <Badge variant="warning" className="text-[10px]">Private</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Public</Badge>
                          )}
                          <span className="text-xs text-slate-400 font-medium">
                            {c.member_count} {c.member_count === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                      </div>
                      <CardTitle className="text-base text-white pt-2 leading-snug">
                        {c.name}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {c.description || 'Dedicated academic inquiry group.'}
                      </CardDescription>
                    </CardHeader>

                    <CardFooter className="pt-3 border-t border-surface-border/60 flex items-center justify-between">
                      <div className="text-[11px] text-slate-400">
                        {c.creator ? `By ${c.creator.display_name}` : 'Community Lead'}
                      </div>
                      <Link href={`/communities/${c.slug}`}>
                        <Button size="sm" variant="ghost" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                          Explore Circle
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content Section: Creator Channels */}
        {activeTab === 'CHANNELS' && (
          <div>
            {isLoadingChannels ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="border-surface-border">
                    <CardHeader className="space-y-2">
                      <Skeleton className="w-8 h-8 rounded-lg" />
                      <Skeleton className="w-1/2 h-5" />
                      <Skeleton className="w-full h-10" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : channelsError ? (
              <ErrorState
                title="Error Loading Channels"
                message={channelsError}
                onRetry={fetchChannels}
              />
            ) : channels.length === 0 ? (
              <EmptyState
                icon={Radio}
                title="No Creator Channels Found"
                description="Verified educators and creators publish technical masterclasses on broadcast channels."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {channels.map((ch) => (
                  <Card
                    key={ch.id}
                    className="border-surface-border hover:border-brand-cyan-500/40 transition-all flex flex-col justify-between"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-400">
                          <Radio className="w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          {ch.is_verified && (
                            <Badge variant="success" className="text-[10px]">Verified Channel</Badge>
                          )}
                          <span className="text-xs text-slate-400 font-medium">
                            {ch.subscriber_count} {ch.subscriber_count === 1 ? 'subscriber' : 'subscribers'}
                          </span>
                        </div>
                      </div>
                      <CardTitle className="text-base text-white pt-2 leading-snug">
                        {ch.name}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {ch.description || 'Official technical broadcast channel.'}
                      </CardDescription>
                    </CardHeader>

                    <CardFooter className="pt-3 border-t border-surface-border/60 flex items-center justify-between">
                      <div className="text-[11px] text-slate-400">
                        {ch.owner ? `Owner: ${ch.owner.display_name}` : 'Broadcaster'}
                      </div>
                      <Link href={`/creator?channel=${ch.slug}`}>
                        <Button size="sm" variant="ghost" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                          View Channel
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-surface-border/60 text-xs text-slate-400">
            <div>
              Showing page <span className="text-white font-medium">{page}</span> of{' '}
              <span className="text-white font-medium">{totalPages}</span> ({total} total)
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Create Community Dialog */}
        <Dialog
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Academic Study Circle"
          description="Establish an inquiry group dedicated to rigorous software engineering and computing sciences."
          maxWidth="md"
        >
          <form onSubmit={handleCreateCommunity} className="space-y-4 pt-2">
            {createError && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-lg">
                {createError}
              </div>
            )}

            <div>
              <label htmlFor="comm-name" className="block text-xs font-medium text-slate-300 mb-1">
                Circle Name *
              </label>
              <input
                id="comm-name"
                type="text"
                required
                minLength={3}
                maxLength={80}
                placeholder="e.g. Distributed Consensus Systems"
                value={newCommName}
                onChange={(e) => setNewCommName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded-lg text-white focus:outline-none focus:border-brand-cyan-500"
              />
            </div>

            <div>
              <label htmlFor="comm-slug" className="block text-xs font-medium text-slate-300 mb-1">
                Slug (Optional)
              </label>
              <input
                id="comm-slug"
                type="text"
                placeholder="distributed-consensus-systems"
                value={newCommSlug}
                onChange={(e) => setNewCommSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="w-full px-3 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded-lg text-white focus:outline-none focus:border-brand-cyan-500"
              />
            </div>

            <div>
              <label htmlFor="comm-desc" className="block text-xs font-medium text-slate-300 mb-1">
                Description
              </label>
              <textarea
                id="comm-desc"
                rows={3}
                maxLength={2000}
                placeholder="Core focus areas, paper discussions, and community standards..."
                value={newCommDesc}
                onChange={(e) => setNewCommDesc(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded-lg text-white focus:outline-none focus:border-brand-cyan-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="comm-private"
                type="checkbox"
                checked={newCommIsPrivate}
                onChange={(e) => setNewCommIsPrivate(e.target.checked)}
                className="rounded border-surface-border bg-surface-subtle text-brand-cyan-500 focus:ring-0"
              />
              <label htmlFor="comm-private" className="text-xs text-slate-300 cursor-pointer">
                Make this a private circle (invitation/approval required to view discussions)
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
              >
                Create Circle
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}
