import React from 'react';
import Link from 'next/link';

interface LearnovaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  showTagline?: boolean;
  className?: string;
  href?: string;
}

export function LearnovaLogo({
  size = 'md',
  showWordmark = true,
  showTagline = false,
  className = '',
  href = '/',
}: LearnovaLogoProps) {
  const iconSize = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  }[size];

  const textSize = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  }[size];

  const content = (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Brand Glyph SVG: Knowledge Constellation & Core Beacon */}
      <div className={`relative flex items-center justify-center ${iconSize} rounded-xl bg-gradient-to-tr from-brand-indigo-600 via-brand-violet-600 to-brand-cyan-400 p-[1.5px] shadow-brand-glow transition-transform hover:scale-105`}>
        <div className="w-full h-full bg-surface-base rounded-[10px] flex items-center justify-center overflow-hidden">
          <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-3/4 h-3/4"
          >
            {/* Open Knowledge Pages Geometry */}
            <path
              d="M16 6L6 11V21L16 26L26 21V11L16 6Z"
              stroke="url(#learnova-grad)"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            {/* Inner Neural Knowledge Core */}
            <path
              d="M16 11L21 13.5V18.5L16 21L11 18.5V13.5L16 11Z"
              fill="url(#learnova-core)"
              fillOpacity="0.3"
              stroke="#818cf8"
              strokeWidth="1.25"
            />
            {/* Constellation Nodes */}
            <circle cx="16" cy="6" r="1.5" fill="#38bdf8" />
            <circle cx="6" cy="11" r="1.5" fill="#818cf8" />
            <circle cx="26" cy="11" r="1.5" fill="#c084fc" />
            <circle cx="16" cy="26" r="1.5" fill="#34d399" />
            <circle cx="16" cy="16" r="2" fill="#ffffff" />

            <defs>
              <linearGradient id="learnova-grad" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366f1" />
                <stop offset="0.5" stopColor="#a855f7" />
                <stop offset="1" stopColor="#06b6d4" />
              </linearGradient>
              <linearGradient id="learnova-core" x1="11" y1="11" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4f46e5" />
                <stop offset="1" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {showWordmark && (
        <div className="flex flex-col">
          <span className={`font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent ${textSize}`}>
            Learnova
          </span>
          {showTagline && (
            <span className="text-[10px] uppercase tracking-widest text-brand-indigo-400 font-semibold">
              Where Knowledge Connects
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo-500 rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}
