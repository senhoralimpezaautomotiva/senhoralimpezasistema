import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { dbInstance } from './src/db/localDb';
import { automationEngineInstance } from './src/db/automationEngine';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // --- AUTOMATIONS API ENDPOINTS ---

  // Get automation stats & full history (Dashboard data)
  app.get('/api/automations/dashboard', async (req, res) => {
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
            cliente: customer ? customer.name : 'Cliente',
            telefone: e.telefone,
            automacao: automationTrigger ? automationTrigger.name : e.automacao,
            mensagem: e.mensagem,
            status: e.status,
            tentativas: e.tentativas,
            resposta_api: e.resposta_api,
            data_execucao: e.data_execucao
          };
        })
      });
    } catch (error: any) {
      console.error('[API Error] Falha ao carregar dashboard de automações:', error);
      res.status(500).json({ error: 'Erro ao carregar dashboard de automações', details: error.message });
    }
  });

  // Run manual test for specific automation
  app.post('/api/automations/test/:id', async (req, res) => {
    const { id } = req.params;
    try {
      console.log(`[API] Teste manual acionado para ID: ${id}`);
      const result = await automationEngineInstance.executeManualTest(id);
      res.json(result);
    } catch (error: any) {
      console.error('[API Error] Falha no teste manual:', error);
      res.status(500).json({ success: false, log: `Erro interno: ${error.message}` });
    }
  });

  // Run a manual queue scan and process cycle immediately
  app.post('/api/automations/run-cycle', async (req, res) => {
    try {
      console.log('[API] Varredura manual da fila acionada.');
      const result = await automationEngineInstance.runCycle();
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('[API Error] Falha na execução manual do ciclo:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Trigger Supabase database synchronization
  app.post('/api/database/sync', async (req, res) => {
    try {
      if (dbInstance.config.useRealSupabase) {
        await dbInstance.syncWithSupabase();
        res.json({ success: true, message: 'Banco de dados sincronizado com sucesso.' });
      } else {
        res.json({ success: false, message: 'Supabase não está ativado.' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Vite] Middleware de desenvolvimento acoplado com sucesso.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('[Vite] Servindo arquivos estáticos de produção.');
  }

  // Bind to port 3000 and host 0.0.0.0
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Backend Server] Servidor rodando com sucesso em http://localhost:${PORT}`);
  });

  // --- BACKGROUND Persist Job (runs every 60 seconds) ---
  setInterval(async () => {
    console.log('[Background Worker] Executando ciclo automático da fila...');
    try {
      const result = await automationEngineInstance.runCycle();
      if (result.generated > 0 || result.processed > 0) {
        console.log(`[Background Worker] Ciclo concluído. Gerados: ${result.generated} | Processados: ${result.processed}`);
      }
    } catch (err: any) {
      console.error('[Background Worker Error] Erro ao executar ciclo automático:', err.message || err);
    }
  }, 60 * 1000);
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
  console.error('[Backend Crítico] Falha ao iniciar servidor:', err);
});
