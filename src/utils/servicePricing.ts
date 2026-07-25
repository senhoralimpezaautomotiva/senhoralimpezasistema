import type { Customer, Service, Vehicle } from '../types';

export interface AppointmentFormDraft {
  customerId: string;
  vehicleId: string;
  serviceId: string;
  time: string;
  value: number;
  employeeId: string;
  notes: string;
}

export function getServicePrice(
  service: Service,
  vehicleOrPorte?: Vehicle | string | null
): number {
  const porte = typeof vehicleOrPorte === 'string'
    ? vehicleOrPorte.toLocaleLowerCase('pt-BR')
    : vehicleOrPorte?.porte?.toLocaleLowerCase('pt-BR');

  if (service.pricingType === 'porte' && porte) {
    if (porte.includes('pequeno') || porte === 'p') {
      return service.priceP ?? service.basePrice;
    }
    if (porte.includes('médio') || porte.includes('medio') || porte === 'm') {
      return service.priceM ?? service.basePrice;
    }
    if (porte.includes('grande') || porte === 'g') {
      return service.priceG ?? service.basePrice;
    }
  }

  return service.basePrice;
}

export function getServicesPrice(
  services: Service[],
  serviceIds: string[],
  vehicle?: Vehicle | null
): number {
  return serviceIds.reduce((total, serviceId) => {
    const service = services.find(candidate => candidate.id === serviceId);
    return total + (service ? getServicePrice(service, vehicle) : 0);
  }, 0);
}

export function getServicesDuration(services: Service[], serviceIds: string[]): number {
  return serviceIds.reduce((total, serviceId) => {
    const service = services.find(candidate => candidate.id === serviceId);
    return total + (service?.estimatedTime ?? 0);
  }, 0);
}

export function createAppointmentFormDraft(
  customers: Customer[],
  vehicles: Vehicle[],
  services: Service[],
  time: string,
  employeeId = 'Gabriel'
): AppointmentFormDraft {
  const customer = customers[0];
  const vehicle = vehicles.find(candidate => candidate.customerId === customer?.id);
  const service = services[0];

  return {
    customerId: customer?.id ?? '',
    vehicleId: vehicle?.id ?? '',
    serviceId: service?.id ?? '',
    time,
    value: service ? getServicePrice(service, vehicle) : 0,
    employeeId,
    notes: ''
  };
}
