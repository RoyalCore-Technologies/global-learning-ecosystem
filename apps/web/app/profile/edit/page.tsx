'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/feedback';
import { apiClient } from '@/lib/api-client';
import type { Profile } from '@platform/types';
import {
  User,
  Sparkles,
  Link as LinkIcon,
  Bell,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function EditProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [skillsString, setSkillsString] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // Notification Preferences State
  const [inAppComments, setInAppComments] = useState(true);
  const [inAppUpvotes, setInAppUpvotes] = useState(true);
  const [inAppEndorsements, setInAppEndorsements] = useState(true);
  const [inAppFollows, setInAppFollows] = useState(true);
  const [inAppSystem, setInAppSystem] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);
  const [emailAnnouncements, setEmailAnnouncements] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient<Profile>('profiles/me')
      .then((res) => {
        if (res.data) {
          const p = res.data;
          setProfile(p);
          setDisplayName(p.display_name || '');
          setHeadline(p.headline || '');
          setBio(p.bio || '');
          setSkillsString((p.skills || []).join(', '));
          setGithubUrl(p.github_url || '');
          setLinkedinUrl(p.linkedin_url || '');
          setWebsiteUrl(p.website_url || '');

          if (p.notification_preferences) {
            const prefs = p.notification_preferences;
            setInAppComments(prefs.in_app?.comments ?? true);
            setInAppUpvotes(prefs.in_app?.upvotes ?? true);
            setInAppEndorsements(prefs.in_app?.endorsements ?? true);
            setInAppFollows(prefs.in_app?.follows ?? true);
            setInAppSystem(prefs.in_app?.system ?? true);
            setEmailDigest(prefs.email?.weekly_digest ?? true);
            setEmailAnnouncements(prefs.email?.major_announcements ?? true);
          }
        }
      })
      .catch((err) => {
        setErrorMessage(err.message || 'Failed to load profile.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const skills = skillsString
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const payload = {
      display_name: displayName.trim(),
      headline: headline.trim() || undefined,
      bio: bio.trim() || undefined,
      skills,
      github_url: githubUrl.trim() || undefined,
      linkedin_url: linkedinUrl.trim() || undefined,
      website_url: websiteUrl.trim() || undefined,
      notification_preferences: {
        in_app: {
          comments: inAppComments,
          upvotes: inAppUpvotes,
          endorsements: inAppEndorsements,
          follows: inAppFollows,
          system: inAppSystem,
        },
        email: {
          weekly_digest: emailDigest,
          major_announcements: emailAnnouncements,
        },
      },
    };

    try {
      const res = await apiClient<Profile>('profiles/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (res.data) {
        setSuccessMessage('Profile and preferences updated successfully.');
        setTimeout(() => {
          if (profile?.username) {
            router.push(`/profile/${profile.username}`);
          }
        }, 1200);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-xs text-slate-400 font-mono">Loading your profile preferences...</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6 pb-16">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={profile ? `/profile/${profile.username}` : '/dashboard'}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Profile</span>
          </Link>
          <span className="text-xs text-slate-500 font-mono">Profile Settings</span>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-950/70 border border-emerald-500/50 flex items-center gap-3 text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-500/50 flex items-center gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card 1: Scholar Identity */}
          <Card variant="elevated">
            <CardHeader className="border-b border-surface-border/60 pb-3">
              <div className="flex items-center gap-2 text-white">
                <User className="w-4 h-4 text-brand-indigo-400" />
                <CardTitle className="text-base font-bold">Scholar Identity & Credentials</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Display Name <span className="text-rose-400">*</span>
                </label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Dr. Alex Rivera"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Academic Headline
                </label>
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Doctoral Researcher in Distributed Systems & Quantum Circuits"
                  maxLength={160}
                />
                <span className="text-[10px] text-slate-500 font-mono">Max 160 characters</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Scholarly Biography
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Detail your academic background, research inquiries, active projects, or teaching areas..."
                  rows={4}
                  maxLength={2000}
                  className="w-full rounded-xl bg-surface-card border border-surface-border p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-indigo-500 transition-colors"
                />
                <span className="text-[10px] text-slate-500 font-mono">Max 2,000 characters</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Research Disciplines & Skills
                </label>
                <Input
                  value={skillsString}
                  onChange={(e) => setSkillsString(e.target.value)}
                  placeholder="rust, distributed-systems, peano-arithmetic, machine-learning"
                />
                <span className="text-[10px] text-slate-500 font-mono">
                  Separate tags with commas. These will be highlighted on your profile.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Academic & Professional Links */}
          <Card variant="elevated">
            <CardHeader className="border-b border-surface-border/60 pb-3">
              <div className="flex items-center gap-2 text-white">
                <LinkIcon className="w-4 h-4 text-brand-indigo-400" />
                <CardTitle className="text-base font-bold">Academic Presence & External Repositories</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">GitHub Profile URL</label>
                <Input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">LinkedIn Profile URL</label>
                <Input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Personal Research Website URL
                </label>
                <Input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://scholar.research.edu"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Notification & Alert Preferences */}
          <Card variant="elevated">
            <CardHeader className="border-b border-surface-border/60 pb-3">
              <div className="flex items-center gap-2 text-white">
                <Bell className="w-4 h-4 text-brand-indigo-400" />
                <CardTitle className="text-base font-bold">Notification & Alert Preferences</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  In-App Notification Alerts
                </h4>
                <div className="space-y-2.5">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-surface-base border border-surface-border cursor-pointer">
                    <span className="text-xs text-slate-200">Discussion replies to your posts and comments</span>
                    <input
                      type="checkbox"
                      checked={inAppComments}
                      onChange={(e) => setInAppComments(e.target.checked)}
                      className="w-4 h-4 accent-brand-indigo-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-surface-base border border-surface-border cursor-pointer">
                    <span className="text-xs text-slate-200">Academic accuracy endorsements from verified peers</span>
                    <input
                      type="checkbox"
                      checked={inAppEndorsements}
                      onChange={(e) => setInAppEndorsements(e.target.checked)}
                      className="w-4 h-4 accent-brand-indigo-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-surface-base border border-surface-border cursor-pointer">
                    <span className="text-xs text-slate-200">Insightful votes from scholars</span>
                    <input
                      type="checkbox"
                      checked={inAppUpvotes}
                      onChange={(e) => setInAppUpvotes(e.target.checked)}
                      className="w-4 h-4 accent-brand-indigo-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-surface-base border border-surface-border cursor-pointer">
                    <span className="text-xs text-slate-200">New scholar followers</span>
                    <input
                      type="checkbox"
                      checked={inAppFollows}
                      onChange={(e) => setInAppFollows(e.target.checked)}
                      className="w-4 h-4 accent-brand-indigo-500 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Email Communications
                </h4>
                <div className="space-y-2.5">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-surface-base border border-surface-border cursor-pointer">
                    <span className="text-xs text-slate-200">Weekly academic digest and top peer inquiries</span>
                    <input
                      type="checkbox"
                      checked={emailDigest}
                      onChange={(e) => setEmailDigest(e.target.checked)}
                      className="w-4 h-4 accent-brand-indigo-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-surface-base border border-surface-border cursor-pointer">
                    <span className="text-xs text-slate-200">Major platform security and academic announcements</span>
                    <input
                      type="checkbox"
                      checked={emailAnnouncements}
                      onChange={(e) => setEmailAnnouncements(e.target.checked)}
                      className="w-4 h-4 accent-brand-indigo-500 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href={profile ? `/profile/${profile.username}` : '/dashboard'}>
              <Button type="button" variant="secondary" size="md">
                Cancel
              </Button>
            </Link>

            <Button
              type="submit"
              variant="primary"
              size="md"
              leftIcon={<Save className="w-4 h-4" />}
              isLoading={saving}
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
