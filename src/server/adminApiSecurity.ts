import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ModulePermission, SystemModuleId, UserRole } from '../types';

const KNOWN_ROLES = new Set<UserRole>([
  'admin',
  'gerente',
  'atendente',
  'tecnico',
  'personalizado'
]);

type PermissionAction = keyof ModulePermission;

export interface AdminApiAuthContext {
  authUserId: string;
  profileId: string;
  role: UserRole;
  permissions: Partial<Record<SystemModuleId, ModulePermission>>;
}

export interface AccessRequirement {
  module: SystemModuleId;
  action: PermissionAction;
  allowedRoles: readonly UserRole[];
}

declare global {
  namespace Express {
    interface Request {
      adminAuth?: AdminApiAuthContext;
      securityRequestId?: string;
    }
  }
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface SecurityAuditDetails {
  reason?: string;
  retryAfterSeconds?: number;
  requiredModule?: string;
  requiredAction?: string;
  statusCode?: number;
  durationMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();
  private operations = 0;

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
    private readonly maxKeys = 10_000
  ) {
    if (windowMs <= 0 || maxRequests <= 0 || maxKeys <= 0) {
      throw new Error('Configuração inválida de rate limiting.');
    }
  }

  consume(key: string, now = Date.now()): RateLimitResult {
    this.operations += 1;
    if (this.operations % 100 === 0 || this.entries.size >= this.maxKeys) {
      for (const [entryKey, entry] of this.entries) {
        if (entry.resetAt <= now) this.entries.delete(entryKey);
      }
    }

    if (this.entries.size >= this.maxKeys && !this.entries.has(key)) {
      return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
    }

    const current = this.entries.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + this.windowMs }
      : current;

    entry.count += 1;
    this.entries.set(key, entry);

    return {
      allowed: entry.count <= this.maxRequests,
      remaining: Math.max(0, this.maxRequests - entry.count),
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    };
  }
}

const getSourceIp = (request: Request): string =>
  request.ip || request.socket.remoteAddress || 'unknown';

export const extractBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader || authorizationHeader.length > 8192) return null;
  const match = authorizationHeader.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  return match?.[1] || null;
};

const isModulePermission = (value: unknown): value is ModulePermission => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const permission = value as Record<string, unknown>;
  return ['view', 'create', 'edit', 'delete'].every(
    action => typeof permission[action] === 'boolean'
  );
};

const parsePermissions = (
  value: unknown
): Partial<Record<SystemModuleId, ModulePermission>> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const permissions: Partial<Record<SystemModuleId, ModulePermission>> = {};
  for (const [moduleId, permission] of Object.entries(value)) {
    if (isModulePermission(permission)) {
      permissions[moduleId as SystemModuleId] = permission;
    }
  }
  return permissions;
};

export const isAuthorized = (
  context: AdminApiAuthContext,
  requirement: AccessRequirement
): boolean => {
  if (!requirement.allowedRoles.includes(context.role)) return false;
  return context.permissions[requirement.module]?.[requirement.action] === true;
};

export const administrativeApiError = (request: Request, error: string) => ({
  error,
  correlationId: request.securityRequestId || 'unassigned'
});

export const auditSecurityEvent = (
  request: Request,
  event: string,
  outcome: 'success' | 'denied' | 'error',
  details: SecurityAuditDetails = {}
): void => {
  console.info(JSON.stringify({
    type: 'security_audit',
    timestamp: new Date().toISOString(),
    requestId: request.securityRequestId || 'unassigned',
    event,
    outcome,
    method: request.method,
    path: request.originalUrl.split('?')[0],
    sourceIp: getSourceIp(request),
    actorAuthUserId: request.adminAuth?.authUserId,
    actorProfileId: request.adminAuth?.profileId,
    actorRole: request.adminAuth?.role,
    reason: details.reason,
    retryAfterSeconds: details.retryAfterSeconds,
    requiredModule: details.requiredModule,
    requiredAction: details.requiredAction,
    statusCode: details.statusCode,
    durationMs: details.durationMs
  }));
};

export const apiSecurityContext: RequestHandler = (request, response, next) => {
  request.securityRequestId = randomUUID();
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Request-Id', request.securityRequestId);
  next();
};

export const createRateLimit = (
  name: string,
  options: {
    windowMs: number;
    maxRequests: number;
    keyByUser?: boolean;
  }
): RequestHandler => {
  const limiter = new FixedWindowRateLimiter(options.windowMs, options.maxRequests);

  return (request, response, next) => {
    const identity = options.keyByUser
      ? request.adminAuth?.authUserId || getSourceIp(request)
      : getSourceIp(request);
    const result = limiter.consume(`${name}:${identity}`);

    response.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    response.setHeader('X-RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      response.setHeader('Retry-After', String(result.retryAfterSeconds));
      auditSecurityEvent(request, `rate_limit.${name}`, 'denied', {
        retryAfterSeconds: result.retryAfterSeconds
      });
      response.status(429).json(
        administrativeApiError(request, 'Limite de requisições excedido. Tente novamente mais tarde.')
      );
      return;
    }
    next();
  };
};

export const createSupabaseAuthentication = (
  getConfig: () => { url: string; anonKey: string }
): RequestHandler => {
  return async (request: Request, response: Response, next: NextFunction) => {
    const accessToken = extractBearerToken(request.header('authorization'));
    if (!accessToken) {
      auditSecurityEvent(request, 'authentication', 'denied', { reason: 'missing_bearer_token' });
      response.status(401).json(administrativeApiError(request, 'Sessão administrativa ausente.'));
      return;
    }

    try {
      const { url, anonKey } = getConfig();
      if (!url || !anonKey) {
        auditSecurityEvent(request, 'authentication', 'error', { reason: 'supabase_not_configured' });
        response.status(503).json(
          administrativeApiError(request, 'Serviço de autenticação indisponível.')
        );
        return;
      }

      const supabase = createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        global: {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      });

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser(accessToken);

      if (userError || !user || user.aud !== 'authenticated') {
        auditSecurityEvent(request, 'authentication', 'denied', { reason: 'invalid_or_expired_session' });
        response.status(401).json(
          administrativeApiError(request, 'Sessão administrativa inválida ou expirada.')
        );
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('usuarios')
        .select('id, auth_user_id, perfil, status, permissions')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (profileError) {
        auditSecurityEvent(request, 'authentication', 'error', { reason: 'profile_lookup_failed' });
        response.status(503).json(
          administrativeApiError(request, 'Não foi possível validar o perfil de acesso.')
        );
        return;
      }

      const role = profile?.perfil as UserRole | undefined;
      const permissions = parsePermissions(profile?.permissions);
      if (
        !profile ||
        profile.auth_user_id !== user.id ||
        profile.status !== 'ativo' ||
        !role ||
        !KNOWN_ROLES.has(role) ||
        !permissions
      ) {
        auditSecurityEvent(request, 'authentication', 'denied', {
          reason: profile?.status === 'inativo' ? 'inactive_user' : 'invalid_profile'
        });
        response.status(403).json(
          administrativeApiError(request, 'Usuário sem perfil ativo e válido.')
        );
        return;
      }

      request.adminAuth = {
        authUserId: user.id,
        profileId: String(profile.id),
        role,
        permissions
      };
      next();
    } catch {
      auditSecurityEvent(request, 'authentication', 'error', { reason: 'unexpected_authentication_failure' });
      response.status(503).json(
        administrativeApiError(request, 'Serviço de autenticação temporariamente indisponível.')
      );
    }
  };
};

export const requireAccess = (requirement: AccessRequirement): RequestHandler => {
  return (request, response, next) => {
    if (!request.adminAuth || !isAuthorized(request.adminAuth, requirement)) {
      auditSecurityEvent(request, 'authorization', 'denied', {
        requiredModule: requirement.module,
        requiredAction: requirement.action
      });
      response.status(403).json(
        administrativeApiError(request, 'Permissão insuficiente para esta operação.')
      );
      return;
    }
    next();
  };
};

export const validateNoInput: RequestHandler = (request, response, next) => {
  const body = request.body;
  const hasBody = body !== undefined && body !== null &&
    (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length > 0);
  if (hasBody || Object.keys(request.query).length > 0) {
    response.status(400).json(
      administrativeApiError(request, 'A operação não aceita corpo ou parâmetros de consulta.')
    );
    return;
  }
  next();
};

export const validateAutomationId: RequestHandler = (request, response, next) => {
  const id = request.params.id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
    response.status(400).json(
      administrativeApiError(request, 'Identificador de automação inválido.')
    );
    return;
  }
  next();
};

export const auditAdministrativeAction = (event: string): RequestHandler => {
  return (request, response, next) => {
    const startedAt = Date.now();
    response.once('finish', () => {
      auditSecurityEvent(
        request,
        event,
        response.statusCode < 400 ? 'success' : response.statusCode < 500 ? 'denied' : 'error',
        {
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt
        }
      );
    });
    next();
  };
};
