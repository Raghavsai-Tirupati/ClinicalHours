import { useMemo, useState } from 'react';
import { Users, Loader2, ExternalLink, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useAllApplications } from '@/hooks/useAllApplications';
import { useTrackerCategories } from '../volunteer-tracker/hooks';
import { useTrackerEntries } from '../volunteer-tracker/hooks';
import type { StudentApplication } from '@/types/positions';

// ── Name helpers (mirrors PeopleTab) ─────────────────────────
const PLACEHOLDER_NAME_REGEX = /^student\s+[a-f0-9]{8}$/i;
function getApplicantName(app: StudentApplication): string {
  const candidates = [app.applicant_name, app.student_profile?.full_name];
  for (const c of candidates) {
    const t = c?.trim();
    if (t && !PLACEHOLDER_NAME_REGEX.test(t)) return t;
  }
  return (
    app.student_profile?.email?.split('@')[0] ||
    app.applicant_email?.split('@')[0] ||
    `Student ${app.student_id?.slice(0, 8) || ''}`
  );
}

// ── Avatar helpers ────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
] as const;
function emailToColor(email: string): string {
  const hash = [...email].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

interface MembersTabProps {
  clinicId: string;
}

export default function MembersTab({ clinicId }: MembersTabProps) {
  const { hospitalPage, basePath } = useHospitalPageContext();
  const { applications, loading: appsLoading } = useAllApplications(hospitalPage?.id);
  const { categories, loading: catLoading } = useTrackerCategories(clinicId);
  const { entries, loading: entLoading } = useTrackerEntries(clinicId);
  const [search, setSearch] = useState('');

  const loading = appsLoading || catLoading || entLoading;

  // O(1) lookups
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  // Map studentId → tracker categoryId (who's assigned to what role)
  const studentCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of entries) {
      if (entry.volunteer_user_id) map.set(entry.volunteer_user_id, entry.category_id);
    }
    return map;
  }, [entries]);

  // Staff = accepted applicants, deduplicated by student_id (most recent first)
  const staff = useMemo(() => {
    const seen = new Set<string>();
    return applications.filter((a) => {
      if (a.status !== 'accepted' || !a.student_id) return false;
      if (seen.has(a.student_id)) return false;
      seen.add(a.student_id);
      return true;
    });
  }, [applications]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((a) => {
      const name = getApplicantName(a).toLowerCase();
      const email = (a.applicant_email || a.student_profile?.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [staff, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-2">
        <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-1" />
        <p className="text-sm text-muted-foreground">No staff yet.</p>
        <p className="text-xs text-muted-foreground">
          Staff appear here automatically when an applicant is accepted.
          Assign roles in the <span className="font-medium text-foreground">Tracker</span> tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground ml-auto">
          {filtered.length} {filtered.length === 1 ? 'staff member' : 'staff members'}
        </p>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Name</th>
              <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Position</th>
              <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Accepted</th>
              <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Role</th>
              <th className="w-10 p-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((app) => {
              const name = getApplicantName(app);
              const email = app.applicant_email || app.student_profile?.email || '';
              const catId = studentCategoryMap.get(app.student_id);
              const cat = catId ? categoryMap.get(catId) : null;
              const href = `${basePath}/people/${app.student_id}`;

              return (
                <tr
                  key={app.id}
                  className="border-b border-border/50 hover:bg-muted/10 transition-colors"
                >
                  {/* Name + avatar */}
                  <td className="p-3">
                    <Link to={href} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        {app.student_profile?.avatar_url && (
                          <AvatarImage src={app.student_profile.avatar_url} alt={name} />
                        )}
                        <AvatarFallback
                          className={`text-xs font-semibold text-white ${emailToColor(email || name)}`}
                        >
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium hover:underline">{name}</div>
                        {email && (
                          <div className="text-xs text-muted-foreground break-all">{email}</div>
                        )}
                      </div>
                    </Link>
                  </td>

                  {/* Position */}
                  <td className="p-3 hidden sm:table-cell text-muted-foreground">
                    {app.position?.title || '—'}
                  </td>

                  {/* Accepted date */}
                  <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">
                    {app.submitted_at
                      ? format(new Date(app.submitted_at), 'MMM d, yyyy')
                      : '—'}
                  </td>

                  {/* Role badge (from tracker) */}
                  <td className="p-3">
                    {cat ? (
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: cat.color, color: cat.color }}
                      >
                        <div
                          className="h-2 w-2 rounded-full mr-1.5"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground border-muted-foreground/30"
                      >
                        Unassigned
                      </Badge>
                    )}
                  </td>

                  {/* External link */}
                  <td className="p-3">
                    <Link
                      to={href}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Open ${name}'s profile`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
