# Auth Audit, Flash Fix, Onboarding & Admin Activity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix auth/hospital signup bugs, eliminate tracking flash, build multi-step onboarding flow, and add Supabase Realtime live activity feed to admin dashboard.

**Architecture:** Four sequential tasks building on each other. Auth fixes first (foundation), then flash fix (UX), then onboarding (new feature), then admin activity (new feature). Each task commits independently.

**Tech Stack:** React 18, Vite, TypeScript, Supabase (Auth + Realtime + DB), shadcn/ui, Tailwind CSS, TanStack React Query, React Router v6.

**Design doc:** `docs/plans/2026-03-06-auth-onboarding-admin-design.md`

---

## Task 1: Auth + Hospital Signup Audit & Fix

**Files to read first:**
- `src/hooks/useAuth.tsx` (full file — 427 lines)
- `src/pages/Auth.tsx` (full file — 812 lines)
- `src/lib/authCookie.ts` (full file)
- `src/hooks/useAdminCheck.ts` (full file)

### Step 1: Audit useAuth race conditions

Read `src/hooks/useAuth.tsx` completely. Look for:
- Is `setIsReady(true)` called AFTER `setUser()` and `setSession()` have resolved?
- Does `onAuthStateChange` properly handle the initial SIGNED_IN event vs session restore?
- Is there any case where `isReady=true` but `user=null` (ghost ready state)?
- Does the cookie restore path (`restoreSessionFromCookie`) call `setIsReady(true)` on both success AND failure?

**Expected bug:** `isReady` may be set to `true` before the user state is populated, causing components to render "unauthenticated" for a frame.

**Fix pattern:** Ensure `setIsReady(true)` is the LAST call after all state is set:
```typescript
// Correct order:
setUser(data.user);
setSession(data.session);
setIsReady(true); // Always last
```

If `isReady` is set inside a `try/catch`, ensure the `finally` block sets it:
```typescript
} finally {
  setIsReady(true);
}
```

### Step 2: Audit hospital signup error handling

In `src/pages/Auth.tsx`, find the hospital signup section (around line 221-234). Check:
- Is the `hospital_accounts` insert wrapped in try/catch?
- If the insert fails, does the user see an error message or just get stuck?
- Is there cleanup if insert fails (the auth user was already created)?

**Fix:** Add explicit error handling:
```typescript
const { error: hospitalError } = await supabase
  .from("hospital_accounts")
  .insert({ ... });

if (hospitalError) {
  setError("Account created but hospital profile failed. Please contact support.");
  // Do NOT redirect — show error in form
  return;
}
```

### Step 3: Check new user profiles row creation

Find where `profiles` row is created for new users. It should be created immediately on signup (via a Supabase trigger or in the signup handler itself).

Check: Does a new user always have a `profiles` row before any query runs?

If there's no DB trigger, find where profile creation happens in `Auth.tsx` and verify it runs before the redirect.

### Step 4: Audit redirect logic

Verify these redirects work correctly:
- New hospital signup → `/pending-approval` ✓ or ✗
- New student signup → email verification → `/dashboard` ✓ or ✗
- Login with unverified email → `/check-email` ✓ or ✗
- Login with rejected hospital → show rejection reason ✓ or ✗

Fix any broken redirects.

### Step 5: Write audit report

Create `docs/audit-auth-2026-03-06.md` with every bug found:
```markdown
# Auth Audit Report — 2026-03-06

## Bugs Found

### BUG-001: [Title]
- **File:** src/hooks/useAuth.tsx:123
- **Symptom:** [what the user sees]
- **Root cause:** [why it happens]
- **Fix:** [what was changed]
- **Status:** Fixed ✓

[repeat for each bug]
```

### Step 6: Commit

```bash
git add src/hooks/useAuth.tsx src/pages/Auth.tsx src/lib/authCookie.ts docs/audit-auth-2026-03-06.md
git commit -m "fix: auth race conditions, hospital signup error handling, redirect logic"
```

---

## Task 2: Fix Flash / Hydration Lag

**Files to read first:**
- `src/services/savedOpportunities.ts` (full file)
- `src/hooks/useOpportunitiesQuery.ts` (full file)
- Any component that renders a "Save" / "Track" button or enrollment badge

**Search for the flash source:**
```bash
grep -r "saved_opportunities\|isSaved\|isTracked\|isSaving" src/ --include="*.tsx" -l
```

Read each result file. Find components that:
1. Initialize state as `false` or `null`
2. Fetch from Supabase to update that state
3. Render conditional UI (button state, badge, text) based on that state

### Step 1: Fix each tracking component

For every component that renders tracking state:

**Pattern to apply:**
```typescript
import { useAuth } from '@/hooks/useAuth';

const { isReady } = useAuth();
const { data: savedData, isLoading } = useQuery({
  queryKey: ['saved-opportunities', user?.id],
  queryFn: () => fetchSavedOpportunities(user!.id),
  enabled: isReady && !!user?.id, // Don't fire until auth resolves
});

// Don't render wrong state — show skeleton instead
if (!isReady || isLoading) {
  return <Skeleton className="h-9 w-24 rounded-md" />;
}
```

### Step 2: Add Skeleton import to each file

`Skeleton` is in shadcn: `import { Skeleton } from '@/components/ui/skeleton';`

If it doesn't exist yet:
```bash
npx shadcn@latest add skeleton
```

### Step 3: Verify fix

Run the dev server and:
1. Log in as a student
2. Navigate to Opportunities page
3. Observe: Save buttons should show skeleton immediately, then snap to correct saved/unsaved state
4. There should be ZERO flash of wrong state

### Step 4: Commit

```bash
git add src/
git commit -m "fix: eliminate tracking state flash by gating renders on auth isReady"
```

---

## Task 3: User Onboarding System

**New files to create:**
- `src/components/onboarding/OnboardingFlow.tsx` — main modal component
- `src/components/onboarding/OnboardingStep.tsx` — individual step wrapper
- `src/hooks/useOnboarding.ts` — hook for onboarding state

**Files to modify:**
- `src/App.tsx` or main layout — trigger OnboardingFlow after login
- `src/pages/Settings.tsx` (if exists) — add "Redo onboarding" option

### Step 1: Create the onboarding hook

Create `src/hooks/useOnboarding.ts`:

```typescript
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useOnboarding() {
  const { user, isReady } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) {
      setIsLoading(false);
      return;
    }

    async function checkOnboarding() {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', user!.id)
        .single();

      setShowOnboarding(!data?.onboarding_complete);
      setIsLoading(false);
    }

    checkOnboarding();
  }, [isReady, user]);

  async function completeOnboarding() {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', user.id);
    setShowOnboarding(false);
  }

  function skipOnboarding() {
    setShowOnboarding(false);
  }

  return { showOnboarding, isLoading, completeOnboarding, skipOnboarding };
}
```

### Step 2: Create OnboardingFlow component

Create `src/components/onboarding/OnboardingFlow.tsx`:

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface OnboardingFlowProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS = ['role', 'info', 'action'] as const;
type Step = typeof STEPS[number];

export function OnboardingFlow({ open, onComplete, onSkip }: OnboardingFlowProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<'student' | 'hospital' | null>(null);
  const [info, setInfo] = useState({ university: '', major: '', graduation_year: '' });
  const [saving, setSaving] = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const totalSteps = STEPS.length;

  async function handleRoleSelect(selected: 'student' | 'hospital') {
    setRole(selected);
    if (selected === 'hospital') {
      onComplete();
      navigate('/auth?hospital=true');
      return;
    }
    setStep('info');
  }

  async function handleInfoSubmit() {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({
      university: info.university || null,
      major: info.major || null,
      graduation_year: info.graduation_year ? parseInt(info.graduation_year) : null,
    }).eq('id', user.id);
    setSaving(false);
    setStep('action');
  }

  async function handleActionSelect(action: 'browse' | 'profile') {
    onComplete();
    navigate(action === 'browse' ? '/opportunities' : '/profile');
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === stepIndex ? 'bg-primary' : i < stepIndex ? 'bg-primary/50' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step: Role */}
        {step === 'role' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Welcome to ClinicalHours</h2>
              <p className="text-muted-foreground text-sm mt-1">Let's get you set up. What best describes you?</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleRoleSelect('student')}
                className="border rounded-lg p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <div className="font-medium">Student</div>
                <div className="text-xs text-muted-foreground mt-1">Pre-med or clinical student seeking hours</div>
              </button>
              <button
                onClick={() => handleRoleSelect('hospital')}
                className="border rounded-lg p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <div className="font-medium">Clinical Site</div>
                <div className="text-xs text-muted-foreground mt-1">Hospital or clinic posting opportunities</div>
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={onSkip} className="w-full">
              Skip for now
            </Button>
          </div>
        )}

        {/* Step: Info */}
        {step === 'info' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Your Academic Info</h2>
              <p className="text-muted-foreground text-sm mt-1">This helps match you with relevant opportunities. All optional.</p>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="university">University</Label>
                <Input
                  id="university"
                  placeholder="e.g. University of Texas"
                  value={info.university}
                  onChange={(e) => setInfo(p => ({ ...p, university: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="major">Major</Label>
                <Input
                  id="major"
                  placeholder="e.g. Biology"
                  value={info.major}
                  onChange={(e) => setInfo(p => ({ ...p, major: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="grad-year">Graduation Year</Label>
                <Input
                  id="grad-year"
                  placeholder="e.g. 2027"
                  type="number"
                  value={info.graduation_year}
                  onChange={(e) => setInfo(p => ({ ...p, graduation_year: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onSkip} className="flex-1">Skip</Button>
              <Button onClick={handleInfoSubmit} disabled={saving} className="flex-1">
                {saving ? 'Saving...' : 'Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* Step: First Action */}
        {step === 'action' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">You're all set!</h2>
              <p className="text-muted-foreground text-sm mt-1">What would you like to do first?</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => handleActionSelect('browse')}
                className="border rounded-lg p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <div className="font-medium">Browse Opportunities</div>
                <div className="text-xs text-muted-foreground mt-1">Find clinical hours near you</div>
              </button>
              <button
                onClick={() => handleActionSelect('profile')}
                className="border rounded-lg p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <div className="font-medium">Complete My Profile</div>
                <div className="text-xs text-muted-foreground mt-1">Add your details to unlock all features</div>
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### Step 3: Wire OnboardingFlow into the app

In `src/App.tsx` (or the main authenticated layout), add:

```typescript
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { useOnboarding } from '@/hooks/useOnboarding';

// Inside the app component, after auth:
const { showOnboarding, completeOnboarding, skipOnboarding } = useOnboarding();

// In JSX, at the end before closing tag:
<OnboardingFlow
  open={showOnboarding}
  onComplete={completeOnboarding}
  onSkip={skipOnboarding}
/>
```

### Step 4: Add empty states to key pages

For every page a new user lands on after onboarding, ensure there's instructional content when no data exists.

**Dashboard:** If no saved opportunities, show:
```typescript
// Empty state component:
<div className="text-center py-12">
  <p className="text-muted-foreground">You haven't saved any opportunities yet.</p>
  <Button asChild className="mt-4">
    <Link to="/opportunities">Browse Opportunities</Link>
  </Button>
</div>
```

Check these pages: `/dashboard`, `/opportunities`, `/profile`. Add empty states where missing.

### Step 5: Commit

```bash
git add src/components/onboarding/ src/hooks/useOnboarding.ts src/App.tsx
git commit -m "feat: add multi-step onboarding flow with role selection and empty states"
```

---

## Task 4: Admin Live Activity Feed

**New files to create:**
- `src/components/admin/AdminActivityTab.tsx` — main tab component
- `src/hooks/useActivityFeed.ts` — Realtime subscription hook

**Files to modify:**
- `src/pages/AdminDashboard.tsx` — add 6th tab

### Step 1: Create the activity feed hook

Create `src/hooks/useActivityFeed.ts`:

```typescript
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityEvent {
  id: string;
  timestamp: string;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  record: Record<string, unknown>;
  userId?: string;
}

const MAX_EVENTS = 200;

export function useActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel('admin-activity-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        addEvent('profiles', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hospital_accounts' }, (payload) => {
        addEvent('hospital_accounts', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_opportunities' }, (payload) => {
        addEvent('saved_opportunities', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experience_entries' }, (payload) => {
        addEvent('experience_entries', payload);
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function addEvent(table: string, payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) {
    const event: ActivityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      table,
      action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
      record: payload.new || payload.old,
      userId: (payload.new?.user_id || payload.new?.id || payload.old?.user_id) as string | undefined,
    };

    setEvents(prev => [event, ...prev].slice(0, MAX_EVENTS));
  }

  return { events, isConnected };
}
```

### Step 2: Create AdminActivityTab component

Create `src/components/admin/AdminActivityTab.tsx`:

```typescript
import { useState } from 'react';
import { useActivityFeed, ActivityEvent } from '@/hooks/useActivityFeed';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

const ACTION_COLORS = {
  INSERT: 'bg-green-500/10 text-green-500 border-green-500/20',
  UPDATE: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  DELETE: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const TABLE_LABELS: Record<string, string> = {
  profiles: 'Profile',
  hospital_accounts: 'Hospital',
  saved_opportunities: 'Saved Opp',
  experience_entries: 'Hours Log',
};

function EventRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex items-start gap-3 py-2 px-3 hover:bg-muted/40 rounded-md transition-colors">
      <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5 w-20 shrink-0">
        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
      </span>
      <Badge variant="outline" className={`text-xs shrink-0 ${ACTION_COLORS[event.action]}`}>
        {event.action}
      </Badge>
      <span className="text-xs text-muted-foreground shrink-0">
        {TABLE_LABELS[event.table] ?? event.table}
      </span>
      <span className="text-xs font-mono text-foreground/80 truncate">
        {event.userId ? `user:${event.userId.slice(0, 8)}...` : '—'}
      </span>
    </div>
  );
}

export function AdminActivityTab() {
  const { events, isConnected } = useActivityFeed();
  const [paused, setPaused] = useState(false);
  const [userFilter, setUserFilter] = useState('');

  const filtered = userFilter
    ? events.filter(e => e.userId?.includes(userFilter))
    : events;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Live Activity</h2>
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{events.length} events</span>
          <Button variant="outline" size="sm" onClick={() => setPaused(p => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
        </div>
      </div>

      {/* User filter */}
      <Input
        placeholder="Filter by user ID..."
        value={userFilter}
        onChange={(e) => setUserFilter(e.target.value)}
        className="max-w-sm"
      />

      {/* Event feed */}
      <div className="border rounded-lg">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {events.length === 0
              ? 'Waiting for activity... Events will appear here in real-time.'
              : 'No events match your filter.'}
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="p-2">
              {filtered.map(event => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
```

### Step 3: Add Activity tab to AdminDashboard

In `src/pages/AdminDashboard.tsx`:

1. Import the new component:
```typescript
import { AdminActivityTab } from '@/components/admin/AdminActivityTab';
```

2. Add to the tabs list (find where tabs are defined and add):
```typescript
{ value: 'activity', label: 'Activity' }
```

3. Add the tab content panel:
```typescript
<TabsContent value="activity">
  <AdminActivityTab />
</TabsContent>
```

### Step 4: Enable Realtime on tables in Supabase

Supabase Realtime requires tables to be enabled for replication. If not already enabled, run in Supabase SQL editor:

```sql
-- Enable realtime for activity tracking
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE hospital_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE saved_opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE experience_entries;
```

Note this in the commit message as a required manual step.

### Step 5: Verify

1. Open admin dashboard at `/admin`
2. Navigate to "Activity" tab
3. In another browser tab, sign up as a new user
4. Within 2 seconds, a green INSERT event should appear for `profiles`
5. Green dot should show "Connected"

### Step 6: Commit

```bash
git add src/components/admin/AdminActivityTab.tsx src/hooks/useActivityFeed.ts src/pages/AdminDashboard.tsx
git commit -m "feat: add live activity feed to admin dashboard with Supabase Realtime"
```

---

## Final: Test the complete flow

1. Fresh incognito window → sign up as student → onboarding flow appears → complete it → `onboarding_complete = true` in DB
2. Log out → log back in → onboarding does NOT appear
3. Browse opportunities → save one → no flash of wrong state
4. Hospital signup → error handled gracefully if DB insert fails
5. Admin `/admin` → Activity tab → green dot → events appear on user actions

---

## Execution Options

After saving this plan, two execution options:

**1. Subagent-Driven (this session)** — Fresh subagent per task, two-stage review after each. Use `superpowers:subagent-driven-development`.

**2. Parallel Session (separate)** — Open new session, use `superpowers:executing-plans`.
