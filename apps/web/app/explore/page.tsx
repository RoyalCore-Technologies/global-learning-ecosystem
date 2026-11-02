'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/feedback';
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
} from 'lucide-react';

interface KnowledgePost {
  id: string;
  title: string;
  summary: string;
  codeSnippet?: string;
  author: {
    name: string;
    role: 'RESEARCHER' | 'EDUCATOR' | 'STUDENT' | 'CREATOR';
    institution: string;
    isVerified: boolean;
  };
  category: string;
  postType: 'TUTORIAL' | 'ARTICLE' | 'QUESTION' | 'PROJECT_SHOWCASE';
  accuracyEndorsements: number;
  insightfulVotes: number;
  commentsCount: number;
  tags: string[];
  publishedAt: string;
}

const SAMPLE_POSTS: KnowledgePost[] = [
  {
    id: '1',
    title: 'Implementing Byzantine Fault Tolerant State Machine Replication in Rust',
    summary:
      'A deep dive into Practical Byzantine Fault Tolerance (PBFT). We step through pre-prepare, prepare, and commit phases while demonstrating view change edge-cases in concurrent asynchronous networks.',
    codeSnippet: 'pub async fn handle_prepare(&mut self, prep: PrepareMsg) -> Result<(), ConsensusError> {\n    let digest = prep.digest;\n    if self.has_2f_prepares(&digest) {\n        self.transition_to_commit(digest).await?;\n    }\n    Ok(())\n}',
    author: {
      name: 'Prof. Marcus Vance',
      role: 'EDUCATOR',
      institution: 'Carnegie Mellon University',
      isVerified: true,
    },
    category: 'systems',
    postType: 'TUTORIAL',
    accuracyEndorsements: 218,
    insightfulVotes: 480,
    commentsCount: 64,
    tags: ['rust', 'consensus', 'distributed-systems', 'pbft'],
    publishedAt: '2 hours ago',
  },
  {
    id: '2',
    title: 'Why Self-Attention Scales as O(N^2) and How FlashAttention-3 Restructures Memory Hierarchy',
    summary:
      'Understanding hardware-aware algorithms for transformer attention. Instead of materializing large N x N intermediate matrices in HBM, we pipeline matrix multiplication and softmax across GPU SRAM tiles.',
    author: {
      name: 'Dr. Sarah Lin',
      role: 'RESEARCHER',
      institution: 'Stanford AI Lab',
      isVerified: true,
    },
    category: 'ai',
    postType: 'ARTICLE',
    accuracyEndorsements: 342,
    insightfulVotes: 890,
    commentsCount: 95,
    tags: ['deep-learning', 'transformers', 'gpu-kernel', 'cuda'],
    publishedAt: '5 hours ago',
  },
  {
    id: '3',
    title: 'How should one mathematically formalize Type-Level Peano Arithmetic in TypeScript 5?',
    summary:
      'I am building a compile-time dimensional analysis checker. When expressing addition and multiplication using recursive conditional types, the compiler hits max recursion depth at N=40. Looking for peer feedback on tail-call recursion optimization tricks.',
    author: {
      name: 'David K.',
      role: 'STUDENT',
      institution: 'TU Delft',
      isVerified: false,
    },
    category: 'cs',
    postType: 'QUESTION',
    accuracyEndorsements: 84,
    insightfulVotes: 132,
    commentsCount: 22,
    tags: ['typescript', 'type-theory', 'compilers'],
    publishedAt: 'Yesterday',
  },
];

export default function ExploreFeedPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeType, setActiveType] = useState<string>('ALL');

  const categories = [
    { id: 'all', label: 'All Knowledge' },
    { id: 'systems', label: 'Distributed Systems' },
    { id: 'ai', label: 'AI & Machine Learning' },
    { id: 'cs', label: 'Computer Science' },
    { id: 'math', label: 'Mathematics & Logic' },
    { id: 'research', label: 'Peer Review Preprints' },
  ];

  const filteredPosts = SAMPLE_POSTS.filter((post) => {
    const matchesCategory = activeCategory === 'all' || post.category === activeCategory;
    const matchesType = activeType === 'ALL' || post.postType === activeType;
    return matchesCategory && matchesType;
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
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
              leftIcon={<BookOpen className="w-3.5 h-3.5" />}
            >
              Tutorials
            </Button>
            <Button
              size="sm"
              variant={activeType === 'ARTICLE' ? 'primary' : 'outline'}
              onClick={() => setActiveType('ARTICLE')}
              leftIcon={<Code2 className="w-3.5 h-3.5" />}
            >
              Articles
            </Button>
            <Button
              size="sm"
              variant={activeType === 'QUESTION' ? 'primary' : 'outline'}
              onClick={() => setActiveType('QUESTION')}
              leftIcon={<HelpCircle className="w-3.5 h-3.5" />}
            >
              Questions
            </Button>
          </div>
        </div>

        {/* Subject Category Tabs */}
        <Tabs
          tabs={categories}
          activeTab={activeCategory}
          onChange={setActiveCategory}
          variant="pills"
        />

        {/* Feed Posts Stream */}
        <div className="space-y-4">
          {filteredPosts.length > 0 ? (
            filteredPosts.map((post) => (
              <Card
                key={post.id}
                className="border-surface-border hover:border-brand-indigo-500/30 transition-all duration-200"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={post.author.name} size="md" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white hover:underline cursor-pointer">
                            {post.author.name}
                          </span>
                          <Badge
                            roleType={post.author.role}
                            isVerified={post.author.isVerified}
                            className="text-[9px] px-1.5 py-0"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {post.author.institution} &middot; {post.publishedAt}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-surface-elevated text-brand-indigo-300 border border-surface-border">
                        {post.postType}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <h2 className="text-base sm:text-lg font-bold text-white leading-snug hover:text-brand-indigo-300 transition-colors cursor-pointer">
                    {post.title}
                  </h2>

                  <p className="text-xs text-slate-300 leading-relaxed">{post.summary}</p>

                  {post.codeSnippet && (
                    <div className="rounded-xl bg-surface-base border border-surface-border/80 p-3 font-mono text-[11px] text-slate-300 overflow-x-auto">
                      <pre>{post.codeSnippet}</pre>
                    </div>
                  )}

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
                </CardContent>

                <CardFooter className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-surface-border/50">
                  <div className="flex items-center gap-4 flex-wrap">
                    <button
                      className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors font-medium text-emerald-400/90"
                      title="Academic accuracy endorsement"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{post.accuracyEndorsements} Endorsements</span>
                    </button>

                    <button
                      className="flex items-center gap-1.5 hover:text-brand-indigo-400 transition-colors"
                      title="Insightful vote"
                    >
                      <Sparkles className="w-4 h-4 text-brand-indigo-400" />
                      <span>{post.insightfulVotes} Insightful</span>
                    </button>

                    <button
                      className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
                      title="Comments & Discussion"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{post.commentsCount} Discussions</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors"
                      title="Bookmark post"
                    >
                      <Bookmark className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors"
                      title="Share knowledge link"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardFooter>
              </Card>
            ))
          ) : (
            <EmptyState
              title="No posts found in this category"
              description="Be the first educator or researcher to publish a verified tutorial or inquiry in this field."
              actionLabel="Reset Subject Filters"
              onAction={() => {
                setActiveCategory('all');
                setActiveType('ALL');
              }}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
