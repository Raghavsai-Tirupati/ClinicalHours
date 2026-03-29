import { useState, useCallback } from 'react';
import {
  Upload,
  File,
  FileText,
  Image,
  Trash2,
  Download,
  FolderOpen,
  User,
  Loader2,
  Search,
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ClinicFile, ClinicMember } from './types';
import { useClinicFiles } from './hooks';

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return FileText;
  return File;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileSystemProps {
  clinicId: string;
  members: ClinicMember[];
}

export default function FileSystem({ clinicId, members }: FileSystemProps) {
  const { user } = useAuth();
  const [view, setView] = useState<'shared' | 'member'>('shared');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch files based on view
  const memberIdArg = view === 'shared' ? null : selectedMemberId;
  const { files, loading, refetch } = useClinicFiles(clinicId, view === 'shared' ? null : (selectedMemberId || undefined));

  const filteredFiles = searchQuery.trim()
    ? files.filter((f) => f.file_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !user) return;

    setUploading(true);
    let uploadCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const storagePath = `${clinicId}/${view === 'member' && selectedMemberId ? selectedMemberId : 'shared'}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('clinic-files')
        .upload(storagePath, file);

      if (uploadError) {
        toast.error(`Failed to upload ${file.name}: ${uploadError.message}`);
        continue;
      }

      const { error: dbError } = await supabase.from('clinic_files').insert({
        clinic_id: clinicId,
        member_id: view === 'member' ? selectedMemberId : null,
        file_name: file.name,
        file_path: storagePath,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: user.id,
      });

      if (dbError) {
        toast.error(`Failed to save ${file.name} record`);
      } else {
        uploadCount++;
      }
    }

    setUploading(false);
    e.target.value = '';
    if (uploadCount > 0) {
      toast.success(`Uploaded ${uploadCount} file${uploadCount > 1 ? 's' : ''}`);
      refetch();
    }
  }, [clinicId, view, selectedMemberId, user, refetch]);

  const handleDelete = async (file: ClinicFile) => {
    if (!confirm(`Delete "${file.file_name}"?`)) return;

    await supabase.storage.from('clinic-files').remove([file.file_path]);
    const { error } = await supabase.from('clinic_files').delete().eq('id', file.id);
    if (error) {
      toast.error('Failed to delete file');
    } else {
      toast.success('File deleted');
      refetch();
    }
  };

  const handleDownload = async (file: ClinicFile) => {
    const { data, error } = await supabase.storage
      .from('clinic-files')
      .createSignedUrl(file.file_path, 60);

    if (error || !data?.signedUrl) {
      toast.error('Failed to generate download link');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* View toggle + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={view === 'shared' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setView('shared'); setSelectedMemberId(null); }}
            className="gap-1.5"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Shared Documents
          </Button>
          <Button
            variant={view === 'member' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('member')}
            className="gap-1.5"
          >
            <User className="h-3.5 w-3.5" />
            Member Files
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="h-8 pl-8 w-44 text-xs"
            />
          </div>
          <label>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={uploading || (view === 'member' && !selectedMemberId)}
            />
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 cursor-pointer"
              asChild
              disabled={uploading || (view === 'member' && !selectedMemberId)}
            >
              <span>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Member selector (when in member view) */}
      {view === 'member' && (
        <Select
          value={selectedMemberId || ''}
          onValueChange={(v) => setSelectedMemberId(v || null)}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Select a member..." />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* File list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : view === 'member' && !selectedMemberId ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <User className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Select a member to view their files.</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {searchQuery ? 'No files match your search.' : 'No files uploaded yet.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border/50">
          {filteredFiles.map((file) => {
            const Icon = getFileIcon(file.mime_type);
            return (
              <div key={file.id} className="flex items-center gap-3 p-3 hover:bg-muted/10 transition-colors">
                <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-muted/30 shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {file.file_size && <span>{formatFileSize(file.file_size)}</span>}
                    <span>{new Date(file.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(file)}>
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(file)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
