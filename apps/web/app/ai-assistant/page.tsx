'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { CodeBlock } from '@/components/ui/code-block';
import {
  Sparkles,
  Send,
  BookOpen,
  Lightbulb,
  CheckCircle2,
  Code2,
  HelpCircle,
  RotateCcw,
  PlusCircle,
  Copy,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  codeSnippet?: {
    code: string;
    language: string;
    filename?: string;
  };
  citations?: string[];
  timestamp: string;
}

type ScaffoldingMode = 'SOCRATIC' | 'PROOF' | 'CODE_ANALYSIS' | 'MASTERY';

export default function AiAssistantPage() {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ScaffoldingMode>('PROOF');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'ai',
      text: `Welcome to the Learnova AI Learning Core. I am your cognitive scaffold for concept synthesis, algorithmic proofs, and academic research analysis.

I am grounded in peer-verified computer science and mathematics literature with zero hallucination guardrails. Select a scaffolding mode or query an invariant to begin.`,
      citations: [
        'Lamport, Shostak, Pease (1982) "The Byzantine Generals Problem"',
        'Fischer, Lynch, Paterson (1985) "Impossibility of Distributed Consensus with One Faulty Process"',
      ],
      timestamp: 'Just now',
    },
  ]);

  const starterPrompts = [
    {
      title: 'Formal Proof of Safety in Raft',
      prompt: 'Derive the inductive proof for Raft Leader Completeness and show why quorum intersection guarantees State Machine Safety.',
      mode: 'PROOF' as const,
    },
    {
      title: 'FlashAttention-3 GPU SRAM Tiling',
      prompt: 'Explain how FlashAttention-3 avoids HBM roundtrips by tiling the Q, K, V matrices in SRAM and computing online softmax.',
      mode: 'CODE_ANALYSIS' as const,
    },
    {
      title: 'PBFT View Change Protocol',
      prompt: 'Deconstruct the 3-phase commit protocol in Practical Byzantine Fault Tolerance (pre-prepare, prepare, commit) and view change edge-cases.',
      mode: 'PROOF' as const,
    },
    {
      title: 'Socratic Concept Check: Vector Clocks',
      prompt: 'Quiz me on logical clocks and causal concurrency. Give me a concrete scenario with 3 processes and ask me to calculate vector timestamp orders.',
      mode: 'SOCRATIC' as const,
    },
  ];

  const handleSend = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isGenerating) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsGenerating(true);

    setTimeout(() => {
      let aiReply: ChatMessage;

      if (query.toLowerCase().includes('raft') || query.toLowerCase().includes('proof')) {
        aiReply = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `### Formal Inductive Proof: Raft Leader Completeness
**Theorem (Leader Completeness):** If a log entry is committed in a given term $T$, then that entry is present in the logs of the leaders for all terms $T' > T$.

#### Proof by Induction:
1. **Base Case ($T' = T+1$):**
   - For an entry to be committed in term $T$, it must be replicated on a majority quorum $Q_{\text{commit}}$ of servers.
   - For a server to be elected leader in term $T+1$, it must receive votes from a majority quorum $Q_{\text{vote}}$ of servers.
   - By the **Pigeonhole Principle**, any two majorities of a cluster of size $2f + 1$ intersect in at least one node:
   $$Q_{\text{commit}} \cap Q_{\text{vote}} \neq \emptyset$$
   - Let node $v \in Q_{\text{commit}} \cap Q_{\text{vote}}$. Since $v$ received the committed entry in term $T$, its log contains that entry.
   - Furthermore, the candidate's RequestVote RPC requires that its last log term and index be at least as up-to-date as the voter's log. Node $v$ would have rejected any candidate whose log did not include this committed entry.
   - Therefore, the leader for term $T+1$ must contain the entry.

2. **Inductive Step ($T' > T+1$):**
   - Assuming all leaders from term $T$ up to $T'-1$ contain the committed entry, by induction and quorum intersection, the leader for term $T'$ must also receive a vote from at least one node containing the committed entry.

$$\therefore \text{State Machine Safety is preserved under arbitrary crash failures. } \blacksquare$$`,
          codeSnippet: {
            language: 'rust',
            filename: 'raft/src/leader_completeness_invariant.rs',
            code: `// Verify Quorum Intersection Property
fn verify_quorum_intersection(cluster_size: usize, q1_len: usize, q2_len: usize) -> bool {
    let majority = (cluster_size / 2) + 1;
    assert!(q1_len >= majority && q2_len >= majority);
    // Strict pigeonhole intersection: (majority + majority) > cluster_size
    (q1_len + q2_len) > cluster_size
}`,
          },
          citations: [
            'Ongaro & Ousterhout (2014) "In Search of an Understandable Consensus Algorithm"',
            'Howard et al. (2015) "Flexible Paxos: Quorum intersection revisited"',
          ],
          timestamp: 'Just now',
        };
      } else {
        aiReply = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `### Cognitive Breakdown for: "${query}"

1. **System & Formal Foundation:**
   Every distributed invariant rests on defining the synchrony model: synchronous, partially synchronous, or asynchronous.
   Under asynchronous timing, network delays are unbounded, meaning timeouts cannot distinguish slow nodes from crashed nodes.

2. **Mathematical Model:**
   Let state transitions be modeled as a Deterministic Finite Automaton (DFA) $\mathcal{M} = (S, \Sigma, \delta, s_0, F)$.
   Safety states that no transition produces an undesirable state $s \in S_{\text{unsafe}}$.
   Liveness guarantees that every legitimate request eventually results in a valid state transition $\delta(s, \sigma) \to s'$.

3. **Key Architectural Insight:**
   Decoupling consensus ordering from state-machine execution enables pipelined throughput without sacrificing deterministic consistency.`,
          citations: [
            'Lamport (1978) "Time, Clocks, and the Ordering of Events in a Distributed System"',
            'Chandy & Lamport (1985) "Distributed Snapshots: Determining Global States"',
          ],
          timestamp: 'Just now',
        };
      }

      setMessages((prev) => [...prev, aiReply]);
      setIsGenerating(false);
    }, 950);
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col space-y-4 pb-4">
        {/* Header & Grounding Mode Bar (Stitch Design) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border/60">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-violet-400" /> AI Knowledge Core &amp; Cognitive Scaffold
            </h1>
            <p className="text-xs text-slate-400">
              Rigorous mathematical proofs, algorithm derivations, and zero-hallucination research assistance.
            </p>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center gap-1 p-1 bg-surface-elevated/70 rounded-xl border border-surface-border text-xs">
            {[
              { id: 'PROOF', label: 'Proof Derivation' },
              { id: 'SOCRATIC', label: 'Socratic Check' },
              { id: 'CODE_ANALYSIS', label: 'System Code' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMode(m.id as ScaffoldingMode)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedMode === m.id
                    ? 'bg-brand-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat History Container */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scroll-smooth">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-3xl rounded-2xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-brand-indigo-600 text-white rounded-br-none shadow-md'
                    : 'bg-surface-card/90 border border-surface-border text-slate-200 rounded-bl-none shadow-lg'
                }`}
              >
                {msg.sender === 'ai' && (
                  <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-surface-border/60">
                    <div className="flex items-center gap-2 text-brand-violet-300 font-bold text-xs">
                      <Sparkles className="w-4 h-4 text-brand-violet-400" />
                      <span>Learnova Cognitive Scaffold</span>
                    </div>
                    <Badge variant="ai">No Hallucination Grounded</Badge>
                  </div>
                )}

                <div className="whitespace-pre-line space-y-3">{msg.text}</div>

                {/* Render Code Snippet if present */}
                {msg.codeSnippet && (
                  <div className="mt-4">
                    <CodeBlock
                      code={msg.codeSnippet.code}
                      language={msg.codeSnippet.language}
                      filename={msg.codeSnippet.filename}
                    />
                  </div>
                )}

                {/* Literature Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-surface-border/60 space-y-1.5">
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" /> Verified Academic References
                    </span>
                    <ul className="space-y-1">
                      {msg.citations.map((cite, idx) => (
                        <li
                          key={idx}
                          className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5"
                        >
                          <span className="text-brand-indigo-400 font-bold">[{idx + 1}]</span>
                          <span>{cite}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 px-1 font-mono">
                {msg.timestamp}
              </span>
            </div>
          ))}

          {isGenerating && (
            <div className="flex items-start">
              <div className="rounded-2xl p-4 bg-surface-card border border-surface-border text-slate-300 text-xs flex items-center gap-3 shadow-md">
                <Sparkles className="w-4 h-4 text-brand-violet-400 animate-spin" />
                <span className="font-mono">
                  Synthesizing mathematical proof invariants across peer literature...
                </span>
              </div>
            </div>
          )}

          {/* Starter Prompts Grid (visible when 1 message) */}
          {messages.length === 1 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-slate-400 px-1">
                Suggested Academic Proofs &amp; Deep Inquiries:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {starterPrompts.map((p, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedMode(p.mode);
                      handleSend(p.prompt);
                    }}
                    className="p-3.5 rounded-xl border border-surface-border/80 bg-surface-elevated/40 hover:bg-surface-elevated hover:border-brand-violet-500/50 cursor-pointer transition-all space-y-1 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white group-hover:text-brand-violet-300 transition-colors flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                        {p.title}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {p.prompt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input Bar Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="pt-2 flex gap-2"
        >
          <input
            type="text"
            placeholder={`Ask about an algorithm, proof invariant, or research paper (${selectedMode} mode)...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isGenerating}
            className="flex-1 h-12 px-4 rounded-xl bg-surface-card border border-surface-border text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-violet-500 focus:ring-1 focus:ring-brand-violet-500 transition-all shadow-inner"
          />
          <Button
            type="submit"
            variant="ai"
            size="lg"
            isLoading={isGenerating}
            rightIcon={<Send className="w-4 h-4" />}
          >
            Ask AI Core
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
