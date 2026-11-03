'use client';

import React, { useState } from 'react';
import { Check, Copy, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  code,
  language = 'typescript',
  filename,
  className,
  showLineNumbers = true,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const lines = code.trim().split('\n');

  return (
    <div
      className={cn(
        'rounded-xl border border-surface-border bg-[#090d16] overflow-hidden font-mono text-xs shadow-md',
        className
      )}
    >
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border/70 bg-surface-elevated/40">
        <div className="flex items-center gap-2 text-slate-400">
          <Code2 className="w-3.5 h-3.5 text-brand-indigo-400" />
          {filename ? (
            <span className="font-semibold text-slate-200">{filename}</span>
          ) : (
            <span className="uppercase text-[10px] tracking-wider font-semibold text-slate-400">
              {language}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-sans">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <div className="p-4 overflow-x-auto text-slate-200 leading-relaxed font-mono">
        <pre className="table w-full">
          {lines.map((line, idx) => (
            <div key={idx} className="table-row">
              {showLineNumbers && (
                <span className="table-cell select-none pr-4 text-right text-slate-600 font-mono text-[11px] w-6">
                  {idx + 1}
                </span>
              )}
              <span className="table-cell whitespace-pre">{line || ' '}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
