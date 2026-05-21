import { FileText, File, Award, BookOpen, Users, FileCheck, Download, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ApplicationDocument, DocumentFileType } from '@/types/positions';
import { DOCUMENT_TYPE_LABELS } from '@/types/positions';

const FILE_TYPE_ICONS: Record<DocumentFileType, typeof FileText> = {
  resume: FileText,
  cv: FileCheck,
  certification: Award,
  reference: Users,
  transcript: BookOpen,
  other: File,
};

const FILE_TYPE_COLORS: Record<DocumentFileType, string> = {
  resume: 'bg-blue-500/15 text-blue-400',
  cv: 'bg-cyan-500/15 text-cyan-400',
  certification: 'bg-amber-500/15 text-amber-400',
  reference: 'bg-purple-500/15 text-purple-400',
  transcript: 'bg-green-500/15 text-green-400',
  other: 'bg-zinc-500/15 text-zinc-400',
};

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ApplicantDocumentsProps {
  documents: ApplicationDocument[];
  onDelete?: (doc: ApplicationDocument) => void;
}

export default function ApplicantDocuments({ documents, onDelete }: ApplicantDocumentsProps) {
  if (!documents.length) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No documents uploaded.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" />
          Documents ({documents.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {documents.map((doc) => {
          const Icon = FILE_TYPE_ICONS[doc.file_type] || File;
          const sizeStr = formatSize(doc.file_size_bytes);
          return (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-md border border-border/40 p-2.5 hover:bg-muted/20 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/30">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{doc.file_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className={`text-[10px] ${FILE_TYPE_COLORS[doc.file_type]}`}>
                    {DOCUMENT_TYPE_LABELS[doc.file_type]}
                  </Badge>
                  {sizeStr && (
                    <span className="text-[11px] text-muted-foreground">{sizeStr}</span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" aria-label="Download document">
                  <Download className="h-3.5 w-3.5" />
                </a>
              </Button>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Delete document"
                  onClick={() => onDelete(doc)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
