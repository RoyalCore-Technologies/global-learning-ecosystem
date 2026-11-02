'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, BookOpen, Lightbulb, CheckCircle2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export default function AiAssistantPage() {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'ai',
      text: 'Welcome to the Learnova AI Learning Core. I am your cognitive scaffold for concept synthesis, algorithmic proofs, and academic research analysis. What topic or assignment are you exploring today?',
      timestamp: 'Just now',
    },
  ]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: input,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsGenerating(true);

    setTimeout(() => {
      const aiReply: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: `Analysis for "${userMsg.text}":\n\n1. Mathematical Formulation: In distributed state machines, safety guarantees that all non-faulty nodes execute operations in an identical order.\n2. Liveness vs Safety: Under asynchronous networks with Byzantine nodes (Fischer-Lynch-Paterson impossibility), consensus cannot guarantee deterministic termination without partial synchrony assumptions.\n3. Key Reference: Lamport, Shostak, Pease (1982) "The Byzantine Generals Problem".`,
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, aiReply]);
      setIsGenerating(false);
    }, 800);
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-border/60">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-violet-400" /> AI Learning Core
            </h1>
            <p className="text-xs text-slate-400">
              Cognitive scaffolding, concept breakdown, and algorithmic derivation assistant.
            </p>
          </div>
          <Badge variant="ai">No Hallucination Academic Grounding</Badge>
        </div>

        {/* Chat History Container */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-brand-indigo-600 text-white rounded-br-none shadow-md'
                    : 'bg-surface-elevated/80 border border-surface-border text-slate-200 rounded-bl-none shadow-sm'
                }`}
              >
                {msg.sender === 'ai' && (
                  <div className="flex items-center gap-1.5 text-brand-violet-300 font-bold text-xs mb-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Learnova AI Cognitive Tutor
                  </div>
                )}
                <div className="whitespace-pre-line">{msg.text}</div>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
            </div>
          ))}

          {isGenerating && (
            <div className="flex items-start">
              <div className="rounded-2xl p-4 bg-surface-elevated/80 border border-surface-border text-slate-400 text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-violet-400 animate-spin" />
                <span>Synthesizing mathematical explanation...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="pt-2 flex gap-2">
          <input
            type="text"
            placeholder="Ask about an algorithm, proof, paper, or system concept..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isGenerating}
            className="flex-1 h-12 px-4 rounded-xl bg-surface-elevated/70 border border-surface-border text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-violet-500 focus:ring-1 focus:ring-brand-violet-500 transition-all"
          />
          <Button
            type="submit"
            variant="ai"
            size="lg"
            isLoading={isGenerating}
            rightIcon={<Send className="w-4 h-4" />}
          >
            Ask AI
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
