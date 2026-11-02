'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LearnovaLogo } from '@/components/brand/learnova-logo';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Lock, School, ShieldCheck, ArrowRight, Check } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'STUDENT' | 'BEGINNER'>('STUDENT');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password) {
      setError('Please fill in all required registration fields.');
      return;
    }

    if (!agreed) {
      setError('Please accept the Learnova Academic Integrity & Community Honor Code.');
      return;
    }

    setIsLoading(true);
    // Simulated registration and onboarding handshake
    setTimeout(() => {
      setIsLoading(false);
      router.push('/dashboard');
    }, 700);
  };

  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <LearnovaLogo size="lg" showTagline />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-4">
            Join the Global Learning & Social Ecosystem
          </h1>
          <p className="text-xs text-slate-400">
            A knowledge-first platform engineered for academic collaboration, structured courses, and peer review.
          </p>
        </div>

        {/* Registration Card */}
        <Card className="border-surface-border bg-surface-card/80 backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 pt-6">
              {error && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300">
                  {error}
                </div>
              )}

              {/* Step 1: Initial Learning Path Selection */}
              <div className="space-y-2 text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Select Onboarding Learning Path
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setSelectedRole('STUDENT')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedRole === 'STUDENT'
                        ? 'border-brand-indigo-500 bg-brand-indigo-950/40 shadow-sm'
                        : 'border-surface-border bg-surface-elevated/40 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Student</span>
                      {selectedRole === 'STUDENT' && (
                        <span className="p-1 rounded-full bg-brand-indigo-600 text-white">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Enrolled in formal degrees, bootcamps, or structured tracks.
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedRole('BEGINNER')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedRole === 'BEGINNER'
                        ? 'border-brand-cyan-500 bg-brand-cyan-950/40 shadow-sm'
                        : 'border-surface-border bg-surface-elevated/40 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Beginner</span>
                      {selectedRole === 'BEGINNER' && (
                        <span className="p-1 rounded-full bg-brand-cyan-600 text-white">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Starting a new domain from ground up with foundational guides.
                    </p>
                  </div>
                </div>

                {/* Institutional Role Verification Disclosure */}
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-surface-elevated/60 border border-surface-border text-[11px] text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-300">Educator & Researcher Roles:</strong> To maintain academic integrity, Educator, Creator, and Researcher credentials require institutional accreditation and cannot be self-assigned.
                  </span>
                </div>
              </div>

              {/* Personal Details */}
              <div className="space-y-3">
                <Input
                  label="Full Name / Display Name"
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  leftIcon={<User className="w-4 h-4" />}
                  required
                />

                <Input
                  label="Academic / Work Email"
                  type="email"
                  placeholder="ada@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                  helperText="Use your institutional email for expedited domain verification."
                  required
                />

                <Input
                  label="University / Organization (Optional)"
                  placeholder="Oxford University / Self-Directed"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  leftIcon={<School className="w-4 h-4" />}
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  required
                />
              </div>

              {/* Honor Code Checkbox */}
              <label className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="rounded bg-surface-elevated border-surface-border text-brand-indigo-600 focus:ring-brand-indigo-500 mt-0.5"
                />
                <span>
                  I agree to the <span className="text-white underline">Terms of Service</span> and pledge adherence to the <span className="text-white underline">Learnova Academic Integrity Honor Code</span>.
                </span>
              </label>

              <Button
                type="submit"
                size="md"
                className="w-full mt-2"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Create Account &amp; Begin Learning
              </Button>
            </CardContent>

            <CardFooter className="justify-center border-t border-surface-border/60 py-4 text-xs text-slate-400">
              Already have an account?{' '}
              <Link
                href="/auth/login"
                className="ml-1 font-semibold text-brand-indigo-400 hover:text-brand-indigo-300"
              >
                Sign in
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
