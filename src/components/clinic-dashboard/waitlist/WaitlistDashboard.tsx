import { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Download,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserPlus,
  Check,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useWaitlistSubmissions } from './hooks';
import type { WaitlistSubmission } from '@/components/waitlist/types';
import { ROLE_INTEREST_OPTIONS } from '@/components/waitlist/types';

type SortCol = 'submitted_at' | 'full_name' | 'email' | 'university' | 'role_interest' | 'gpa';
type SortDir = 'asc' | 'desc';

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLE_INTEREST_OPTIONS.map((o) => [o.value, o.label]),
);

export default function WaitlistDashboard() {
  const { hospitalPage } = useHospitalPageContext();
  const clinicId = hospitalPage?.id;
  const { submissions, loading, refetch } = useWaitlistSubmissions(clinicId);

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterConverted, setFilterConverted] = useState<'' | 'pending' | 'converted'>('');
  const [sortCol, setSortCol] = useState<SortCol>('submitted_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState(false);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = submissions;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.university?.toLowerCase().includes(q)),
      );
    }
    if (filterRole) list = list.filter((s) => s.role_interest === filterRole);
    if (filterConverted === 'pending') list = list.filter((s) => !s.converted_to_application_id);
    if (filterConverted === 'converted') list = list.filter((s) => !!s.converted_to_application_id);

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = a[sortCol] ?? '';
      const vb = b[sortCol] ?? '';
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [submissions, search, filterRole, filterConverted, sortCol, sortDir]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir(col === 'submitted_at' ? 'desc' : 'asc'); }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((s) => s.id)));
  };

  // CSV export
  const exportCSV = useCallback(() => {
    const headers = ['Name', 'Email', 'Phone', 'University', 'Major', 'GPA', 'Grad Year', 'Role Interest', 'Message', 'Submitted', 'Converted'];
    const rows = filtered.map((s) => [
      s.full_name,
      s.email,
      s.phone || '',
      s.university || '',
      s.major || '',
      s.gpa?.toString() || '',
      s.graduation_year?.toString() || '',
      s.role_interest ? (ROLE_LABEL[s.role_interest] || s.role_interest) : '',
      (s.message || '').replace(/"/g, '""'),
      new Date(s.submitted_at).toLocaleString(),
      s.converted_to_application_id ? 'Yes' : 'No',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  // Convert selected to real applicants
  const convertSelected = async () => {
    const toConvert = filtered.filter((s) => selected.has(s.id) && !s.converted_to_application_id);
    if (toConvert.length === 0) { toast.error('No unconverted entries selected.'); return; }

    setConverting(true);
    let converted = 0;
    for (const entry of toConvert) {
      try {
        // We mark the waitlist entry as converted. The actual application creation
        // happens when the student follows the real application link.
        // For now, we update the status to track the intent.
        const { error } = await supabase
          .from('waitlist_submissions')
          .update({ converted_at: new Date().toISOString() })
          .eq('id', entry.id);
        if (!error) converted++;
      } catch {
        // continue to next
      }
    }

    toast.success(`Marked ${converted} entr${converted === 1 ? 'y' : 'ies'} as converted.`);
    setSelected(new Set());
    setConverting(false);
    refetch();
  };

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ArrowUpDown size={12} className="opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  const SortHeader = ({ col, label }: { col: SortCol; label: string }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      <span className="inline-flex items-center gap-1">{label} <SortIcon col={col} /></span>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-background text-sm"
            placeholder="Search by name, email, university…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <select
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="">All Roles</option>
            {ROLE_INTEREST_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={filterConverted}
            onChange={(e) => setFilterConverted(e.target.value as typeof filterConverted)}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="converted">Converted</option>
          </select>
          {(filterRole || filterConverted || search) && (
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setSearch(''); setFilterRole(''); setFilterConverted(''); }}>
              Clear
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <button
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              disabled={converting}
              onClick={convertSelected}
            >
              {converting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Convert ({selected.size})
            </button>
          )}
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            onClick={exportCSV}
          >
            <Download size={14} /> CSV
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            onClick={refetch}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <Badge variant="secondary" className="text-xs">{submissions.length} total</Badge>
        <Badge variant="secondary" className="text-xs">{submissions.filter((s) => !s.converted_to_application_id).length} pending</Badge>
        <Badge variant="secondary" className="text-xs">{submissions.filter((s) => !!s.converted_to_application_id).length} converted</Badge>
        {filtered.length !== submissions.length && (
          <Badge variant="outline" className="text-xs">{filtered.length} shown</Badge>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="w-10 px-3 py-2">
                <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} className="rounded" />
              </th>
              <SortHeader col="full_name" label="Name" />
              <SortHeader col="email" label="Email" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Phone</th>
              <SortHeader col="university" label="University" />
              <SortHeader col="role_interest" label="Role" />
              <SortHeader col="gpa" label="GPA" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Grad Year</th>
              <SortHeader col="submitted_at" label="Submitted" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="py-12 text-center text-muted-foreground">No waitlist submissions yet.</td></tr>
            ) : filtered.map((s) => (
              <tr key={s.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="rounded" />
                </td>
                <td className="px-3 py-2 font-medium whitespace-nowrap">{s.full_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.email}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.phone || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.university || '—'}</td>
                <td className="px-3 py-2">
                  {s.role_interest ? (
                    <Badge variant="outline" className="text-xs">{ROLE_LABEL[s.role_interest] || s.role_interest}</Badge>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{s.gpa != null ? s.gpa.toFixed(2) : '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.graduation_year || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {new Date(s.submitted_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  {s.converted_to_application_id || s.converted_at ? (
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">
                      <Check size={10} className="mr-1" /> Converted
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Pending</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
