import { Appointment, Budget, BudgetItem, BudgetStatus } from '../types';

export interface BudgetProgress {
  totalItems: number;
  pendingItems: number;
  scheduledItems: number;
  completedItems: number;
  canceledItems: number;
  convertedItems: number;
  status: BudgetStatus;
  label: string;
}

const terminalBudgetStatuses: BudgetStatus[] = ['recusado', 'cancelado', 'vencido'];

export const getBudgetItemStatus = (
  item: BudgetItem,
  appointments: Appointment[] = []
): NonNullable<BudgetItem['status']> => {
  if (item.status === 'concluido' || item.concludedAt) return 'concluido';
  if (item.status === 'cancelado') return 'cancelado';
  const appointment = item.appointmentId
    ? appointments.find(candidate => candidate.id === item.appointmentId)
    : undefined;
  if (appointment?.status === 'finalizado' || appointment?.status === 'entregue') return 'concluido';
  if (appointment?.status === 'cancelado') return 'cancelado';
  if (item.status === 'agendado' || item.appointmentId || item.convertedAt) return 'agendado';
  return 'pendente';
};

export const getBudgetProgress = (
  budget: Budget,
  appointments: Appointment[] = []
): BudgetProgress => {
  const statuses = budget.items.map(item => getBudgetItemStatus(item, appointments));
  const totalItems = statuses.length;
  const pendingItems = statuses.filter(status => status === 'pendente').length;
  const scheduledItems = statuses.filter(status => status === 'agendado').length;
  const completedItems = statuses.filter(status => status === 'concluido').length;
  const canceledItems = statuses.filter(status => status === 'cancelado').length;
  const convertedItems = scheduledItems + completedItems;

  let status = budget.status;
  if (!terminalBudgetStatuses.includes(budget.status) && budget.status !== 'rascunho') {
    if (totalItems > 0 && completedItems === totalItems) status = 'convertido';
    else if (convertedItems > 0) status = 'enviado';
    else status = budget.status === 'convertido' ? 'enviado' : budget.status;
  }

  const label = (() => {
    if (budget.status === 'rascunho') return 'Rascunho';
    if (budget.status === 'recusado') return 'Recusado';
    if (budget.status === 'cancelado') return 'Cancelado';
    if (budget.status === 'vencido') return 'Vencido';
    if (totalItems > 0 && completedItems === totalItems) return 'Concluido';
    if (completedItems > 0 && pendingItems > 0) return 'Parcialmente realizado';
    if (convertedItems > 0 && pendingItems > 0) return 'Parcialmente agendado';
    if (convertedItems > 0 && pendingItems === 0) return 'Totalmente agendado';
    return 'Pendente';
  })();

  return { totalItems, pendingItems, scheduledItems, completedItems, canceledItems, convertedItems, status, label };
};

export const getPendingBudgetItems = (
  budget: Budget,
  appointments: Appointment[] = []
): BudgetItem[] => budget.items.filter(item => getBudgetItemStatus(item, appointments) === 'pendente');

export const budgetHasPendingItems = (
  budget: Budget,
  appointments: Appointment[] = []
): boolean => budget.items.length === 0 || getPendingBudgetItems(budget, appointments).length > 0;
