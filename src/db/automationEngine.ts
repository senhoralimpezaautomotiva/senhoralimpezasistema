import { dbInstance } from './localDb';
import {
  AutomationExecution,
  AutomationLog,
  Customer,
  Vehicle,
  Service,
  Appointment
} from '../types';
import { maskPhone, redactExternalResponse, safeLog } from '../security/safeOutput';
import {
  AutomationTransportPayload,
  sendAutomationPayload
} from '../server/automationTransport';
import { getIntegrationSecrets } from '../server/integrationSecrets';
import {
  classifyAutomationEvent,
  getAutomationEventRetryDelayMinutes
} from './automationEventPolicy';
import { classifyQueuedAutomation } from './automationExecutionPolicy';
import {
  getPartsInTimezone,
  isWithinOperationalWindow,
  getNextStartTime,
  isWithinReminderWindow
} from '../utils/operationalWindow';

export {
  getPartsInTimezone,
  isWithinOperationalWindow,
  getNextStartTime,
  isWithinReminderWindow
};

type ClaimedAutomationExecution = AutomationExecution & {
  claim_token?: string;
};

const AUTOMATION_CLAIM_BATCH_SIZE = 10;
const AUTOMATION_CLAIM_LEASE_SECONDS = 900;

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
    let syncComplete = true;

    try {
      // 1. If real Supabase is active, fetch latest state to ensure sync
      if (dbInstance.config.useRealSupabase) {
        await dbInstance.syncWithSupabase();
        const syncState = dbInstance.lastSupabaseSync;
        syncComplete = !(
          !syncState.configLoaded
          || !syncState.customersLoaded
          || !syncState.vehiclesLoaded
          || !syncState.servicesLoaded
          || !syncState.appointmentsLoaded
        );
      }

      // 2. Consume persisted business events through the same queue producer
      generatedCount += await this.consumePendingBusinessEvents(logs);
      if (!syncComplete) {
        logs.push('[Automation Engine] Sincronização parcial; eventos ficaram em retry e envios foram adiados.');
        return { generated: generatedCount, processed: 0, logs };
      }

      // 3. Scan time-based events through the same queue producer
      generatedCount += await this.scanAndGenerateExecutions(logs);

      // 4. Process the pending queue
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
   * Consumes database outbox events produced by both the administrative system
   * and the Client Portal. Only queueAutomation may create an execution.
   */
  private async consumePendingBusinessEvents(logs: string[]): Promise<number> {
    if (!dbInstance.config.useRealSupabase) return 0;

    const supabase = dbInstance.getSupabaseClient();
    const now = new Date().toISOString();
    const { data: events, error } = await supabase
      .from('automacoes_eventos')
      .select('id,automacao,appointment_id,customer_id,deduplication_key,status,tentativas')
      .in('status', ['pendente', 'pendente_retry'])
      .or(`proxima_tentativa.is.null,proxima_tentativa.lte.${now}`)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      safeLog('error', 'automation_engine.events.load', 'error', { error });
      logs.push('[Automation Events] Falha ao carregar eventos pendentes.');
      return 0;
    }

    let generated = 0;
    for (const event of events || []) {
      const customer = dbInstance.customers.find(c => c.id === event.customer_id);
      const appointment = event.appointment_id
        ? dbInstance.appointments.find(a => a.id === event.appointment_id)
        : undefined;
      const vehicle = appointment
        ? dbInstance.vehicles.find(v => v.id === appointment.vehicleId)
        : dbInstance.vehicles.find(v => v.customerId === event.customer_id);
      const service = appointment
        ? dbInstance.services.find(s => s.id === appointment.serviceId)
        : undefined;
      let duplicateExecution = dbInstance.executions.some(
        item => item.deduplication_key === event.deduplication_key
      );
      const trigger = dbInstance.automations.find(item => item.event === event.automacao);
      let decision = classifyAutomationEvent({
        event: event.automacao,
        appointmentId: event.appointment_id,
        configurationLoaded: dbInstance.lastSupabaseSync.configLoaded,
        customersLoaded: dbInstance.lastSupabaseSync.customersLoaded,
        appointmentsLoaded: dbInstance.lastSupabaseSync.appointmentsLoaded,
        vehiclesLoaded: dbInstance.lastSupabaseSync.vehiclesLoaded,
        servicesLoaded: dbInstance.lastSupabaseSync.servicesLoaded,
        customerFound: Boolean(customer),
        appointmentFound: !event.appointment_id || Boolean(appointment),
        appointmentStatus: appointment?.status,
        vehicleFound: !event.appointment_id || Boolean(vehicle),
        serviceFound: !event.appointment_id || Boolean(service),
        duplicateExecution,
        trigger,
        phone: customer ? customer.phone || customer.whatsapp || '' : ''
      });

      let execution: AutomationExecution | null = null;
      if (decision.action === 'queue' && customer) {
        execution = await dbInstance.queueAutomation(event.automacao, {
          customer,
          vehicle,
          service,
          appointment
        });

        if (!execution) {
          const { data: persistedDuplicate, error: duplicateError } = await supabase
            .from('automacoes_execucoes')
            .select('id')
            .eq('deduplication_key', event.deduplication_key)
            .maybeSingle();
          duplicateExecution = Boolean(persistedDuplicate?.id);
          decision = duplicateExecution
            ? { action: 'processado', reason: 'duplicate_execution' }
            : {
                action: 'pendente_retry',
                reason: duplicateError ? 'deduplication_check_failed' : 'queue_persistence_failed'
              };
        }
      }

      const attempts = Number(event.tentativas || 0);
      const isFinal = Boolean(execution)
        || decision.action === 'processado'
        || decision.action === 'ignorado_definitivo'
        || decision.action === 'erro_definitivo';
      const retryAt = decision.action === 'pendente_retry'
        ? new Date(
            Date.now() + getAutomationEventRetryDelayMinutes(attempts) * 60 * 1000
          ).toISOString()
        : null;
      const nextStatus = execution
        ? 'processado'
        : decision.action;
      const { error: updateError } = await supabase
        .from('automacoes_eventos')
        .update({
          status: nextStatus,
          tentativas: decision.action === 'pendente_retry' ? attempts + 1 : attempts,
          proxima_tentativa: retryAt,
          ultimo_erro: execution || decision.action === 'processado'
            ? null
            : decision.reason,
          processed_at: isFinal ? new Date().toISOString() : null
        })
        .eq('id', event.id)
        .eq('status', event.status);

      if (updateError) {
        safeLog('error', 'automation_engine.events.persist', 'error', {
          entityId: event.id,
          error: updateError
        });
        logs.push(`[Automation Events] Falha ao concluir evento ${event.id}.`);
        continue;
      }

      if (execution) {
        generated++;
        logs.push(`[Automation Events] Evento ${event.automacao} convertido em execução ${execution.id}.`);
      } else if (decision.action === 'pendente_retry') {
        logs.push(`[Automation Events] Evento ${event.id} reagendado para ${retryAt}.`);
      } else {
        logs.push(`[Automation Events] Evento ${event.automacao} concluído como ${nextStatus}.`);
      }
    }

    return generated;
  }

  /**
   * Scans all events and queues automations for eligible targets.
   */
  private async scanAndGenerateExecutions(logs: string[]): Promise<number> {
    let count = 0;

    // --- 1. LEMBRETE DE AGENDAMENTO (antecedência configurável) ---
    const reminderTrigger = dbInstance.automations.find(a => a.event === 'lembrete_agendamento');
    if (reminderTrigger && reminderTrigger.isActive) {
      const now = new Date();
      const advanceHours = dbInstance.config.reminderAdvanceHours || 1;

      const eligibleAppts = dbInstance.appointments.filter(appt => {
        if (appt.status === 'cancelado' || appt.status === 'finalizado' || appt.status === 'entregue') return false;
        if (!isWithinReminderWindow(appt.dateTime, now, advanceHours)) return false;

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

    return count;
  }

  /**
   * Processes pending automation executions in the queue.
   */
  private async processQueue(logs: string[]): Promise<number> {
    const nowTime = Date.now();
    const startHour = dbInstance.config.automationStartHour || '08:00';
    const endHour = dbInstance.config.automationEndHour || '20:00';

    // --- JANELA DE FUNCIONAMENTO CHECK ---
    if (!dbInstance.config.automation24Hours && !this.isWithinOperationalWindow(startHour, endHour)) {
      logs.push(`[Operational Window] Fora do horário de funcionamento (${startHour} - ${endHour}). Postergando agendamentos pendentes.`);
      
      const nextStart = this.getNextStartTime(startHour, endHour);
      if (dbInstance.config.useRealSupabase) {
        const supabase = dbInstance.getSupabaseClient();
        const { error } = await supabase
          .from('automacoes_execucoes')
          .update({
            data_execucao: nextStart,
            updated_at: new Date().toISOString()
          })
          .eq('status', 'pendente')
          .lte('data_execucao', new Date(nowTime).toISOString());
        if (error) {
          safeLog('error', 'automation_engine.queue.postpone', 'error', { error });
        }
      } else {
        for (const exec of dbInstance.executions) {
          if (
            exec.status === 'pendente'
            && new Date(exec.data_execucao).getTime() <= nowTime
          ) {
            exec.data_execucao = nextStart;
            exec.updated_at = new Date().toISOString();
          }
        }
        dbInstance.save();
      }
      return 0;
    }

    let pendingExecutions: ClaimedAutomationExecution[];
    if (dbInstance.config.useRealSupabase) {
      const supabase = dbInstance.getSupabaseClient();
      const { data, error } = await supabase.rpc('fn_claim_automacoes_execucoes', {
        p_limit: AUTOMATION_CLAIM_BATCH_SIZE,
        p_lease_seconds: AUTOMATION_CLAIM_LEASE_SECONDS,
        p_execution_id: null
      });

      if (error) {
        safeLog('error', 'automation_engine.queue.claim', 'error', { error });
        logs.push('[Queue Processor] Claim atômico indisponível; ciclo encerrado sem envio.');
        return 0;
      }

      pendingExecutions = (data || []).map((row: any) => this.mapClaimedExecution(row));

      for (const claimed of pendingExecutions) {
        const currentIndex = dbInstance.executions.findIndex(item => item.id === claimed.id);
        if (currentIndex >= 0) {
          dbInstance.executions[currentIndex] = claimed;
        } else {
          dbInstance.executions.push(claimed);
        }
      }
    } else {
      pendingExecutions = dbInstance.executions
        .filter(exec =>
          exec.status === 'pendente'
          && new Date(exec.data_execucao).getTime() <= nowTime
        )
        .map(exec => {
          exec.status = 'processando';
          exec.updated_at = new Date().toISOString();
          return exec;
        });
      dbInstance.save();
    }

    if (pendingExecutions.length === 0) {
      return 0;
    }

    let processedCount = 0;
    for (const exec of pendingExecutions) {
      const targetCustomer = dbInstance.customers.find(c => c.id === exec.customer_id);
      if (!targetCustomer) {
        const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        exec.status = 'pendente';
        exec.data_execucao = retryAt;
        exec.data_proxima_tentativa = retryAt;
        exec.resposta_api = 'Execução adiada: contexto do cliente indisponível na sincronização atual.';
        exec.updated_at = new Date().toISOString();
        await this.persistClaimedExecution(exec, logs);
        logs.push(`[Queue Processor] Execução ${exec.id} adiada por contexto parcial.`);
        continue;
      }

      const activeTrigger = dbInstance.automations.find(a => a.event === exec.automacao);
      const queueDecision = classifyQueuedAutomation(activeTrigger, exec.mensagem);
      if (queueDecision.action === 'cancel') {
        exec.status = 'cancelada';
        exec.resposta_api = 'Execução cancelada: automação ausente ou desativada.';
        exec.updated_at = new Date().toISOString();
        await this.persistClaimedExecution(exec, logs);

        logs.push(`[Queue Processor] Execução ${exec.id} cancelada: automação desativada.`);
        continue;
      }

      if (queueDecision.action === 'error') {
        exec.status = 'erro_definitivo';
        exec.resposta_api = 'Envio bloqueado: mensagem vazia.';
        exec.updated_at = new Date().toISOString();
        await this.persistClaimedExecution(exec, logs);

        logs.push(`[Queue Processor] Execução ${exec.id} bloqueada: conteúdo vazio.`);
        continue;
      }

      processedCount++;
      logs.push(`[Queue Processor] Processando execução ${exec.id} (${exec.automacao}).`);

      exec.tentativas += 1;
      exec.updated_at = new Date().toISOString();
      dbInstance.save();

      // Provider credentials are resolved only on the server.
      const payloadBody: AutomationTransportPayload = {
        event: exec.automacao,
        executionId: exec.id,
        appointmentId: exec.appointment_id || null,
        companyId: exec.empresa_id,
        phone: exec.telefone,
        message: exec.mensagem,
        customer: {
          id: targetCustomer.id,
          name: targetCustomer.name,
          phone: exec.telefone
        }
      };

      const { success, apiResponse } = await sendAutomationPayload(payloadBody, {
        secrets: getIntegrationSecrets()
      });

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
      const persisted = await this.persistClaimedExecution(exec, logs);
      if (!persisted) {
        logs.push(`[Queue Processor] Resultado da execução ${exec.id} não foi confirmado no banco.`);
      }

      // Add to standard automation logs list for compatibility
      const triggerName = dbInstance.automations.find(a => a.event === exec.automacao)?.name || exec.automacao;
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
    }

    // Call onSyncCallback if defined
    if (dbInstance.onSyncCallback) {
      dbInstance.onSyncCallback();
    }

    return processedCount;
  }

  private mapClaimedExecution(row: any): ClaimedAutomationExecution {
    return {
      id: row.id,
      empresa_id: row.empresa_id,
      automacao: row.automacao,
      appointment_id: row.appointment_id || undefined,
      customer_id: row.customer_id,
      telefone: row.telefone || '',
      mensagem: row.mensagem || '',
      status: 'processando',
      tentativas: row.tentativas ?? 0,
      resposta_api: row.resposta_api || undefined,
      deduplication_key: row.deduplication_key || undefined,
      data_execucao: row.data_execucao,
      data_proxima_tentativa: row.data_proxima_tentativa || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      claim_token: row.claim_token
    };
  }

  private async persistClaimedExecution(
    exec: ClaimedAutomationExecution,
    logs: string[]
  ): Promise<boolean> {
    if (!dbInstance.config.useRealSupabase) {
      dbInstance.save();
      return true;
    }

    if (!exec.claim_token) {
      safeLog('error', 'automation_engine.queue.persist', 'error', {
        entityId: exec.id,
        reason: 'missing_claim_token'
      });
      logs.push(`[Queue Processor] Execução ${exec.id} sem token de claim; resultado não persistido.`);
      return false;
    }

    const supabase = dbInstance.getSupabaseClient();
    for (let persistAttempt = 1; persistAttempt <= 3; persistAttempt++) {
      const { data, error } = await supabase.rpc('fn_finalizar_automacao_execucao', {
        p_execution_id: exec.id,
        p_claim_token: exec.claim_token,
        p_status: exec.status,
        p_tentativas: exec.tentativas,
        p_resposta_api: exec.resposta_api || null,
        p_data_execucao: exec.data_execucao,
        p_data_proxima_tentativa: exec.data_proxima_tentativa || null,
        p_updated_at: exec.updated_at
      });

      if (!error && data === true) {
        delete exec.claim_token;
        dbInstance.save();
        return true;
      }

      safeLog('error', 'automation_engine.queue.persist', 'error', {
        entityId: exec.id,
        attempt: persistAttempt,
        error: error || undefined,
        reason: data === false ? 'claim_mismatch' : 'persistence_failed'
      });
    }

    return false;
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
    const queuedExecution = await dbInstance.queueAutomation(automation.event, {
      customer: sampleCustomer as Customer,
      vehicle: sampleVehicle as Vehicle,
      service: sampleService as Service,
      appointment: sampleAppointment
    });

    if (!queuedExecution) {
      return { success: false, log: 'Não foi possível enfileirar a automação (provável duplicidade ou inativa).' };
    }

    let execution: ClaimedAutomationExecution = queuedExecution;
    if (dbInstance.config.useRealSupabase) {
      const supabase = dbInstance.getSupabaseClient();
      const { data, error } = await supabase.rpc('fn_claim_automacoes_execucoes', {
        p_limit: 1,
        p_lease_seconds: AUTOMATION_CLAIM_LEASE_SECONDS,
        p_execution_id: queuedExecution.id
      });
      if (error || !data?.[0]) {
        safeLog('error', 'automation_engine.manual_test.claim', 'error', {
          entityId: queuedExecution.id,
          error: error || undefined,
          reason: data?.length ? 'claim_mismatch' : 'claim_unavailable'
        });
        return {
          success: false,
          log: 'Não foi possível obter claim exclusivo para a execução de teste.'
        };
      }
      execution = this.mapClaimedExecution(data[0]);
      const currentIndex = dbInstance.executions.findIndex(
        item => item.id === execution.id
      );
      if (currentIndex >= 0) {
        dbInstance.executions[currentIndex] = execution;
      }
    } else {
      execution.status = 'processando';
    }

    execution.tentativas += 1;
    execution.updated_at = new Date().toISOString();
    dbInstance.save();

    const payloadBody: AutomationTransportPayload = {
      event: execution.automacao,
      executionId: execution.id,
      appointmentId: execution.appointment_id || null,
      companyId: execution.empresa_id,
      phone: execution.telefone,
      message: execution.mensagem,
      customer: {
        id: sampleCustomer.id,
        name: sampleCustomer.name,
        phone: execution.telefone
      }
    };

    const { success, apiResponse } = await sendAutomationPayload(payloadBody, {
      secrets: getIntegrationSecrets()
    });

    execution.status = success ? 'sucesso' : 'erro_definitivo';
    execution.resposta_api = redactExternalResponse(apiResponse);
    execution.updated_at = new Date().toISOString();
    await this.persistClaimedExecution(execution, []);

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
