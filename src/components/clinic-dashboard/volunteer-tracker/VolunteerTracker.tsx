import { useState, useMemo } from 'react';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  FolderInput,
  Table as TableIcon,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import {
  useTrackerCategories,
  useTrackerColumns,
  useTrackerEntries,
  useTrackerValues,
} from './hooks';
import type { TrackerCategory, TrackerColumn, TrackerColumnType, TrackerEntry } from './types';
import { COLUMN_TYPE_LABELS, DEFAULT_CATEGORY_COLORS } from './types';
import { toast } from 'sonner';

// ── Inline cell editor ────────────────────────────────────────

function CellEditor({
  value,
  columnType,
  onSave,
}: {
  value: string | null;
  columnType: TrackerColumnType;
  onSave: (val: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  if (columnType === 'boolean') {
    return (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={value === 'true'}
          onCheckedChange={(checked) => onSave(checked ? 'true' : 'false')}
        />
      </div>
    );
  }

  if (!editing) {
    const display = columnType === 'percentage' && value ? `${value}%` : (value || '');
    return (
      <button
        type="button"
        className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted/50 min-h-[32px] transition-colors"
        onClick={() => {
          setDraft(value ?? '');
          setEditing(true);
        }}
      >
        {display || <span className="text-muted-foreground/40">—</span>}
      </button>
    );
  }

  const handleBlur = () => {
    setEditing(false);
    const trimmed = draft.trim();

    if (columnType === 'percentage') {
      const num = parseFloat(trimmed);
      if (trimmed && (isNaN(num) || num < 0 || num > 100)) {
        toast.error('Percentage must be between 0 and 100');
        return;
      }
      onSave(trimmed ? String(num) : null);
    } else if (columnType === 'rating_1_5') {
      const num = parseFloat(trimmed);
      if (trimmed && (isNaN(num) || num < 1 || num > 5)) {
        toast.error('Rating must be between 1 and 5');
        return;
      }
      onSave(trimmed ? String(num) : null);
    } else if (columnType === 'number') {
      const num = parseFloat(trimmed);
      if (trimmed && isNaN(num)) {
        toast.error('Please enter a valid number');
        return;
      }
      onSave(trimmed ? String(num) : null);
    } else {
      onSave(trimmed || null);
    }
  };

  const inputType = columnType === 'text' ? 'text' : 'number';
  const step = columnType === 'number' ? 'any' : '1';

  return (
    <Input
      autoFocus
      type={inputType}
      step={step}
      min={columnType === 'percentage' ? 0 : columnType === 'rating_1_5' ? 1 : undefined}
      max={columnType === 'percentage' ? 100 : columnType === 'rating_1_5' ? 5 : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
      }}
      className="h-8 text-sm px-2"
    />
  );
}

// ── Color picker ──────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {DEFAULT_CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`w-7 h-7 rounded-full border-2 transition-all ${
            value === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
          }`}
          style={{ backgroundColor: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function VolunteerTracker() {
  const { hospitalPage } = useHospitalPageContext();
  const rawId = hospitalPage?.id;
  const clinicId = rawId && !rawId.startsWith('virtual-') ? rawId : undefined;

  const { categories, loading: catLoading, add: addCategory, update: updateCategory, remove: removeCategory } = useTrackerCategories(clinicId);
  const { columns, loading: colLoading, add: addColumn, update: updateColumn, remove: removeColumn } = useTrackerColumns(clinicId);
  const { entries, loading: entLoading, add: addEntry, update: updateEntry, remove: removeEntry } = useTrackerEntries(clinicId);
  const entryIds = useMemo(() => entries.map(e => e.id), [entries]);
  const { values, loading: valLoading, upsert: upsertValue } = useTrackerValues(entryIds);

  // Modal state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [colDialogOpen, setColDialogOpen] = useState(false);
  const [volDialogOpen, setVolDialogOpen] = useState(false);

  // Edit mode (reuse same dialogs)
  const [editingCategory, setEditingCategory] = useState<TrackerCategory | null>(null);
  const [editingColumn, setEditingColumn] = useState<TrackerColumn | null>(null);
  const [editingEntry, setEditingEntry] = useState<TrackerEntry | null>(null);

  // Form state
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState(DEFAULT_CATEGORY_COLORS[0]);
  const [colName, setColName] = useState('');
  const [colType, setColType] = useState<TrackerColumnType>('number');
  const [volName, setVolName] = useState('');
  const [volCategoryId, setVolCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

  const loading = catLoading || colLoading || entLoading || valLoading;

  if (!clinicId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Volunteer tracker is not available yet. Please reload the page or contact support.
        </p>
      </div>
    );
  }

  // ── Helpers ───────────────────────────────────────────────

  function getValue(entryId: string, columnId: string): string | null {
    return values.find(v => v.entry_id === entryId && v.column_id === columnId)?.value ?? null;
  }

  function entriesForCategory(categoryId: string): TrackerEntry[] {
    return entries.filter(e => e.category_id === categoryId).sort((a, b) => a.sort_order - b.sort_order);
  }

  // ── Category dialog handlers ──────────────────────────────

  function openAddCategory() {
    setEditingCategory(null);
    setCatName('');
    setCatColor(DEFAULT_CATEGORY_COLORS[categories.length % DEFAULT_CATEGORY_COLORS.length]);
    setCatDialogOpen(true);
  }

  function openEditCategory(cat: TrackerCategory) {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatColor(cat.color);
    setCatDialogOpen(true);
  }

  async function handleSaveCategory() {
    if (!catName.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    if (editingCategory) {
      const err = await updateCategory(editingCategory.id, { name: catName.trim(), color: catColor });
      if (err) toast.error('Failed to update category');
      else toast.success('Category updated');
    } else {
      const err = await addCategory(catName.trim(), catColor);
      if (err) toast.error('Failed to add category');
      else toast.success('Category added');
    }
    setSaving(false);
    setCatDialogOpen(false);
  }

  async function handleDeleteCategory(id: string) {
    const catEntries = entries.filter(e => e.category_id === id);
    if (catEntries.length > 0) {
      toast.error('Remove all volunteers in this category first');
      return;
    }
    const err = await removeCategory(id);
    if (err) toast.error('Failed to delete category');
    else toast.success('Category deleted');
  }

  async function handleMoveCategoryUp(cat: TrackerCategory) {
    const idx = categories.findIndex(c => c.id === cat.id);
    if (idx <= 0) return;
    const prev = categories[idx - 1];
    await updateCategory(cat.id, { sort_order: prev.sort_order });
    await updateCategory(prev.id, { sort_order: cat.sort_order });
  }

  async function handleMoveCategoryDown(cat: TrackerCategory) {
    const idx = categories.findIndex(c => c.id === cat.id);
    if (idx >= categories.length - 1) return;
    const next = categories[idx + 1];
    await updateCategory(cat.id, { sort_order: next.sort_order });
    await updateCategory(next.id, { sort_order: cat.sort_order });
  }

  // ── Column dialog handlers ────────────────────────────────

  function openAddColumn() {
    setEditingColumn(null);
    setColName('');
    setColType('number');
    setColDialogOpen(true);
  }

  function openEditColumn(col: TrackerColumn) {
    setEditingColumn(col);
    setColName(col.name);
    setColType(col.column_type);
    setColDialogOpen(true);
  }

  async function handleSaveColumn() {
    if (!colName.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    if (editingColumn) {
      const err = await updateColumn(editingColumn.id, { name: colName.trim(), column_type: colType });
      if (err) toast.error('Failed to update column');
      else toast.success('Column updated');
    } else {
      const err = await addColumn(colName.trim(), colType);
      if (err) toast.error('Failed to add column');
      else toast.success('Column added');
    }
    setSaving(false);
    setColDialogOpen(false);
  }

  async function handleDeleteColumn(id: string) {
    const err = await removeColumn(id);
    if (err) toast.error('Failed to delete column');
    else toast.success('Column deleted');
  }

  async function handleMoveColumnLeft(col: TrackerColumn) {
    const idx = columns.findIndex(c => c.id === col.id);
    if (idx <= 0) return;
    const prev = columns[idx - 1];
    await updateColumn(col.id, { sort_order: prev.sort_order });
    await updateColumn(prev.id, { sort_order: col.sort_order });
  }

  async function handleMoveColumnRight(col: TrackerColumn) {
    const idx = columns.findIndex(c => c.id === col.id);
    if (idx >= columns.length - 1) return;
    const next = columns[idx + 1];
    await updateColumn(col.id, { sort_order: next.sort_order });
    await updateColumn(next.id, { sort_order: col.sort_order });
  }

  // ── Volunteer dialog handlers ─────────────────────────────

  function openAddVolunteer() {
    setEditingEntry(null);
    setVolName('');
    setVolCategoryId(categories[0]?.id ?? '');
    setVolDialogOpen(true);
  }

  function openEditVolunteer(entry: TrackerEntry) {
    setEditingEntry(entry);
    setVolName(entry.volunteer_name);
    setVolCategoryId(entry.category_id);
    setVolDialogOpen(true);
  }

  async function handleSaveVolunteer() {
    if (!volName.trim()) { toast.error('Name is required'); return; }
    if (!volCategoryId) { toast.error('Select a category'); return; }
    setSaving(true);
    if (editingEntry) {
      const err = await updateEntry(editingEntry.id, { volunteer_name: volName.trim(), category_id: volCategoryId });
      if (err) toast.error('Failed to update volunteer');
      else toast.success('Volunteer updated');
    } else {
      const err = await addEntry(volCategoryId, volName.trim());
      if (err) toast.error('Failed to add volunteer');
      else toast.success('Volunteer added');
    }
    setSaving(false);
    setVolDialogOpen(false);
  }

  async function handleDeleteVolunteer(id: string) {
    const err = await removeEntry(id);
    if (err) toast.error('Failed to delete volunteer');
    else toast.success('Volunteer removed');
  }

  // ── Cell save ─────────────────────────────────────────────

  async function handleCellSave(entryId: string, columnId: string, val: string | null) {
    const err = await upsertValue(entryId, columnId, val);
    if (err) toast.error('Failed to save');
  }

  // ── Loading state ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────

  if (categories.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Volunteer Tracker</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Spreadsheet-style performance tracking for your volunteers
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <TableIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Set up your volunteer tracker</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Add your first role category to get started. Categories group volunteers by role
              (e.g. "Medical Assistant", "Scribe", "Patient Registration").
            </p>
            <Button onClick={openAddCategory} className="gap-2">
              <Plus className="h-4 w-4" />
              Add First Category
            </Button>
          </CardContent>
        </Card>

        {/* Category dialog for empty state */}
        <CategoryDialog
          open={catDialogOpen}
          onOpenChange={setCatDialogOpen}
          editing={!!editingCategory}
          name={catName}
          color={catColor}
          saving={saving}
          onNameChange={setCatName}
          onColorChange={setCatColor}
          onSave={handleSaveCategory}
        />
      </div>
    );
  }

  // ── Main spreadsheet view ─────────────────────────────────

  const totalCols = columns.length + 2; // category + name + dynamic cols

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Volunteer Tracker</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Spreadsheet-style performance tracking for your volunteers
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={openAddCategory} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Category
        </Button>
        <Button size="sm" variant="outline" onClick={openAddColumn} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Column
        </Button>
        <Button size="sm" onClick={openAddVolunteer} className="gap-1.5" disabled={categories.length === 0}>
          <Plus className="h-3.5 w-3.5" />
          Add Volunteer
        </Button>
      </div>

      {/* Spreadsheet */}
      <Card className="border-border/50 overflow-hidden">
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/60">
                <TableHead className="w-[180px] sticky left-0 z-10 bg-background">Category / Volunteer</TableHead>
                {columns.map((col) => (
                  <TableHead key={col.id} className="min-w-[140px]">
                    <div className="flex items-center gap-1">
                      <span className="flex-1 truncate">{col.name}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditColumn(col)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMoveColumnLeft(col)} disabled={columns[0]?.id === col.id}>
                            <ArrowUp className="h-3.5 w-3.5 mr-2 -rotate-90" /> Move Left
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMoveColumnRight(col)} disabled={columns[columns.length - 1]?.id === col.id}>
                            <ArrowDown className="h-3.5 w-3.5 mr-2 -rotate-90" /> Move Right
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeleteColumn(col.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableHead>
                ))}
                {columns.length === 0 && (
                  <TableHead className="text-center text-muted-foreground/60">
                    <Button variant="ghost" size="sm" onClick={openAddColumn} className="gap-1.5 text-xs">
                      <Plus className="h-3 w-3" /> Add your first column
                    </Button>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => {
                const catEntries = entriesForCategory(cat.id);
                return (
                  <CategoryGroup
                    key={cat.id}
                    category={cat}
                    entries={catEntries}
                    columns={columns}
                    totalCols={totalCols}
                    getValue={getValue}
                    onCellSave={handleCellSave}
                    onEditCategory={() => openEditCategory(cat)}
                    onDeleteCategory={() => handleDeleteCategory(cat.id)}
                    onMoveCategoryUp={() => handleMoveCategoryUp(cat)}
                    onMoveCategoryDown={() => handleMoveCategoryDown(cat)}
                    isFirst={categories[0]?.id === cat.id}
                    isLast={categories[categories.length - 1]?.id === cat.id}
                    onEditEntry={openEditVolunteer}
                    onDeleteEntry={(id) => handleDeleteVolunteer(id)}
                    allCategories={categories}
                    onMoveEntry={async (entryId, newCatId) => {
                      await updateEntry(entryId, { category_id: newCatId });
                      toast.success('Volunteer moved');
                    }}
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ── Dialogs ──────────────────────────────────────────── */}

      <CategoryDialog
        open={catDialogOpen}
        onOpenChange={setCatDialogOpen}
        editing={!!editingCategory}
        name={catName}
        color={catColor}
        saving={saving}
        onNameChange={setCatName}
        onColorChange={setCatColor}
        onSave={handleSaveCategory}
      />

      <ColumnDialog
        open={colDialogOpen}
        onOpenChange={setColDialogOpen}
        editing={!!editingColumn}
        name={colName}
        colType={colType}
        saving={saving}
        onNameChange={setColName}
        onTypeChange={setColType}
        onSave={handleSaveColumn}
      />

      <VolunteerDialog
        open={volDialogOpen}
        onOpenChange={setVolDialogOpen}
        editing={!!editingEntry}
        name={volName}
        categoryId={volCategoryId}
        categories={categories}
        saving={saving}
        onNameChange={setVolName}
        onCategoryChange={setVolCategoryId}
        onSave={handleSaveVolunteer}
      />
    </div>
  );
}

// ── Category group rows ─────────────────────────────────────

function CategoryGroup({
  category,
  entries,
  columns,
  totalCols,
  getValue,
  onCellSave,
  onEditCategory,
  onDeleteCategory,
  onMoveCategoryUp,
  onMoveCategoryDown,
  isFirst,
  isLast,
  onEditEntry,
  onDeleteEntry,
  allCategories,
  onMoveEntry,
}: {
  category: TrackerCategory;
  entries: TrackerEntry[];
  columns: TrackerColumn[];
  totalCols: number;
  getValue: (entryId: string, columnId: string) => string | null;
  onCellSave: (entryId: string, columnId: string, val: string | null) => void;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
  onMoveCategoryUp: () => void;
  onMoveCategoryDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  onEditEntry: (entry: TrackerEntry) => void;
  onDeleteEntry: (id: string) => void;
  allCategories: TrackerCategory[];
  onMoveEntry: (entryId: string, newCatId: string) => void;
}) {
  return (
    <>
      {/* Category header row */}
      <TableRow className="hover:bg-muted/20 border-border/40">
        <TableCell
          colSpan={Math.max(totalCols, columns.length + 1)}
          className="py-2 px-0"
        >
          <div className="flex items-center gap-2" style={{ borderLeft: `4px solid ${category.color}`, paddingLeft: 12 }}>
            <span className="font-semibold text-sm">{category.name}</span>
            <span className="text-xs text-muted-foreground">({entries.length})</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 opacity-60 hover:opacity-100">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={onEditCategory}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Category
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onMoveCategoryUp} disabled={isFirst}>
                  <ArrowUp className="h-3.5 w-3.5 mr-2" /> Move Up
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onMoveCategoryDown} disabled={isLast}>
                  <ArrowDown className="h-3.5 w-3.5 mr-2" /> Move Down
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDeleteCategory} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Category
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      {/* Volunteer entry rows */}
      {entries.map((entry) => (
        <TableRow key={entry.id} className="border-border/30 hover:bg-muted/10">
          <TableCell className="sticky left-0 z-10 bg-background">
            <div className="flex items-center gap-1.5" style={{ borderLeft: `3px solid ${category.color}`, paddingLeft: 10 }}>
              <span className="text-sm truncate flex-1">{entry.volunteer_name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => onEditEntry(entry)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                  </DropdownMenuItem>
                  {allCategories.filter(c => c.id !== category.id).length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      {allCategories
                        .filter(c => c.id !== category.id)
                        .map(c => (
                          <DropdownMenuItem key={c.id} onClick={() => onMoveEntry(entry.id, c.id)}>
                            <FolderInput className="h-3.5 w-3.5 mr-2" />
                            <span className="truncate">Move to {c.name}</span>
                          </DropdownMenuItem>
                        ))}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDeleteEntry(entry.id)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TableCell>
          {columns.map((col) => (
            <TableCell key={col.id} className="p-0.5">
              <CellEditor
                value={getValue(entry.id, col.id)}
                columnType={col.column_type}
                onSave={(val) => onCellSave(entry.id, col.id, val)}
              />
            </TableCell>
          ))}
          {columns.length === 0 && (
            <TableCell className="text-center text-muted-foreground/40 text-xs">
              Add columns to track metrics
            </TableCell>
          )}
        </TableRow>
      ))}

      {/* Empty category message */}
      {entries.length === 0 && (
        <TableRow className="border-border/30">
          <TableCell colSpan={Math.max(totalCols, columns.length + 1)} className="text-center py-4">
            <p className="text-xs text-muted-foreground/60">No volunteers in this category yet</p>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Dialogs ─────────────────────────────────────────────────

function CategoryDialog({
  open,
  onOpenChange,
  editing,
  name,
  color,
  saving,
  onNameChange,
  onColorChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: boolean;
  name: string;
  color: string;
  saving: boolean;
  onNameChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogDescription>
            Categories group volunteers by role (e.g. "Medical Assistant", "Scribe").
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              placeholder="e.g. Medical Assistant"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }}
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker value={color} onChange={onColorChange} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? 'Save Changes' : 'Add Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColumnDialog({
  open,
  onOpenChange,
  editing,
  name,
  colType,
  saving,
  onNameChange,
  onTypeChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: boolean;
  name: string;
  colType: TrackerColumnType;
  saving: boolean;
  onNameChange: (v: string) => void;
  onTypeChange: (v: TrackerColumnType) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Column' : 'Add Column'}</DialogTitle>
          <DialogDescription>
            Columns define the metrics you track for each volunteer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="col-name">Column Name</Label>
            <Input
              id="col-name"
              placeholder="e.g. % Arrival on Time"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }}
            />
          </div>
          <div className="space-y-2">
            <Label>Data Type</Label>
            <Select value={colType} onValueChange={(v) => onTypeChange(v as TrackerColumnType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(COLUMN_TYPE_LABELS) as [TrackerColumnType, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? 'Save Changes' : 'Add Column'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VolunteerDialog({
  open,
  onOpenChange,
  editing,
  name,
  categoryId,
  categories,
  saving,
  onNameChange,
  onCategoryChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: boolean;
  name: string;
  categoryId: string;
  categories: TrackerCategory[];
  saving: boolean;
  onNameChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Volunteer' : 'Add Volunteer'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Update volunteer details.' : 'Add a volunteer to track their performance.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vol-name">Volunteer Name</Label>
            <Input
              id="vol-name"
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={onCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? 'Save Changes' : 'Add Volunteer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
