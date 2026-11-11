'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/ui/code-block';
import { apiClient, streamAiClient, ApiError } from '@/lib/api-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  AI_SUPPORTED_LANGUAGES,
  AI_AGE_GROUPS,
  getAiLocaleConfig,
} from '@/lib/i18n/ai-locales';
import type {
  AiScaffoldingMode,
  LearnerLevel,
  LearningAgeGroup,
  AiChatMessage,
  AssessmentCheckResponseDto,
  SubmitAssessmentResultDto,
  AiLearningSessionSummary,
  AiLearningSessionDetail,
  AiAssessmentSummary,
  AdaptiveRecommendationsDto,
} from '@platform/types';
import {
  Sparkles,
  Send,
  Lightbulb,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  AlertCircle,
  Square,
  History,
  Trash2,
  Plus,
  Globe,
  Shield,
  Target,
  RefreshCw,
} from 'lucide-react';

export default function AiAssistantPage() {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMode, setSelectedMode] = useState<AiScaffoldingMode>('PROOF');
  const [learnerLevel, setLearnerLevel] = useState<LearnerLevel>('INTERMEDIATE');
  const [ageGroup, setAgeGroup] = useState<LearningAgeGroup>('ADULT');
  const [preferredLanguage, setPreferredLanguage] = useState<string>('en');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'assessment' | 'adaptive'>('chat');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  // Persisted Session History
  const [sessions, setSessions] = useState<AiLearningSessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Assessment State
  const [assessmentTopic, setAssessmentTopic] = useState('Raft Leader Completeness & Invariants');
  const [currentAssessment, setCurrentAssessment] = useState<AssessmentCheckResponseDto | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<SubmitAssessmentResultDto | null>(null);
  const [isGeneratingAssessment, setIsGeneratingAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [assessmentHistory, setAssessmentHistory] = useState<AiAssessmentSummary[]>([]);

  // Adaptive Mastery State
  const [adaptiveData, setAdaptiveData] = useState<AdaptiveRecommendationsDto | null>(null);
  const [isLoadingAdaptive, setIsLoadingAdaptive] = useState(false);
  const [adaptiveError, setAdaptiveError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const { option: localeOption, strings: localeStrings } = getAiLocaleConfig(preferredLanguage);

  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'init-1',
      sender: 'ai',
      text: `Welcome to the Learnova AI Learning Core. I am your cognitive scaffold for concept synthesis, algorithmic proofs, and academic research analysis.

All model interactions occur securely on the server with prompt-injection defense, privacy redaction, and age-appropriate calibration. Select your mode, language, and learner level to begin.`,
      citations: [
        'Lamport, Shostak, Pease (1982) "The Byzantine Generals Problem"',
        'Fischer, Lynch, Paterson (1985) "Impossibility of Distributed Consensus with One Faulty Process"',
      ],
      follow_up_questions: [
        'Would you like a step-by-step induction proof of Raft Leader Completeness?',
        'How does FlashAttention-3 avoid GPU HBM roundtrips by tiling in SRAM?',
      ],
      provider: 'learnova-academic-core',
      is_fallback: false,
      safety_status: 'SAFE',
      timestamp: 'Ready',
    },
  ]);

  const loadPersistedData = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setIsAuthenticated(false);
        return;
      }
      setIsAuthenticated(true);

      setIsLoadingSessions(true);
      const [sessRes, histRes] = await Promise.allSettled([
        apiClient<AiLearningSessionSummary[]>('ai/sessions'),
        apiClient<AiAssessmentSummary[]>('ai/assessments/history'),
      ]);

      if (sessRes.status === 'fulfilled' && sessRes.value.success && Array.isArray(sessRes.value.data)) {
        setSessions(sessRes.value.data);
      }
      if (histRes.status === 'fulfilled' && histRes.value.success && Array.isArray(histRes.value.data)) {
        setAssessmentHistory(histRes.value.data);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  const fetchAdaptive = useCallback(async () => {
    setIsLoadingAdaptive(true);
    setAdaptiveError(null);
    try {
      const res = await apiClient<AdaptiveRecommendationsDto>('ai/adaptive/recommendations');
      if (res.success && res.data) {
        setAdaptiveData(res.data);
      } else {
        setAdaptiveError('Unable to load adaptive mastery records.');
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setAdaptiveError(apiErr.message || 'Sign in to view personalized SM-2 mastery records.');
    } finally {
      setIsLoadingAdaptive(false);
    }
  }, []);

  useEffect(() => {
    loadPersistedData();
  }, [loadPersistedData]);

  useEffect(() => {
    if (activeTab === 'adaptive' && isAuthenticated && !adaptiveData && !isLoadingAdaptive) {
      fetchAdaptive();
    }
  }, [activeTab, isAuthenticated, adaptiveData, isLoadingAdaptive, fetchAdaptive]);

  const starterPrompts = [
    {
      title: 'Formal Proof of Safety in Raft',
      prompt:
        'Derive the inductive proof for Raft Leader Completeness and show why quorum intersection guarantees State Machine Safety.',
      mode: 'PROOF' as const,
    },
    {
      title: 'FlashAttention-3 GPU SRAM Tiling',
      prompt:
        'Explain how FlashAttention-3 avoids HBM roundtrips by tiling the Q, K, V matrices in SRAM and computing online softmax.',
      mode: 'CODE_ANALYSIS' as const,
    },
    {
      title: 'PBFT View Change Protocol',
      prompt:
        'Deconstruct the 3-phase commit protocol in Practical Byzantine Fault Tolerance (pre-prepare, prepare, commit) and view change edge-cases.',
      mode: 'PROOF' as const,
    },
    {
      title: 'Socratic Concept Check: Vector Clocks',
      prompt:
        'Quiz me on logical clocks and causal concurrency. Give me a concrete scenario with 3 processes and ask me to calculate vector timestamp orders.',
      mode: 'SOCRATIC' as const,
    },
  ];

  const handleLoadSession = async (id: string) => {
    setChatError(null);
    try {
      const res = await apiClient<AiLearningSessionDetail>(`ai/sessions/${id}`);
      if (res.success && res.data) {
        setSessionId(res.data.id);
        setSelectedMode(res.data.mode);
        setLearnerLevel(res.data.learner_level);
        if (res.data.language) setPreferredLanguage(res.data.language);
        setMessages(
          res.data.messages.length > 0
            ? res.data.messages
            : [
                {
                  id: `empty-${id}`,
                  sender: 'system',
                  text: 'Session loaded with no prior messages.',
                  timestamp: res.data.created_at,
                },
              ]
        );
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setChatError(apiErr.message || 'Could not load session history.');
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await apiClient(`ai/sessions/${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (sessionId === id) {
        setSessionId(null);
        setMessages((prev) => prev.slice(0, 1));
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setChatError(apiErr.message || 'Could not delete session.');
    }
  };

  const handleNewSession = () => {
    setSessionId(null);
    setChatError(null);
    setMessages((prev) => prev.slice(0, 1));
  };

  const handleStopStream = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsGenerating(false);
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isGenerating) return;

    setChatError(null);
    const userMsg: AiChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      language: preferredLanguage,
      timestamp: 'Just now',
    };

    const streamingMsgId = `ai-stream-${Date.now()}`;
    const placeholderAiMsg: AiChatMessage = {
      id: streamingMsgId,
      sender: 'ai',
      text: '',
      language: preferredLanguage,
      timestamp: 'Streaming...',
    };

    setMessages((prev) => [...prev, userMsg, placeholderAiMsg]);
    if (!textToSend) setInput('');
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const endpoint = sessionId ? `ai/sessions/${sessionId}/stream` : 'ai/query/stream';
      const payload = {
        query,
        mode: selectedMode,
        context: {
          learner_level: learnerLevel,
          preferred_language: preferredLanguage,
          age_group: ageGroup,
        },
        conversation_history: messages
          .filter((m) => m.id !== 'init-1' && (m.sender === 'user' || m.sender === 'ai'))
          .slice(-6)
          .map((m) => ({
            sender: m.sender as 'user' | 'ai',
            text: m.text,
          })),
      };

      let receivedComplete = false;

      await streamAiClient(
        endpoint,
        payload,
        (chunk) => {
          if (chunk.event === 'session' && chunk.session_id) {
            setSessionId(chunk.session_id);
          } else if (chunk.event === 'delta' && chunk.delta) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingMsgId ? { ...m, text: m.text + chunk.delta } : m
              )
            );
          } else if (chunk.event === 'complete' && chunk.response) {
            receivedComplete = true;
            const finalRes = chunk.response;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingMsgId
                  ? {
                      ...m,
                      id: finalRes.message_id || streamingMsgId,
                      text: finalRes.text,
                      codeSnippet: finalRes.codeSnippet || undefined,
                      citations: finalRes.citations,
                      follow_up_questions: finalRes.follow_up_questions,
                      provider: finalRes.provider,
                      model: finalRes.model,
                      is_fallback: finalRes.is_fallback,
                      fallback_reason: finalRes.fallback_reason,
                      language: finalRes.language || preferredLanguage,
                      safety_status: finalRes.safety_status,
                      timestamp: 'Just now',
                    }
                  : m
              )
            );
          } else if (chunk.event === 'error') {
            throw new ApiError(500, 'STREAM_ERROR', chunk.error || 'AI generation failed.');
          }
        },
        controller.signal
      );

      if (receivedComplete) {
        loadPersistedData();
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMsgId
              ? { ...m, text: m.text || 'Generation stopped by learner.', timestamp: 'Stopped' }
              : m
          )
        );
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== streamingMsgId));
        const apiErr = err as ApiError;
        setChatError(
          apiErr?.statusCode === 401
            ? 'Please sign in to access server-side AI companion sessions.'
            : apiErr?.message || 'AI Learning Core is temporarily unavailable. Please try again.'
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  const handleGenerateAssessment = async () => {
    setIsGeneratingAssessment(true);
    setAssessmentError(null);
    setAssessmentResult(null);
    setSelectedAnswers({});

    try {
      const res = await apiClient<AssessmentCheckResponseDto>('ai/assessments/generate', {
        method: 'POST',
        body: JSON.stringify({
          topic: assessmentTopic,
          level: learnerLevel,
          context: {
            learner_level: learnerLevel,
            preferred_language: preferredLanguage,
            age_group: ageGroup,
          },
        }),
      });

      if (res.success && res.data) {
        setCurrentAssessment(res.data);
      } else {
        throw new Error(
          typeof res.error === 'string'
            ? res.error
            : res.error?.message || 'Failed to generate assessment'
        );
      }
    } catch (err: any) {
      const apiErr = err as ApiError;
      setAssessmentError(
        apiErr?.statusCode === 401
          ? 'Please sign in to generate tracked knowledge check assessments.'
          : apiErr?.message || 'Failed to generate knowledge check assessment.'
      );
    } finally {
      setIsGeneratingAssessment(false);
    }
  };

  const handleSubmitAssessment = async () => {
    if (!currentAssessment) return;
    setIsSubmittingAssessment(true);
    setAssessmentError(null);

    const answers = Object.entries(selectedAnswers).map(([qId, optIdx]) => ({
      question_id: qId,
      selected_option_index: optIdx,
    }));

    try {
      const res = await apiClient<SubmitAssessmentResultDto>('ai/assessments/submit', {
        method: 'POST',
        body: JSON.stringify({
          assessment_id: currentAssessment.assessment_id,
          answers,
        }),
      });

      if (res.success && res.data) {
        setAssessmentResult(res.data);
        loadPersistedData();
        fetchAdaptive();
      } else {
        throw new Error(
          typeof res.error === 'string'
            ? res.error
            : res.error?.message || 'Failed to grade assessment'
        );
      }
    } catch (err: any) {
      const apiErr = err as ApiError;
      setAssessmentError(apiErr?.message || 'Could not evaluate assessment submission.');
    } finally {
      setIsSubmittingAssessment(false);
    }
  };

  return (
    <AppShell>
      <div
        dir={localeOption.dir}
        className="max-w-5xl mx-auto h-[calc(100vh-8rem)] flex flex-col space-y-4 pb-4"
      >
        {/* Header & Primary Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-surface-border/60">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-violet-400" /> AI Knowledge Core &amp; Cognitive Scaffold
            </h1>
            <p className="text-xs text-slate-400">
              Server-side streaming AI, prompt-injection safeguards, SM-2 mastery, and multilingual readiness.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-elevated border border-surface-border text-xs">
              <Globe className="w-3.5 h-3.5 text-brand-cyan-400" />
              <select
                aria-label="Preferred AI response language"
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                {AI_SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-slate-900 text-slate-100">
                    {lang.nativeLabel}
                  </option>
                ))}
              </select>
            </div>

            {/* Age Group Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-elevated border border-surface-border text-xs">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <select
                aria-label="Learner age group safety calibration"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value as LearningAgeGroup)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                {AI_AGE_GROUPS.map((g) => (
                  <option key={g.id} value={g.id} className="bg-slate-900 text-slate-100">
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Workspace Tabs */}
            <div className="flex items-center gap-1 p-1 bg-surface-elevated/70 rounded-xl border border-surface-border text-xs">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'chat'
                    ? 'bg-brand-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Companion
              </button>
              <button
                onClick={() => setActiveTab('assessment')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'assessment'
                    ? 'bg-brand-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Knowledge Checks
              </button>
              <button
                onClick={() => setActiveTab('adaptive')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'adaptive'
                    ? 'bg-brand-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Mastery &amp; SM-2
              </button>
            </div>
          </div>
        </div>

        {/* Unauthenticated Honest Banner */}
        {isAuthenticated === false && (
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Sign in to persist AI learning sessions, verify knowledge checks, and build your SM-2 mastery schedule.
              </span>
            </div>
            <Link href="/auth/login?next=/ai-assistant">
              <Button size="sm" variant="primary" className="text-xs shrink-0">
                Sign In
              </Button>
            </Link>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Session History Sidebar */}
            <Card variant="elevated" className="hidden lg:flex flex-col p-3 space-y-3 overflow-hidden">
              <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-brand-violet-400" /> Sessions
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleNewSession}
                  className="h-7 px-2 text-[11px]"
                >
                  <Plus className="w-3 h-3 mr-1" /> New
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {isLoadingSessions ? (
                  <p className="text-[11px] text-slate-500 p-2">Loading sessions...</p>
                ) : sessions.length === 0 ? (
                  <p className="text-[11px] text-slate-500 p-2">
                    Your persisted AI companion sessions will appear here.
                  </p>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`group p-2 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        sessionId === s.id
                          ? 'bg-brand-violet-600/20 border-brand-violet-500/50 text-white'
                          : 'bg-surface-subtle/60 border-surface-border/50 text-slate-300 hover:bg-surface-elevated'
                      }`}
                      onClick={() => handleLoadSession(s.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[11px]">{s.title}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                          <span>{s.mode}</span>
                          {s.language && <span>• {s.language.toUpperCase()}</span>}
                        </div>
                      </div>
                      <button
                        aria-label="Delete session"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(s.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Main Chat Column */}
            <div className="lg:col-span-3 flex flex-col min-h-0 space-y-3">
              {/* Scaffolding Mode & Level Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-slate-400 font-medium mr-1">Mode:</span>
                  {[
                    { id: 'PROOF', label: 'Proof Derivation' },
                    { id: 'SOCRATIC', label: 'Socratic Check' },
                    { id: 'EXPLANATION', label: 'Explanation' },
                    { id: 'CODE_ANALYSIS', label: 'System Code' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMode(m.id as AiScaffoldingMode)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        selectedMode === m.id
                          ? 'bg-surface-elevated text-white border border-brand-violet-500/50'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-medium mr-1">Level:</span>
                  {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setLearnerLevel(lvl)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        learnerLevel === lvl
                          ? 'bg-slate-200 text-slate-900 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat History */}
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
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-surface-border/60">
                          <div className="flex items-center gap-2 text-brand-violet-300 font-bold text-xs">
                            <Sparkles className="w-4 h-4 text-brand-violet-400" />
                            <span>Learnova Cognitive Scaffold</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {msg.safety_status && msg.safety_status !== 'SAFE' && (
                              <Badge variant="warning" className="text-[10px]">
                                Guardrail: {msg.safety_status}
                              </Badge>
                            )}
                            <Badge variant={msg.is_fallback ? 'warning' : 'ai'} className="text-[10px]">
                              {msg.is_fallback ? localeStrings.fallbackBadge : msg.provider || localeStrings.liveBadge}
                            </Badge>
                          </div>
                        </div>
                      )}

                      <div className="whitespace-pre-line space-y-3">
                        {msg.text || (isGenerating && msg.sender === 'ai' ? 'Thinking...' : '')}
                      </div>

                      {msg.codeSnippet && (
                        <div className="mt-4">
                          <CodeBlock
                            code={msg.codeSnippet.code}
                            language={msg.codeSnippet.language}
                            filename={msg.codeSnippet.filename}
                          />
                        </div>
                      )}

                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-surface-border/60 space-y-1.5">
                          <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" /> Academic References
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

                      {msg.follow_up_questions && msg.follow_up_questions.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-surface-border/60 space-y-2">
                          <span className="text-[10px] font-semibold tracking-wider uppercase text-brand-violet-300 flex items-center gap-1">
                            <HelpCircle className="w-3 h-3" /> Guided Follow-Up Inquiries
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {msg.follow_up_questions.map((q, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSend(q)}
                                className="text-[11px] text-left px-2.5 py-1 rounded-lg bg-surface-elevated/80 border border-surface-border text-slate-300 hover:text-white hover:border-brand-violet-400 transition-colors"
                              >
                                {q} &rarr;
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 px-1 font-mono">
                      {msg.timestamp}
                    </span>
                  </div>
                ))}

                {chatError && (
                  <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{chatError}</span>
                  </div>
                )}

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
                  placeholder={localeStrings.askPlaceholder}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isGenerating}
                  className="flex-1 h-12 px-4 rounded-xl bg-surface-card border border-surface-border text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-violet-500 focus:ring-1 focus:ring-brand-violet-500 transition-all shadow-inner"
                />
                {isGenerating ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={handleStopStream}
                    rightIcon={<Square className="w-3.5 h-3.5" />}
                  >
                    {localeStrings.cancelStreamLabel}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="ai"
                    size="lg"
                    disabled={!input.trim()}
                    rightIcon={<Send className="w-4 h-4" />}
                  >
                    {localeStrings.sendLabel}
                  </Button>
                )}
              </form>
            </div>
          </div>
        )}

        {activeTab === 'assessment' && (
          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            <Card variant="elevated" className="p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-brand-indigo-400" />
                  Targeted Concept Mastery Check
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Evaluate your retention of algorithm proofs and system invariants with persisted database grading and SM-2 mastery updates.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={assessmentTopic}
                  onChange={(e) => setAssessmentTopic(e.target.value)}
                  placeholder="Enter concept topic (e.g., Raft Leader Completeness, Vector Clocks)"
                  className="flex-1 h-10 px-3 rounded-lg bg-surface-elevated border border-surface-border text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-violet-500"
                />
                <Button
                  onClick={handleGenerateAssessment}
                  isLoading={isGeneratingAssessment}
                  variant="primary"
                  size="sm"
                >
                  Generate Questions
                </Button>
              </div>

              {assessmentError && (
                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{assessmentError}</span>
                </div>
              )}
            </Card>

            {currentAssessment && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                    Questions for: {currentAssessment.topic}
                  </h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={currentAssessment.is_fallback ? 'warning' : 'ai'}>
                      {currentAssessment.is_fallback ? 'Local Curriculum Check' : currentAssessment.provider || 'Live AI'}
                    </Badge>
                    <Badge variant="secondary">{currentAssessment.level}</Badge>
                  </div>
                </div>

                {currentAssessment.questions.map((q, qIdx) => (
                  <Card key={q.id} variant="default" className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {qIdx + 1}. {q.prompt}
                      </p>
                      <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                        {q.concept_tag}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => (
                        <label
                          key={optIdx}
                          className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            selectedAnswers[q.id] === optIdx
                              ? 'bg-brand-indigo-950/60 border-brand-indigo-500 text-white'
                              : 'bg-surface-elevated/40 border-surface-border text-slate-300 hover:bg-surface-elevated'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={selectedAnswers[q.id] === optIdx}
                            onChange={() =>
                              setSelectedAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                            }
                            className="text-brand-indigo-500 focus:ring-brand-indigo-400"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>

                    {assessmentResult && (
                      <div className="pt-2 border-t border-surface-border/50 text-xs">
                        {selectedAnswers[q.id] === q.correct_option_index ? (
                          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-4 h-4" /> Correct: {q.explanation}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-rose-400">
                            <AlertCircle className="w-4 h-4" /> Invariant: {q.explanation}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                ))}

                {!assessmentResult ? (
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSubmitAssessment}
                      isLoading={isSubmittingAssessment}
                      disabled={
                        Object.keys(selectedAnswers).length < currentAssessment.questions.length
                      }
                      variant="primary"
                    >
                      Submit for Evaluation &amp; SM-2 Mastery Update
                    </Button>
                  </div>
                ) : (
                  <Card variant="elevated" className="p-5 border-brand-violet-500/40 bg-brand-violet-950/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span className="font-bold text-white text-base">
                          Mastery Score: {assessmentResult.score} / {assessmentResult.total_questions} ({assessmentResult.percentage}%)
                        </span>
                      </div>
                      <Badge variant={assessmentResult.passed ? 'success' : 'warning'}>
                        {assessmentResult.passed ? 'PASSED' : 'NEEDS REVIEW'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {assessmentResult.next_recommended_step}
                    </p>
                  </Card>
                )}
              </div>
            )}

            {/* Past Assessment History */}
            {assessmentHistory.length > 0 && (
              <Card variant="default" className="p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Recent Persisted Knowledge Checks
                </h4>
                <div className="space-y-2">
                  {assessmentHistory.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg bg-surface-subtle border border-surface-border/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{item.topic}</p>
                        <p className="text-[10px] font-mono text-slate-400">
                          {item.level} • {item.total_questions} questions • {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {item.completed_at ? (
                        <Badge variant={item.passed ? 'success' : 'warning'}>
                          {item.score}/{item.total_questions} ({Math.round(Number(item.percentage || 0))}%)
                        </Badge>
                      ) : (
                        <Badge variant="secondary">In Progress</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'adaptive' && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <Card variant="elevated" className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border/60">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-brand-cyan-400" />
                    Adaptive Mastery &amp; SM-2 Spaced Repetition
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real persistence grounded exclusively in your completed assessment evidence.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={fetchAdaptive}
                  isLoading={isLoadingAdaptive}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
                </Button>
              </div>

              {adaptiveError ? (
                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{adaptiveError}</span>
                </div>
              ) : isLoadingAdaptive && !adaptiveData ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Loading personalized concept mastery records...
                </p>
              ) : adaptiveData ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border">
                      <span className="text-[10px] font-mono text-slate-400">OVERALL RETENTION</span>
                      <div className="text-2xl font-bold text-white mt-1">
                        {adaptiveData.overall_mastery_percentage}%
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border">
                      <span className="text-[10px] font-mono text-slate-400">CONCEPTS TRACKED</span>
                      <div className="text-2xl font-bold text-brand-cyan-400 mt-1">
                        {adaptiveData.total_concepts_tracked}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border">
                      <span className="text-[10px] font-mono text-slate-400">REVIEWS DUE (SM-2)</span>
                      <div className="text-2xl font-bold text-amber-400 mt-1">
                        {adaptiveData.due_reviews.length}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border">
                      <span className="text-[10px] font-mono text-slate-400">KNOWLEDGE GAPS</span>
                      <div className="text-2xl font-bold text-rose-400 mt-1">
                        {adaptiveData.knowledge_gaps.length}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Prioritized Learning Recommendations
                    </h4>
                    {adaptiveData.recommended_actions.map((act, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border/70 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={act.priority === 'HIGH' ? 'warning' : 'secondary'}>
                              {act.priority} PRIORITY
                            </Badge>
                            <span className="font-semibold text-white">{act.title}</span>
                          </div>
                          <p className="text-slate-400">{act.reason}</p>
                        </div>
                        {act.concept_tag && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setActiveTab('chat');
                              handleSend(
                                `Explain the core invariant and common pitfalls for concept: ${act.concept_tag}`
                              );
                            }}
                          >
                            Study Now
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Complete a Knowledge Check to establish your SM-2 spaced-repetition schedule.
                </p>
              )}
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
