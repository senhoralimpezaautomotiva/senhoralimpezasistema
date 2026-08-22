import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableAgendaStartTimes } from '../src/utils/agendaAvailability';
import type { AgendaConfig, Appointment, Service } from '../src/types';

const agenda: AgendaConfig = {
  days: [
    { dayOfWeek: 1, dayName: 'Segunda-feira', isActive: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:00' }
  ],
  timeSlots: [
    { id: 'ts_1', time: '08:00', maxCapacity: 1 },
    { id: 'ts_2', time: '09:00', maxCapacity: 1 },
    { id: 'ts_3', time: '10:00', maxCapacity: 1 },
    { id: 'ts_4', time: '11:00', maxCapacity: 1 },
    { id: 'ts_5', time: '13:00', maxCapacity: 1 },
    { id: 'ts_6', time: '14:00', maxCapacity: 1 },
    { id: 'ts_7', time: '15:00', maxCapacity: 1 },
    { id: 'ts_8', time: '16:00', maxCapacity: 1 },
    { id: 'ts_9', time: '17:00', maxCapacity: 1 }
  ],
  minAdvanceHours: 0,
  maxAdvanceDays: 60,
  autoBlockDuration: true
};

const services = [
  { id: 'busy-40', name: 'Servico 40 min', estimatedTime: 40 },
  { id: 'busy-90', name: 'Servico 90 min', estimatedTime: 90 }
] as Service[];

const appointment = (id: string, time: string, serviceId: string): Appointment => ({
  id,
  customerId: 'customer-1',
  vehicleId: 'vehicle-1',
  serviceId,
  dateTime: `2026-08-24T${time}`,
  status: 'agendado',
  value: 0,
  durationTotal: services.find(service => service.id === serviceId)?.estimatedTime,
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-20T10:00:00.000Z'
} as Appointment);

const timesFor = (serviceDuration: number, appointments: Appointment[] = []) => (
  getAvailableAgendaStartTimes({
    agenda,
    appointments,
    services,
    date: '2026-08-24',
    serviceDuration,
    now: new Date('2026-08-20T10:00:00')
  }).map(option => option.time)
);

test('agenda usa termino de servico de 40 minutos como novo inicio valido', () => {
  const times = timesFor(90, [appointment('appt-1', '08:00', 'busy-40')]);

  assert.equal(times.includes('08:00'), false);
  assert.equal(times.includes('08:40'), true);
  assert.equal(times.includes('11:00'), false);
  assert.equal(times.includes('13:00'), true);
});

test('agenda aproveita intervalo real entre servicos para duracoes de 1h30 e 2h', () => {
  const booked = [
    appointment('appt-1', '08:00', 'busy-40'),
    appointment('appt-2', '11:30', 'busy-90'),
    appointment('appt-3', '15:00', 'busy-90')
  ];

  const ninetyMinutes = timesFor(90, booked);
  const twoHours = timesFor(120, booked);

  assert.deepEqual(ninetyMinutes.filter(time => time < '13:00'), ['08:40', '09:00', '10:00']);
  assert.equal(twoHours.includes('08:40'), true);
  assert.equal(twoHours.includes('10:00'), false);
  assert.equal(twoHours.includes('13:00'), true);
});

test('agenda nao exibe horario quando servico de 3h nao cabe integralmente', () => {
  const booked = [
    appointment('appt-1', '08:00', 'busy-40'),
    appointment('appt-2', '11:30', 'busy-90'),
    appointment('appt-3', '15:00', 'busy-90')
  ];

  const threeHours = timesFor(180, booked);

  assert.equal(threeHours.includes('08:40'), false);
  assert.equal(threeHours.includes('13:00'), false);
  assert.equal(threeHours.includes('15:00'), false);
});
