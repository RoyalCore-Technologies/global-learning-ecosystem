'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Tabs } from '@/components/ui/tabs';
import { ProgressBar } from '@/components/ui/progress';
import { CodeBlock } from '@/components/ui/code-block';
import { Accordion, AccordionItem } from '@/components/ui/accordion';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Volume2,
  Maximize2,
  CheckCircle2,
  Clock,
  BookOpen,
  Code2,
  MessageSquare,
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  Sparkles,
  HelpCircle,
  Award,
} from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  duration: string;
  timestampSec: number;
  isCompleted: boolean;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

const SAMPLE_COURSES_DATA: Record<
  string,
  {
    title: string;
    description: string;
    tier: 'FREE' | 'PREMIUM';
    level: string;
    instructor: {
      name: string;
      role: 'EDUCATOR' | 'RESEARCHER';
      institution: string;
    };
    modules: Module[];
    sampleCode: string;
    notes: string;
  }
> = {
  'distributed-systems': {
    title: 'Distributed Systems Architecture: Consensus & Consistency',
    description:
      'Master state machine replication, Paxos, Raft, Byzantine fault tolerance, and vector clocks with verifiable Rust assignments.',
    tier: 'FREE',
    level: 'ADVANCED',
    instructor: {
      name: 'Prof. Marcus Vance',
      role: 'EDUCATOR',
      institution: 'Carnegie Mellon University',
    },
    sampleCode: `// Rust implementation: Raft Leader Election RequestVote RPC
pub async fn handle_request_vote(
    &mut self,
    req: RequestVoteArgs,
) -> Result<RequestVoteReply, ConsensusError> {
    if req.term > self.current_term {
        self.become_follower(req.term);
    }

    let is_candidate_up_to_date = req.last_log_term > self.last_log_term()
        || (req.last_log_term == self.last_log_term() 
            && req.last_log_index >= self.last_log_index());

    let vote_granted = req.term == self.current_term
        && (self.voted_for.is_none() || self.voted_for == Some(req.candidate_id))
        && is_candidate_up_to_date;

    if vote_granted {
        self.voted_for = Some(req.candidate_id);
        self.reset_election_timer();
    }

    Ok(RequestVoteReply {
        term: self.current_term,
        vote_granted,
    })
}`,
    notes: `### Formal Invariants of State Machine Replication
1. **Election Safety**: At most one leader can be elected in a given term (proven via pigeonhole principle on majority quorums).
2. **Leader Append-Only**: A leader never overwrites or truncates its own log entries; it only appends new entries.
3. **Log Matching Property**: If two logs contain an entry with the same index and term, then the logs are identical in all entries up through the given index.
4. **Leader Completeness**: If a log entry is committed in a given term, that entry will be present in the logs of the leaders for all higher-numbered terms.
5. **State Machine Safety**: If a server has applied a log entry at a given index to its state machine, no other server will ever apply a different log entry for the same index.`,
    modules: [
      {
        id: 'mod-1',
        title: 'Module 1: Foundations of Fault-Tolerant Consensus',
        lessons: [
          {
            id: 'l1',
            title: '1.1 System Models: Synchrony, Asynchrony & FLP Impossibility',
            duration: '38 min',
            timestampSec: 0,
            isCompleted: true,
          },
          {
            id: 'l2',
            title: '1.2 Logical Clocks, Vector Clocks & Causal Ordering',
            duration: '45 min',
            timestampSec: 2280,
            isCompleted: true,
          },
          {
            id: 'l3',
            title: '1.3 State Machine Replication & Quorum Intersection',
            duration: '52 min',
            timestampSec: 4980,
            isCompleted: false,
          },
        ],
      },
      {
        id: 'mod-2',
        title: 'Module 2: The Raft Consensus Algorithm',
        lessons: [
          {
            id: 'l4',
            title: '2.1 Leader Election, Randomized Heartbeats & Invariants',
            duration: '42 min',
            timestampSec: 8100,
            isCompleted: false,
          },
          {
            id: 'l5',
            title: '2.2 Log Replication, Commit Indexes & Joint Consensus',
            duration: '58 min',
            timestampSec: 10620,
            isCompleted: false,
          },
        ],
      },
      {
        id: 'mod-3',
        title: 'Module 3: Byzantine Fault Tolerance (PBFT & Beyond)',
        lessons: [
          {
            id: 'l6',
            title: '3.1 The Byzantine Generals Problem & Cryptographic Signatures',
            duration: '46 min',
            timestampSec: 14100,
            isCompleted: false,
          },
          {
            id: 'l7',
            title: '3.2 Pre-Prepare, Prepare, Commit Phases & View Changes',
            duration: '64 min',
            timestampSec: 16860,
            isCompleted: false,
          },
        ],
      },
    ],
  },
  'deep-learning-foundations': {
    title: 'Deep Learning Systems & GPU Memory Optimization',
    description:
      'Hardware-aware transformer training, tensor parallelism, FlashAttention kernel architecture, and quantization strategies.',
    tier: 'PREMIUM',
    level: 'ADVANCED',
    instructor: {
      name: 'Dr. Sarah Lin',
      role: 'RESEARCHER',
      institution: 'Stanford AI Lab',
    },
    sampleCode: `// CUDA kernel pseudo-code: FlashAttention Tile Tiling in SRAM
__global__ void flash_attention_kernel(
    const float* __restrict__ Q,
    const float* __restrict__ K,
    const float* __restrict__ V,
    float* __restrict__ O,
    int N, int d
) {
    extern __shared__ float sram[];
    // Partition SRAM into tiles for Q_i, K_j, V_j
    // Pipeline GEMM1 (Q_i * K_j^T) and online softmax scale
    // Compute online GEMM2 update to accumulator O_i
}`,
    notes: `### Memory Hierarchy Constraints in Transformer Scaling
Standard attention calculates:
$$A = \text{softmax}\left(\frac{Q K^T}{\sqrt{d}}\right) V$$
In standard implementations, materializing the intermediate matrix $S = Q K^T$ incurs $O(N^2)$ memory reads and writes to High Bandwidth Memory (HBM).
FlashAttention-3 leverages SRAM tiling:
1. Divide $Q$ into blocks of size $B_r \times d$.
2. Divide $K, V$ into blocks of size $B_c \times d$.
3. Compute online softmax normalization without ever writing the $N \times N$ attention matrix to global memory.`,
    modules: [
      {
        id: 'mod-1',
        title: 'Module 1: GPU Architecture & High Bandwidth Memory',
        lessons: [
          {
            id: 'l1',
            title: '1.1 Memory Hierarchy: HBM vs SRAM vs Register File',
            duration: '35 min',
            timestampSec: 0,
            isCompleted: true,
          },
          {
            id: 'l2',
            title: '1.2 Arithmetic Intensity & The Roofline Model',
            duration: '44 min',
            timestampSec: 2100,
            isCompleted: false,
          },
        ],
      },
    ],
  },
};

export default function CourseLectureInterfacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.id;
  const course = SAMPLE_COURSES_DATA[courseId] || SAMPLE_COURSES_DATA['distributed-systems'];

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState('1x');
  const [currentProgressSec, setCurrentProgressSec] = useState(868); // 14:28
  const [activeTab, setActiveTab] = useState('notes');
  const [activeLessonId, setActiveLessonId] = useState('l3');
  const [completedLessons, setCompletedLessons] = useState<Record<string, boolean>>({
    l1: true,
    l2: true,
  });

  const totalDurationSec = 3120; // 52 minutes

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleToggleLessonComplete = (lessonId: string) => {
    setCompletedLessons((prev) => ({
      ...prev,
      [lessonId]: !prev[lessonId],
    }));
  };

  // Calculate course completion
  const allLessons = course.modules.flatMap((m) => m.lessons);
  const completedCount = allLessons.filter((l) => completedLessons[l.id]).length;
  const progressPercent = Math.round((completedCount / allLessons.length) * 100);

  const activeLesson =
    allLessons.find((l) => l.id === activeLessonId) || allLessons[0];

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Course Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-surface-border/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/courses"
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> All Courses
              </Link>
              <span className="text-slate-600">/</span>
              <Badge variant={course.tier === 'FREE' ? 'secondary' : 'tier'}>
                {course.tier} Track
              </Badge>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-slate-300">
                {course.level}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              {course.title}
            </h1>
            <div className="flex items-center gap-2 pt-0.5">
              <Avatar name={course.instructor.name} size="xs" />
              <span className="text-xs text-slate-300 font-semibold">
                {course.instructor.name}
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400">{course.instructor.institution}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="min-w-[140px] hidden md:block">
              <ProgressBar
                value={progressPercent}
                showLabel
                colorScheme="gradient"
                className="w-full"
              />
            </div>
            <Button
              size="sm"
              variant={completedLessons[activeLesson.id] ? 'secondary' : 'primary'}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              onClick={() => handleToggleLessonComplete(activeLesson.id)}
            >
              {completedLessons[activeLesson.id] ? 'Completed' : 'Mark Lesson Complete'}
            </Button>
          </div>
        </div>

        {/* Main Grid: Video Player + Learning Tabs (Left) vs Curriculum Drawer (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols): Theater Lecture Player + Tabs */}
          <div className="lg:col-span-2 space-y-6">
            {/* 16:9 Video Theater Canvas */}
            <div className="relative aspect-video rounded-2xl bg-black border border-surface-border overflow-hidden shadow-2xl flex flex-col justify-between group">
              {/* Top Video Overlay Bar */}
              <div className="relative z-10 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="ai">4K Verified Lecture</Badge>
                  <span className="text-xs text-white font-medium truncate max-w-sm">
                    {activeLesson.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Download lecture slides"
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-xs flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Slides</span>
                  </button>
                  <button
                    aria-label="Share lesson link"
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Center Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={handleTogglePlay}
                  aria-label={isPlaying ? 'Pause lecture' : 'Play lecture'}
                  className="w-16 h-16 rounded-full bg-brand-indigo-600/90 hover:bg-brand-indigo-500 text-white flex items-center justify-center shadow-xl hover:scale-105 transition-all backdrop-blur-sm"
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7" />
                  ) : (
                    <Play className="w-7 h-7 ml-1" />
                  )}
                </button>
              </div>

              {/* Bottom Video Controls Scrubber Bar */}
              <div className="relative z-10 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent space-y-2">
                {/* Progress Scrubber */}
                <div
                  className="w-full h-1.5 rounded-full bg-white/20 cursor-pointer overflow-hidden relative"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const percent = clickX / rect.width;
                    setCurrentProgressSec(Math.round(percent * totalDurationSec));
                  }}
                >
                  <div
                    className="h-full bg-brand-indigo-500 rounded-full"
                    style={{
                      width: `${(currentProgressSec / totalDurationSec) * 100}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-white">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleTogglePlay}
                      className="hover:text-brand-indigo-400 transition-colors"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setCurrentProgressSec(Math.max(0, currentProgressSec - 10))}
                      className="hover:text-brand-indigo-400 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-[11px] text-slate-300">
                      {formatTime(currentProgressSec)} / {formatTime(totalDurationSec)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Playback speed toggle */}
                    <div className="flex items-center gap-1 font-mono text-[11px] bg-white/10 px-2 py-0.5 rounded">
                      {['1x', '1.25x', '1.5x', '2x'].map((spd) => (
                        <button
                          key={spd}
                          onClick={() => setPlaybackSpeed(spd)}
                          className={`px-1 rounded ${
                            playbackSpeed === spd
                              ? 'bg-brand-indigo-500 text-white font-bold'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {spd}
                        </button>
                      ))}
                    </div>
                    <Maximize2 className="w-4 h-4 text-slate-300 hover:text-white cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Multi-Tab Learning Workspace */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-surface-border pb-2 overflow-x-auto no-scrollbar">
                {[
                  { id: 'notes', label: 'Concept Notes & Proofs', icon: BookOpen },
                  { id: 'lab', label: 'Interactive Code Lab', icon: Code2 },
                  { id: 'transcript', label: 'Lecture Transcript', icon: FileText },
                  { id: 'qa', label: 'Peer Q&A & Endorsements', icon: MessageSquare },
                ].map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-brand-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-surface-elevated'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Notes & Invariants */}
              {activeTab === 'notes' && (
                <Card variant="elevated" className="p-6 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-brand-indigo-400" /> Lesson Core Concepts &amp; Invariants
                    </h2>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                      Peer Endorsed by CMU Systems Lab
                    </span>
                  </div>

                  <div className="prose prose-invert prose-xs text-slate-300 leading-relaxed font-sans space-y-3">
                    <p>
                      In this lecture, we formalize the boundary between synchronous and asynchronous consensus.
                      Recall the fundamental theorem established by Fischer, Lynch, and Paterson (1985):
                    </p>
                    <div className="p-4 rounded-xl bg-surface-subtle/80 border-l-4 border-amber-400 border-surface-border text-xs text-amber-200">
                      <p className="font-semibold mb-1">FLP Impossibility Theorem:</p>
                      In an asynchronous network, no deterministic consensus protocol can guarantee liveness
                      in the presence of even a single unannounced crash failure.
                    </div>
                    <div className="whitespace-pre-line text-xs font-mono bg-surface-base p-4 rounded-xl border border-surface-border/80">
                      {course.notes}
                    </div>
                  </div>
                </Card>
              )}

              {/* Tab 2: Code Lab */}
              {activeTab === 'lab' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-brand-cyan-400" /> Verifiable Assignment Playground
                      </h2>
                      <p className="text-xs text-slate-400">
                        Inspect the implementation and verify safety conditions against majority quorums.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={<Play className="w-3.5 h-3.5" />}
                      onClick={() => alert('All 12 consensus unit tests PASSED (0.04s)!')}
                    >
                      Run Unit Tests
                    </Button>
                  </div>

                  <CodeBlock
                    code={course.sampleCode}
                    language="rust"
                    filename="consensus/raft/rpc_handler.rs"
                  />
                </div>
              )}

              {/* Tab 3: Transcript */}
              {activeTab === 'transcript' && (
                <Card variant="elevated" className="p-5 space-y-3">
                  <h2 className="text-sm font-bold text-white pb-2 border-b border-surface-border/60">
                    Interactive Timestamped Transcript
                  </h2>
                  <div className="space-y-2 text-xs">
                    {[
                      {
                        sec: 0,
                        label: '00:00',
                        text: 'Welcome back. Today we are addressing State Machine Replication under network partitions.',
                      },
                      {
                        sec: 868,
                        label: '14:28',
                        text: 'Notice that in a quorum of size 2f + 1, any two majority quorums must intersect at least on one non-faulty node.',
                      },
                      {
                        sec: 1420,
                        label: '23:40',
                        text: 'This intersection guarantee is what preserves Leader Completeness across view changes.',
                      },
                      {
                        sec: 2100,
                        label: '35:00',
                        text: 'Now let us step through the Rust RPC handler code for RequestVote.',
                      },
                    ].map((seg) => (
                      <div
                        key={seg.label}
                        onClick={() => setCurrentProgressSec(seg.sec)}
                        className="p-2.5 rounded-lg hover:bg-surface-elevated cursor-pointer transition-colors flex items-start gap-3 group"
                      >
                        <span className="font-mono text-brand-indigo-400 group-hover:underline shrink-0">
                          {seg.label}
                        </span>
                        <p className="text-slate-300 leading-relaxed">{seg.text}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Tab 4: Q&A */}
              {activeTab === 'qa' && (
                <Card variant="elevated" className="p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-brand-indigo-400" /> Lesson Discussion &amp; Clarifications
                    </h2>
                    <Button size="sm" variant="secondary">
                      Ask Question
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-surface-subtle/60 border border-surface-border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar name="David K." size="xs" />
                          <span className="text-xs font-semibold text-white">David K. (Student)</span>
                          <span className="text-[10px] text-slate-500">at 14:28</span>
                        </div>
                        <Badge variant="success">Accepted Solution</Badge>
                      </div>
                      <p className="text-xs text-slate-300">
                        Why does Raft require the candidate's last log term to be strictly greater or equal, rather than just log length?
                      </p>
                      <div className="p-3 rounded-lg bg-surface-base border border-surface-border/80 text-xs text-slate-300 space-y-1">
                        <span className="font-semibold text-brand-indigo-300 flex items-center gap-1 text-[11px]">
                          <Award className="w-3.5 h-3.5" /> Prof. Marcus Vance (Instructor Answer):
                        </span>
                        <p>
                          A longer log from an uncommitted earlier term could contain uncommitted entries that were subsequently superseded. The term guarantees the entry was sanctioned by a more recent leader quorum.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* Right Column (1 Col): Curriculum & Modules Drawer (Stitch Design) */}
          <div className="space-y-4">
            <Card variant="elevated" className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border/60">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand-indigo-400" /> Course Syllabus
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {completedCount}/{allLessons.length} Done
                </span>
              </div>

              {/* Modules Accordion */}
              <Accordion className="space-y-3">
                {course.modules.map((m) => (
                  <AccordionItem
                    key={m.id}
                    id={m.id}
                    title={m.title}
                    defaultOpen={m.lessons.some((l) => l.id === activeLessonId)}
                  >
                    <div className="space-y-1 pt-1">
                      {m.lessons.map((lesson) => {
                        const isCurrent = lesson.id === activeLessonId;
                        const isDone = completedLessons[lesson.id];
                        return (
                          <div
                            key={lesson.id}
                            onClick={() => setActiveLessonId(lesson.id)}
                            className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between text-xs ${
                              isCurrent
                                ? 'bg-brand-indigo-600/20 border border-brand-indigo-500/50 text-white font-medium'
                                : 'hover:bg-surface-elevated/70 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleLessonComplete(lesson.id);
                                }}
                                className="shrink-0"
                              >
                                <CheckCircle2
                                  className={`w-4 h-4 ${
                                    isDone
                                      ? 'text-emerald-400 fill-emerald-400/20'
                                      : 'text-slate-600 hover:text-slate-400'
                                  }`}
                                />
                              </button>
                              <span className="truncate">{lesson.title}</span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-500 shrink-0">
                              {lesson.duration}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionItem>
                ))}
              </Accordion>

              {/* Bottom Navigation Controls */}
              <div className="pt-3 border-t border-surface-border/60 flex items-center justify-between gap-2">
                <Button size="sm" variant="ghost" leftIcon={<ChevronLeft className="w-4 h-4" />}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                  onClick={() => {
                    handleToggleLessonComplete(activeLesson.id);
                  }}
                >
                  Next Lesson
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
