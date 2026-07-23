import { dbInstance } from './localDb';
import { AutomationExecution, AutomationLog, Customer, Vehicle, Service, Appointment } from '../types';

export class AutomationEngine {
  private isProcessing = false;

  constructor() {
    console.log('[Automation Engine] Inicializado.');
  }

  /**
   * Main cycle executed periodically by the backend background job (e.g., every 1-2 minutes).
   */
  async runCycle(): Promise<{ generated: number; processed: number; logs: string[] }> {
    const logs: string[] = [];
    if (this.isProcessing) {
      logs.push('[Automation Engine] Ciclo ignorado: ciclo anterior ainda em andamento.');
      return { generated: 0, processed: 0, logs };
    }

    this.isProcessing = true;
    let generatedCount = 0;
    let processedCount = 0;

    try {
      // 1. If real Supabase is active, fetch latest state to ensure sync
      if (dbInstance.config.useRealSupabase) {
        await dbInstance.syncWithSupabase();
      }

      // 2. Scan for and generate new pending executions
      generatedCount = await this.scanAndGenerateExecutions(logs);

      // 3. Process the pending queue
      processedCount = await this.processQueue(logs);

    } catch (error: any) {
      console.error('[Automation Engine Error]', error);
      logs.push(`[Automation Engine Error] Erro crítico no ciclo: ${error.message || error}`);
    } finally {
      this.isProcessing = false;
    }

    return { generated: generatedCount, processed: processedCount, logs };
  }

  /**
   * Scans all events and queues automations for eligible targets.
   */
  private async scanAndGenerateExecutions(logs: string[]): Promise<number> {
    let count = 0;
    const nowIso = new Date().toISOString();

    // --- 1. LEMBRETE DE AGENDAMENTO (60 minutos antes) ---
    const reminderTrigger = dbInstance.automations.find(a => a.event === 'lembrete_agendamento');
    if (reminderTrigger && reminderTrigger.isActive) {
      const now = new Date();
      const limit = new Date(now.getTime() + 60 * 60 * 1000); // 60 minutes ahead

      const eligibleAppts = dbInstance.appointments.filter(appt => {
        if (appt.status === 'cancelado' || appt.status === 'finalizado' || appt.status === 'entregue') return false;
        
        const apptDate = new Date(appt.dateTime);
        // Is within the next 60 minutes and is in the future
        const isImminent = apptDate > now && apptDate <= limit;
        if (!isImminent) return false;

        // Check duplicate
        const hasBeenQueued = dbInstance.executions.some(e => 
          e.automacao === 'lembrete_agendamento' && 
          e.appointment_id === appt.id &&
          e.status !== 'erro_definitivo'
        );
        return !hasBeenQueued;
      });

      for (const appt of eligibleAppts) {
        const customer = dbInstance.customers.find(c => c.id === appt.customerId);
        if (!customer) continue;

        const vehicle = dbInstance.vehicles.find(v => v.id === appt.vehicleId);
        const service = dbInstance.services.find(s => s.id === appt.serviceId);

        const execution = await dbInstance.queueAutomation('lembrete_agendamento', {
          customer,
          vehicle,
          service,
          appointment: appt
        });

        if (execution) {
          count++;
          logs.push(`[Reminder Scan] Lembrete agendado para o cliente ${customer.name} (Agendamento: ${appt.id}).`);
        }
      }
    }

    // --- 2. ANIVERSÁRIOS (Aniversariantes do dia) ---
    const bdayTrigger = dbInstance.automations.find(a => a.event === 'aniversario');
    if (bdayTrigger && bdayTrigger.isActive) {
      const todayStr = new Date().toISOString().slice(5, 10); // MM-DD
      const currentYear = new Date().getFullYear().toString();

      const eligibleBdays = dbInstance.customers.filter(customer => {
        if (!customer.birthDate) return false;
        const bdayMonthDay = customer.birthDate.slice(5, 10);
        if (bdayMonthDay !== todayStr) return false;

        // Check if already queued for this year
        const hasBeenQueued = dbInstance.executions.some(e => 
          e.automacao === 'aniversario' && 
          e.customer_id === customer.id && 
          e.created_at.startsWith(currentYear) &&
          e.status !== 'erro_definitivo'
        );
        return !hasBeenQueued;
      });

      for (const customer of eligibleBdays) {
        const execution = await dbInstance.queueAutomation('aniversario', { customer });
        if (execution) {
          count++;
          logs.push(`[Birthday Scan] Mensagem de aniversário agendada para ${customer.name}.`);
        }
      }
    }

    // --- 3. CLIENTES INATIVOS ---
    const inactiveTrigger = dbInstance.automations.find(a => a.event === 'cliente_inativo');
    if (inactiveTrigger && inactiveTrigger.isActive) {
      const inactiveDays = inactiveTrigger.inactiveDays || 30;
      const thresholdDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      for (const customer of dbInstance.customers) {
        // Find appointments for this customer
        const customerAppts = dbInstance.appointments.filter(a => a.customerId === customer.id);
        if (customerAppts.length === 0) continue;

        // Find latest appointment
        const latestAppt = customerAppts.reduce((latest, current) => {
          return new Date(current.dateTime) > new Date(latest.dateTime) ? current : latest;
        });

        const lastApptDate = new Date(latestAppt.dateTime);
        const hasFutureAppt = customerAppts.some(a => new Date(a.dateTime) > new Date());

        // Eligible if last service was > inactiveDays ago and has no future services scheduled
        if (lastApptDate < thresholdDate && !hasFutureAppt) {
          // Check if queued in the last 30 days to avoid spam
          const hasBeenQueued = dbInstance.executions.some(e => 
            e.automacao === 'cliente_inativo' && 
            e.customer_id === customer.id && 
            e.created_at >= thirtyDaysAgo &&
            e.status !== 'erro_definitivo'
          );

          if (!hasBeenQueued) {
            const vehicle = dbInstance.vehicles.find(v => v.customerId === customer.id);
            const execution = await dbInstance.queueAutomation('cliente_inativo', {
              customer,
              vehicle
            });
            if (execution) {
              count++;
              logs.push(`[Inactive Scan] Mensagem de reativação agendada para ${customer.name}.`);
            }
          }
        }
      }
    }

    // --- 4. PESQUISA DE SATISFAÇÃO / PÓS-VENDA (Concluídos recentemente) ---
    const posVendaTrigger = dbInstance.automations.find(a => a.event === 'pagamento_recebido');
    if (posVendaTrigger && posVendaTrigger.isActive) {
      const recentFinished = dbInstance.appointments.filter(appt => {
        if (appt.status !== 'finalizado' && appt.status !== 'entregue') return false;

        // Check if already queued
        const hasBeenQueued = dbInstance.executions.some(e => 
          e.automacao === 'pagamento_recebido' && 
          e.appointment_id === appt.id &&
          e.status !== 'erro_definitivo'
        );
        return !hasBeenQueued;
      });

      for (const appt of recentFinished) {
        const customer = dbInstance.customers.find(c => c.id === appt.customerId);
        if (!customer) continue;

        const vehicle = dbInstance.vehicles.find(v => v.id === appt.vehicleId);
        const service = dbInstance.services.find(s => s.id === appt.serviceId);

        const execution = await dbInstance.queueAutomation('pagamento_recebido', {
          customer,
          vehicle,
          service,
          appointment: appt
        });

        if (execution) {
          count++;
          logs.push(`[Feedback Scan] Pesquisa de satisfação agendada para ${customer.name} (Agendamento: ${appt.id}).`);
        }
      }
    }

    return count;
  }

  /**
   * Processes pending automation executions in the queue.
   */
  private async processQueue(logs: string[]): Promise<number> {
    const nowIso = new Date().toISOString();
    const pendingExecutions = dbInstance.executions.filter(e => 
      e.status === 'pendente' && 
      e.data_execucao <= nowIso
    );

    if (pendingExecutions.length === 0) {
      return 0;
    }

    let processedCount = 0;
    const startHour = dbInstance.config.automationStartHour || '08:00';
    const endHour = dbInstance.config.automationEndHour || '20:00';

    // --- JANELA DE FUNCIONAMENTO CHECK ---
    if (!this.isWithinOperationalWindow(startHour, endHour)) {
      logs.push(`[Operational Window] Fora do horário de funcionamento (${startHour} - ${endHour}). Postergando agendamentos pendentes.`);
      
      const nextStart = this.getNextStartTime(startHour);
      for (const exec of pendingExecutions) {
        exec.data_execucao = nextStart;
        exec.updated_at = new Date().toISOString();
        
        // Persist change
        if (dbInstance.config.useRealSupabase) {
          try {
            const supabase = dbInstance.getSupabaseClient();
            await supabase.from('automacoes_execucoes')
              .update({ data_execucao: exec.data_execucao, updated_at: exec.updated_at })
              .eq('id', exec.id);
          } catch (e) {
            // ignore error to fallback to local save
          }
        }
      }
      dbInstance.save();
      return 0;
    }

    // Process each pending execution
    for (const exec of pendingExecutions) {
      processedCount++;
      logs.push(`[Queue Processor] Processando envio da execução ${exec.id} (${exec.automacao}) para ${exec.telefone}...`);

      exec.status = 'processando';
      exec.tentativas += 1;
      exec.updated_at = new Date().toISOString();
      dbInstance.save();

      let success = false;
      let apiResponse = '';

      // Prepare payload identical to make webhook format
      const payloadBody = {
        event: exec.automacao,
        executionId: exec.id,
        telefone: exec.telefone,
        formattedMessage: exec.mensagem,
        timestamp: exec.updated_at
      };

      try {
        // --- 1. WEBHOOK MAKE.COM ---
        if (dbInstance.config.makeWebhookUrl) {
          const makeUrl = dbInstance.config.makeWebhookUrl;
          console.log(`[Queue Processor Webhook] Payload enviado ao Make (URL: ${makeUrl}):`, JSON.stringify(payloadBody, null, 2));
          
          const response = await fetch(makeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadBody)
          });
          
          const resText = await response.text();
          console.log(`[Queue Processor Webhook] Payload recebido pelo Make (Resposta). Status: ${response.status} | Body: ${resText}`);
          apiResponse += `[Make Webhook] Status: ${response.status} | Resposta: ${resText}\n`;
          if (response.ok) {
            success = true;
          }
        }

        // --- 2. Z-API INTEGRATION ---
        if (dbInstance.config.zapiInstanceId && dbInstance.config.zapiToken) {
          const zapiUrl = `https://api.z-api.io/instances/${dbInstance.config.zapiInstanceId}/token/${dbInstance.config.zapiToken}/send-text`;
          
          const zapiPayload = {
            phone: exec.telefone,
            message: exec.mensagem
          };
          
          console.log(`[Queue Processor Z-API] Payload enviado para a Z-API (URL: ${zapiUrl}):`, JSON.stringify(zapiPayload, null, 2));
          
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (dbInstance.config.zapiClientToken) {
            headers['Client-Token'] = dbInstance.config.zapiClientToken;
          }

          const response = await fetch(zapiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(zapiPayload)
          });

          const resText = await response.text();
          console.log(`[Queue Processor Z-API] Payload recebido da Z-API (Resposta). Status: ${response.status} | Body: ${resText}`);
          apiResponse += `[Z-API] Status: ${response.status} | Resposta: ${resText}\n`;
          if (response.ok) {
            success = true; // Mark true if at least one sending succeeds
          }
        }

        // If neither is configured, mark as simulado/sucesso
        if (!dbInstance.config.makeWebhookUrl && !(dbInstance.config.zapiInstanceId && dbInstance.config.zapiToken)) {
          apiResponse = 'Envio simulado com sucesso (Sem canais de envio reais configurados)';
          success = true;
        }

      } catch (err: any) {
        apiResponse += `[Erro de Envio] ${err.message || err}`;
        console.error('[Queue Processor Error] Falha de comunicação:', err);
      }

      // --- RETRIES SYSTEM (Requirement 5) ---
      if (success) {
        exec.status = 'sucesso';
        exec.resposta_api = apiResponse;
        logs.push(`[Queue Processor] Sucesso ao enviar execução ${exec.id}.`);
      } else {
        logs.push(`[Queue Processor] Falha ao enviar execução ${exec.id} (Tentativa ${exec.tentativas}/3).`);
        if (exec.tentativas < 3) {
          exec.status = 'pendente';
          // Retry delay: 5 minutes after 1st attempt, 15 minutes after 2nd attempt
          const backoffMinutes = exec.tentativas === 1 ? 5 : 15;
          const nextAttemptDate = new Date(Date.now() + backoffMinutes * 60 * 1000);
          exec.data_execucao = nextAttemptDate.toISOString();
          exec.data_proxima_tentativa = nextAttemptDate.toISOString();
          exec.resposta_api = `[TENTATIVA FALHOU] ${apiResponse}`;
          logs.push(`[Queue Processor] Reagendado para ${exec.data_execucao} (${backoffMinutes}min de espera).`);
        } else {
          exec.status = 'erro_definitivo';
          exec.resposta_api = `[ERRO DEFINITIVO] ${apiResponse}`;
          logs.push(`[Queue Processor] Falha permanente na execução ${exec.id}.`);
        }
      }

      exec.updated_at = new Date().toISOString();
      dbInstance.save();

      // Add to standard automation logs list for compatibility
      const triggerName = dbInstance.automations.find(a => a.event === exec.automacao)?.name || exec.automacao;
      const targetCustomer = dbInstance.customers.find(c => c.id === exec.customer_id);
      
      const newLog: AutomationLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        triggerEvent: triggerName,
        targetName: targetCustomer ? targetCustomer.name : 'Cliente',
        targetContact: exec.telefone,
        payload: `ID da Execução: ${exec.id}\nTentativa: ${exec.tentativas}\nPayload: ${JSON.stringify(payloadBody, null, 2)}\nResposta: ${exec.resposta_api}`,
        status: exec.status === 'sucesso' ? 'sucesso' : 'erro',
        timestamp: exec.updated_at
      };
      dbInstance.addLog(newLog);

      // Persist status back to Supabase
      if (dbInstance.config.useRealSupabase) {
        try {
          const supabase = dbInstance.getSupabaseClient();
          const { error } = await supabase.from('automacoes_execucoes')
            .upsert({
              id: exec.id,
              empresa_id: exec.empresa_id,
              automacao: exec.automacao,
              appointment_id: exec.appointment_id,
              customer_id: exec.customer_id,
              telefone: exec.telefone,
              mensagem: exec.mensagem,
              status: exec.status,
              tentativas: exec.tentativas,
              resposta_api: exec.resposta_api,
              data_execucao: exec.data_execucao,
              data_proxima_tentativa: exec.data_proxima_tentativa,
              created_at: exec.created_at,
              updated_at: exec.updated_at
            });
          if (error) {
            console.error('[Supabase Queue Update Error] Erro ao sincronizar status do processador:', error.message);
          }
        } catch (e: any) {
          console.error('[Supabase Queue Update Error] Falha ao atualizar status no Supabase:', e.message);
        }
      }
    }

    // Call onSyncCallback if defined
    if (dbInstance.onSyncCallback) {
      dbInstance.onSyncCallback();
    }

    return processedCount;
  }

  /**
   * Checks if current time is within operational window.
   */
  private isWithinOperationalWindow(startHour: string, endHour: string): boolean {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    return currentTime >= startHour && currentTime <= endHour;
  }

  /**
   * Generates next day's start time ISO string.
   */
  private getNextStartTime(startHour: string): string {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const [h, m] = startHour.split(':').map(Number);
    tomorrow.setHours(h || 8, m || 0, 0, 0);
    return tomorrow.toISOString();
  }

  /**
   * Executes an automation manually for testing (bypassing time check and queue wait).
   */
  async executeManualTest(eventId: string): Promise<{ success: boolean; log: string }> {
    const automation = dbInstance.automations.find(a => a.id === eventId);
    if (!automation) {
      return { success: false, log: 'Automação não encontrada' };
    }

    const sampleCustomer = dbInstance.customers[0] || { id: 'test_cust', name: 'Cliente de Teste', phone: '5511999998888', whatsapp: '5511999998888', email: '', birthDate: '', address: '', neighborhood: '', city: '', state: '' };
    const sampleVehicle = dbInstance.vehicles.find(v => v.customerId === sampleCustomer.id) || { id: 'test_veh', brand: 'Honda', model: 'Civic', plate: 'ABC1D23', color: 'Preto', year: '2022', customerId: sampleCustomer.id, mileage: '12000' };
    const sampleService = dbInstance.services[0] || { id: 'test_srv', name: 'Serviço de Teste', description: 'Serviço de Teste', basePrice: 100.00, estimatedTime: 60 };
    const sampleAppointment: Appointment = {
      id: 'test_appt_' + Date.now().toString().slice(-4),
      customerId: sampleCustomer.id,
      vehicleId: sampleVehicle.id,
      serviceId: sampleService.id,
      dateTime: new Date().toISOString().slice(0, 16),
      status: 'confirmado',
      value: sampleService.basePrice,
      employeeId: 'Matheus',
      notes: 'Execução manual de teste.'
    };

    // Queue the execution
    const execution = await dbInstance.queueAutomation(automation.event, {
      customer: sampleCustomer as Customer,
      vehicle: sampleVehicle as Vehicle,
      service: sampleService as Service,
      appointment: sampleAppointment
    });

    if (!execution) {
      return { success: false, log: 'Não foi possível enfileirar a automação (provável duplicidade ou inativa).' };
    }

    // Force-process it immediately!
    execution.status = 'processando';
    execution.tentativas += 1;
    execution.updated_at = new Date().toISOString();
    dbInstance.save();

    let success = false;
    let apiResponse = '';

    const payloadBody = {
      event: execution.automacao,
      executionId: execution.id,
      telefone: execution.telefone,
      formattedMessage: execution.mensagem,
      timestamp: execution.updated_at,
      isTest: true
    };

    try {
      if (dbInstance.config.makeWebhookUrl) {
        const makeUrl = dbInstance.config.makeWebhookUrl;
        console.log(`[Manual Test Webhook] Payload enviado ao Make (URL: ${makeUrl}):`, JSON.stringify(payloadBody, null, 2));
        
        const response = await fetch(makeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBody)
        });
        const resText = await response.text();
        console.log(`[Manual Test Webhook] Payload recebido pelo Make (Resposta). Status: ${response.status} | Body: ${resText}`);
        apiResponse += `[Make Webhook] Status: ${response.status} | Resposta: ${resText}\n`;
        if (response.ok) success = true;
      }

      if (dbInstance.config.zapiInstanceId && dbInstance.config.zapiToken) {
        const zapiUrl = `https://api.z-api.io/instances/${dbInstance.config.zapiInstanceId}/token/${dbInstance.config.zapiToken}/send-text`;
        
        const zapiPayload = {
          phone: execution.telefone,
          message: execution.mensagem
        };
        
        console.log(`[Manual Test Z-API] Payload enviado para a Z-API (URL: ${zapiUrl}):`, JSON.stringify(zapiPayload, null, 2));
        
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (dbInstance.config.zapiClientToken) {
          headers['Client-Token'] = dbInstance.config.zapiClientToken;
        }

        const response = await fetch(zapiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(zapiPayload)
        });
        const resText = await response.text();
        console.log(`[Manual Test Z-API] Payload recebido da Z-API (Resposta). Status: ${response.status} | Body: ${resText}`);
        apiResponse += `[Z-API] Status: ${response.status} | Resposta: ${resText}\n`;
        if (response.ok) success = true;
      }

      if (!dbInstance.config.makeWebhookUrl && !(dbInstance.config.zapiInstanceId && dbInstance.config.zapiToken)) {
        apiResponse = 'Envio manual simulado com sucesso.';
        success = true;
      }
    } catch (err: any) {
      apiResponse += `[Erro] ${err.message || err}`;
    }

    execution.status = success ? 'sucesso' : 'erro_definitivo';
    execution.resposta_api = apiResponse;
    execution.updated_at = new Date().toISOString();
    dbInstance.save();

    // Sincroniza Supabase
    if (dbInstance.config.useRealSupabase) {
      try {
        const supabase = dbInstance.getSupabaseClient();
        await supabase.from('automacoes_execucoes').upsert({
          id: execution.id,
          empresa_id: execution.empresa_id,
          automacao: execution.automacao,
          appointment_id: execution.appointment_id,
          customer_id: execution.customer_id,
          telefone: execution.telefone,
          mensagem: execution.mensagem,
          status: execution.status,
          tentativas: execution.tentativas,
          resposta_api: execution.resposta_api,
          data_execucao: execution.data_execucao,
          created_at: execution.created_at,
          updated_at: execution.updated_at
        });
      } catch (e) {
        // ignore
      }
    }

    // Add to logs list
    const newLog: AutomationLog = {
      id: 'log_manual_' + Date.now(),
      triggerEvent: automation.name + ' (Teste Manual)',
      targetName: sampleCustomer.name,
      targetContact: execution.telefone,
      payload: `ID da Execução: ${execution.id}\nResposta: ${execution.resposta_api}`,
      status: success ? 'sucesso' : 'erro',
      timestamp: execution.updated_at
    };
    dbInstance.addLog(newLog);

    if (dbInstance.onSyncCallback) {
      dbInstance.onSyncCallback();
    }

    return { success, log: apiResponse };
  }
}

export const automationEngineInstance = new AutomationEngine();
