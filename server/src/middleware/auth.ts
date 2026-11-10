import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { can, type Permission, type ProfileLike, type UserRole } from '@cozam/shared';
import { config } from '../config.js';
import { getPool } from '../db/pool.js';

export interface AuthUser extends ProfileLike {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  extra_permissions: string[];
  active: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}

let supabaseClient: any = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (config.supabaseUrl && (config.supabaseAnonKey || config.supabaseServiceRoleKey)) {
    supabaseClient = createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey || config.supabaseAnonKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    return supabaseClient;
  }
  return null;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: { code: 'NAO_AUTENTICADO', message: 'Token de autenticação ausente ou inválido.' },
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  let userId: string | null = null;
  let userEmail: string | null = null;

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data?.user) {
        res.status(401).json({
          error: { code: 'TOKEN_INVALIDO', message: 'Sessão expirada ou token inválido. Faça login novamente.' },
        });
        return;
      }
      userId = data.user.id;
      userEmail = data.user.email || null;
    } catch (err) {
      res.status(401).json({
        error: { code: 'ERRO_AUTENTICACAO', message: 'Não foi possível validar a sessão no Supabase.' },
      });
      return;
    }
  } else {
    // Modo standalone/testes: aceita token no formato "dev:<userId>" ou "mock-admin" ou UUID
    if (token.startsWith('dev:')) {
      userId = token.slice(4);
    } else if (token === 'mock-admin' || token === 'admin') {
      userId = '00000000-0000-0000-0000-000000000001';
    } else if (token === 'mock-pagamentos' || token === 'pagamentos') {
      userId = '00000000-0000-0000-0000-000000000002';
    } else if (/^[0-9a-f-]{36}$/i.test(token)) {
      userId = token;
    } else {
      res.status(401).json({
        error: { code: 'TOKEN_INVALIDO', message: 'Token de desenvolvimento inválido.' },
      });
      return;
    }
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      `select id, full_name, email, role, extra_permissions, active
         from public.profiles
        where id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      res.status(403).json({
        error: { code: 'PERFIL_NAO_ENCONTRADO', message: 'Usuário autenticado não possui perfil cadastrado no sistema.' },
      });
      return;
    }

    const row = result.rows[0];
    if (!row.active) {
      res.status(403).json({
        error: { code: 'USUARIO_INATIVO', message: 'Sua conta de usuário foi desativada pelo administrador.' },
      });
      return;
    }

    req.user = {
      id: row.id,
      email: row.email || userEmail || '',
      full_name: row.full_name,
      role: row.role as UserRole,
      extra_permissions: row.extra_permissions || [],
      active: row.active,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'NAO_AUTENTICADO', message: 'Autenticação necessária.' },
      });
      return;
    }

    if (!can(req.user, permission)) {
      res.status(403).json({
        error: {
          code: 'ACESSO_NEGADO',
          message: `Você não possui a permissão "${permission}" necessária para realizar esta operação.`,
        },
      });
      return;
    }
    next();
  };
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'NAO_AUTENTICADO', message: 'Autenticação necessária.' },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'ACESSO_NEGADO',
          message: 'Seu perfil de acesso não tem permissão para esta funcionalidade.',
        },
      });
      return;
    }
    next();
  };
}
