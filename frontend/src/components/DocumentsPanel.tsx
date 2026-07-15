'use client';

import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Trash2, UploadCloud, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import clsx from 'clsx';
import type { WorkspaceDocument } from '@/lib/types';

interface DocumentsPanelProps {
  documents: WorkspaceDocument[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// `iconClassName` is kept separate from `className` so the spin applies to the
// icon alone — folding it into the wrapper rotates the label text with it.
function statusMeta(status: WorkspaceDocument['status']) {
  switch (status) {
    case 'ready':
      return { icon: CheckCircle2, label: 'Ready', className: 'text-accent', iconClassName: '' };
    case 'failed':
      return { icon: XCircle, label: 'Failed', className: 'text-danger', iconClassName: '' };
    default:
      return {
        icon: Loader2,
        label: 'Processing',
        className: 'text-warn',
        iconClassName: 'animate-spin',
      };
  }
}

export default function DocumentsPanel({ documents, onUpload, onDelete }: DocumentsPanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!ACCEPTED_TYPES.includes(file.type)) {
        return;
      }
      setUploading(true);
      try {
        await onUpload(file);
      } finally {
        setUploading(false);
      }
    },
    [onUpload]
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragActive
            ? 'border-accent-2 bg-accent-2/10'
            : 'border-line bg-card/40 hover:border-accent-2/40 hover:bg-card/60'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <motion.div
          animate={{ y: dragActive ? -4 : 0 }}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-2/15 ring-1 ring-line-2"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-accent-2" />
          ) : (
            <UploadCloud className="h-5 w-5 text-accent-2" />
          )}
        </motion.div>
        <p className="text-sm text-ink">
          {uploading ? 'Uploading…' : 'Drop a file here or click to upload'}
        </p>
        <p className="text-xs text-muted">PDF, DOCX, or TXT</p>
      </div>

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {documents.map((doc) => {
            const { icon: Icon, label, className, iconClassName } = statusMeta(doc.status);
            return (
              <motion.div
                key={doc.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="flex items-center gap-3 rounded-xl border border-line bg-card/60 px-4 py-3 backdrop-blur-sm"
              >
                <FileText className="h-4 w-4 shrink-0 text-accent-2/70" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {doc.original_name}
                </span>
                <span className={clsx('flex items-center gap-1 font-mono text-xs', className)}>
                  <Icon className={clsx('h-3.5 w-3.5', iconClassName)} />
                  {label}
                </span>
                <button
                  onClick={() => onDelete(doc.id)}
                  className="text-muted transition-colors hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {documents.length === 0 && (
          <p className="px-1 text-sm text-muted">No documents uploaded yet.</p>
        )}
      </div>
    </div>
  );
}
