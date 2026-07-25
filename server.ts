import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { dbInstance } from './src/db/localDb';
import { automationEngineInstance } from './src/db/automationEngine';
import {
  apiSecurityContext,
  auditAdministrativeAction,
  auditSecurityEvent,
  createRateLimit,
  createSupabaseAuthentication,
  requireAccess,
  validateAutomationId,
  validateNoInput
} from './src/server/adminApiSecurity';
import {
  maskPhone,
  redactExternalResponse,
  safeLog
} from './src/security/safeOutput';
import { loadServerEnvironment } from './src/server/environment';
import { createSecurityHeaders } from './src/server/securityHeaders';

const apiError = (
  req: express.Request,
  message: string,
  extra: Record<string, string | boolean> = {}
) => ({
  ...extra,
  error: message,
  correlationId: req.securityRequestId || 'unassigned'
});

async function startServer() {
  const environment = loadServerEnvironment();
  dbInstance.config = {
    ...dbInstance.config,
    supabaseUrl: environment.supabaseUrl,
    supabaseAnonKey: environment.supabaseAnonKey,
    useRealSupabase: Boolean(environment.supabaseUrl && environment.supabaseAnonKey)
  };

  const app = express();
  const PORT = environment.port;

  app.disable('x-powered-by');
  app.use(createSecurityHeaders({
    environment: environment.appEnvironment,
    supabaseUrl: environment.supabaseUrl
  }));
  app.get('/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ status: 'ok' });
  });
  app.use('/api', apiSecurityContext);
  app.use(express.json({ limit: '32kb', strict: true }));
  app.use(express.urlencoded({ extended: true, limit: '32kb', parameterLimit: 50 }));

  app.use('/api', (error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error?.type === 'entity.too.large') {
      auditSecurityEvent(req, 'request_validation', 'denied', { reason: 'payload_too_large' });
      res.status(413).json(apiError(req, 'Corpo da requisição excede o limite permitido.'));
      return;
    }
    if (error instanceof SyntaxError) {
      auditSecurityEvent(req, 'request_validation', 'denied', { reason: 'invalid_json' });
      res.status(400).json(apiError(req, 'Corpo JSON inválido.'));
      return;
    }
    next(error);
  });

  const authenticateAdministrativeApi = createSupabaseAuthentication(() => ({
    url: dbInstance.config.supabaseUrl,
    anonKey: dbInstance.config.supabaseAnonKey
  }));
  const authenticationRateLimit = createRateLimit('administrative_authentication', {
    windowMs: 60_000,
    maxRequests: 60
  });
  const readRateLimit = createRateLimit('administrative_read', {
    windowMs: 60_000,
    maxRequests: 60,
    keyByUser: true
  });
  const sensitiveActionRateLimit = createRateLimit('administrative_action', {
    windowMs: 60_000,
    maxRequests: 10,
    keyByUser: true
  });
  const synchronizationRateLimit = createRateLimit('database_synchronization', {
    windowMs: 60_000,
    maxRequests: 5,
    keyByUser: true
  });

  app.use(
    ['/api/automations', '/api/database'],
    authenticationRateLimit,
    authenticateAdministrativeApi
  );

  // --- AUTOMATIONS API ENDPOINTS ---

  // Get automation stats & full history (Dashboard data)
  app.get(
    '/api/automations/dashboard',
    readRateLimit,
    requireAccess({
      module: 'automacoes',
      action: 'view',
      allowedRoles: ['admin', 'gerente']
    }),
    auditAdministrativeAction('automations.dashboard.read'),
    validateNoInput,
    async (req, res) => {
    try {
      // If using real Supabase, ensure we have the absolute latest state
      if (dbInstance.config.useRealSupabase) {
        await dbInstance.syncWithSupabase();
      }

      const executions = dbInstance.executions;
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

      // Filter executions executed/updated today
      const executionsToday = executions.filter(e => e.updated_at.startsWith(todayStr));
      const successfulToday = executionsToday.filter(e => e.status === 'sucesso').length;
      
      const sentCount = executions.filter(e => e.status === 'sucesso').length;
      const pendingCount = executions.filter(e => e.status === 'pendente').length;
      const errorCount = executions.filter(e => e.status === 'erro_definitivo').length;
      
      // Success rate of final states (sucesso / (sucesso + erro_definitivo))
      const totalFinalized = sentCount + errorCount;
      const successRate = totalFinalized > 0 ? Math.round((sentCount / totalFinalized) * 100) : 100;

      // Find last execution
      const sortedExecutions = [...executions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      const lastExecution = sortedExecutions[0] || null;

      // Find next scheduled execution
      const pendingSorted = executions
        .filter(e => e.status === 'pendente')
        .sort((a, b) => new Date(a.data_execucao).getTime() - new Date(b.data_execucao).getTime());
      const nextExecution = pendingSorted[0] || null;

      res.json({
        stats: {
          executedToday: executionsToday.length,
          successfulToday,
          sentCount,
          pendingCount,
          errorCount,
          successRate,
          lastExecutionTime: lastExecution ? lastExecution.updated_at : 'Nunca',
          nextExecutionTime: nextExecution ? executionTimeFormatted(nextExecution.data_execucao) : 'Nenhuma agendada'
        },
        history: sortedExecutions.map(e => {
          const customer = dbInstance.customers.find(c => c.id === e.customer_id);
          const automationTrigger = dbInstance.automations.find(a => a.event === e.automacao);
          return {
            id: e.id,
            horario: e.updated_at,
            cliente: customer ? 'Cliente protegido' : 'Cliente',
            telefone: maskPhone(e.telefone),
            automacao: automationTrigger ? automationTrigger.name : e.automacao,
            mensagem: 'Conteúdo da mensagem redigido.',
            status: e.status,
            tentativas: e.tentativas,
            resposta_api: redactExternalResponse(e.resposta_api),
            data_execucao: e.data_execucao
          };
        })
      });
    } catch (error) {
      safeLog('error', 'api.automations.dashboard', 'error', {
        correlationId: req.securityRequestId,
        error
      });
      res.status(500).json(apiError(req, 'Erro interno ao carregar dashboard de automações.'));
    }
  });

  // Run manual test for specific automation
  app.post(
    '/api/automations/test/:id',
    sensitiveActionRateLimit,
    requireAccess({
      module: 'automacoes',
      action: 'create',
      allowedRoles: ['admin', 'gerente']
    }),
    auditAdministrativeAction('automations.manual_test.execute'),
    validateAutomationId,
    validateNoInput,
    async (req, res) => {
    const { id } = req.params;
    try {
      const result = await automationEngineInstance.executeManualTest(id);
      res.json(result);
    } catch (error) {
      safeLog('error', 'api.automations.manual_test', 'error', {
        correlationId: req.securityRequestId,
        entityId: req.params.id,
        error
      });
      res.status(500).json(apiError(req, 'Erro interno ao executar teste.', { success: false }));
    }
  });

  // Run a manual queue scan and process cycle immediately
  app.post(
    '/api/automations/run-cycle',
    sensitiveActionRateLimit,
    requireAccess({
      module: 'automacoes',
      action: 'edit',
      allowedRoles: ['admin', 'gerente']
    }),
    auditAdministrativeAction('automations.queue_cycle.execute'),
    validateNoInput,
    async (req, res) => {
    try {
      const result = await automationEngineInstance.runCycle();
      res.json({ success: true, ...result });
    } catch (error) {
      safeLog('error', 'api.automations.run_cycle', 'error', {
        correlationId: req.securityRequestId,
        error
      });
      res.status(500).json(apiError(req, 'Erro interno ao executar ciclo.', { success: false }));
    }
  });

  // Trigger Supabase database synchronization
  app.post(
    '/api/database/sync',
    synchronizationRateLimit,
    requireAccess({
      module: 'configuracoes',
      action: 'edit',
      allowedRoles: ['admin', 'gerente']
    }),
    auditAdministrativeAction('database.synchronization.execute'),
    validateNoInput,
    async (req, res) => {
    try {
      if (dbInstance.config.useRealSupabase) {
        await dbInstance.syncWithSupabase();
        res.json({ success: true, message: 'Banco de dados sincronizado com sucesso.' });
      } else {
        res.json({ success: false, message: 'Supabase não está ativado.' });
      }
    } catch (error) {
      safeLog('error', 'api.database.sync', 'error', {
        correlationId: req.securityRequestId,
        error
      });
      res.status(500).json(apiError(req, 'Erro interno ao sincronizar banco de dados.', { success: false }));
    }
  });

  app.all(['/api/automations/*', '/api/database/*'], (req, res) => {
    auditSecurityEvent(req, 'administrative_route', 'denied', { reason: 'route_not_found' });
    res.status(404).json(apiError(req, 'Endpoint administrativo não encontrado.'));
  });

  // Serve static files / Vite middleware
  if (environment.nodeEnvironment !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    safeLog('info', 'server.vite_middleware', 'success', { operation: 'development' });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      index: false,
      setHeaders: (response, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return;
        }
        response.setHeader('Cache-Control', 'no-cache');
      }
    }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
    safeLog('info', 'server.static_assets', 'success', {
      operation: environment.appEnvironment
    });
  }

  // Bind to port 3000 and host 0.0.0.0
  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    safeLog('info', 'server.listen', 'success', { operation: `port_${PORT}` });
  });

  // Prevent overlapping cycles when a provider or database operation takes
  // longer than the worker interval.
  let backgroundCycleRunning = false;

  // --- BACKGROUND Persist Job (runs every 60 seconds) ---
  const backgroundCycle = setInterval(async () => {
    if (backgroundCycleRunning) {
      safeLog('warn', 'background_worker.cycle', 'ignored', {
        reason: 'previous_cycle_still_running'
      });
      return;
    }

    backgroundCycleRunning = true;
    try {
      const result = await automationEngineInstance.runCycle();
      if (result.generated > 0 || result.processed > 0) {
        safeLog('info', 'background_worker.cycle', 'success', {
          count: result.processed,
          attempt: result.generated
        });
      }
    } catch (err: any) {
      safeLog('error', 'background_worker.cycle', 'error', { error: err });
    } finally {
      backgroundCycleRunning = false;
    }
  }, 60 * 1000);

  let shutdownStarted = false;
  const shutdown = (signal: 'SIGTERM' | 'SIGINT') => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    clearInterval(backgroundCycle);
    safeLog('info', 'server.shutdown', 'started', { operation: signal });

    const forcedShutdown = setTimeout(() => {
      safeLog('error', 'server.shutdown', 'error', {
        operation: signal,
        reason: 'shutdown_timeout'
      });
      process.exit(1);
    }, 20_000);
    forcedShutdown.unref();

    httpServer.close(error => {
      clearTimeout(forcedShutdown);
      safeLog(
        error ? 'error' : 'info',
        'server.shutdown',
        error ? 'error' : 'success',
        { operation: signal, error }
      );
      process.exit(error ? 1 : 0);
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

function executionTimeFormatted(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} às ${hours}:${minutes}`;
  } catch {
    return isoStr;
  }
}

startServer().catch(err => {
  safeLog('error', 'server.start', 'error', { error: err });
});
