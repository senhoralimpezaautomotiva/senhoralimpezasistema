import { dbInstance } from './localDb';
import { AutomationLog, Customer, Vehicle, Service, Appointment } from '../types';
import { getIntegrationSecrets, hasZapiCredentials } from '../server/integrationSecrets';
import { maskPhone, redactExternalResponse, safeLog } from '../security/safeOutput';
import {
  getPartsInTimezone,
  isWithinOperationalWindow,
  getNextStartTime
} from '../utils/operationalWindow';

export { getPartsInTimezone, isWithinOperationalWindow, getNextStartTime };

const sendToConfiguredProviders = async (
  payloadBody: Record<string, unknown>,
  phone: string,
  message: string
): Promise<{ success: boolean; apiResponse: string }> => {
  const secrets = getIntegrationSecrets();
  const statuses: string[] = [];
  let configuredProviders = 0;
  let success = false;

  if (secrets.makeWebhookUrl) {
    configuredProviders += 1;
    // [AUTOMATION TRACE 3] Mensagem antes do envio (Make)
    console.log('[AUTOMATION TRACE] 3. Mensagem antes do envio (Make):', {
      message,
      payloadBody
    });

    try {
      const response = await fetch(secrets.makeWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody)
      });

      // [AUTOMATION TRACE 5] Confirmação Make
      console.log('[AUTOMATION TRACE] 5. Confirmação (Make):', {
        provider: 'Make',
        status: response.status,
        executionId: payloadBody.executionId
      });

      statuses.push(`[Make Webhook] Status HTTP: ${response.status}`);
      success = success || response.ok;
    } catch {
      statuses.push('[Make Webhook] Falha de comunicação com o provedor');
    }
  }

  if (hasZapiCredentials(secrets)) {
    configuredProviders += 1;
    const zapiUrl = `https://api.z-api.io/instances/${encodeURIComponent(secrets.zapiInstanceId)}/token/${encodeURIComponent(secrets.zapiToken)}/send-text`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secrets.zapiClientToken) {
      headers['Client-Token'] = secrets.zapiClientToken;
    }

    // [AUTOMATION TRACE 4] Mensagem enviada para Z-API
    console.log('[AUTOMATION TRACE] 4. Mensagem enviada para Z-API:', {
      phone,
      message
    });

    try {
      const response = await fetch(zapiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone, message })
      });

      // [AUTOMATION TRACE 5] Confirmação Z-API
      console.log('[AUTOMATION TRACE] 5. Confirmação (Z-API):', {
        provider: 'Z-API',
        status: response.status,
        executionId: payloadBody.executionId
      });

      statuses.push(`[Z-API] Status HTTP: ${response.status}`);
      success = success || response.ok;
    } catch {
      statuses.push('[Z-API] Falha de comunicação com o provedor');
    }
  }

  if (configuredProviders === 0) {
    console.log('[AUTOMATION TRACE] 3 & 4. Provedores não configurados. Envio simulado:', {
      executionId: payloadBody.executionId,
      phone,
      message
    });

    return {
      success: true,
      apiResponse: 'Envio simulado: nenhum provedor configurado no ambiente do servidor'
    };
  }

  return { success, apiResponse: statuses.join('\n') };
};

export class AutomationEngine {
  private isProcessing = false;

  constructor() {
    safeLog('info', 'automation_engine.initialize', 'success');
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
      safeLog('error', 'automation_engine.cycle', 'error', { error });
      logs.push('[Automation Engine] Falha interna no ciclo. Consulte o correlation ID do log do servidor.');
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
          logs.push(`[Reminder Scan] Lembrete agendado. ClienteId=${customer.id}; AgendamentoId=${appt.id}.`);
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
          logs.push(`[Birthday Scan] Mensagem agendada. ClienteId=${customer.id}.`);
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
              logs.push(`[Inactive Scan] Mensagem agendada. ClienteId=${customer.id}.`);
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
          logs.push(`[Feedback Scan] Pesquisa agendada. ClienteId=${customer.id}; AgendamentoId=${appt.id}.`);
        }
      }
    }

    return count;
  }

  /**
   * Processes pending automation executions in the queue.
   */
  private async processQueue(logs: string[]): Promise<number> {
    const nowTime = Date.now();
    const pendingExecutions = dbInstance.executions.filter(e => 
      e.status === 'pendente' && 
      new Date(e.data_execucao).getTime() <= nowTime
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
      
      const nextStart = this.getNextStartTime(startHour, endHour);
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
      logs.push(`[Queue Processor] Processando execução ${exec.id} (${exec.automacao}).`);

      exec.status = 'processando';
      exec.tentativas += 1;
      exec.updated_at = new Date().toISOString();
      dbInstance.save();

      // Provider credentials are resolved only on the server.
      const payloadBody = {
        event: exec.automacao,
        executionId: exec.id,
        telefone: exec.telefone,
        formattedMessage: exec.mensagem,
        timestamp: exec.updated_at
      };

      const { success, apiResponse } = await sendToConfiguredProviders(
        payloadBody,
        exec.telefone,
        exec.mensagem
      );

      // --- RETRIES SYSTEM (Requirement 5) ---
      if (success) {
        exec.status = 'sucesso';
        exec.resposta_api = redactExternalResponse(apiResponse);
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
          exec.resposta_api = `[TENTATIVA FALHOU] ${redactExternalResponse(apiResponse)}`;
          logs.push(`[Queue Processor] Reagendado para ${exec.data_execucao} (${backoffMinutes}min de espera).`);
        } else {
          exec.status = 'erro_definitivo';
          exec.resposta_api = `[ERRO DEFINITIVO] ${redactExternalResponse(apiResponse)}`;
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
        targetName: targetCustomer ? 'Cliente protegido' : 'Cliente',
        targetContact: maskPhone(exec.telefone),
        payload: `ID da execução: ${exec.id}\nTentativa: ${exec.tentativas}\nStatus técnico: ${exec.resposta_api}`,
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
            safeLog('error', 'automation_engine.queue.persist', 'error', {
              entityId: exec.id,
              error
            });
          }
        } catch (e: any) {
          safeLog('error', 'automation_engine.queue.persist', 'error', {
            entityId: exec.id,
            error: e
          });
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
  isWithinOperationalWindow(startHour: string, endHour: string, date = new Date()): boolean {
    return isWithinOperationalWindow(startHour, endHour, date);
  }

  /**
   * Generates next day's start time ISO string.
   */
  getNextStartTime(startHour: string, endHour = '20:00', date = new Date()): string {
    return getNextStartTime(startHour, endHour, date);
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

    const payloadBody = {
      event: execution.automacao,
      executionId: execution.id,
      telefone: execution.telefone,
      formattedMessage: execution.mensagem,
      timestamp: execution.updated_at,
      isTest: true
    };

    const { success, apiResponse } = await sendToConfiguredProviders(
      payloadBody,
      execution.telefone,
      execution.mensagem
    );

    execution.status = success ? 'sucesso' : 'erro_definitivo';
    execution.resposta_api = redactExternalResponse(apiResponse);
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
      targetName: 'Cliente de teste protegido',
      targetContact: maskPhone(execution.telefone),
      payload: `ID da execução: ${execution.id}\nStatus técnico: ${execution.resposta_api}`,
      status: success ? 'sucesso' : 'erro',
      timestamp: execution.updated_at
    };
    dbInstance.addLog(newLog);

    if (dbInstance.onSyncCallback) {
      dbInstance.onSyncCallback();
    }

    return { success, log: redactExternalResponse(apiResponse) };
  }
}

export const automationEngineInstance = new AutomationEngine();
