import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppErrorOptions {
  code: string;
  status?: number;
  details?: any;
}

export class AppError extends Error {
  status: number;
  code: string;
  details?: any;

  constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.status = options.status || 400;
    this.code = options.code;
    this.details = options.details;
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Já respondeu
  if (res.headersSent) {
    return next(err);
  }

  // Erro customizado da aplicação
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Erros do Zod (validação de schemas de requisição)
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.') || 'root';
      fields[path] = issue.message;
    }
    res.status(400).json({
      error: {
        code: 'VALIDACAO',
        message: 'Existem campos com preenchimento inválido.',
        details: { fields },
      },
    });
    return;
  }

  // Multer errors (upload)
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: {
          code: 'ARQUIVO_MUITO_GRANDE',
          message: 'O arquivo enviado excede o limite máximo permitido de 20 MB.',
        },
      });
      return;
    }
    res.status(400).json({
      error: {
        code: 'ERRO_UPLOAD',
        message: `Falha no upload do arquivo: ${err.message}`,
      },
    });
    return;
  }

  // Erros do PostgreSQL / triggers
  const pgCode = err.code;
  const pgHint = err.hint;

  // Violação de exclusão proibida
  if (pgHint === 'EXCLUSAO_PROIBIDA' || pgHint === 'AUDITORIA_IMUTAVEL' || pgHint === 'DOCUMENTO_IMUTAVEL') {
    res.status(403).json({
      error: {
        code: pgHint,
        message: err.message,
      },
    });
    return;
  }

  // Violação de unicidade (código 23505)
  if (pgCode === '23505') {
    const constraint = err.constraint || '';
    if (constraint.includes('invoices_supplier_number_uk')) {
      res.status(409).json({
        error: {
          code: 'NF_DUPLICADA',
          message: 'Já existe uma Nota Fiscal com este mesmo número cadastrada para este fornecedor.',
        },
      });
      return;
    }
    if (constraint.includes('processes_number_uk')) {
      res.status(409).json({
        error: {
          code: 'PROCESSO_DUPLICADO',
          message: 'Já existe um processo administrativo cadastrado com este número.',
        },
      });
      return;
    }
    if (constraint.includes('suppliers_name_uk')) {
      res.status(409).json({
        error: {
          code: 'FORNECEDOR_DUPLICADO',
          message: 'Já existe um fornecedor cadastrado com este nome.',
        },
      });
      return;
    }
    res.status(409).json({
      error: {
        code: 'REGISTRO_DUPLICADO',
        message: 'Operação não permitida: já existe um registro com estes dados únicos.',
      },
    });
    return;
  }

  // Regras de negócio plpgsql (código 23514 / HINT definido)
  if (pgHint) {
    res.status(422).json({
      error: {
        code: pgHint,
        message: err.message,
      },
    });
    return;
  }

  // Falha genérica não tratada
  console.error('[ERRO NÃO TRATADO]', err);
  res.status(500).json({
    error: {
      code: 'ERRO_INTERNO',
      message: 'Ocorreu um erro interno no servidor ao processar a operação.',
    },
  });
}
