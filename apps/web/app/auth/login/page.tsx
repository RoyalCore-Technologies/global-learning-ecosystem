'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LearnovaLogo } from '@/components/brand/learnova-logo';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, Mail, ArrowRight, Github } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please provide both your academic email and password.');
      return;
    }

    setIsLoading(true);
    // Simulated authentication handshake
    setTimeout(() => {
      setIsLoading(false);
      router.push('/dashboard');
    }, 700);
  };

  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <LearnovaLogo size="lg" showTagline />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-4">
            Welcome back
          </h1>
          <p className="text-xs text-slate-400">
            Sign in to access your courses, study communities, and knowledge stream.
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-surface-border bg-surface-card/80 backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-6">
              {error && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300">
                  {error}
                </div>
              )}

              <Input
                label="Academic / Institutional Email"
                type="email"
                placeholder="learner@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400">
                  <input
                    type="checkbox"
                    className="rounded bg-surface-elevated border-surface-border text-brand-indigo-600 focus:ring-brand-indigo-500"
                  />
                  <span>Remember session</span>
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="font-medium text-brand-indigo-400 hover:text-brand-indigo-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                size="md"
                className="w-full mt-2"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Learnova
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-surface-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface-card px-2 text-slate-500 font-mono">
                    Institutional SSO / Auth
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<Github className="w-4 h-4" />}
                  className="w-full"
                >
                  GitHub
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  EduGain / SAML
                </Button>
              </div>
            </CardContent>

            <CardFooter className="justify-center border-t border-surface-border/60 py-4 text-xs text-slate-400">
              New to the ecosystem?{' '}
              <Link
                href="/auth/register"
                className="ml-1 font-semibold text-brand-indigo-400 hover:text-brand-indigo-300"
              >
                Create an account
              </Link>
            </CardFooter>
          </form>
        </Card>

        {/* Philosophy Footer */}
        <p className="text-center text-[11px] text-slate-500">
          Knowledge over popularity &middot; Zero-trust verification &middot; Learnova
        </p>
      </div>
    </div>
  );
}
