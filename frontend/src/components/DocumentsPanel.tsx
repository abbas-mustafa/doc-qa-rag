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

function statusMeta(status: WorkspaceDocument['status']) {
  switch (status) {
    case 'ready':
      return { icon: CheckCircle2, label: 'Ready', className: 'text-emerald-400' };
    case 'failed':
      return { icon: XCircle, label: 'Failed', className: 'text-red-400' };
    default:
      return { icon: Loader2, label: 'Processing', className: 'text-amber-400 animate-spin' };
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
            ? 'border-violet-400 bg-violet-500/10'
            : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
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
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-400/20"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
          ) : (
            <UploadCloud className="h-5 w-5 text-violet-300" />
          )}
        </motion.div>
        <p className="text-sm text-zinc-300">
          {uploading ? 'Uploading…' : 'Drop a file here or click to upload'}
        </p>
        <p className="text-xs text-zinc-500">PDF, DOCX, or TXT</p>
      </div>

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {documents.map((doc) => {
            const { icon: Icon, label, className } = statusMeta(doc.status);
            return (
              <motion.div
                key={doc.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                  {doc.original_name}
                </span>
                <span className={clsx('flex items-center gap-1 text-xs', className)}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
                <button
                  onClick={() => onDelete(doc.id)}
                  className="text-zinc-500 transition-colors hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {documents.length === 0 && (
          <p className="px-1 text-sm text-zinc-500">No documents uploaded yet.</p>
        )}
      </div>
    </div>
  );
}
