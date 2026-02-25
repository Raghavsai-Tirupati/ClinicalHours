# Admin Dashboard + Hospital Verification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add hospital approval/rejection flow + redesign the admin dashboard with Overview, Students, Hospitals, Pending Approvals, and Tools tabs.

**Architecture:** New `hospital-review` Deno edge function handles approve/reject + Resend emails. The existing `AdminDashboard.tsx` is refactored into a thin tab-router; each tab's content lives in its own component. All existing tools content moves to `AdminToolsTab.tsx` with zero functional change.

**Tech Stack:** React 18, TypeScript, Vite, Supabase JS v2, Deno edge functions, Resend email API, Tailwind CSS, shadcn/ui components, lucide-react icons, date-fns, sonner toasts.

---

## Context

### What's already done — do not rebuild
- `hospital_accounts` table with `account_status` (`pending/approved/rejected`), `admin_note`, `reviewed_at`, `reviewed_by`
- `HospitalDashboard.tsx` — hospital's posted opportunities view at `/hospital-dashboard`
- `PendingApproval.tsx` — pending/rejected screen at `/pending-approval`
- `Auth.tsx` — hospital signup creates `hospital_accounts` record; login redirects correctly
- `useHospitalAccount` and `useAdminCheck` hooks
- `AdminUserList.tsx` + `AdminUserProfile.tsx` — reused as-is for Students tab
- `GuestSessionStats.tsx` — reused inside Overview tab
- Email via Resend: see `supabase/functions/send-mass-email/index.ts` for exact pattern
- Admin auth pattern: see `supabase/functions/admin-get-users/index.ts` for exact pattern

### Key file paths
```
src/pages/AdminDashboard.tsx                  ← refactor this
src/components/admin/AdminUserList.tsx        ← reuse unchanged
src/components/admin/AdminUserProfile.tsx     ← reuse unchanged
src/components/admin/GuestSessionStats.tsx    ← reuse unchanged
supabase/functions/_shared/auth.ts            ← checkAdminRole, getCorsHeaders, validateOrigin
supabase/functions/admin-get-users/index.ts   ← copy the auth+admin-check boilerplate
supabase/functions/send-mass-email/index.ts   ← copy the Resend email pattern
```

### TypeScript checks (no test suite — use these instead)
```bash
npx tsc --noEmit
```

---

## Task 1: Create the `hospital-review` Edge Function

**Files:**
- Create: `supabase/functions/hospital-review/index.ts`

This is the most critical piece. It updates `account_status` and sends a Resend email to the hospital.

**Step 1: Create the file with this exact content**

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, checkAdminRole } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface ReviewRequest {
  hospitalId: string;
  action: "approve" | "reject";
  note?: string;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendApprovalEmail(
  to: string,
  hospitalName: string,
  corsHeaders: Record<string, string>
): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "ClinicalHours <noreply@clinicalhours.org>",
      to: [to],
      subject: "Your ClinicalHours Hospital Account Has Been Approved",
      html: `
        <h2>Welcome to ClinicalHours, ${escapeHtml(hospitalName)}!</h2>
        <p>Your hospital account has been approved. You can now log in and manage your clinical opportunities.</p>
        <p><a href="https://clinicalhours.org/auth" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Log In to Your Dashboard</a></p>
        <p>If you have any questions, contact us at <a href="mailto:support@clinicalhours.org">support@clinicalhours.org</a>.</p>
      `,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Resend approval email failed:", body);
  }
}

async function sendRejectionEmail(
  to: string,
  hospitalName: string,
  note: string | undefined
): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email");
    return;
  }
  const noteHtml = note
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;margin:16px 0;">
         <p style="margin:0;font-weight:600;color:#dc2626;">Admin Note:</p>
         <p style="margin:4px 0 0;">${escapeHtml(note)}</p>
       </div>`
    : "";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "ClinicalHours <noreply@clinicalhours.org>",
      to: [to],
      subject: "Update on Your ClinicalHours Hospital Account Application",
      html: `
        <h2>Application Update for ${escapeHtml(hospitalName)}</h2>
        <p>Thank you for applying to join ClinicalHours. After reviewing your application, we are unable to approve your hospital account at this time.</p>
        ${noteHtml}
        <p>If you believe this was an error or have questions, please contact us at <a href="mailto:support@clinicalhours.org">support@clinicalhours.org</a>.</p>
      `,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Resend rejection email failed:", body);
  }
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid origin" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { isAdmin, error: adminError } = await checkAdminRole(user.id);
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: adminError || "Admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let payload: ReviewRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { hospitalId, action, note } = payload;

    if (!hospitalId || !action || !["approve", "reject"].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: "hospitalId and action (approve|reject) are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch the hospital account
    const { data: hospital, error: fetchError } = await supabaseAdmin
      .from("hospital_accounts")
      .select("id, hospital_name, contact_email, account_status")
      .eq("id", hospitalId)
      .single();

    if (fetchError || !hospital) {
      return new Response(
        JSON.stringify({ success: false, error: "Hospital account not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update the hospital account
    const newStatus = action === "approve" ? "approved" : "rejected";
    const { error: updateError } = await supabaseAdmin
      .from("hospital_accounts")
      .update({
        account_status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        admin_note: note ?? null,
      })
      .eq("id", hospitalId);

    if (updateError) {
      console.error("Error updating hospital account:", updateError);
      throw new Error("Failed to update hospital account");
    }

    // Send email (non-blocking — don't fail the request if email fails)
    if (action === "approve") {
      await sendApprovalEmail(hospital.contact_email, hospital.hospital_name, corsHeaders);
    } else {
      await sendRejectionEmail(hospital.contact_email, hospital.hospital_name, note);
    }

    return new Response(
      JSON.stringify({ success: true, action, hospitalId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in hospital-review:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
```

**Step 2: Verify it type-checks (Deno has its own type system — just confirm it compiles during deploy)**

No local test runner needed — visual review is sufficient here. Confirm:
- All imports match `_shared/auth.ts` exports exactly: `validateOrigin`, `getCorsHeaders`, `checkAdminRole`
- `action` is narrowed to `"approve" | "reject"` before use
- Both email functions use `escapeHtml` on user-supplied strings

**Step 3: Commit**

```bash
git add supabase/functions/hospital-review/index.ts
git commit -m "feat: add hospital-review edge function (approve/reject + Resend email)"
```

---

## Task 2: Extract Tools Tab Component

Move all existing operational tools content out of `AdminDashboard.tsx` into its own component. This is a pure refactor — zero functional change.

**Files:**
- Create: `src/components/admin/AdminToolsTab.tsx`
- Modify: `src/pages/AdminDashboard.tsx`

**Step 1: Create `src/components/admin/AdminToolsTab.tsx`**

This component accepts the props and handlers that currently live in `AdminDashboard.tsx`. Copy the exact JSX from the current tabs: `email`, `import`, `data-quality`, `maintenance`. The component signature is:

```typescript
interface AdminToolsTabProps {
  // Mass email
  emailSubject: string;
  setEmailSubject: (v: string) => void;
  emailBody: string;
  setEmailBody: (v: string) => void;
  sendingEmail: boolean;
  subscriberCount: number | null;
  loadingCount: boolean;
  fetchSubscriberCount: () => void;
  handleSendMassEmail: () => void;
  // CSV import
  csvFile: File | null;
  setCsvFile: (f: File | null) => void;
  clearExisting: boolean;
  setClearExisting: (v: boolean) => void;
  importing: boolean;
  importProgress: number;
  handleCsvImport: () => void;
  // Fix states
  fixStatesLimit: number;
  setFixStatesLimit: (v: number) => void;
  fixingStates: boolean;
  handleFixStates: (preview: boolean) => void;
  // Find links
  findLinksLimit: number;
  setFindLinksLimit: (v: number) => void;
  findingLinks: boolean;
  handleFindLinks: () => void;
  // Fix coordinates
  fixingCoordinates: boolean;
  handleFixCoordinates: () => void;
  // Remove duplicates
  removingDuplicates: boolean;
  handleRemoveDuplicates: () => void;
}
```

The JSX body is the combined content of the 4 existing `TabsContent` panels (`email`, `import`, `data-quality`, `maintenance`) from `AdminDashboard.tsx`, rendered as a single `<div className="space-y-6">`. Use a sub-tab structure inside `AdminToolsTab` with its own `<Tabs>`:

```tsx
export default function AdminToolsTab(props: AdminToolsTabProps) {
  return (
    <Tabs defaultValue="email" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="email" className="flex items-center gap-2">
          <Mail className="h-4 w-4" /> Email
        </TabsTrigger>
        <TabsTrigger value="import" className="flex items-center gap-2">
          <Upload className="h-4 w-4" /> Import
        </TabsTrigger>
        <TabsTrigger value="data-quality" className="flex items-center gap-2">
          <Database className="h-4 w-4" /> Data Quality
        </TabsTrigger>
        <TabsTrigger value="maintenance" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Maintenance
        </TabsTrigger>
      </TabsList>
      {/* paste existing TabsContent blocks here exactly */}
    </Tabs>
  );
}
```

**Step 2: Type-check**

```bash
cd /c/Users/shiva/ClinicalHours && npx tsc --noEmit
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add src/components/admin/AdminToolsTab.tsx
git commit -m "feat: extract AdminToolsTab component from AdminDashboard"
```

---

## Task 3: Create `AdminOverviewTab` Component

**Files:**
- Create: `src/components/admin/AdminOverviewTab.tsx`

**Step 1: Write the component**

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Users, Building2, Briefcase, FileText, Clock, Activity } from 'lucide-react';
import GuestSessionStats from './GuestSessionStats';

interface OverviewStats {
  totalStudents: number;
  approvedHospitals: number;
  pendingHospitals: number;
  rejectedHospitals: number;
  totalOpportunities: number;
  totalApplications: number;
  totalHoursLogged: number;
  activeUsers7d: number;
  activeUsers30d: number;
}

export default function AdminOverviewTab() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const [
        { count: totalStudents },
        { count: approvedHospitals },
        { count: pendingHospitals },
        { count: rejectedHospitals },
        { count: totalOpportunities },
        { count: totalApplications },
        { data: hoursData },
        { count: activeUsers7d },
        { count: activeUsers30d },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('hospital_accounts').select('*', { count: 'exact', head: true }).eq('account_status', 'approved'),
        supabase.from('hospital_accounts').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
        supabase.from('hospital_accounts').select('*', { count: 'exact', head: true }).eq('account_status', 'rejected'),
        supabase.from('opportunities').select('*', { count: 'exact', head: true }),
        supabase.from('applications').select('*', { count: 'exact', head: true }),
        supabase.from('experience_entries').select('hours'),
        supabase.from('tracking_events')
          .select('*', { count: 'exact', head: true })
          .not('user_id', 'is', null)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('tracking_events')
          .select('*', { count: 'exact', head: true })
          .not('user_id', 'is', null)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const totalHoursLogged = (hoursData || []).reduce(
        (sum, e) => sum + (e.hours ?? 0), 0
      );

      setStats({
        totalStudents: totalStudents ?? 0,
        approvedHospitals: approvedHospitals ?? 0,
        pendingHospitals: pendingHospitals ?? 0,
        rejectedHospitals: rejectedHospitals ?? 0,
        totalOpportunities: totalOpportunities ?? 0,
        totalApplications: totalApplications ?? 0,
        totalHoursLogged,
        activeUsers7d: activeUsers7d ?? 0,
        activeUsers30d: activeUsers30d ?? 0,
      });
    } catch (err) {
      console.error('Error fetching overview stats:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Students', value: stats?.totalStudents ?? 0, icon: Users, color: 'text-blue-400' },
    { label: 'Approved Hospitals', value: stats?.approvedHospitals ?? 0, icon: Building2, color: 'text-green-400' },
    { label: 'Pending Hospitals', value: stats?.pendingHospitals ?? 0, icon: Building2, color: 'text-yellow-400' },
    { label: 'Rejected Hospitals', value: stats?.rejectedHospitals ?? 0, icon: Building2, color: 'text-red-400' },
    { label: 'Opportunities', value: stats?.totalOpportunities ?? 0, icon: Briefcase, color: 'text-purple-400' },
    { label: 'Applications', value: stats?.totalApplications ?? 0, icon: FileText, color: 'text-orange-400' },
    { label: 'Clinical Hours Logged', value: Math.round(stats?.totalHoursLogged ?? 0), icon: Clock, color: 'text-teal-400' },
    { label: 'Active Users (30d)', value: stats?.activeUsers30d ?? 0, icon: Activity, color: 'text-pink-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label} className="bg-card border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`h-4 w-4 ${card.color}`} />
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {card.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <GuestSessionStats />
    </div>
  );
}
```

**Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add src/components/admin/AdminOverviewTab.tsx
git commit -m "feat: add AdminOverviewTab with platform health stats"
```

---

## Task 4: Create `AdminHospitalsTab` Component

**Files:**
- Create: `src/components/admin/AdminHospitalsTab.tsx`

**Step 1: Write the component**

This queries `hospital_accounts` directly (admin RLS already allows it) and joins opportunity/application counts.

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Building2, Search, RefreshCw, Loader2, Mail, Globe, MapPin,
  ChevronLeft, ChevronRight, Eye, Briefcase, Users, Phone,
} from 'lucide-react';
import { format } from 'date-fns';

interface HospitalRow {
  id: string;
  user_id: string;
  hospital_name: string;
  contact_email: string;
  contact_phone: string | null;
  website: string | null;
  address: string | null;
  description: string | null;
  created_at: string;
  reviewed_at: string | null;
  opportunityCount: number;
  applicantCount: number;
}

interface HospitalOpportunity {
  id: string;
  name: string;
  location: string;
  type: string;
  created_at: string;
  applicationCount: number;
}

const PAGE_SIZE = 20;

export default function AdminHospitalsTab() {
  const [hospitals, setHospitals] = useState<HospitalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedHospital, setSelectedHospital] = useState<HospitalRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerOpportunities, setDrawerOpportunities] = useState<HospitalOpportunity[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  useEffect(() => { fetchHospitals(); }, [currentPage]);

  async function fetchHospitals(search = searchTerm) {
    setLoading(true);
    try {
      let query = supabase
        .from('hospital_accounts')
        .select('id, user_id, hospital_name, contact_email, contact_phone, website, address, description, created_at, reviewed_at', { count: 'exact' })
        .eq('account_status', 'approved')
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      if (search.trim()) {
        query = query.or(`hospital_name.ilike.%${search.trim()}%,contact_email.ilike.%${search.trim()}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      // Enrich with opportunity + applicant counts
      const enriched: HospitalRow[] = await Promise.all(
        (data || []).map(async (h) => {
          const { data: opps } = await supabase
            .from('opportunities')
            .select('id')
            .eq('created_by', h.user_id);

          const oppIds = (opps || []).map((o) => o.id);
          let applicantCount = 0;
          if (oppIds.length > 0) {
            const { count: appCount } = await supabase
              .from('applications')
              .select('*', { count: 'exact', head: true })
              .in('opportunity_id', oppIds);
            applicantCount = appCount ?? 0;
          }

          return {
            ...h,
            opportunityCount: opps?.length ?? 0,
            applicantCount,
          };
        })
      );

      setHospitals(enriched);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error('Error fetching hospitals:', err);
      toast.error('Failed to fetch hospitals');
    } finally {
      setLoading(false);
    }
  }

  async function openDrawer(hospital: HospitalRow) {
    setSelectedHospital(hospital);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const { data: opps } = await supabase
        .from('opportunities')
        .select('id, name, location, type, created_at')
        .eq('created_by', hospital.user_id)
        .order('created_at', { ascending: false });

      const enrichedOpps: HospitalOpportunity[] = await Promise.all(
        (opps || []).map(async (o) => {
          const { count } = await supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .eq('opportunity_id', o.id);
          return { ...o, applicationCount: count ?? 0 };
        })
      );
      setDrawerOpportunities(enrichedOpps);
    } catch (err) {
      console.error('Error fetching hospital opportunities:', err);
    } finally {
      setDrawerLoading(false);
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const handleSearch = () => { setCurrentPage(1); fetchHospitals(searchTerm); };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Approved Hospitals
        </CardTitle>
        <CardDescription>All verified hospital accounts on the platform</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1 max-w-md">
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button variant="outline" onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{totalCount} hospitals</span>
            <Button variant="outline" size="sm" onClick={() => fetchHospitals()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hospital</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Opportunities</TableHead>
                <TableHead>Applicants</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && hospitals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : hospitals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No approved hospitals found
                  </TableCell>
                </TableRow>
              ) : hospitals.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{h.hospital_name}</p>
                      {h.website && (
                        <a href={h.website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-0.5">
                          <Globe className="h-3 w-3" />
                          {h.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />{h.contact_email}
                      </div>
                      {h.contact_phone && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />{h.contact_phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{h.opportunityCount}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{h.applicantCount}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(h.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {h.reviewed_at ? format(new Date(h.reviewed_at), 'MMM d, yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openDrawer(h)}>
                      <Eye className="h-4 w-4 mr-1" />View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1 || loading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages || loading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedHospital && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {selectedHospital.hospital_name}
                </SheetTitle>
                <SheetDescription>{selectedHospital.contact_email}</SheetDescription>
              </SheetHeader>

              {/* Hospital info */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-2 mb-6">
                {selectedHospital.address && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{selectedHospital.address}</span>
                  </div>
                )}
                {selectedHospital.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a href={selectedHospital.website} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:underline truncate">{selectedHospital.website}</a>
                  </div>
                )}
                {selectedHospital.description && (
                  <p className="text-sm text-muted-foreground mt-2">{selectedHospital.description}</p>
                )}
              </div>

              {/* Opportunities list */}
              <div>
                <h3 className="text-sm font-semibold mb-3">
                  Posted Opportunities ({selectedHospital.opportunityCount})
                </h3>
                {drawerLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : drawerOpportunities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No opportunities posted yet</p>
                ) : (
                  <div className="space-y-2">
                    {drawerOpportunities.map((opp) => (
                      <div key={opp.id} className="bg-card border border-border rounded-lg p-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">{opp.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs capitalize">{opp.type}</Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{opp.location}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-medium">{opp.applicationCount}</p>
                          <p className="text-xs text-muted-foreground">applicants</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
```

**Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If you see "Sheet is not exported", check the import path — shadcn Sheet is at `@/components/ui/sheet`. If the `sheet` component doesn't exist yet, run:
```bash
npx shadcn@latest add sheet
```

**Step 3: Commit**

```bash
git add src/components/admin/AdminHospitalsTab.tsx
git commit -m "feat: add AdminHospitalsTab with hospital table and detail drawer"
```

---

## Task 5: Create `AdminPendingApprovalsTab` Component

**Files:**
- Create: `src/components/admin/AdminPendingApprovalsTab.tsx`

This is the core UX for the approval flow. It calls the `hospital-review` edge function.

**Step 1: Write the component**

```typescript
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Building2, Clock, CheckCircle, XCircle, Mail, Globe,
  Loader2, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface PendingHospital {
  id: string;
  hospital_name: string;
  contact_email: string;
  contact_phone: string | null;
  website: string | null;
  address: string | null;
  description: string | null;
  created_at: string;
}

interface ReviewedHospital {
  id: string;
  hospital_name: string;
  contact_email: string;
  account_status: 'approved' | 'rejected';
  admin_note: string | null;
  reviewed_at: string;
}

interface AdminPendingApprovalsTabProps {
  onPendingCountChange?: (count: number) => void;
}

export default function AdminPendingApprovalsTab({ onPendingCountChange }: AdminPendingApprovalsTabProps) {
  const [pending, setPending] = useState<PendingHospital[]>([]);
  const [reviewed, setReviewed] = useState<ReviewedHospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingHospital | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchData();
    // Poll every 60 seconds for new pending hospitals
    pollingRef.current = setInterval(fetchData, 60_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  async function fetchData() {
    try {
      const [{ data: pendingData }, { data: reviewedData }] = await Promise.all([
        supabase
          .from('hospital_accounts')
          .select('id, hospital_name, contact_email, contact_phone, website, address, description, created_at')
          .eq('account_status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('hospital_accounts')
          .select('id, hospital_name, contact_email, account_status, admin_note, reviewed_at')
          .in('account_status', ['approved', 'rejected'])
          .order('reviewed_at', { ascending: false })
          .limit(50),
      ]);

      const newPending = (pendingData || []) as PendingHospital[];
      setPending(newPending);
      setReviewed((reviewedData || []) as ReviewedHospital[]);
      onPendingCountChange?.(newPending.length);
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
    } finally {
      setLoading(false);
    }
  }

  async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function handleApprove(hospital: PendingHospital) {
    setProcessingId(hospital.id);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hospital-review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ hospitalId: hospital.id, action: 'approve' }),
        }
      );
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Approval failed');

      // Optimistically remove from queue
      setPending((prev) => prev.filter((h) => h.id !== hospital.id));
      onPendingCountChange?.(pending.length - 1);
      toast.success(`${hospital.hospital_name} approved — confirmation email sent`);
      // Refresh history
      fetchData();
    } catch (err) {
      console.error('Approval error:', err);
      toast.error(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setProcessingId(rejectTarget.id);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hospital-review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            hospitalId: rejectTarget.id,
            action: 'reject',
            note: rejectNote.trim() || undefined,
          }),
        }
      );
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Rejection failed');

      setPending((prev) => prev.filter((h) => h.id !== rejectTarget.id));
      onPendingCountChange?.(pending.length - 1);
      setRejectTarget(null);
      setRejectNote('');
      toast.success(`${rejectTarget.hospital_name} rejected — notification email sent`);
      fetchData();
    } catch (err) {
      console.error('Rejection error:', err);
      toast.error(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Pending Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                Pending Hospital Approvals
                {pending.length > 0 && (
                  <Badge className="bg-yellow-500 text-white ml-1">{pending.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Review and approve or reject new hospital account registrations
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="font-medium text-foreground">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">No pending hospital approvals</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((hospital) => (
                <div key={hospital.id}
                  className="bg-muted/20 border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <p className="font-semibold text-foreground truncate">{hospital.hospital_name}</p>
                    </div>
                    <div className="space-y-1 mt-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />{hospital.contact_email}
                      </p>
                      {hospital.website && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          <a href={hospital.website} target="_blank" rel="noopener noreferrer"
                            className="text-primary hover:underline truncate">{hospital.website}</a>
                        </p>
                      )}
                      {hospital.address && (
                        <p className="text-sm text-muted-foreground">{hospital.address}</p>
                      )}
                      {hospital.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{hospital.description}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Submitted {formatDistanceToNow(new Date(hospital.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleApprove(hospital)}
                      disabled={processingId === hospital.id}
                    >
                      {processingId === hospital.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-1" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setRejectTarget(hospital); setRejectNote(''); }}
                      disabled={processingId === hospital.id}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review History */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setShowHistory((v) => !v)}
        >
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Review History ({reviewed.length})
            </span>
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {showHistory && (
          <CardContent>
            {reviewed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No reviews yet</p>
            ) : (
              <div className="space-y-3">
                {reviewed.map((h) => (
                  <div key={h.id}
                    className="flex items-start justify-between gap-3 py-3 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{h.hospital_name}</p>
                        <Badge
                          variant={h.account_status === 'approved' ? 'default' : 'destructive'}
                          className="text-xs flex-shrink-0"
                        >
                          {h.account_status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{h.contact_email}</p>
                      {h.admin_note && (
                        <p className="text-xs text-muted-foreground mt-1 italic">Note: {h.admin_note}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(h.reviewed_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Reject Dialog */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Hospital Account</AlertDialogTitle>
            <AlertDialogDescription>
              Reject <strong>{rejectTarget?.hospital_name}</strong>? They will receive a notification email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-0 pb-2">
            <Textarea
              placeholder="Optional: add a note explaining the rejection (will be included in the email)..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRejectTarget(null); setRejectNote(''); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={processingId !== null}
            >
              {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

**Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If `AlertDialog` is missing, run:
```bash
npx shadcn@latest add alert-dialog
```

**Step 3: Commit**

```bash
git add src/components/admin/AdminPendingApprovalsTab.tsx
git commit -m "feat: add AdminPendingApprovalsTab with approve/reject flow"
```

---

## Task 6: Refactor `AdminDashboard.tsx`

This is the final wiring step. Replace the existing tab structure with the new 5-tab layout.

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

**Step 1: Replace `AdminDashboard.tsx` with this content**

The key changes:
- Remove all the inline state/handlers that now belong to `AdminToolsTab`
- Add `pendingCount` state for the badge
- Wire up the 5 new tabs

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Shield, Users, Building2, Clock, Wrench, BarChart3,
  AlertTriangle, Loader2,
} from 'lucide-react';
import AdminOverviewTab from '@/components/admin/AdminOverviewTab';
import AdminUserList from '@/components/admin/AdminUserList';
import AdminHospitalsTab from '@/components/admin/AdminHospitalsTab';
import AdminPendingApprovalsTab from '@/components/admin/AdminPendingApprovalsTab';
import AdminToolsTab from '@/components/admin/AdminToolsTab';
import { supabase } from '@/integrations/supabase/client';

// ── AdminToolsTab needs these props lifted up from AdminDashboard ──────────────
// (All the existing state/handlers for email, import, data-quality, maintenance)
// Keep them here so AdminDashboard remains the single source of truth.

// [Paste all the existing state declarations and handler functions from
//  the current AdminDashboard.tsx here — emailSubject, emailBody, csvFile,
//  fixStatesLimit, findLinksLimit, etc. — and all the handle* functions]

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminCheck();
  const [pendingCount, setPendingCount] = useState(0);
  const [operationResult, setOperationResult] = useState<{ success: boolean; message: string; details?: unknown } | null>(null);

  // ── All existing Tools state (keep exactly as-is) ──────────────────────────
  // Mass email
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  // CSV import
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [clearExisting, setClearExisting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  // Fix states
  const [fixingStates, setFixingStates] = useState(false);
  const [fixStatesLimit, setFixStatesLimit] = useState(50);
  // Find links
  const [findingLinks, setFindingLinks] = useState(false);
  const [findLinksLimit, setFindLinksLimit] = useState(25);
  // Fix coordinates
  const [fixingCoordinates, setFixingCoordinates] = useState(false);
  // Remove duplicates
  const [removingDuplicates, setRemovingDuplicates] = useState(false);

  // [Keep all existing handle* functions exactly as-is from the current AdminDashboard.tsx]
  // getAuthToken, fetchSubscriberCount, handleSendMassEmail, handleCsvImport,
  // handleFixStates, handleFindLinks, handleFixCoordinates, handleRemoveDuplicates

  // ── Auth guards (keep exactly as-is) ──────────────────────────────────────
  if (authLoading || adminLoading) { /* ... loading spinner ... */ }
  if (!user) { /* ... login prompt ... */ }
  if (!isAdmin) { /* ... access denied ... */ }

  return (
    <>
      <Helmet>
        <title>Admin Dashboard | ClinicalHours</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Navigation />
      <main className="min-h-screen bg-background pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">Platform management and oversight</p>
            </div>
            <Badge variant="outline" className="text-sm">{user.email}</Badge>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Students
              </TabsTrigger>
              <TabsTrigger value="hospitals" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Hospitals
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex items-center gap-2 relative">
                <Clock className="h-4 w-4" />
                Pending Approvals
                {pendingCount > 0 && (
                  <Badge className="bg-yellow-500 text-white text-xs px-1.5 py-0 ml-1 min-w-[1.25rem] h-5">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Tools
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <AdminOverviewTab />
            </TabsContent>

            <TabsContent value="students">
              <AdminUserList />
            </TabsContent>

            <TabsContent value="hospitals">
              <AdminHospitalsTab />
            </TabsContent>

            <TabsContent value="pending">
              <AdminPendingApprovalsTab onPendingCountChange={setPendingCount} />
            </TabsContent>

            <TabsContent value="tools">
              <AdminToolsTab
                emailSubject={emailSubject}
                setEmailSubject={setEmailSubject}
                emailBody={emailBody}
                setEmailBody={setEmailBody}
                sendingEmail={sendingEmail}
                subscriberCount={subscriberCount}
                loadingCount={loadingCount}
                fetchSubscriberCount={fetchSubscriberCount}
                handleSendMassEmail={handleSendMassEmail}
                csvFile={csvFile}
                setCsvFile={setCsvFile}
                clearExisting={clearExisting}
                setClearExisting={setClearExisting}
                importing={importing}
                importProgress={importProgress}
                handleCsvImport={handleCsvImport}
                fixStatesLimit={fixStatesLimit}
                setFixStatesLimit={setFixStatesLimit}
                fixingStates={fixingStates}
                handleFixStates={handleFixStates}
                findLinksLimit={findLinksLimit}
                setFindLinksLimit={setFindLinksLimit}
                findingLinks={findingLinks}
                handleFindLinks={handleFindLinks}
                fixingCoordinates={fixingCoordinates}
                handleFixCoordinates={handleFixCoordinates}
                removingDuplicates={removingDuplicates}
                handleRemoveDuplicates={handleRemoveDuplicates}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </>
  );
}
```

**Important:** When writing the real file, do **not** leave placeholders. Copy the existing auth guard JSX and all existing handle* functions verbatim from the current `AdminDashboard.tsx`. The plan shows structure; the real file must be complete.

**Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 3: Smoke test in browser**

```bash
npm run dev
```

1. Log in as admin → navigate to `/admin`
2. Verify 5 tabs are visible: Overview, Students, Hospitals, Pending Approvals, Tools
3. Overview tab: confirm stat cards load with real numbers
4. Students tab: existing table loads unchanged
5. Hospitals tab: approved hospitals table loads
6. Pending Approvals: shows pending queue (or empty state if none)
7. Tools tab: Email/Import/Data Quality/Maintenance all still work

**Step 4: Commit**

```bash
git add src/pages/AdminDashboard.tsx
git commit -m "feat: redesign AdminDashboard with Overview, Students, Hospitals, Pending Approvals, Tools tabs"
```

---

## Task 7: Final Integration Test

**Step 1: Test the full hospital approval flow**

1. Sign up a new account with the hospital toggle enabled
2. Confirm it lands on `/pending-approval` after login
3. Log in as admin → navigate to `/admin` → Pending Approvals tab
4. Confirm the new hospital appears in the queue
5. Click **Approve** → confirm toast, queue empties, hospital email sent (check Resend logs)
6. Log out, log back in as the hospital → confirm it lands on `/hospital-dashboard`

**Step 2: Test rejection flow**

1. Sign up another hospital
2. Admin → Pending Approvals → click **Reject** → enter a note → confirm
3. Log in as rejected hospital → confirm `/pending-approval` shows rejection + note

**Step 3: Commit if clean**

```bash
git add -A
git commit -m "feat: complete admin dashboard + hospital verification system"
```

---

## Task Order Summary

| # | Task | Risk |
|---|------|------|
| 1 | `hospital-review` edge function | Low — follows existing pattern |
| 2 | `AdminToolsTab` extraction | Very low — pure refactor |
| 3 | `AdminOverviewTab` | Low — read-only queries |
| 4 | `AdminHospitalsTab` | Low — read-only + Sheet |
| 5 | `AdminPendingApprovalsTab` | Medium — calls edge function |
| 6 | Refactor `AdminDashboard.tsx` | Low — wires components together |
| 7 | Integration test | N/A |
