import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export interface UploadResult {
  storagePath: string;
  sha256: string;
  sizeBytes: number;
}

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin;
  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return supabaseAdmin;
  }
  return null;
}

export async function uploadDocument(
  buffer: Buffer,
  kind: 'OF' | 'NF' | 'COMPROVANTE' | 'OF_ASSINADA' | 'CONTRATO' | 'ADITIVO' | 'OUTRO' | string,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext = path.extname(originalName) || (mimeType === 'application/pdf' ? '.pdf' : '.bin');
  const dateFolder = new Date().toISOString().slice(0, 10);
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const storagePath = `${kind.toLowerCase()}s/${dateFolder}/${fileName}`;

  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin.storage
      .from('documentos')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
    if (error) {
      throw new Error(`Erro ao enviar arquivo para o Supabase Storage: ${error.message}`);
    }
  } else {
    // Fallback local filesystem
    const target = path.join(config.localStorageDir, storagePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
  }

  return {
    storagePath,
    sha256,
    sizeBytes: buffer.length,
  };
}

export async function getDocumentBytes(storagePath: string): Promise<Buffer> {
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin.storage.from('documentos').download(storagePath);
    if (error || !data) {
      throw new Error(`Erro ao baixar arquivo do Supabase Storage: ${error?.message || 'Arquivo não encontrado'}`);
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } else {
    const target = path.join(config.localStorageDir, storagePath);
    return await fs.readFile(target);
  }
}

export async function createSignedUrl(storagePath: string, expiresInSeconds = 60): Promise<string> {
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin.storage
      .from('documentos')
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) {
      throw new Error(`Erro ao gerar link assinado: ${error?.message || 'Falha ao assinar'}`);
    }
    return data.signedUrl;
  }
  // Local fallback: URL relativa servida pela própria API
  return `/api/documents/by-path/${encodeURIComponent(storagePath)}`;
}
