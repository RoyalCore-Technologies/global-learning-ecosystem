'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { ProgressBar } from '@/components/ui/progress';
import {
  Video,
  PlusCircle,
  TrendingUp,
  Users,
  DollarSign,
  FileText,
  CheckCircle2,
  Clock,
  Sparkles,
  Eye,
  MessageSquare,
  ShieldCheck,
  Edit3,
  MoreVertical,
  Upload,
  BookOpen,
  ArrowUpRight,
  Filter,
} from 'lucide-react';

interface Publication {
  id: string;
  title: string;
  type: 'ARTICLE' | 'COURSE' | 'TUTORIAL';
  status: 'PUBLISHED' | 'IN_REVIEW' | 'DRAFT';
  accuracyScore: number;
  viewsCount: number;
  endorsementsCount: number;
  publishedDate: string;
  discipline: string;
}

const SAMPLE_PUBLICATIONS: Publication[] = [
  {
    id: 'pub-1',
    title: 'Implementing Byzantine Fault Tolerant State Machine Replication in Rust',
    type: 'TUTORIAL',
    status: 'PUBLISHED',
    accuracyScore: 98.4,
    viewsCount: 14200,
    endorsementsCount: 218,
    publishedDate: 'Nov 01, 2026',
    discipline: 'Distributed Systems',
  },
  {
    id: 'pub-2',
    title: 'Distributed Systems Architecture: Consensus & Consistency (Full Track)',
    type: 'COURSE',
    status: 'PUBLISHED',
    accuracyScore: 99.2,
    viewsCount: 48900,
    endorsementsCount: 640,
    publishedDate: 'Oct 15, 2026',
    discipline: 'Systems Architecture',
  },
  {
    id: 'pub-3',
    title: 'Formal Verification of Raft Leader Election using TLA+ Specification',
    type: 'ARTICLE',
    status: 'IN_REVIEW',
    accuracyScore: 94.0,
    viewsCount: 320,
    endorsementsCount: 18,
    publishedDate: 'Under Review',
    discipline: 'Formal Methods',
  },
  {
    id: 'pub-4',
    title: 'Vector Clocks vs Hybrid Logical Clocks: Monotonicity under Clock Drift',
    type: 'ARTICLE',
    status: 'DRAFT',
    accuracyScore: 0,
    viewsCount: 0,
    endorsementsCount: 0,
    publishedDate: 'Last saved 2 hrs ago',
    discipline: 'Distributed Systems',
  },
];

export default function CreatorPage() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'PUBLISHED' | 'IN_REVIEW' | 'DRAFT'>('ALL');
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'ARTICLE' | 'COURSE' | 'TUTORIAL'>('ARTICLE');
  const [newDiscipline, setNewDiscipline] = useState('Distributed Systems');
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredPubs =
    activeTab === 'ALL'
      ? SAMPLE_PUBLICATIONS
      : SAMPLE_PUBLICATIONS.filter((p) => p.status === activeTab);

  const handleCreatePublication = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsPublishModalOpen(false);
      setNewTitle('');
      setNewContent('');
      alert('Publication submitted for peer review verification!');
    }, 800);
  };

  const getStatusBadge = (status: Publication['status']) => {
    switch (status) {
      case 'PUBLISHED':
        return <Badge variant="success">Published</Badge>;
      case 'IN_REVIEW':
        return <Badge variant="warning">In Peer Review</Badge>;
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="space-y-8 max-w-6xl mx-auto pb-16">
        {/* Creator Studio Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-surface-border/60">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Video className="w-6 h-6 text-amber-400" /> Creator Studio &amp; Publishing Dashboard
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Author certified courses, research monographs, and milestone-driven educational curricula.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="primary"
              leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
              onClick={() => setIsPublishModalOpen(true)}
            >
              New Publication
            </Button>
          </div>
        </div>

        {/* Creator Analytics Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card variant="elevated" className="p-5 space-y-2 border-surface-border">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-brand-indigo-400" /> Active Enrolled Students
            </span>
            <p className="text-2xl font-bold text-white">4,820</p>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
              <TrendingUp className="w-3 h-3" /> +18.4% this month
            </div>
          </Card>

          <Card variant="elevated" className="p-5 space-y-2 border-surface-border">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Peer Accuracy Rating
            </span>
            <p className="text-2xl font-bold text-emerald-400 font-mono">98.4%</p>
            <p className="text-[11px] text-slate-400">858 Verified Endorsements</p>
          </Card>

          <Card variant="elevated" className="p-5 space-y-2 border-surface-border">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-brand-cyan-400" /> Published Curricula
            </span>
            <p className="text-2xl font-bold text-white">24</p>
            <p className="text-[11px] text-slate-400">2 Tracks • 22 Monographs</p>
          </Card>

          <Card variant="elevated" className="p-5 space-y-2 border-surface-border">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-400" /> Creator Payouts (Est.)
            </span>
            <p className="text-2xl font-bold text-white font-mono">$1,640.00</p>
            <p className="text-[11px] text-slate-400">Freemium course &amp; subscriber shares</p>
          </Card>
        </div>

        {/* Verified Academic Channel Accreditation Banner */}
        <Card variant="elevated" className="border-brand-indigo-500/30 overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-brand-indigo-950/40 to-transparent">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <Avatar name="Distributed Systems & Low-Level Runtimes" size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base text-white">
                      Distributed Systems &amp; Low-Level Runtimes
                    </CardTitle>
                    <Badge variant="success">Verified Academic Channel</Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-400">
                    Accredited by Carnegie Mellon University Research Consortium
                  </CardDescription>
                </div>
              </div>
              <Button size="sm" variant="outline">
                Channel Settings
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              Your publications are certified for automated peer review distribution.
              Whenever you release a new syllabus module, verified researchers receive an endorsement
              request before your course is featured in institutional student feeds.
            </p>
          </CardContent>
        </Card>

        {/* Content Management Table (Stitch Design) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border/60">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-indigo-400" /> Publications &amp; Syllabus Manager
              </h2>
              <p className="text-xs text-slate-400">
                Manage your lectures, monographs, and peer-reviewed educational articles.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-surface-elevated/60 rounded-xl border border-surface-border text-xs">
              {(['ALL', 'PUBLISHED', 'IN_REVIEW', 'DRAFT'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-brand-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab === 'ALL'
                    ? 'All (24)'
                    : tab === 'PUBLISHED'
                    ? 'Published (18)'
                    : tab === 'IN_REVIEW'
                    ? 'In Review (4)'
                    : 'Drafts (2)'}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-surface-border overflow-hidden bg-surface-card/60 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-elevated/70 text-slate-400 font-semibold border-b border-surface-border/70 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Title &amp; Discipline</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Peer Accuracy</th>
                    <th className="py-3.5 px-4">Views</th>
                    <th className="py-3.5 px-4">Endorsements</th>
                    <th className="py-3.5 px-4">Published Date</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50 text-slate-200">
                  {filteredPubs.map((pub) => (
                    <tr
                      key={pub.id}
                      className="hover:bg-surface-elevated/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4 max-w-sm">
                        <p className="font-semibold text-white group-hover:text-brand-indigo-300 transition-colors line-clamp-1">
                          {pub.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-slate-400">
                            {pub.discipline}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-[10px] font-mono text-brand-indigo-400">
                            {pub.type}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(pub.status)}</td>
                      <td className="py-3.5 px-4 font-mono font-semibold">
                        {pub.accuracyScore > 0 ? (
                          <span className="text-emerald-400">{pub.accuracyScore}%</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {pub.viewsCount.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400">
                        {pub.endorsementsCount} ✓
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {pub.publishedDate}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2">
                            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                          </Button>
                          <Link href={`/courses/distributed-systems`}>
                            <Button size="sm" variant="secondary" className="h-7 text-xs px-2.5">
                              View
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* New Publication Modal / Dialog */}
        <Dialog
          isOpen={isPublishModalOpen}
          onClose={() => setIsPublishModalOpen(false)}
          title="Create New Educational Publication"
          description="Publish a research monograph, interactive course module, or technical tutorial for peer evaluation."
          maxWidth="lg"
        >
          <form onSubmit={handleCreatePublication} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Publication Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Memory Safety & Formal Proofs in Rust Runtimes"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-surface-subtle border border-surface-border text-sm text-white focus:outline-none focus:border-brand-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Format
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500"
                >
                  <option value="ARTICLE">Research Article / Monograph</option>
                  <option value="TUTORIAL">Interactive Code Tutorial</option>
                  <option value="COURSE">Multi-Module Course Track</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Academic Discipline
                </label>
                <input
                  type="text"
                  value={newDiscipline}
                  onChange={(e) => setNewDiscipline(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Syllabus &amp; Concept Content (Markdown Supported)
              </label>
              <textarea
                required
                rows={6}
                placeholder="Include formal proof invariants, lecture outlines, assignment specifications, and reference citations..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-brand-indigo-500 font-mono"
              />
            </div>

            <div className="p-3 rounded-xl bg-surface-elevated/60 border border-surface-border flex items-center justify-between text-xs">
              <span className="text-slate-300">Request Peer Review from CMU &amp; Stanford Faculty</span>
              <input type="checkbox" defaultChecked className="rounded text-brand-indigo-600" />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border/60">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsPublishModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                rightIcon={<Upload className="w-3.5 h-3.5" />}
              >
                Submit for Accreditation
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}
