import React, { useEffect, useState } from 'react';
import { Eye, Download, Printer, Loader2, RefreshCw } from 'lucide-react';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { fetchDocumentBlob, downloadDocument, printDocument } from '../../lib/documents.js';
import { ConfirmDialog } from './Modal.js';
import { useAuth } from '../../contexts/AuthContext.js';

export interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string | null;
  fileName: string;
  kindName?: string;
}

export function DocumentViewerModal({
  isOpen,
  onClose,
  documentId,
  fileName,
  kindName = 'Documento',
}: DocumentViewerModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('application/pdf');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !documentId) {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetchDocumentBlob(documentId)
      .then((res) => {
        if (!active) return;
        setBlobUrl(res.url);
        setMimeType(res.mimeType);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Erro ao carregar o arquivo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, documentId]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title={`${kindName} — ${fileName}`}
      subtitle="Visualização do documento original com opções de download e impressão"
    >
      <div className="flex flex-col h-[75vh]">
        {/* Barra superior de ações */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="text-xs text-slate-500 font-medium">
            Formato: <span className="uppercase font-semibold text-slate-700">{mimeType.split('/')[1] || 'PDF'}</span>
          </div>
          <div className="flex items-center gap-2">
            {documentId && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Printer className="w-4 h-4" />}
                  onClick={() => printDocument(documentId)}
                >
                  Imprimir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Download className="w-4 h-4" />}
                  onClick={() => downloadDocument(documentId, fileName)}
                >
                  Baixar
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Visualizador */}
        <div className="flex-1 bg-slate-100 rounded-xl overflow-hidden relative border border-slate-200">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
              <p className="text-xs font-medium text-slate-600">Carregando arquivo oficial...</p>
            </div>
          )}

          {error && (
            <div className="p-8 text-center text-rose-600">
              <p className="font-semibold text-sm">Falha na visualização</p>
              <p className="text-xs mt-1 text-slate-600">{error}</p>
            </div>
          )}

          {!loading && !error && blobUrl && (
            mimeType.includes('pdf') ? (
              <iframe src={blobUrl} className="w-full h-full border-0" title={fileName} />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-4">
                <img src={blobUrl} alt={fileName} className="max-w-full max-h-full object-contain shadow-md rounded" />
              </div>
            )
          )}
        </div>
      </div>
    </Modal>
  );
}

export function DocumentActions({
  documentId,
  fileName,
  kindName = 'Documento',
  onReplace,
  compact = false,
}: {
  documentId: string | null | undefined;
  fileName?: string;
  kindName?: string;
  onReplace?: () => void;
  compact?: boolean;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const { can } = useAuth();
  const canReplace = can('documents.replace');

  if (!documentId) {
    return (
      <span className="text-xs text-slate-400 italic">
        Nenhum arquivo anexado
      </span>
    );
  }

  const name = fileName || 'documento.pdf';

  if (compact) {
    return (
      <>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            title="Visualizar documento"
            className="p-1.5 rounded text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => downloadDocument(documentId, name)}
            title="Baixar arquivo original"
            className="p-1.5 rounded text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => printDocument(documentId)}
            title="Imprimir documento"
            className="p-1.5 rounded text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>

        <DocumentViewerModal
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          documentId={documentId}
          fileName={name}
          kindName={kindName}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          icon={<Eye className="w-3.5 h-3.5" />}
          onClick={() => setViewerOpen(true)}
        >
          Visualizar
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={<Download className="w-3.5 h-3.5" />}
          onClick={() => downloadDocument(documentId, name)}
        >
          Baixar
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={<Printer className="w-3.5 h-3.5" />}
          onClick={() => printDocument(documentId)}
        >
          Imprimir
        </Button>

        {onReplace && canReplace && (
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={onReplace}
            className="text-slate-500 hover:text-slate-800"
          >
            Substituir
          </Button>
        )}
      </div>

      <DocumentViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        documentId={documentId}
        fileName={name}
        kindName={kindName}
      />
    </>
  );
}
