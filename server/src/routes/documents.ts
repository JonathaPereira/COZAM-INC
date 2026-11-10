import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getPool } from '../db/pool.js';
import { getDocumentBytes, createSignedUrl } from '../services/storage.js';
import { AppError } from '../middleware/errors.js';

export const documentsRouter = Router();

documentsRouter.get('/documents/:id/content', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const download = req.query.download === '1' || req.query.download === 'true';
    const pool = getPool();
    const user = req.user!;

    const docRes = await pool.query('select * from public.documents where id = $1', [id]);
    if (docRes.rowCount === 0) {
      throw new AppError('Documento não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
    }
    const doc = docRes.rows[0];

    // Checagem de visibilidade
    if (user.role === 'pagamentos') {
      if (doc.invoice_id) {
        const invCheck = await pool.query(
          `select 1 from public.invoices where id = $1 and (forward_status <> 'RASCUNHO' or is_historical = true)`,
          [doc.invoice_id]
        );
        if (invCheck.rowCount === 0) {
          throw new AppError('Acesso não autorizado a este documento.', { code: 'ACESSO_NEGADO', status: 403 });
        }
      } else if (doc.supply_order_id) {
        const ofCheck = await pool.query(
          `select 1 from public.invoices where supply_order_id = $1 and (forward_status <> 'RASCUNHO' or is_historical = true)`,
          [doc.supply_order_id]
        );
        if (ofCheck.rowCount === 0) {
          throw new AppError('Acesso não autorizado a este documento.', { code: 'ACESSO_NEGADO', status: 403 });
        }
      }
    }

    const buffer = await getDocumentBytes(doc.storage_path);

    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Length', buffer.length);
    const disposition = download ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(doc.file_name)}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

documentsRouter.get('/documents/:id/signed-url', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const docRes = await pool.query('select * from public.documents where id = $1', [id]);
    if (docRes.rowCount === 0) {
      throw new AppError('Documento não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
    }
    const doc = docRes.rows[0];
    const signedUrl = await createSignedUrl(doc.storage_path, 60);
    res.json({ url: signedUrl, expires_in: 60, file_name: doc.file_name, mime_type: doc.mime_type });
  } catch (err) {
    next(err);
  }
});

// Endpoint de leitura direta para fallback de storage local
documentsRouter.get('/documents/by-path/:path(*)', authenticate, async (req, res, next) => {
  try {
    const storagePath = req.params.path;
    const pool = getPool();
    const docRes = await pool.query('select * from public.documents where storage_path = $1', [storagePath]);
    if (docRes.rowCount === 0) {
      throw new AppError('Documento não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
    }
    const doc = docRes.rows[0];
    const buffer = await getDocumentBytes(storagePath);
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.file_name)}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});
