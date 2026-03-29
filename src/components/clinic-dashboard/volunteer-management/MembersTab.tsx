import { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  UserPlus,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import type { ClinicMember, ClinicRole, MemberStatus, OnboardingSource } from './types';
import { MEMBER_STATUS_LABELS, MEMBER_STATUS_COLORS } from './types';

type SortField = 'full_name' | 'join_date' | 'hours_logged' | 'status';
type SortDir = 'asc' | 'desc';

interface MembersTabProps {
  clinicId: string;
  members: ClinicMember[];
  roles: ClinicRole[];
  loading: boolean;
  onRefresh: () => void;
}

export default function MembersTab({ clinicId, members, roles, loading, onRefresh }: MembersTabProps) {
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ClinicMember>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newMember, setNewMember] = useState({
    full_name: '',
    email: '',
    phone: '',
    role_id: '',
    status: 'active' as MemberStatus,
    onboarding_source: 'new_applicant' as OnboardingSource,
  });

  const sorted = useMemo(() => {
    return [...members].sort((a, b) => {
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
  }, [members, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const roleMap = useMemo(() => {
    const map = new Map<string, ClinicRole>();
    roles.forEach((r) => map.set(r.id, r));
    return map;
  }, [roles]);

  const startEdit = (member: ClinicMember) => {
    setEditingId(member.id);
    setEditValues({
      full_name: member.full_name,
      email: member.email,
      phone: member.phone,
      role_id: member.role_id,
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
        role_id: editValues.role_id || null,
        status: editValues.status,
        hours_logged: editValues.hours_logged ?? 0,
      })
      .eq('id', editingId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save: ' + error.message);
    } else {
      toast.success('Member updated');
      cancelEdit();
      onRefresh();
    }
  };

  const deleteMember = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the roster?`)) return;
    const { error } = await supabase.from('clinic_members').delete().eq('id', id);
    if (error) {
      toast.error('Failed to remove member');
    } else {
      toast.success('Member removed');
      onRefresh();
    }
  };

  const addMember = async () => {
    if (!newMember.full_name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('clinic_members').insert({
      clinic_id: clinicId,
      full_name: newMember.full_name.trim(),
      email: newMember.email.trim() || null,
      phone: newMember.phone.trim() || null,
      role_id: newMember.role_id || null,
      status: newMember.status,
      onboarding_source: newMember.onboarding_source,
    });
    setSaving(false);
    if (error) {
      toast.error('Failed to add member: ' + error.message);
    } else {
      toast.success('Member added');
      setAddOpen(false);
      setNewMember({ full_name: '', email: '', phone: '', role_id: '', status: 'active', onboarding_source: 'new_applicant' });
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      {/* Table */}
      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <UserPlus className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No members yet. Add your first team member.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
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
                const role = m.role_id ? roleMap.get(m.role_id) : null;
                const isEditing = editingId === m.id;

                return (
                  <tr
                    key={m.id}
                    className="border-b border-border/50 hover:bg-muted/10 transition-colors"
                    style={role ? { borderLeftWidth: 3, borderLeftColor: role.color } : undefined}
                  >
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

                    {/* Role */}
                    <td className="p-3 hidden sm:table-cell">
                      {isEditing ? (
                        <Select
                          value={editValues.role_id || 'none'}
                          onValueChange={(v) => setEditValues((prev) => ({ ...prev, role_id: v === 'none' ? null : v }))}
                        >
                          <SelectTrigger className="h-8 text-xs w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No role</SelectItem>
                            {roles.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                <div className="flex items-center gap-2">
                                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                                  {r.role_name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : role ? (
                        <Badge variant="outline" className="text-xs" style={{ borderColor: role.color, color: role.color }}>
                          <div className="h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: role.color }} />
                          {role.role_name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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

      {/* Add Member Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name *</Label>
              <Input
                value={newMember.full_name}
                onChange={(e) => setNewMember((v) => ({ ...v, full_name: e.target.value }))}
                placeholder="Jane Doe"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  value={newMember.email}
                  onChange={(e) => setNewMember((v) => ({ ...v, email: e.target.value }))}
                  placeholder="jane@example.com"
                  type="email"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={newMember.phone}
                  onChange={(e) => setNewMember((v) => ({ ...v, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role</Label>
                <Select
                  value={newMember.role_id || 'none'}
                  onValueChange={(v) => setNewMember((prev) => ({ ...prev, role_id: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No role</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                          {r.role_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source</Label>
                <Select
                  value={newMember.onboarding_source}
                  onValueChange={(v) => setNewMember((prev) => ({ ...prev, onboarding_source: v as OnboardingSource }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_applicant">New Applicant</SelectItem>
                    <SelectItem value="existing_staff">Existing Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addMember} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
