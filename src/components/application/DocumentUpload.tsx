import { useCallback, useRef, useState } from 'react';
import { FileText, Upload, X, File, Award, BookOpen, Users, FileCheck } from 'lucide-react';
import type { DocumentFileType } from '@/types/positions';
import { DOCUMENT_TYPE_LABELS } from '@/types/positions';

export interface PendingDocument {
  id: string;
  file: File;
  fileType: DocumentFileType;
  fileName: string;
  fileSizeBytes: number;
}

const FILE_TYPE_ICONS: Record<DocumentFileType, typeof FileText> = {
  resume: FileText,
  cv: FileCheck,
  certification: Award,
  reference: Users,
  transcript: BookOpen,
  other: File,
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = '.pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg';

interface DocumentUploadProps {
  documents: PendingDocument[];
  onChange: (docs: PendingDocument[]) => void;
  maxFiles?: number;
}

export default function DocumentUpload({
  documents,
  onChange,
  maxFiles = 5,
}: DocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedType, setSelectedType] = useState<DocumentFileType>('resume');
  const [dragActive, setDragActive] = useState(false);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newDocs: PendingDocument[] = [];
      const fileArr = Array.from(files);

      for (const file of fileArr) {
        if (documents.length + newDocs.length >= maxFiles) break;
        if (file.size > MAX_FILE_SIZE) {
          continue; // skip files over 10 MB silently
        }
        newDocs.push({
          id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          file,
          fileType: selectedType,
          fileName: file.name,
          fileSizeBytes: file.size,
        });
      }

      if (newDocs.length > 0) {
        onChange([...documents, ...newDocs]);
      }
    },
    [documents, onChange, maxFiles, selectedType],
  );

  const removeDoc = (id: string) => {
    onChange(documents.filter((d) => d.id !== id));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="pa-form-label !mb-0">Document type:</label>
        <select
          className="pa-select !w-auto"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as DocumentFileType)}
        >
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      {documents.length < maxFiles && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            className="sr-only"
            accept={ACCEPTED_TYPES}
            multiple
            onChange={(e) => {
              if (e.target.files?.length) {
                addFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            className={`pa-file-drop w-full ${dragActive ? 'pa-drag-active' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-5 w-5 mx-auto mb-1 opacity-60" />
            <span className="text-sm text-[var(--pa-text-1)]">
              Click to upload or drag files here
            </span>
            <p>PDF, DOC, DOCX, or image files</p>
            <span>Max {maxFiles} files, 10 MB each</span>
          </button>
        </>
      )}

      {/* File list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => {
            const Icon = FILE_TYPE_ICONS[doc.fileType] || File;
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-md border border-[var(--pa-border)] bg-[var(--pa-surface-2)] px-3 py-2.5"
              >
                <Icon className="h-4 w-4 shrink-0 opacity-60" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--pa-text-1)] truncate">
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-[var(--pa-text-3)]">
                    {DOCUMENT_TYPE_LABELS[doc.fileType]} · {formatSize(doc.fileSizeBytes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeDoc(doc.id)}
                  className="shrink-0 rounded p-1 hover:bg-white/10 transition-colors"
                  aria-label={`Remove ${doc.fileName}`}
                >
                  <X className="h-3.5 w-3.5 text-[var(--pa-text-3)]" />
                </button>
              </div>
            );
          })}
          <p className="text-xs text-[var(--pa-text-3)]">
            {documents.length} of {maxFiles} files
          </p>
        </div>
      )}
    </div>
  );
}
