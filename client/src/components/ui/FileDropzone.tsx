import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, X } from 'lucide-react';
import { Button } from './Button.js';

export interface FileDropzoneProps {
  label?: string;
  accept?: string;
  maxSizeBytes?: number;
  onFileSelect: (file: File | null) => void;
  selectedFile?: File | null;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export function FileDropzone({
  label,
  accept = 'application/pdf',
  maxSizeBytes = 20 * 1024 * 1024,
  onFileSelect,
  selectedFile,
  error,
  helperText = 'Apenas arquivos PDF (máximo 20 MB)',
  required,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setInternalError(null);
    if (file.size > maxSizeBytes) {
      setInternalError(`O arquivo ultrapassa o limite de ${(maxSizeBytes / (1024 * 1024)).toFixed(0)} MB.`);
      return;
    }
    if (accept && accept.includes('application/pdf') && !file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setInternalError('Por favor, selecione um arquivo em formato PDF.');
      return;
    }
    onFileSelect(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const displayError = error || internalError;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {selectedFile ? (
        <div className="flex items-center justify-between p-3.5 bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{selectedFile.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{formatSize(selectedFile.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onFileSelect(null)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
            title="Remover arquivo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30'
              : displayError
              ? 'border-rose-300 dark:border-rose-700 bg-rose-50/20 dark:bg-rose-950/20'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/50 dark:hover:bg-slate-800/60 hover:border-slate-400 dark:hover:border-slate-600'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />
          <div className="p-2.5 rounded-full bg-white dark:bg-slate-800 shadow-2xs text-slate-500 dark:text-slate-400 mb-2">
            <UploadCloud className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 text-center">
            Arraste o arquivo aqui ou <span className="text-emerald-700 dark:text-emerald-400 underline font-semibold">clique para selecionar</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{helperText}</p>
        </div>
      )}

      {displayError && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">{displayError}</p>}
    </div>
  );
}
