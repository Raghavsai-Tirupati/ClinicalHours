# Admin Applicant Profile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `AdminUserProfile.tsx` to show a sketch-matching card header (Last, First / contact info / avatar) and a 9-tab layout with individual application rows and mirrored hospital-admin sections.

**Architecture:** Single-file modification of `src/components/admin/AdminUserProfile.tsx`. New data (applications, answers, notes, documents, email logs) is fetched in parallel inside the existing `fetchUserData()` function using application IDs as the join key. All per-application tabs group their content under a position heading.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Supabase JS client, shadcn/ui (Tabs, Badge, Card, Table), Tailwind CSS, Vitest + React Testing Library (added in Task 1)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/components/admin/AdminUserProfile.tsx` | All changes — header, tabs, data fetching |
| Create | `src/components/admin/__tests__/AdminUserProfile.utils.test.ts` | Unit tests for pure utility functions |

---

## Task 1: Add Vitest + React Testing Library

**Files:**
- Modify: `package.json` (dev deps)
- Create: `vite.config.ts` or modify existing (test block)
- Create: `src/components/admin/__tests__/AdminUserProfile.utils.test.ts`

- [ ] **Step 1.1: Install test dependencies**

```bash
cd /c/Users/shiva/ClinicalHours
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 1.2: Check if vite.config.ts exists and read it**

```bash
cat vite.config.ts 2>/dev/null || cat vite.config.js 2>/dev/null
```

- [ ] **Step 1.3: Add test config to vite.config.ts**

Open `vite.config.ts` and add the `test` block. The file likely looks something like:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ... existing config ...
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
```

- [ ] **Step 1.4: Create test setup file**

Create `src/test-setup.ts`:

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 1.5: Add test script to package.json**

Open `package.json` and add to the `"scripts"` block:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 1.6: Create the utility test file with two failing tests**

Create `src/components/admin/__tests__/AdminUserProfile.utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatLastFirst, emailToColor } from '../AdminUserProfile';

describe('formatLastFirst', () => {
  it('formats "Shivam Kanodia" as "Kanodia, Shivam"', () => {
    expect(formatLastFirst('Shivam Kanodia')).toBe('Kanodia, Shivam');
  });

  it('handles multi-word first names: "Mary Jo Smith" → "Smith, Mary Jo"', () => {
    expect(formatLastFirst('Mary Jo Smith')).toBe('Smith, Mary Jo');
  });

  it('returns the raw value when there is no space', () => {
    expect(formatLastFirst('Madonna')).toBe('Madonna');
  });
});

describe('emailToColor', () => {
  it('returns a valid Tailwind bg color class', () => {
    const validColors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
      'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
    ];
    const result = emailToColor('shivam@example.com');
    expect(validColors).toContain(result);
  });

  it('returns the same color for the same email (deterministic)', () => {
    expect(emailToColor('a@b.com')).toBe(emailToColor('a@b.com'));
  });

  it('returns different colors for different emails (likely)', () => {
    // Not guaranteed but statistically true for these two
    const c1 = emailToColor('alice@example.com');
    const c2 = emailToColor('bob@example.com');
    // At minimum both should be valid color strings
    expect(c1).toMatch(/^bg-\w+-500$/);
    expect(c2).toMatch(/^bg-\w+-500$/);
  });
});
```

- [ ] **Step 1.7: Run tests — expect them to FAIL (functions not exported yet)**

```bash
npm run test:run
```

Expected output: FAIL — "formatLastFirst is not exported from AdminUserProfile"

- [ ] **Step 1.8: Commit test scaffolding**

```bash
git add package.json vite.config.ts src/test-setup.ts src/components/admin/__tests__/AdminUserProfile.utils.test.ts
git commit -m "test: scaffold vitest + RTL, add failing utility tests for profile redesign"
```

---

## Task 2: Add Utility Functions and New Types

**Files:**
- Modify: `src/components/admin/AdminUserProfile.tsx` (add exports at top of file, add new interfaces)

- [ ] **Step 2.1: Add exported utility functions near the top of `AdminUserProfile.tsx`**

After the import block (around line 41), add:

```ts
// ─── Utility functions (exported for testing) ────────────────────────────────

export function formatLastFirst(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) return fullName;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return `${last}, ${first}`;
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
] as const;

export function emailToColor(email: string): string {
  const hash = [...email].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
```

- [ ] **Step 2.2: Add new interfaces after the existing `Review` interface (around line 128)**

```ts
interface ApplicationRow {
  id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  interview_invited_at: string | null;
  interview_confirmed_at: string | null;
  availability_json: {
    days?: string[];
    time_pref?: string;
    hours_per_week?: number;
    commitment?: string;
  } | null;
  position: {
    title: string;
    opportunity: { name: string } | null;
  } | null;
}

interface ResponseRow {
  id: string;
  application_id: string;
  answer_text: string | null;
  answer_options: string[] | null;
  created_at: string;
  question: { question_text: string; question_type: string } | null;
}

interface NoteRow {
  id: string;
  application_id: string;
  body: string;
  created_at: string;
  created_by_email: string | null;
}

interface DocumentRow {
  id: string;
  application_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  created_at: string;
}

interface EmailLogRow {
  id: string;
  subject: string;
  template_name: string | null;
  sent_by: string;
  created_at: string;
}
```

- [ ] **Step 2.3: Run tests — expect them to PASS now**

```bash
npm run test:run
```

Expected output: PASS — all 5 utility tests green

- [ ] **Step 2.4: Commit**

```bash
git add src/components/admin/AdminUserProfile.tsx
git commit -m "feat: add utility functions and types for profile redesign"
```

---

## Task 3: Expand Data Fetching

**Files:**
- Modify: `src/components/admin/AdminUserProfile.tsx` — state declarations + `fetchUserData()`

- [ ] **Step 3.1: Add new state variables after the existing state declarations (around line 143)**

Find the block:
```ts
const [reviews, setReviews] = useState<Review[]>([]);
```

Add directly after it:
```ts
const [applications, setApplications] = useState<ApplicationRow[]>([]);
const [responses, setResponses] = useState<ResponseRow[]>([]);
const [notes, setNotes] = useState<NoteRow[]>([]);
const [documents, setDocuments] = useState<DocumentRow[]>([]);
const [emailLogs, setEmailLogs] = useState<EmailLogRow[]>([]);
```

- [ ] **Step 3.2: Add new fetches inside `fetchUserData()`, after the existing `profileResponse` block**

The existing function (around line 150) calls `admin-get-user-profile` and sets state. After the `setReviews(...)` call inside `if (profileData.success)`, add:

```ts
// Fetch applications for this user
const { data: appRows } = await supabase
  .from('student_applications')
  .select(`
    id, status, submitted_at, reviewed_at,
    interview_invited_at, interview_confirmed_at, availability_json,
    position:hospital_positions(
      title,
      opportunity:opportunities(name)
    )
  `)
  .eq('student_id', user.id)
  .order('submitted_at', { ascending: false });

const fetchedApps: ApplicationRow[] = (appRows ?? []) as ApplicationRow[];
setApplications(fetchedApps);

// Use application IDs to batch-fetch dependent data
const appIds = fetchedApps.map((a) => a.id);

if (appIds.length > 0) {
  const [responsesResult, notesResult, documentsResult] = await Promise.all([
    supabase
      .from('application_answers')
      .select(`
        id, application_id, answer_text, answer_options, created_at,
        question:position_questions(question_text, question_type)
      `)
      .in('application_id', appIds),
    supabase
      .from('application_notes')
      .select('id, application_id, body, created_at, created_by_email')
      .in('application_id', appIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('application_documents')
      .select('id, application_id, file_name, file_url, file_type, created_at')
      .in('application_id', appIds),
  ]);

  setResponses((responsesResult.data ?? []) as ResponseRow[]);
  setNotes((notesResult.data ?? []) as NoteRow[]);
  setDocuments((documentsResult.data ?? []) as DocumentRow[]);
}

// Contact history: email_send_logs where this user's email is in recipient_emails
const { data: emailLogRows } = await supabase
  .from('email_send_logs')
  .select('id, subject, template_name, sent_by, created_at')
  .contains('recipient_emails', [user.email])
  .order('created_at', { ascending: false });

setEmailLogs((emailLogRows ?? []) as EmailLogRow[]);
```

- [ ] **Step 3.3: Reset new state when dialog closes**

Find the `useEffect` that calls `fetchUserData()` (around line 144). After the `if (open && user)` branch add an `else` reset:

```ts
useEffect(() => {
  if (open && user) {
    fetchUserData();
  } else {
    setApplications([]);
    setResponses([]);
    setNotes([]);
    setDocuments([]);
    setEmailLogs([]);
  }
}, [open, user]);
```

- [ ] **Step 3.4: Run tests to make sure nothing broke**

```bash
npm run test:run
```

Expected: PASS (utility tests still green; no component tests yet)

- [ ] **Step 3.5: Commit**

```bash
git add src/components/admin/AdminUserProfile.tsx
git commit -m "feat: fetch applications, responses, notes, documents, email logs in AdminUserProfile"
```

---

## Task 4: Redesign the Card Header

**Files:**
- Modify: `src/components/admin/AdminUserProfile.tsx` — the header JSX block

- [ ] **Step 4.1: Replace the existing User Header block**

Find this block (around line 240–278):
```tsx
{/* User Header */}
<div className="flex items-start gap-4">
  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
    <User className="h-8 w-8 text-primary" />
  </div>
  ...
</div>
```

Replace the entire block with:

```tsx
{/* Card Header */}
<div className="flex items-start justify-between gap-4">
  {/* Left: name + contact info */}
  <div className="flex-1 min-w-0">
    <h3 className="text-xl font-semibold tracking-tight">
      {formatLastFirst(user.full_name)}
    </h3>
    <div className="mt-3 space-y-1.5 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Mail className="h-3.5 w-3.5 shrink-0" />
        <span className="break-all">{user.email}</span>
      </div>
      {user.phone && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span>{user.phone}</span>
        </div>
      )}
      {(user.city || user.state) && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>{[user.city, user.state].filter(Boolean).join(', ')}</span>
        </div>
      )}
      {fullProfile?.linkedin_url && (
        <div className="flex items-center gap-2">
          <Linkedin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <a
            href={fullProfile.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            LinkedIn
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {user.email_verified ? (
          <Badge variant="default" className="text-xs">
            <CheckCircle className="h-3 w-3 mr-1" />
            Email Verified
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            <XCircle className="h-3 w-3 mr-1" />
            Email Not Verified
          </Badge>
        )}
        {user.email_opt_in ? (
          <Badge variant="outline" className="text-xs">
            <Mail className="h-3 w-3 mr-1" />
            Subscribed
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            <Mail className="h-3 w-3 mr-1" />
            Not Subscribed
          </Badge>
        )}
      </div>
    </div>
  </div>

  {/* Right: avatar */}
  <div
    className={`h-14 w-14 rounded-full shrink-0 flex items-center justify-center text-white text-xl font-bold ${emailToColor(user.email)}`}
  >
    {user.full_name.charAt(0).toUpperCase()}
  </div>
</div>
```

- [ ] **Step 4.2: Remove the now-unused `<Separator />` that followed the old header**

Find and delete:
```tsx
<Separator />
```
(the one between the old header and the Tabs — around line 279)

- [ ] **Step 4.3: Verify the app still starts**

```bash
npm run dev
```

Open the admin dashboard, click "View" on any user. The header should show Last, First with colored avatar. No console errors.

- [ ] **Step 4.4: Commit**

```bash
git add src/components/admin/AdminUserProfile.tsx
git commit -m "feat: redesign AdminUserProfile card header with Last,First name and avatar"
```

---

## Task 5: Add Applications Tab

**Files:**
- Modify: `src/components/admin/AdminUserProfile.tsx` — TabsList + new TabsContent

The `STATUS_COLORS` map lives in `src/types/positions.ts`. Import it rather than duplicating:

- [ ] **Step 5.1: Add STATUS_COLORS import**

At the top of the file, add to the existing imports:

```ts
import { STATUS_COLORS } from '@/types/positions';
```

If `STATUS_COLORS` is not exported from that file, open `src/types/positions.ts`, find the `STATUS_COLORS` object, and add `export` before `const STATUS_COLORS`.

- [ ] **Step 5.2: Update the TabsList from 4 to 9 tabs**

Find:
```tsx
<TabsList className="grid w-full grid-cols-4">
  <TabsTrigger value="activity">Activity</TabsTrigger>
  <TabsTrigger value="profile">Profile</TabsTrigger>
  <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
  <TabsTrigger value="hours">Hours Log</TabsTrigger>
</TabsList>
```

Replace with:
```tsx
<TabsList className="flex w-full overflow-x-auto flex-nowrap justify-start h-auto p-1 gap-1">
  <TabsTrigger value="applications" className="shrink-0">Applications</TabsTrigger>
  <TabsTrigger value="responses" className="shrink-0">Responses</TabsTrigger>
  <TabsTrigger value="notes" className="shrink-0">Notes</TabsTrigger>
  <TabsTrigger value="documents" className="shrink-0">Documents</TabsTrigger>
  <TabsTrigger value="availability" className="shrink-0">Availability</TabsTrigger>
  <TabsTrigger value="interview" className="shrink-0">Interview</TabsTrigger>
  <TabsTrigger value="contact-history" className="shrink-0">Contact History</TabsTrigger>
  <TabsTrigger value="profile" className="shrink-0">Profile</TabsTrigger>
  <TabsTrigger value="activity" className="shrink-0">Activity</TabsTrigger>
</TabsList>
```

Also update the `<Tabs>` default value:
```tsx
<Tabs defaultValue="applications" className="w-full">
```

- [ ] **Step 5.3: Add the Applications TabsContent**

Insert this as the FIRST `<TabsContent>` block, before the existing Activity tab:

```tsx
{/* Applications Tab */}
<TabsContent value="applications" className="mt-4">
  {applications.length === 0 ? (
    <div className="text-center py-8 text-muted-foreground">
      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
      <p>No applications yet</p>
    </div>
  ) : (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2 font-medium">Hospital / Position</th>
            <th className="text-left px-4 py-2 font-medium">Status</th>
            <th className="text-left px-4 py-2 font-medium">Submitted</th>
            <th className="text-left px-4 py-2 font-medium">Reviewed</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <tr key={app.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-4 py-3">
                <p className="font-medium">{app.position?.title ?? '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {app.position?.opportunity?.name ?? '—'}
                </p>
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant="secondary"
                  className={`text-xs ${STATUS_COLORS[app.status as keyof typeof STATUS_COLORS] ?? ''}`}
                >
                  {app.status.replace('_', ' ')}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDateShort(app.submitted_at)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {app.reviewed_at ? formatDateShort(app.reviewed_at) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</TabsContent>
```

- [ ] **Step 5.4: Verify in browser — Applications tab should show a table (or empty state)**

```bash
npm run dev
```

- [ ] **Step 5.5: Commit**

```bash
git add src/components/admin/AdminUserProfile.tsx src/types/positions.ts
git commit -m "feat: add Applications tab to AdminUserProfile"
```

---

## Task 6: Add Responses and Notes Tabs

**Files:**
- Modify: `src/components/admin/AdminUserProfile.tsx`

Both tabs group their content by application using the `applications` array as the grouping key.

- [ ] **Step 6.1: Add a shared helper function for the group heading**

Add this helper near the utility functions at the top of the component file (before the `export default` function):

```ts
function appLabel(app: ApplicationRow): string {
  const pos = app.position?.title ?? 'Unknown Position';
  const opp = app.position?.opportunity?.name ?? 'Unknown Hospital';
  return `${pos} @ ${opp}`;
}
```

- [ ] **Step 6.2: Add Responses TabsContent after the Applications tab**

```tsx
{/* Responses Tab */}
<TabsContent value="responses" className="mt-4 space-y-4">
  {applications.length === 0 || responses.length === 0 ? (
    <div className="text-center py-8 text-muted-foreground">
      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
      <p>No application responses on record</p>
    </div>
  ) : (
    applications.map((app) => {
      const appResponses = responses.filter((r) => r.application_id === app.id);
      if (appResponses.length === 0) return null;
      return (
        <Card key={app.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{appLabel(app)}</CardTitle>
            <CardDescription>{formatDateShort(app.submitted_at)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {appResponses.map((r) => (
              <div key={r.id} className="text-sm">
                <p className="font-medium text-muted-foreground">
                  {r.question?.question_text ?? 'Question'}
                </p>
                <p className="mt-0.5">
                  {r.answer_text ?? (r.answer_options?.join(', ') ?? '—')}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      );
    })
  )}
</TabsContent>
```

- [ ] **Step 6.3: Add Notes TabsContent after Responses**

```tsx
{/* Notes Tab */}
<TabsContent value="notes" className="mt-4 space-y-4">
  {applications.length === 0 || notes.length === 0 ? (
    <div className="text-center py-8 text-muted-foreground">
      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
      <p>No admin notes on record</p>
    </div>
  ) : (
    applications.map((app) => {
      const appNotes = notes.filter((n) => n.application_id === app.id);
      if (appNotes.length === 0) return null;
      return (
        <Card key={app.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{appLabel(app)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {appNotes.map((note) => (
              <div key={note.id} className="text-sm border-b last:border-0 pb-3 last:pb-0">
                <p className="text-xs text-muted-foreground mb-1">
                  {formatDate(note.created_at)}
                  {note.created_by_email && ` · ${note.created_by_email}`}
                </p>
                <p>{note.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      );
    })
  )}
</TabsContent>
```

- [ ] **Step 6.4: Verify in browser — both tabs render without errors**

- [ ] **Step 6.5: Commit**

```bash
git add src/components/admin/AdminUserProfile.tsx
git commit -m "feat: add Responses and Notes tabs to AdminUserProfile"
```

---

## Task 7: Add Documents, Availability, and Interview Tabs

**Files:**
- Modify: `src/components/admin/AdminUserProfile.tsx`

- [ ] **Step 7.1: Add Documents TabsContent**

```tsx
{/* Documents Tab */}
<TabsContent value="documents" className="mt-4">
  {documents.length === 0 ? (
    <div className="text-center py-8 text-muted-foreground">
      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
      <p>No documents uploaded</p>
    </div>
  ) : (
    <Card>
      <CardContent className="pt-4">
        <div className="space-y-2">
          {documents.map((doc) => {
            const app = applications.find((a) => a.id === doc.application_id);
            return (
              <div key={doc.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{doc.file_name}</p>
                    {app && (
                      <p className="text-xs text-muted-foreground">{appLabel(app)}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">{doc.file_type}</Badge>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    View
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  )}
</TabsContent>
```

- [ ] **Step 7.2: Add Availability TabsContent**

```tsx
{/* Availability Tab */}
<TabsContent value="availability" className="mt-4 space-y-4">
  {applications.filter((a) => a.availability_json).length === 0 ? (
    <div className="text-center py-8 text-muted-foreground">
      <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
      <p>No availability data</p>
    </div>
  ) : (
    applications.map((app) => {
      if (!app.availability_json) return null;
      const av = app.availability_json;
      return (
        <Card key={app.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{appLabel(app)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            {av.days && av.days.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Days</span>
                <span>{av.days.join(', ')}</span>
              </div>
            )}
            {av.time_pref && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time preference</span>
                <span className="capitalize">{av.time_pref}</span>
              </div>
            )}
            {av.hours_per_week != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hours / week</span>
                <span>{av.hours_per_week}</span>
              </div>
            )}
            {av.commitment && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commitment</span>
                <span>{av.commitment}</span>
              </div>
            )}
          </CardContent>
        </Card>
      );
    })
  )}
</TabsContent>
```

- [ ] **Step 7.3: Add Interview TabsContent**

```tsx
{/* Interview Tab */}
<TabsContent value="interview" className="mt-4">
  {applications.filter((a) => a.interview_invited_at).length === 0 ? (
    <div className="text-center py-8 text-muted-foreground">
      <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
      <p>No interview records</p>
    </div>
  ) : (
    <Card>
      <CardContent className="pt-4 space-y-2">
        {applications.map((app) => {
          if (!app.interview_invited_at) return null;
          return (
            <div key={app.id} className="text-sm py-2 border-b last:border-0">
              <p className="font-medium">{appLabel(app)}</p>
              <div className="mt-1 space-y-0.5 text-muted-foreground">
                <p>Invited: {formatDate(app.interview_invited_at)}</p>
                {app.interview_confirmed_at && (
                  <p>Confirmed: {formatDate(app.interview_confirmed_at)}</p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  )}
</TabsContent>
```

- [ ] **Step 7.4: Verify in browser**

- [ ] **Step 7.5: Commit**

```bash
git add src/components/admin/AdminUserProfile.tsx
git commit -m "feat: add Documents, Availability, and Interview tabs to AdminUserProfile"
```

---

## Task 8: Add Contact History Tab

**Files:**
- Modify: `src/components/admin/AdminUserProfile.tsx`

- [ ] **Step 8.1: Add Contact History TabsContent**

```tsx
{/* Contact History Tab */}
<TabsContent value="contact-history" className="mt-4">
  {emailLogs.length === 0 ? (
    <div className="text-center py-8 text-muted-foreground">
      <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
      <p>No emails sent yet</p>
    </div>
  ) : (
    <Card>
      <CardContent className="pt-4">
        <div className="space-y-2">
          {emailLogs.map((log) => (
            <div key={log.id} className="flex items-start justify-between text-sm py-2 border-b last:border-0">
              <div className="min-w-0">
                <p className="font-medium truncate">{log.subject}</p>
                {log.template_name && (
                  <p className="text-xs text-muted-foreground">
                    Template: {log.template_name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">From: {log.sent_by}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 ml-4">
                {formatDateShort(log.created_at)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )}
</TabsContent>
```

- [ ] **Step 8.2: Verify in browser**

- [ ] **Step 8.3: Commit**

```bash
git add src/components/admin/AdminUserProfile.tsx
git commit -m "feat: add Contact History tab to AdminUserProfile"
```

---

## Task 9: Merge Activity Tab and Final Cleanup

**Files:**
- Modify: `src/components/admin/AdminUserProfile.tsx` — merge Opportunities + Hours Log into Activity; remove old separate tabs

The current Activity tab (value="activity") stays. The Opportunities and Hours Log tabs get their content moved into Activity as additional sections, then the old `<TabsContent value="opportunities">` and `<TabsContent value="hours">` blocks are deleted (they no longer have trigger buttons).

- [ ] **Step 9.1: Find the Activity TabsContent block and append Saved Opportunities section**

At the end of `<TabsContent value="activity">`, before the closing `</TabsContent>`, add:

```tsx
{/* Saved Opportunities (merged from old Opportunities tab) */}
{savedOpportunities.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">Saved Opportunities ({savedOpportunities.length})</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {savedOpportunities.map((opp) => (
          <div key={opp.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Badge variant="outline" className="text-xs shrink-0">{opp.type}</Badge>
              <span className="break-words">{opp.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-xs">{opp.status}</Badge>
              <span className="text-xs text-muted-foreground">{formatDateShort(opp.updated_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)}

{/* Hours Log (merged from old Hours Log tab) */}
{experienceEntries.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">
        Hours Log ({experienceEntries.length} entries
        {activity?.total_hours_logged ? ` · ${activity.total_hours_logged} total hrs` : ''})
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {experienceEntries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Badge variant="outline" className="text-xs shrink-0">{entry.opportunity_type}</Badge>
              <span className="break-words">{entry.opportunity_name}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-semibold text-primary">{entry.hours} hrs</span>
              <span className="text-xs text-muted-foreground">{formatDateShort(entry.entry_date)}</span>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 9.2: Delete the old Opportunities and Hours Log TabsContent blocks**

Find and delete the entire `<TabsContent value="opportunities">` block (around line 648–688 of the original file) and the entire `<TabsContent value="hours">` block (around line 691–727).

- [ ] **Step 9.3: Run the full test suite**

```bash
npm run test:run
```

Expected: All tests PASS.

- [ ] **Step 9.4: Verify in browser — full walkthrough**

Manual checklist:
- [ ] Name shows as "Last, First" in header
- [ ] Avatar circle appears top-right with correct initial and a color
- [ ] Contact info (email, phone if present) visible in left block
- [ ] Tabs bar scrolls horizontally without wrapping
- [ ] Applications tab shows table with status badges
- [ ] Responses tab shows Q&A grouped by application (empty state if none)
- [ ] Notes tab shows notes grouped by application (empty state if none)
- [ ] Documents tab shows flat list with file links (empty state if none)
- [ ] Availability tab shows per-application data (empty state if none)
- [ ] Interview tab shows invited/confirmed dates (empty state if none)
- [ ] Contact History tab shows email log (empty state if none)
- [ ] Profile tab unchanged from original
- [ ] Activity tab includes saved opps + hours log at the bottom

- [ ] **Step 9.5: Final commit**

```bash
git add src/components/admin/AdminUserProfile.tsx
git commit -m "feat: complete AdminUserProfile redesign — 9-tab layout, merged Activity tab"
```

---

## Self-Review Checklist

- [x] **Spec §1 (header layout):** Task 4 covers avatar, formatLastFirst, contact block
- [x] **Spec §2 (tab layout + scrollable TabsList):** Task 5 step 5.2
- [x] **Spec §3.1 (Applications tab):** Task 5 step 5.3
- [x] **Spec §3.2 (Responses):** Task 6 step 6.2
- [x] **Spec §3.3 (Notes):** Task 6 step 6.3
- [x] **Spec §3.4 (Documents):** Task 7 step 7.1
- [x] **Spec §3.5 (Availability — reuses apps data):** Task 7 step 7.2
- [x] **Spec §3.6 (Interview — reuses apps data):** Task 7 step 7.3
- [x] **Spec §3.7 (Contact History, `.contains()` query):** Task 8 step 8.1 + Task 3 step 3.2
- [x] **Spec §3.8 (Profile tab unchanged):** Tab trigger present in Task 5; no content change needed
- [x] **Spec §3.9 (Activity merged):** Task 9
- [x] **Spec §4 (data loading + Promise.all):** Task 3 step 3.2
- [x] **Spec §5 (no changes to AdminUserList):** Confirmed — not touched
- [x] **Spec §6 (per-tab error handling):** Each tab has its own empty state; Supabase errors return empty arrays (nullish coalescing `?? []`), so tabs degrade gracefully without crashing others
- [x] **Spec §7 (read-only, no pagination, opens on Applications tab):** `defaultValue="applications"` in Task 5; no write actions added; no pagination
