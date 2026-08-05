import { dbInstance, mapDbAppointmentToFrontend, mapDbBudgetToFrontend, mapDbBudgetItemToFrontend } from './localDb';
import {
  AutomationExecution,
  AutomationLog,
  Customer,
  Vehicle,
  Service,
  Appointment,
  Budget
} from '../types';
import { maskPhone, safeLog } from '../security/safeOutput';
import {
  AutomationTransportPayload,
  AutomationTransportResult,
  sendAutomationPayload
} from '../server/automationTransport';
import { getIntegrationSecrets } from '../server/integrationSecrets';
import {
  classifyAutomationEvent,
  getAutomationEventRetryDelayMinutes
} from './automationEventPolicy';
import { classifyQueuedAutomation } from './automationExecutionPolicy';
import {
  buildReminderDeduplicationKey,
  buildReminderScheduleFromDatabase,
  evaluateReminderExecution,
  isReminderAppointmentEligible
} from './reminderPolicy';
import {
  evaluateInactiveCustomerCadence,
  evaluateInactiveCustomer,
  evaluateInactiveCustomerExecution
} from './inactiveCustomerPolicy';
import {
  evaluateBirthday,
  evaluateBirthdayExecution
} from './birthdayPolicy';
import { decideProviderExecution } from './automationProviderPolicy';
import { evaluateBudgetAutomation } from './budgetPolicy';
import {
  getPartsInTimezone,
  isWithinOperationalWindow,
  getNextStartTime
} from '../utils/operationalWindow';

export { getPartsInTimezone, isWithinOperationalWindow, getNextStartTime };

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
          || !syncState.budgetsLoaded
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
    let eventResult = await supabase
      .from('automacoes_eventos')
      .select('id,automacao,appointment_id,orcamento_id,customer_id,deduplication_key,status,tentativas')
      .in('status', ['pendente', 'pendente_retry'])
      .or(`proxima_tentativa.is.null,proxima_tentativa.lte.${now}`)
      .order('created_at', { ascending: true })
      .limit(100);
    if (
      eventResult.error
      && (eventResult.error.code === 'PGRST204' || eventResult.error.code === '42703')
      && eventResult.error.message?.includes('orcamento_id')
    ) {
      eventResult = await supabase
        .from('automacoes_eventos')
        .select('id,automacao,appointment_id,customer_id,deduplication_key,status,tentativas')
        .in('status', ['pendente', 'pendente_retry'])
        .or(`proxima_tentativa.is.null,proxima_tentativa.lte.${now}`)
        .order('created_at', { ascending: true })
        .limit(100) as typeof eventResult;
    }
    const { data: events, error } = eventResult;

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
      const budget = event.orcamento_id
        ? dbInstance.budgets.find(item => item.id === event.orcamento_id)
        : undefined;
      const vehicle = appointment
        ? dbInstance.vehicles.find(v => v.id === appointment.vehicleId)
        : budget
          ? (budget.vehicleId ? dbInstance.vehicles.find(v => v.id === budget.vehicleId) : undefined)
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
        budgetId: event.orcamento_id,
        configurationLoaded: dbInstance.lastSupabaseSync.configLoaded,
        customersLoaded: dbInstance.lastSupabaseSync.customersLoaded,
        appointmentsLoaded: dbInstance.lastSupabaseSync.appointmentsLoaded,
        vehiclesLoaded: dbInstance.lastSupabaseSync.vehiclesLoaded,
        servicesLoaded: dbInstance.lastSupabaseSync.servicesLoaded,
        budgetsLoaded: dbInstance.lastSupabaseSync.budgetsLoaded,
        customerFound: Boolean(customer),
        appointmentFound: !event.appointment_id || Boolean(appointment),
        appointmentStatus: appointment?.status,
        vehicleFound: !event.appointment_id || Boolean(vehicle),
        serviceFound: !event.appointment_id || Boolean(service),
        budgetFound: !event.orcamento_id || Boolean(budget),
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
          appointment,
          budget
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

    // --- 1. LEMBRETE DE AGENDAMENTO (60 minutos antes) ---
    const reminderTrigger = dbInstance.automations.find(a => a.event === 'lembrete_agendamento');
    if (reminderTrigger && reminderTrigger.isActive) {
      const now = new Date();
      const limit = new Date(now.getTime() + 60 * 60 * 1000); // 60 minutes ahead

      const eligibleAppts = dbInstance.appointments.filter(appt => {
        if (!isReminderAppointmentEligible(appt.status)) return false;
        
        const apptDate = new Date(appt.dateTime);
        // Is within the next 60 minutes and is in the future
        const isImminent = apptDate > now && apptDate <= limit;
        if (!isImminent) return false;

        // Check duplicate
        const deduplicationKey = buildReminderDeduplicationKey(appt.id, appt.dateTime);
        const hasBeenQueued = dbInstance.executions.some(e =>
          e.deduplication_key === deduplicationKey
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
      const now = new Date();

      const eligibleBdays = dbInstance.customers.filter(customer => {
        const decision = evaluateBirthday({
          customerId: customer.id,
          birthDate: customer.birthDate,
          now
        });
        if (!decision.eligible) return false;

        const hasBeenQueued = dbInstance.executions.some(e =>
          e.deduplication_key === decision.deduplicationKey
        );
        return !hasBeenQueued;
      });

      for (const customer of eligibleBdays) {
        const execution = await dbInstance.queueAutomation('aniversario', {
          customer,
          automationReferenceDate: now
        });
        if (execution) {
          count++;
          logs.push(`[Birthday Scan] Mensagem agendada. ClienteId=${customer.id}.`);
        }
      }
    }

    // --- 3. CLIENTES INATIVOS ---
    const inactiveTrigger = dbInstance.automations.find(a => a.event === 'cliente_inativo');
    if (inactiveTrigger && inactiveTrigger.isActive) {
      const inactiveDays = inactiveTrigger.inactiveDays ?? 30;
      const minServices = inactiveTrigger.minServices ?? 1;
      const now = new Date();

      for (const customer of dbInstance.customers) {
        const customerAppts = dbInstance.appointments.filter(a => a.customerId === customer.id);
        const decision = evaluateInactiveCustomer({
          customerId: customer.id,
          appointments: customerAppts,
          inactiveDays,
          minServices,
          now
        });
        if (!decision.eligible) continue;

        const cadenceDecision = evaluateInactiveCustomerCadence({
          customerDecision: decision,
          appointments: customerAppts,
          executions: dbInstance.executions.filter(
            execution =>
              execution.automacao === 'cliente_inativo'
              && execution.customer_id === customer.id
          ),
          now
        });
        if (cadenceDecision.action !== 'queue') continue;

        const latestAppointment = customerAppts.find(
          appointment => appointment.id === decision.lastCompletedAppointment.id
        );
        if (!latestAppointment) continue;

        const vehicle = dbInstance.vehicles.find(
          item => item.id === latestAppointment.vehicleId
        );
        const service = dbInstance.services.find(
          item => item.id === latestAppointment.serviceId
        );
        const execution = await dbInstance.queueAutomation('cliente_inativo', {
          customer,
          vehicle,
          service,
          appointment: latestAppointment,
          inactiveCustomerStage: cadenceDecision.stage
        });
        if (execution) {
          count++;
          logs.push(
            `[Inactive Scan] Etapa ${cadenceDecision.stage} agendada. ClienteId=${customer.id}.`
          );
        }
      }
    }

    // --- 4. ACOMPANHAMENTOS DE ORÇAMENTO (7 e 14 dias) ---
    for (const event of ['orcamento_followup_7d', 'orcamento_followup_14d'] as const) {
      const trigger = dbInstance.automations.find(item => item.event === event);
      if (!trigger?.isActive) continue;

      for (const budget of dbInstance.budgets) {
        const decision = evaluateBudgetAutomation({
          event,
          budget,
          appointments: dbInstance.appointments,
          executions: dbInstance.executions
        });
        if (decision.action !== 'queue') continue;

        const customer = dbInstance.customers.find(item => item.id === budget.customerId);
        if (!customer) continue;
        const execution = await dbInstance.queueAutomation(event, {
          customer,
          vehicle: dbInstance.vehicles.find(item => item.id === budget.vehicleId),
          budget
        });
        if (execution) {
          count++;
          logs.push(`[Budget Scan] ${event} agendado. ClienteId=${customer.id}; OrcamentoId=${budget.id}.`);
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

      if (exec.automacao === 'lembrete_agendamento') {
        const reminderCanBeSent = await this.validateReminderBeforeSend(exec, logs);
        if (!reminderCanBeSent) continue;
      }

      if (exec.automacao === 'cliente_inativo') {
        const inactiveMessageCanBeSent = await this.validateInactiveCustomerBeforeSend(
          exec,
          activeTrigger,
          logs
        );
        if (!inactiveMessageCanBeSent) continue;
      }

      if (exec.automacao === 'aniversario') {
        const birthdayMessageCanBeSent = await this.validateBirthdayBeforeSend(exec, logs);
        if (!birthdayMessageCanBeSent) continue;
      }

      if (
        exec.automacao === 'orcamento_enviado'
        || exec.automacao === 'orcamento_followup_7d'
        || exec.automacao === 'orcamento_followup_14d'
      ) {
        const budgetMessageCanBeSent = await this.validateBudgetBeforeSend(exec, logs);
        if (!budgetMessageCanBeSent) continue;
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

      const transportResult = await sendAutomationPayload(payloadBody, {
        secrets: getIntegrationSecrets()
      });

      const accepted = this.applyProviderResult(exec, transportResult, logs);

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
        payload: `ID da execução: ${exec.id}\nTentativa: ${exec.tentativas}\nStatus técnico: ${exec.resposta_api}${persisted ? '' : '\nPersistência do resultado não confirmada.'}`,
        status: accepted && persisted ? 'sucesso' : 'erro',
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
      budget_id: row.orcamento_id || undefined,
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

  private async validateReminderBeforeSend(
    exec: ClaimedAutomationExecution,
    logs: string[]
  ): Promise<boolean> {
    let appointmentFound = false;
    let appointmentLoadFailed = false;
    let appointmentStatus: string | null = null;
    let currentSchedule: string | null = null;

    if (dbInstance.config.useRealSupabase) {
      const supabase = dbInstance.getSupabaseClient();
      const { data, error } = await supabase
        .from('agendamentos')
        .select('status,data_agendamento,hora_agendamento')
        .eq('id', exec.appointment_id || '')
        .maybeSingle();

      appointmentLoadFailed = Boolean(error);
      appointmentFound = Boolean(data);
      appointmentStatus = data?.status || null;
      currentSchedule = buildReminderScheduleFromDatabase(
        data?.data_agendamento,
        data?.hora_agendamento
      );

      if (error) {
        safeLog('error', 'automation_engine.reminder.validate', 'error', {
          entityId: exec.id,
          error
        });
      }
    } else {
      const appointment = dbInstance.appointments.find(
        item => item.id === exec.appointment_id
      );
      appointmentFound = Boolean(appointment);
      appointmentStatus = appointment?.status || null;
      currentSchedule = appointment?.dateTime || null;
    }

    const decision = evaluateReminderExecution({
      appointmentId: exec.appointment_id,
      executionDeduplicationKey: exec.deduplication_key,
      appointmentFound,
      appointmentLoadFailed,
      appointmentStatus,
      currentSchedule
    });
    if (decision.action === 'send') return true;

    exec.updated_at = new Date().toISOString();
    if (decision.action === 'retry') {
      const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      exec.status = 'pendente';
      exec.data_execucao = retryAt;
      exec.data_proxima_tentativa = retryAt;
      exec.resposta_api = 'Execução adiada: não foi possível validar o agendamento antes do lembrete.';
    } else {
      exec.status = 'cancelada';
      exec.resposta_api = decision.reason === 'schedule_changed'
        ? 'Execução cancelada: o agendamento foi reagendado.'
        : decision.reason === 'appointment_missing'
          ? 'Execução cancelada: agendamento não encontrado.'
          : 'Execução cancelada: o estado atual do agendamento não permite lembrete.';
    }

    await this.persistClaimedExecution(exec, logs);
    logs.push(
      `[Queue Processor] Lembrete ${exec.id} não enviado: ${decision.reason}.`
    );
    return false;
  }

  private async validateInactiveCustomerBeforeSend(
    exec: ClaimedAutomationExecution,
    trigger: NonNullable<ReturnType<typeof dbInstance.automations.find>>,
    logs: string[]
  ): Promise<boolean> {
    let appointmentLoadFailed = false;
    let appointments: Appointment[] = [];

    if (dbInstance.config.useRealSupabase) {
      const supabase = dbInstance.getSupabaseClient();
      const { data, error } = await supabase
        .from('agendamentos')
        .select(
          'id,cliente_id,veiculo_id,servico_id,data_agendamento,hora_agendamento,status,observacoes,created_at,updated_at'
        )
        .eq('cliente_id', exec.customer_id);

      appointmentLoadFailed = Boolean(error);
      appointments = error ? [] : (data || []).map(mapDbAppointmentToFrontend);
      if (error) {
        safeLog('error', 'automation_engine.inactive_customer.validate', 'error', {
          entityId: exec.id,
          error
        });
      }
    } else {
      appointments = dbInstance.appointments.filter(
        appointment => appointment.customerId === exec.customer_id
      );
    }

    const customerDecision = appointmentLoadFailed
      ? undefined
      : evaluateInactiveCustomer({
          customerId: exec.customer_id,
          appointments,
          inactiveDays: trigger.inactiveDays ?? 30,
          minServices: trigger.minServices ?? 1
        });
    const decision = evaluateInactiveCustomerExecution({
      appointmentLoadFailed,
      executionDeduplicationKey: exec.deduplication_key,
      customerDecision,
      appointments,
      executions: dbInstance.executions.filter(
        execution =>
          execution.automacao === 'cliente_inativo'
          && execution.customer_id === exec.customer_id
      )
    });
    if (decision.action === 'send') return true;

    exec.updated_at = new Date().toISOString();
    if (decision.action === 'retry') {
      const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      exec.status = 'pendente';
      exec.data_execucao = retryAt;
      exec.data_proxima_tentativa = retryAt;
      exec.resposta_api = 'Execução adiada: não foi possível revalidar o histórico do cliente.';
    } else {
      exec.status = 'cancelada';
      exec.resposta_api = decision.reason === 'future_appointment'
        ? 'Execução cancelada: cliente possui retorno futuro.'
        : decision.reason === 'active_service'
          ? 'Execução cancelada: cliente possui atendimento em andamento.'
          : decision.reason === 'appointment_after_first_message'
            ? 'Execução cancelada: cliente realizou um novo agendamento após o início da sequência.'
            : decision.reason === 'previous_stage_not_accepted'
              ? 'Execução cancelada: etapa anterior da sequência não foi aceita pelo provedor.'
              : decision.reason === 'follow_up_not_due'
                ? 'Execução cancelada: prazo da etapa de inatividade ainda não foi alcançado.'
          : decision.reason === 'inactivity_episode_changed'
            ? 'Execução cancelada: o ciclo de inatividade do cliente mudou.'
            : 'Execução cancelada: cliente não atende mais aos critérios de inatividade.';
    }

    await this.persistClaimedExecution(exec, logs);
    logs.push(
      `[Queue Processor] Cliente inativo ${exec.id} não enviado: ${decision.reason}.`
    );
    return false;
  }

  private async validateBirthdayBeforeSend(
    exec: ClaimedAutomationExecution,
    logs: string[]
  ): Promise<boolean> {
    let customerLoadFailed = false;
    let customerFound = false;
    let birthDate: string | null = null;

    if (dbInstance.config.useRealSupabase) {
      const supabase = dbInstance.getSupabaseClient();
      const { data, error } = await supabase
        .from('clientes')
        .select('data_aniversario')
        .eq('id', exec.customer_id)
        .maybeSingle();

      customerLoadFailed = Boolean(error);
      customerFound = Boolean(data);
      birthDate = data?.data_aniversario || null;
      if (error) {
        safeLog('error', 'automation_engine.birthday.validate', 'error', {
          entityId: exec.id,
          error
        });
      }
    } else {
      const customer = dbInstance.customers.find(item => item.id === exec.customer_id);
      customerFound = Boolean(customer);
      birthDate = customer?.birthDate || null;
    }

    const decision = evaluateBirthdayExecution({
      customerLoadFailed,
      customerFound,
      customerId: exec.customer_id,
      birthDate,
      executionDeduplicationKey: exec.deduplication_key
    });
    if (decision.action === 'send') return true;

    exec.updated_at = new Date().toISOString();
    if (decision.action === 'retry') {
      const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      exec.status = 'pendente';
      exec.data_execucao = retryAt;
      exec.data_proxima_tentativa = retryAt;
      exec.resposta_api = 'ExecuÃ§Ã£o adiada: nÃ£o foi possÃ­vel revalidar o aniversÃ¡rio do cliente.';
    } else {
      exec.status = 'cancelada';
      exec.resposta_api = decision.reason === 'customer_missing'
        ? 'ExecuÃ§Ã£o cancelada: cliente nÃ£o encontrado.'
        : decision.reason === 'deduplication_key_mismatch'
          ? 'ExecuÃ§Ã£o cancelada: a referÃªncia anual do aniversÃ¡rio mudou.'
          : decision.reason === 'not_birthday_today'
            ? 'ExecuÃ§Ã£o cancelada: o aniversÃ¡rio nÃ£o corresponde ao dia atual em SÃ£o Paulo.'
            : 'ExecuÃ§Ã£o cancelada: data de aniversÃ¡rio ausente ou invÃ¡lida.';
    }

    await this.persistClaimedExecution(exec, logs);
    logs.push(
      `[Queue Processor] AniversÃ¡rio ${exec.id} nÃ£o enviado: ${decision.reason}.`
    );
    return false;
  }

  private async validateBudgetBeforeSend(
    exec: ClaimedAutomationExecution,
    logs: string[]
  ): Promise<boolean> {
    let budget: Budget | undefined;
    let appointments: Appointment[] = [];
    let loadFailed = false;

    if (dbInstance.config.useRealSupabase) {
      const supabase = dbInstance.getSupabaseClient();
      const [budgetResult, itemsResult, appointmentsResult] = await Promise.all([
        supabase.from('orcamentos').select('*').eq('id', exec.budget_id || '').maybeSingle(),
        supabase.from('orcamento_itens').select('*').eq('orcamento_id', exec.budget_id || ''),
        supabase.from('agendamentos')
          .select('id,cliente_id,veiculo_id,servico_id,data_agendamento,hora_agendamento,status,observacoes,created_at,updated_at')
          .eq('cliente_id', exec.customer_id)
      ]);
      loadFailed = Boolean(budgetResult.error || itemsResult.error || appointmentsResult.error);
      if (!loadFailed && budgetResult.data) {
        const items = (itemsResult.data || []).map(mapDbBudgetItemToFrontend);
        budget = mapDbBudgetToFrontend(budgetResult.data, items);
        appointments = (appointmentsResult.data || []).map(mapDbAppointmentToFrontend);
      }
      if (loadFailed) {
        safeLog('error', 'automation_engine.budget.validate', 'error', {
          entityId: exec.id,
          error: budgetResult.error || itemsResult.error || appointmentsResult.error
        });
      }
    } else {
      budget = dbInstance.budgets.find(item => item.id === exec.budget_id);
      appointments = dbInstance.appointments.filter(item => item.customerId === exec.customer_id);
    }

    if (loadFailed) {
      const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      exec.status = 'pendente';
      exec.data_execucao = retryAt;
      exec.data_proxima_tentativa = retryAt;
      exec.resposta_api = 'Execução adiada: não foi possível revalidar o orçamento.';
      exec.updated_at = new Date().toISOString();
      await this.persistClaimedExecution(exec, logs);
      return false;
    }

    if (!budget) {
      exec.status = 'cancelada';
      exec.resposta_api = 'Execução cancelada: orçamento não encontrado.';
      exec.updated_at = new Date().toISOString();
      await this.persistClaimedExecution(exec, logs);
      return false;
    }

    const decision = evaluateBudgetAutomation({
      event: exec.automacao as 'orcamento_enviado' | 'orcamento_followup_7d' | 'orcamento_followup_14d',
      budget,
      appointments,
      executions: dbInstance.executions,
      currentExecutionId: exec.id
    });
    if (decision.action === 'send') return true;

    if (decision.action === 'wait') {
      const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      exec.status = 'pendente';
      exec.data_execucao = retryAt;
      exec.data_proxima_tentativa = retryAt;
      exec.resposta_api = 'Execução adiada: o marco temporal do orçamento ainda não foi confirmado.';
    } else {
      exec.status = 'cancelada';
      exec.resposta_api = `Execução cancelada: ${decision.reason}.`;
    }
    exec.updated_at = new Date().toISOString();
    await this.persistClaimedExecution(exec, logs);
    logs.push(`[Queue Processor] Orçamento ${exec.id} não enviado: ${decision.reason}.`);
    return false;
  }

  private applyProviderResult(
    exec: ClaimedAutomationExecution,
    result: AutomationTransportResult,
    logs: string[]
  ): boolean {
    const decision = decideProviderExecution({
      outcome: result.outcome,
      attempts: exec.tentativas,
      retryAfterSeconds: result.retryAfterSeconds
    });

    exec.updated_at = new Date().toISOString();
    if (decision.action === 'accepted') {
      // O status legado "sucesso" significa apenas aceitação pelo provedor.
      // A entrega não é presumida sem callback autoritativo.
      exec.status = 'sucesso';
      exec.data_proxima_tentativa = undefined;
      exec.resposta_api = result.apiResponse;
      logs.push(`[Queue Processor] Execução ${exec.id} aceita pelo provedor; entrega não confirmada.`);
      return true;
    }

    if (decision.action === 'retry') {
      const nextAttemptDate = new Date(Date.now() + decision.delaySeconds * 1000);
      exec.status = 'pendente';
      exec.data_execucao = nextAttemptDate.toISOString();
      exec.data_proxima_tentativa = nextAttemptDate.toISOString();
      exec.resposta_api = `[RETRY AGENDADO] ${result.apiResponse}`;
      logs.push(
        `[Queue Processor] Execução ${exec.id} rejeitada antes da aceitação; retry em ${decision.delaySeconds}s.`
      );
      return false;
    }

    exec.status = 'erro_definitivo';
    exec.data_proxima_tentativa = undefined;
    exec.resposta_api = decision.reason === 'ambiguous_failure'
      ? `[RESULTADO AMBÍGUO] ${result.apiResponse}`
      : decision.reason === 'retry_exhausted'
        ? `[ERRO DEFINITIVO] Limite de tentativas atingido. ${result.apiResponse}`
        : `[ERRO DEFINITIVO] ${result.apiResponse}`;
    logs.push(
      decision.reason === 'ambiguous_failure'
        ? `[Queue Processor] Execução ${exec.id} encerrada sem retry: resultado ambíguo.`
        : `[Queue Processor] Falha definitiva na execução ${exec.id}.`
    );
    return false;
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
    const isBudgetAutomation = automation.event === 'orcamento_enviado'
      || automation.event === 'orcamento_followup_7d'
      || automation.event === 'orcamento_followup_14d';
    const sampleBudget = isBudgetAutomation ? dbInstance.budgets[0] : undefined;
    if (isBudgetAutomation && !sampleBudget) {
      return { success: false, log: 'Cadastre um orçamento antes de testar esta automação.' };
    }
    const budgetCustomer = sampleBudget
      ? dbInstance.customers.find(item => item.id === sampleBudget.customerId)
      : undefined;
    const budgetVehicle = sampleBudget
      ? dbInstance.vehicles.find(item => item.id === sampleBudget.vehicleId)
      : undefined;
    if (sampleBudget && !budgetCustomer) {
      return { success: false, log: 'O cliente do orçamento não está disponível para o teste.' };
    }
    const targetSampleCustomer = budgetCustomer || sampleCustomer;

    // Queue the execution
    const queuedExecution = await dbInstance.queueAutomation(automation.event, {
      customer: targetSampleCustomer as Customer,
      vehicle: (budgetVehicle || sampleVehicle) as Vehicle,
      service: sampleService as Service,
      appointment: isBudgetAutomation ? undefined : sampleAppointment,
      budget: sampleBudget,
      deduplicationKeyOverride: `manual_test:${automation.event}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
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
        id: targetSampleCustomer.id,
        name: targetSampleCustomer.name,
        phone: execution.telefone
      }
    };

    const transportResult = await sendAutomationPayload(payloadBody, {
      secrets: getIntegrationSecrets()
    });

    const persistenceLogs: string[] = [];
    const accepted = this.applyProviderResult(execution, transportResult, persistenceLogs);
    const persisted = await this.persistClaimedExecution(execution, persistenceLogs);

    // Add to logs list
    const newLog: AutomationLog = {
      id: 'log_manual_' + Date.now(),
      triggerEvent: automation.name + ' (Teste Manual)',
      targetName: 'Cliente de teste protegido',
      targetContact: maskPhone(execution.telefone),
      payload: `ID da execução: ${execution.id}\nStatus técnico: ${execution.resposta_api}${persisted ? '' : '\nPersistência do resultado não confirmada.'}`,
      status: accepted && persisted ? 'sucesso' : 'erro',
      timestamp: execution.updated_at
    };
    dbInstance.addLog(newLog);

    if (dbInstance.onSyncCallback) {
      dbInstance.onSyncCallback();
    }

    return {
      success: accepted && persisted,
      log: persisted
        ? execution.resposta_api || 'Resultado indisponível.'
        : `${execution.resposta_api || 'Resultado do provedor indisponível.'} Persistência no banco não confirmada; não repita o teste automaticamente.`
    };
  }
}

export const automationEngineInstance = new AutomationEngine();
