import { ShieldCheck, BookOpen, Users, Cpu, Layers } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-8 sm:p-16">
      <div className="z-10 w-full max-w-5xl flex items-center justify-between font-mono text-sm border-b border-slate-800 pb-6">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
          <p className="font-semibold tracking-wide">PLATFORM ECOSYSTEM &middot; FOUNDATION ACTIVE</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>Turborepo Monorepo</span>
          <span>&bull;</span>
          <span>Next.js 15 &bull; NestJS</span>
        </div>
      </div>

      <div className="my-16 max-w-3xl text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-950/40 text-emerald-400 text-xs font-medium">
          <ShieldCheck className="w-4 h-4" /> Milestone 1 Deployed & Verified
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
          The Knowledge-First Social & Learning Ecosystem
        </h1>

        <p className="text-lg text-slate-400 leading-relaxed">
          Knowledge over popularity. Learning over endless scrolling.
          Connecting students, educators, creators, and researchers across the globe.
        </p>

        <div className="pt-4 flex flex-wrap justify-center gap-4">
          <a
            href="/api/health"
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-950"
          >
            Web Health Probe (/api/health)
          </a>
          <a
            href="http://localhost:4000/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Backend API Docs (/api/docs)
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl w-full text-left">
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
          <div className="text-emerald-400"><BookOpen className="w-6 h-6" /></div>
          <h2 className="text-base font-semibold text-white">Structured Learning</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Courses, milestone-driven tracks, and peer review systems.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
          <div className="text-cyan-400"><Users className="w-6 h-6" /></div>
          <h2 className="text-base font-semibold text-white">Subject Communities</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Domain-specific clubs focused on deep study rather than engagement farming.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
          <div className="text-indigo-400"><Cpu className="w-6 h-6" /></div>
          <h2 className="text-base font-semibold text-white">AI Learning Core</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            AI-driven cognitive scaffolding and intelligent concept synthesis.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
          <div className="text-amber-400"><Layers className="w-6 h-6" /></div>
          <h2 className="text-base font-semibold text-white">Unified Architecture</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Next.js frontend, NestJS modular monolith, Supabase PostgreSQL with RLS.
          </p>
        </div>
      </div>

      <footer className="mt-16 text-xs text-slate-500 font-mono">
        &copy; {new Date().getFullYear()} Global Learning & Social Ecosystem &middot; Zero-Trust Authorization &middot; Milestone 1
      </footer>
    </main>
  );
}
