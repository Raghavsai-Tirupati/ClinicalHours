import { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  Pencil,
  Trash2,
  Check,
  X,
  Users,
  Loader2,
  Mail,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import type { ClinicMember, MemberStatus } from './types';
import { MEMBER_STATUS_LABELS, MEMBER_STATUS_COLORS } from './types';
import { useEmailTemplates } from '../email-communication/hooks';
import { useTrackerCategories } from '../volunteer-tracker/hooks';
import type { TrackerCategory } from '../volunteer-tracker/types';
import BulkEmailDialog from '../email-communication/BulkEmailDialog';

type SortField = 'full_name' | 'join_date' | 'hours_logged' | 'status';
type SortDir = 'asc' | 'desc';

interface MembersTabProps {
  clinicId: string;
  members: ClinicMember[];
  loading: boolean;
  onRefresh: () => void;
}

export default function MembersTab({ clinicId, members, loading, onRefresh }: MembersTabProps) {
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ClinicMember>>({});
  const [saving, setSaving] = useState(false);

  // Fetch tracker categories — they are the source of truth for "roles".
  const { categories } = useTrackerCategories(clinicId);
  const categoryMap = useMemo(() => {
    const map = new Map<string, TrackerCategory>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  // ── Selection & Bulk Email ────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { templates } = useEmailTemplates(clinicId);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (filterRole !== 'all' && (m.tracker_category_id || 'none') !== filterRole) return false;
      if (filterStatus !== 'all' && m.status !== filterStatus) return false;
      return true;
    });
  }, [members, filterRole, filterStatus]);

  const sorted = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'full_name':
          return a.full_name.localeCompare(b.full_name) * dir;
        case 'join_date':
          return (new Date(a.join_date).getTime() - new Date(b.join_date).getTime()) * dir;
        case 'hours_logged':
          return (a.hours_logged - b.hours_logged) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        default:
          return 0;
      }
    });
  }, [filteredMembers, sortField, sortDir]);

  const toggleSelectAll = () => {
    if (selectedIds.size === sorted.length && sorted.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((m) => m.id)));
    }
  };

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedIds.has(m.id)),
    [members, selectedIds],
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const startEdit = (member: ClinicMember) => {
    setEditingId(member.id);
    setEditValues({
      full_name: member.full_name,
      email: member.email,
      phone: member.phone,
      status: member.status,
      hours_logged: member.hours_logged,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const { error } = await supabase
      .from('clinic_members')
      .update({
        full_name: editValues.full_name,
        email: editValues.email || null,
        phone: editValues.phone || null,
        status: editValues.status,
        hours_logged: editValues.hours_logged ?? 0,
      })
      .eq('id', editingId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save: ' + error.message);
    } else {
      toast.success('Staff member updated');
      cancelEdit();
      onRefresh();
    }
  };

  const deleteMember = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the roster?`)) return;
    const { error } = await supabase.from('clinic_members').delete().eq('id', id);
    if (error) {
      toast.error('Failed to remove staff member');
    } else {
      toast.success('Staff member removed');
      onRefresh();
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => toggleSort(field)}
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-primary' : 'opacity-40'}`} />
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">{filteredMembers.length} staff{filteredMembers.length !== members.length ? ` (of ${members.length})` : ''}</p>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button size="sm" variant="outline" onClick={() => setBulkEmailOpen(true)} className="gap-1.5">
                <Mail className="h-4 w-4" />
                Send Email ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filterRole} onValueChange={(v) => { setFilterRole(v); setSelectedIds(new Set()); }}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="none">Unassigned</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setSelectedIds(new Set()); }}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(MEMBER_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterRole !== 'all' || filterStatus !== 'all') && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs px-2"
              onClick={() => { setFilterRole('all'); setFilterStatus('all'); setSelectedIds(new Set()); }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {filteredMembers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-2">
          <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-1" />
          <p className="text-sm text-muted-foreground">No staff yet.</p>
          <p className="text-xs text-muted-foreground">
            Staff are added automatically when an applicant is accepted. Assign roles in the <span className="font-medium text-foreground">Tracker</span> tab.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-3 w-10">
                  <Checkbox
                    checked={sorted.length > 0 && selectedIds.size === sorted.length}
                    onCheckedChange={toggleSelectAll}
                    className="h-3.5 w-3.5"
                  />
                </th>
                <th className="text-left p-3"><SortHeader field="full_name" label="Name" /></th>
                <th className="text-left p-3 hidden sm:table-cell">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</span>
                </th>
                <th className="text-left p-3"><SortHeader field="status" label="Status" /></th>
                <th className="text-left p-3 hidden md:table-cell"><SortHeader field="join_date" label="Joined" /></th>
                <th className="text-right p-3"><SortHeader field="hours_logged" label="Hours" /></th>
                <th className="text-right p-3 w-24">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => {
                const cat = m.tracker_category_id ? categoryMap.get(m.tracker_category_id) : null;
                const isEditing = editingId === m.id;

                return (
                  <tr
                    key={m.id}
                    className="border-b border-border/50 hover:bg-muted/10 transition-colors"
                    style={cat ? { borderLeftWidth: 3, borderLeftColor: cat.color } : undefined}
                  >
                    {/* Checkbox */}
                    <td className="p-3 w-10">
                      <Checkbox
                        checked={selectedIds.has(m.id)}
                        onCheckedChange={() => toggleSelect(m.id)}
                        className="h-3.5 w-3.5"
                      />
                    </td>

                    {/* Name */}
                    <td className="p-3">
                      {isEditing ? (
                        <Input
                          value={editValues.full_name || ''}
                          onChange={(e) => setEditValues((v) => ({ ...v, full_name: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      ) : (
                        <div>
                          <span className="font-medium">{m.full_name}</span>
                          {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                        </div>
                      )}
                    </td>

                    {/* Role (from tracker category) */}
                    <td className="p-3 hidden sm:table-cell">
                      {cat ? (
                        <Badge variant="outline" className="text-xs" style={{ borderColor: cat.color, color: cat.color }}>
                          <div className="h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                          {m.status === 'alumni' && ' (Alumni)'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                          Accepted
                        </Badge>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-3">
                      {isEditing ? (
                        <Select
                          value={editValues.status}
                          onValueChange={(v) => setEditValues((prev) => ({ ...prev, status: v as MemberStatus }))}
                        >
                          <SelectTrigger className="h-8 text-xs w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(MEMBER_STATUS_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={`text-xs ${MEMBER_STATUS_COLORS[m.status]}`}>
                          {MEMBER_STATUS_LABELS[m.status]}
                        </Badge>
                      )}
                    </td>

                    {/* Join Date */}
                    <td className="p-3 hidden md:table-cell text-muted-foreground text-xs">
                      {new Date(m.join_date).toLocaleDateString()}
                    </td>

                    {/* Hours */}
                    <td className="p-3 text-right tabular-nums">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editValues.hours_logged ?? 0}
                          onChange={(e) => setEditValues((v) => ({ ...v, hours_logged: parseFloat(e.target.value) || 0 }))}
                          className="h-8 text-sm w-20 ml-auto text-right"
                          step="0.5"
                        />
                      ) : (
                        <span className="text-sm">{m.hours_logged}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit} disabled={saving}>
                            <Check className="h-3.5 w-3.5 text-green-400" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(m)}>
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMember(m.id, m.full_name)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Email Dialog */}
      <BulkEmailDialog
        open={bulkEmailOpen}
        onOpenChange={setBulkEmailOpen}
        clinicId={clinicId}
        selectedMembers={selectedMembers}
        roles={[]}
        templates={templates}
        onSent={() => {
          setSelectedIds(new Set());
        }}
      />
    </div>
  );
}
