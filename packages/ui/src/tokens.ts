/**
 * @platform/ui - Design Tokens & Theme Definitions for Learnova
 * Architecture: Unified Hybrid Architecture (UHA)
 * Philosophy: Knowledge over popularity, learning over endless scrolling.
 */

export const THEME_COLORS = {
  background: {
    base: '#080c14',      // Deep midnight void
    surface: '#0f172a',   // Card & component background (slate-900)
    elevated: '#17223b',  // Elevated popovers and dialogs
    overlay: 'rgba(8, 12, 20, 0.85)', // Modal backdrop
    subtle: '#1e293b',    // Subtle hover surfaces (slate-800)
  },
  border: {
    subtle: '#1e293b',    // Default slate-800 border
    default: '#334155',   // Highlighted border
    accent: '#4f46e5',    // Active border (indigo-600)
    emerald: '#10b981',   // Verified border
  },
  brand: {
    indigo: {
      light: '#818cf8',
      main: '#6366f1',
      dark: '#4f46e5',
      glow: 'rgba(99, 102, 241, 0.25)',
    },
    emerald: {
      light: '#34d399',
      main: '#10b981',
      dark: '#059669',
      glow: 'rgba(16, 185, 129, 0.25)',
    },
    violet: {
      light: '#a78bfa',
      main: '#8b5cf6',
      dark: '#7c3aed',
      glow: 'rgba(139, 92, 246, 0.25)',
    },
    amber: {
      light: '#fcd34d',
      main: '#f59e0b',
      dark: '#d97706',
      glow: 'rgba(245, 158, 11, 0.25)',
    },
    cyan: {
      light: '#67e8f9',
      main: '#06b6d4',
      dark: '#0891b2',
      glow: 'rgba(6, 182, 212, 0.25)',
    },
  },
  text: {
    primary: '#f8fafc',   // High-contrast primary (slate-50)
    secondary: '#cbd5e1', // Descriptive text (slate-300)
    muted: '#94a3b8',     // Subdued metadata (slate-400)
    faint: '#64748b',     // Disabled / footnote (slate-500)
  },
} as const;

export interface RoleTheme {
  label: string;
  shortDescription: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  badgeClass: string;
}

export const ROLE_THEMES: Record<string, RoleTheme> = {
  STUDENT: {
    label: 'Student',
    shortDescription: 'Active learner pursuing knowledge pathways',
    bgClass: 'bg-indigo-950/40',
    textClass: 'text-indigo-400',
    borderClass: 'border-indigo-500/30',
    badgeClass: 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30',
  },
  BEGINNER: {
    label: 'Beginner',
    shortDescription: 'New learner building foundational skills',
    bgClass: 'bg-sky-950/40',
    textClass: 'text-sky-400',
    borderClass: 'border-sky-500/30',
    badgeClass: 'bg-sky-950/60 text-sky-300 border-sky-500/30',
  },
  EDUCATOR: {
    label: 'Educator',
    shortDescription: 'Verified instructor authoring structured curricula',
    bgClass: 'bg-emerald-950/40',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
    badgeClass: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30',
  },
  CREATOR: {
    label: 'Creator',
    shortDescription: 'Educational content author and publication lead',
    bgClass: 'bg-amber-950/40',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-500/30',
  },
  RESEARCHER: {
    label: 'Researcher',
    shortDescription: 'Academic peer reviewing & publishing research papers',
    bgClass: 'bg-cyan-950/40',
    textClass: 'text-cyan-400',
    borderClass: 'border-cyan-500/30',
    badgeClass: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30',
  },
  ADMIN: {
    label: 'Platform Admin',
    shortDescription: 'Platform security and administrative governance',
    bgClass: 'bg-rose-950/40',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-500/30',
    badgeClass: 'bg-rose-950/60 text-rose-300 border-rose-500/30',
  },
};

export interface NavItem {
  id: string;
  label: string;
  href: string;
  iconName: string;
  badge?: string;
  ecosystem: 'LEARN' | 'SOCIAL' | 'CREATOR' | 'AI' | 'COMMUNITY';
}

export const MAIN_NAVIGATION: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    iconName: 'LayoutDashboard',
    ecosystem: 'LEARN',
  },
  {
    id: 'explore',
    label: 'Knowledge Feed',
    href: '/explore',
    iconName: 'Compass',
    ecosystem: 'SOCIAL',
  },
  {
    id: 'courses',
    label: 'Courses & Tracks',
    href: '/courses',
    iconName: 'GraduationCap',
    badge: '12 Tracks',
    ecosystem: 'LEARN',
  },
  {
    id: 'communities',
    label: 'Communities',
    href: '/communities',
    iconName: 'Users',
    ecosystem: 'COMMUNITY',
  },
  {
    id: 'ai-tutor',
    label: 'AI Learning Core',
    href: '/ai-assistant',
    iconName: 'Sparkles',
    badge: 'AI',
    ecosystem: 'AI',
  },
  {
    id: 'creator-hub',
    label: 'Creator Studio',
    href: '/creator',
    iconName: 'Video',
    ecosystem: 'CREATOR',
  },
];
