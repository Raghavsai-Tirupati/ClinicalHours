import { useState } from 'react';
import { GripVertical, Plus, Pencil, Trash2, Check, X, Loader2, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import type { ClinicRole } from './types';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#78716c',
];

interface ManageRolesPanelProps {
  clinicId: string;
  roles: ClinicRole[];
  onRefresh: () => void;
  onSeedDefaults: () => void;
}

export default function ManageRolesPanel({ clinicId, roles, onRefresh, onSeedDefaults }: ManageRolesPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#6366f1');
  const [addMode, setAddMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);

  const startEdit = (role: ClinicRole) => {
    setEditingId(role.id);
    setEditName(role.role_name);
    setEditColor(role.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('#6366f1');
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('clinic_roles')
      .update({ role_name: editName.trim(), color: editColor })
      .eq('id', editingId);
    setSaving(false);
    if (error) {
      toast.error('Failed to update role');
    } else {
      toast.success('Role updated');
      cancelEdit();
      onRefresh();
    }
  };

  const addRole = async () => {
    if (!newName.trim()) {
      toast.error('Role name is required');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('clinic_roles').insert({
      clinic_id: clinicId,
      role_name: newName.trim(),
      color: newColor,
      sort_order: roles.length,
    });
    setSaving(false);
    if (error) {
      toast.error('Failed to add role');
    } else {
      toast.success('Role added');
      setAddMode(false);
      setNewName('');
      setNewColor('#6366f1');
      onRefresh();
    }
  };

  const deleteRole = async (id: string, name: string) => {
    if (!confirm(`Delete the "${name}" role? Members with this role will have it unassigned.`)) return;
    const { error } = await supabase.from('clinic_roles').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete role');
    } else {
      toast.success('Role deleted');
      onRefresh();
    }
  };

  const moveRole = async (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= roles.length) return;
    const updates = [
      { id: roles[idx].id, sort_order: roles[targetIdx].sort_order },
      { id: roles[targetIdx].id, sort_order: roles[idx].sort_order },
    ];
    for (const u of updates) {
      await supabase.from('clinic_roles').update({ sort_order: u.sort_order }).eq('id', u.id);
    }
    onRefresh();
  };

  const ColorPicker = ({ value, onChange }: { value: string; onChange: (c: string) => void }) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          className={`h-6 w-6 rounded-full border-2 transition-all ${
            value === c ? 'border-foreground scale-110' : 'border-transparent hover:border-muted-foreground/50'
          }`}
          style={{ backgroundColor: c }}
          onClick={() => onChange(c)}
          type="button"
        />
      ))}
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 w-6 h-6 cursor-pointer"
        />
        <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
          <Palette className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Manage Roles</h3>
          <p className="text-xs text-muted-foreground">Customize roles for your clinic team</p>
        </div>
        <div className="flex items-center gap-2">
          {roles.length === 0 && (
            <Button variant="outline" size="sm" onClick={onSeedDefaults} className="text-xs">
              Load Defaults
            </Button>
          )}
          <Button size="sm" onClick={() => setAddMode(true)} disabled={addMode} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Role
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {roles.map((role, idx) => {
          const isEditing = editingId === role.id;
          return (
            <div
              key={role.id}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-card hover:bg-muted/10 transition-colors"
            >
              {/* Drag handle / reorder */}
              <div className="flex flex-col gap-0.5">
                <button
                  className="text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20"
                  onClick={() => moveRole(idx, -1)}
                  disabled={idx === 0}
                >
                  <GripVertical className="h-4 w-4 rotate-180" />
                </button>
                <button
                  className="text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20"
                  onClick={() => moveRole(idx, 1)}
                  disabled={idx === roles.length - 1}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              </div>

              {/* Color dot */}
              <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: isEditing ? editColor : role.color }} />

              {/* Name / Edit */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <ColorPicker value={editColor} onChange={setEditColor} />
                  </div>
                ) : (
                  <span className="text-sm font-medium">{role.role_name}</span>
                )}
              </div>

              {/* Actions */}
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit} disabled={saving}>
                    <Check className="h-3.5 w-3.5 text-green-400" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(role)}>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRole(role.id, role.role_name)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add new role inline */}
        {addMode && (
          <div className="flex items-start gap-3 p-2.5 rounded-lg border border-primary/30 bg-primary/5">
            <div className="h-4 w-4 rounded-full shrink-0 mt-2" style={{ backgroundColor: newColor }} />
            <div className="flex-1 space-y-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Role name"
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && addRole()}
              />
              <ColorPicker value={newColor} onChange={setNewColor} />
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addRole} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-400" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setAddMode(false); setNewName(''); }}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        )}

        {roles.length === 0 && !addMode && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No roles defined. Click "Load Defaults" to start with MD, RN, Volunteer, and Intern.
          </p>
        )}
      </div>
    </div>
  );
}
