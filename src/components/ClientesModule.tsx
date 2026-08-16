/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Edit, 
  Trash2, 
  Eye, 
  X, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Plus,
  Car,
  Tag,
  Star,
  Minus,
  History,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Customer, Vehicle, HistoryRecord, LoyaltyCardEntry } from '../types';
import { hasModulePermission } from '../db/localDb';
import { safeLog } from '../security/safeOutput';
import { useVehicleCatalog } from '../hooks/useVehicleCatalog';
import { resolveVehiclePorte } from '../utils/vehicleCatalog';

interface ClientesModuleProps {
  customers: Customer[];
  vehicles: Vehicle[];
  history: HistoryRecord[];
  currentUser?: any;
  onAddCustomer: (customer: Omit<Customer, 'id' | 'clientSince' | 'lastServiceDate'>) => Promise<any>;
  onUpdateCustomer: (id: string, customer: Partial<Customer>) => Promise<any>;
  onDeleteCustomer: (id: string) => Promise<any>;
  onAddVehicle: (vehicle: Omit<Vehicle, 'id'>) => Promise<any>;
  onUpdateVehicle: (id: string, vehicle: Partial<Vehicle>) => Promise<any>;
  onDeleteVehicle: (id: string) => Promise<any>;
  loyaltyEntries: LoyaltyCardEntry[];
  loyaltyTarget: number;
  onAdjustLoyaltyMark: (customerId: string, delta: 1 | -1) => Promise<void>;
}

export default function ClientesModule({ 
  customers, 
  vehicles, 
  history, 
  currentUser,
  onAddCustomer, 
  onUpdateCustomer, 
  onDeleteCustomer,
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
  loyaltyEntries,
  loyaltyTarget,
  onAdjustLoyaltyMark
}: ClientesModuleProps) {
  const canCreate = hasModulePermission(currentUser, 'clientes', 'create');
  const canEdit = hasModulePermission(currentUser, 'clientes', 'edit');
  const canDelete = hasModulePermission(currentUser, 'clientes', 'delete');
  const vehicleCatalog = useVehicleCatalog();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isEditVehicleOpen, setIsEditVehicleOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Form States for Customer
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    email: '',
    cpf: '',
    birthDate: '',
    address: '',
    neighborhood: '',
    city: 'São Paulo',
    notes: '',
    status: 'ativo' as 'ativo' | 'inativo',
    origin: 'Instagram'
  });

  const [editId, setEditId] = useState('');

  // Form State for Vehicle
  const [vehicleData, setVehicleData] = useState({
    brand: '',
    model: '',
    version: 'N/A',
    year: '',
    plate: '',
    color: '',
    mileage: '0',
    porte: 'Médio' as 'Pequeno' | 'Médio' | 'Grande',
    isPrincipal: false
  });

  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const availableBrandNames = useMemo(() => {
    const names = vehicleCatalog.brands.map(brand => brand.name);
    if (vehicleData.brand && !names.includes(vehicleData.brand)) names.push(vehicleData.brand);
    return names;
  }, [vehicleCatalog.brands, vehicleData.brand]);
  const availableModels = useMemo(() => {
    const models = vehicleCatalog.models
      .filter(model => model.brandName === vehicleData.brand)
      .map(model => model.name);
    if (vehicleData.model && !models.includes(vehicleData.model)) models.push(vehicleData.model);
    return models;
  }, [vehicleCatalog.models, vehicleData.brand, vehicleData.model]);

  const handleVehicleBrandChange = (brand: string) => {
    setVehicleData(previous => ({
      ...previous,
      brand,
      model: '',
      porte: 'Médio'
    }));
  };

  const handleVehicleModelChange = (model: string) => {
    setVehicleData(previous => ({
      ...previous,
      model,
      porte: resolveVehiclePorte(vehicleCatalog, previous.brand, model, previous.porte)
    }));
  };

  // Reset page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // SMART GLOBAL SEARCH
  // Filter customers by: Name, Phone, CPF, Plate, Manufacturer, Model, Referral Code
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return customers;

    return customers.filter(c => {
      // Direct customer info check
      const matchesCustomer = 
        c.name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        c.whatsapp.includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.cpf && c.cpf.includes(term)) ||
        (c.referralCode && c.referralCode.toLowerCase().includes(term)) ||
        c.neighborhood.toLowerCase().includes(term);

      if (matchesCustomer) return true;

      // Linked vehicle info check
      const customerVehicles = vehicles.filter(v => v.customerId === c.id);
      const matchesVehicle = customerVehicles.some(v => 
        v.brand.toLowerCase().includes(term) ||
        v.model.toLowerCase().includes(term) ||
        v.plate.toLowerCase().includes(term)
      );

      return matchesVehicle;
    });
  }, [customers, vehicles, searchTerm]);

  // AUTO-SELECT INDIVIDUAL UNIQUE CLIENT IF SEARCH RESULTS IN SINGLE HIT (At least 3 characters query)
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed.length >= 3 && filteredCustomers.length === 1) {
      setSelectedCustomer(filteredCustomers[0]);
    }
  }, [searchTerm, filteredCustomers]);

  // Paginated client list
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCustomers, currentPage, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / itemsPerPage));

  const handleOpenAddModal = () => {
    setErrorMessage(null);
    setFormData({
      name: '',
      phone: '',
      whatsapp: '',
      email: '',
      cpf: '',
      birthDate: '',
      address: '',
      neighborhood: '',
      city: 'São Paulo',
      notes: '',
      status: 'ativo',
      origin: 'Instagram'
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    if (!canEdit) return;
    setErrorMessage(null);
    setEditId(c.id);
    setFormData({
      name: c.name,
      phone: c.phone,
      whatsapp: c.whatsapp,
      email: c.email,
      cpf: c.cpf || '',
      birthDate: c.birthDate,
      address: c.address,
      neighborhood: c.neighborhood,
      city: c.city,
      notes: c.notes,
      status: c.status,
      origin: c.origin
    });
    setIsEditModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const added = await onAddCustomer({
        ...formData,
        whatsapp: formData.whatsapp || formData.phone.replace(/\D/g, '') // strip formatting
      });
      setIsAddModalOpen(false);
      if (added) {
        setSelectedCustomer(added);
      }
    } catch (err: any) {
      safeLog('error', 'customers.customer.create', 'error', { error: err });
      setErrorMessage(err?.message || 'Erro ao salvar cliente. Verifique se os dados ja estao cadastrados.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setErrorMessage(null);
    setIsSaving(true);
    try {
      await onUpdateCustomer(editId, {
        ...formData,
        whatsapp: formData.whatsapp || formData.phone.replace(/\D/g, '')
      });
      setIsEditModalOpen(false);
      if (selectedCustomer && selectedCustomer.id === editId) {
        setSelectedCustomer({
          ...selectedCustomer,
          ...formData
        });
      }
    } catch (err: any) {
      safeLog('error', 'customers.customer.update', 'error', { error: err });
      setErrorMessage('Erro ao atualizar dados. Verifique os campos.');
    } finally {
      setIsSaving(false);
    }
  };

  // VEHICLE METHODS
  const handleOpenAddVehicle = () => {
    if (!canCreate) return;
    setErrorMessage(null);
    setVehicleData({
      brand: '',
      model: '',
      version: 'N/A',
      year: '',
      plate: '',
      color: '',
      mileage: '0',
      porte: 'Médio',
      isPrincipal: customerVehicles.length === 0 // automatically principal if first vehicle
    });
    setIsAddVehicleOpen(true);
  };

  const handleOpenEditVehicle = (v: Vehicle) => {
    if (!canEdit) return;
    setErrorMessage(null);
    setEditingVehicleId(v.id);
    setVehicleData({
      brand: v.brand,
      model: v.model,
      version: v.version || 'N/A',
      year: v.year,
      plate: v.plate,
      color: v.color,
      mileage: v.mileage || '0',
      porte: v.porte || 'Médio',
      isPrincipal: !!v.isPrincipal
    });
    setIsEditVehicleOpen(true);
  };

  const handleAddVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !canCreate) return;
    setErrorMessage(null);
    setIsSaving(true);
    try {
      // If we are setting this vehicle as principal, make sure others are un-principaled
      const isFirst = customerVehicles.length === 0;
      const willBePrincipal = vehicleData.isPrincipal || isFirst;

      const newV = await onAddVehicle({
        brand: vehicleData.brand,
        model: vehicleData.model,
        version: vehicleData.version,
        year: vehicleData.year,
        plate: vehicleData.plate.toUpperCase(),
        color: vehicleData.color,
        mileage: vehicleData.mileage,
        porte: vehicleData.porte,
        isPrincipal: willBePrincipal,
        customerId: selectedCustomer.id
      });

      if (willBePrincipal && !isFirst) {
        // Demote other vehicles
        for (const v of customerVehicles) {
          if (v.id !== newV.id && v.isPrincipal) {
            await onUpdateVehicle(v.id, { isPrincipal: false });
          }
        }
      }

      setIsAddVehicleOpen(false);
    } catch (err: any) {
      safeLog('error', 'customers.vehicle.create', 'error', { error: err });
      setErrorMessage('Erro ao cadastrar veículo. Verifique se a placa é única.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !editingVehicleId || !canEdit) return;
    setErrorMessage(null);
    setIsSaving(true);
    try {
      await onUpdateVehicle(editingVehicleId, {
        brand: vehicleData.brand,
        model: vehicleData.model,
        version: vehicleData.version,
        year: vehicleData.year,
        plate: vehicleData.plate.toUpperCase(),
        color: vehicleData.color,
        mileage: vehicleData.mileage,
        porte: vehicleData.porte,
        isPrincipal: vehicleData.isPrincipal
      });

      if (vehicleData.isPrincipal) {
        // Demote other vehicles
        for (const v of customerVehicles) {
          if (v.id !== editingVehicleId && v.isPrincipal) {
            await onUpdateVehicle(v.id, { isPrincipal: false });
          }
        }
      }

      setIsEditVehicleOpen(false);
      setEditingVehicleId(null);
    } catch (err: any) {
      safeLog('error', 'customers.vehicle.update', 'error', { error: err });
      setErrorMessage('Erro ao atualizar veículo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPrincipalVehicle = async (vehicleId: string) => {
    if (!selectedCustomer || !canEdit) return;
    setIsSaving(true);
    try {
      const customerVehicles = vehicles.filter(v => v.customerId === selectedCustomer.id);
      for (const v of customerVehicles) {
        await onUpdateVehicle(v.id, { isPrincipal: v.id === vehicleId });
      }
    } catch (err) {
      safeLog('error', 'customers.vehicle.set_primary', 'error', { error: err });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVehicleClick = async (vehicleId: string) => {
    if (!canDelete) return;
    if (!confirm('Deseja realmente remover este veículo do cadastro do cliente? Todos os agendamentos dele também serão removidos.')) return;
    setIsSaving(true);
    try {
      await onDeleteVehicle(vehicleId);
    } catch (err) {
      safeLog('error', 'customers.vehicle.delete', 'error', { error: err });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomerClick = async (customer: Customer) => {
    if (!canDelete) return;
    if (!confirm(`Tem certeza que deseja excluir o cliente ${customer.name} e todos os seus veículos e agendamentos?`)) return;

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onDeleteCustomer(customer.id);
      if (selectedCustomer?.id === customer.id) setSelectedCustomer(null);
    } catch (error) {
      safeLog('error', 'customers.customer.delete', 'error', {
        entityId: customer.id,
        error
      });
      setErrorMessage('Erro ao excluir cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  const customerVehicles = selectedCustomer ? vehicles.filter(v => v.customerId === selectedCustomer.id) : [];
  const customerHistory = selectedCustomer ? history.filter(h => h.customerId === selectedCustomer.id) : [];
  const customerLoyaltyEntries = selectedCustomer ? loyaltyEntries.filter(entry => entry.customerId === selectedCustomer.id) : [];
  const customerLoyaltyBalance = Math.max(0, customerLoyaltyEntries.reduce((sum, entry) => sum + entry.delta, 0));

  const handleAdjustLoyalty = async (delta: 1 | -1) => {
    if (!selectedCustomer || !canEdit || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);
    try { await onAdjustLoyaltyMark(selectedCustomer.id, delta); }
    catch (error: any) { setErrorMessage(error?.message || 'Não foi possível alterar o cartão fidelidade.'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="clientes-module-view">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Busca Inteligente (Nome, Tel, CPF, Placa, Fabricante, Modelo, Código Indicação...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm rounded-xl text-slate-200 transition-all placeholder-slate-500"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {canCreate && (
          <button 
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 font-semibold text-xs text-white rounded-xl shadow-lg shadow-sky-500/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
            id="btn-add-customer"
          >
            <UserPlus size={16} />
            <span>Cadastrar Cliente</span>
          </button>
        )}
      </div>

      {/* Split view: List on left, details inspector on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 lg:col-span-2 overflow-hidden shadow-sm flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Users size={16} className="text-sky-500" />
                CLIENTES ({filteredCustomers.length})
              </h3>
              {filteredCustomers.length !== customers.length && (
                <span className="text-[10px] bg-sky-500/10 border border-sky-500/20 text-sky-400 font-bold px-2.5 py-1 rounded-full">
                  Filtrado
                </span>
              )}
            </div>

            {paginatedCustomers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm bg-slate-950/40">
                Nenhum cliente cadastrado ou correspondente aos termos digitados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase font-mono text-slate-400 bg-slate-950/25">
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">Contato / CPF</th>
                      <th className="py-3 px-4">Veículos Vinculados</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {paginatedCustomers.map((c) => {
                      const linkedVehicles = vehicles.filter(v => v.customerId === c.id);
                      return (
                        <tr 
                          key={c.id} 
                          className={`hover:bg-slate-850/40 cursor-pointer text-xs transition-colors ${selectedCustomer?.id === c.id ? 'bg-slate-850/60' : ''}`}
                          onClick={() => setSelectedCustomer(c)}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white flex items-center gap-2">
                              {c.name}
                              {c.origin === 'Instagram' && <span className="bg-pink-500/10 text-pink-400 border border-pink-500/15 text-[8px] px-1 rounded">Insta</span>}
                              {c.origin === 'WhatsApp' && <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 text-[8px] px-1 rounded">Whats</span>}
                              {c.origin === 'Indicação' && <span className="bg-sky-500/10 text-sky-400 border border-sky-500/15 text-[8px] px-1 rounded">Indicação</span>}
                              {c.referralCode && (
                                <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[8.5px] font-mono px-1 rounded">
                                  {c.referralCode}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Membro desde: {c.clientSince}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            <div className="flex items-center gap-1.5">{c.phone}</div>
                            {c.cpf && <div className="text-[10px] text-slate-500">CPF: {c.cpf}</div>}
                          </td>
                          <td className="py-3.5 px-4">
                            {linkedVehicles.length === 0 ? (
                              <span className="text-slate-500 italic text-[11px]">Nenhum veículo</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {linkedVehicles.map(v => (
                                  <span 
                                    key={v.id} 
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase border ${
                                      v.isPrincipal 
                                        ? 'bg-sky-500/10 border-sky-500/20 text-sky-400 font-extrabold' 
                                        : 'bg-slate-850 border-slate-800 text-slate-400'
                                    }`}
                                    title={`${v.brand} ${v.model} (${v.porte})`}
                                  >
                                    {v.plate} {v.isPrincipal && '★'}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              c.status === 'ativo' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-700/20 text-slate-400 border border-slate-700/30'
                            }`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2 justify-end">
                              <button 
                                onClick={() => setSelectedCustomer(c)}
                                title="Inspecionar"
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-lg text-sky-400 transition-colors"
                              >
                                <Eye size={13} />
                              </button>
                              {canEdit && (
                                <button 
                                  onClick={() => handleOpenEditModal(c)}
                                  title="Editar Dados"
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-lg text-amber-400 transition-colors"
                                >
                                  <Edit size={13} />
                                </button>
                              )}
                              {canDelete && (
                                <button 
                                  onClick={() => void handleDeleteCustomerClick(c)}
                                  title="Excluir"
                                  className="p-1.5 bg-slate-800 hover:bg-red-500/10 border border-slate-700/60 hover:border-red-500/30 rounded-lg text-red-400 transition-all"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PAGINATION CONTROLS */}
          {filteredCustomers.length > 0 && (
            <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-950/20">
              <div className="text-slate-400 text-xs font-mono">
                Exibindo <span className="text-white font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
                <span className="text-white font-semibold">
                  {Math.min(currentPage * itemsPerPage, filteredCustomers.length)}
                </span>{' '}
                de <span className="text-white font-semibold">{filteredCustomers.length}</span> clientes
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">Por página:</span>
                  <select 
                    value={itemsPerPage} 
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-slate-950 border border-slate-800 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    title="Página Anterior"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-slate-300 font-mono font-bold px-3">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    title="Próxima Página"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* DETAILS INSPECTOR (Lateral Sheet) */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex flex-col shadow-sm gap-5 h-fit lg:sticky lg:top-5 max-h-[calc(100vh-120px)] overflow-y-auto">
          {selectedCustomer ? (
            <div className="space-y-5 animate-fadeIn">
              {/* Inspected Header */}
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-sky-400 block mb-1">Ficha Cadastral</span>
                  <h3 className="text-base font-extrabold text-white tracking-tight leading-tight">{selectedCustomer.name}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">CPF: {selectedCustomer.cpf || 'Não informado'}</p>
                </div>
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1.5 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Core Information Grid */}
              <div className="space-y-3 bg-slate-950/60 border border-slate-800 p-4 rounded-xl text-xs text-slate-300 font-medium">
                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-sky-500 shrink-0" />
                  <span className="font-mono">{selectedCustomer.phone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-sky-500 shrink-0" />
                  <span className="truncate">{selectedCustomer.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={14} className="text-sky-500 shrink-0" />
                  <span>{selectedCustomer.address}, {selectedCustomer.neighborhood} - {selectedCustomer.city}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar size={14} className="text-sky-500 shrink-0" />
                  <span>Aniversário: {new Date(selectedCustomer.birthDate).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Tag size={14} className="text-sky-500 shrink-0" />
                  <span>Origem de Atração: <strong className="text-white font-mono">{selectedCustomer.origin}</strong></span>
                </div>
                {selectedCustomer.notes && (
                  <div className="pt-3 border-t border-slate-800/80 flex gap-2 text-slate-400 text-xs">
                    <FileText size={14} className="text-sky-500 shrink-0" />
                    <span>Obs: {selectedCustomer.notes}</span>
                  </div>
                )}
              </div>

              <section className="space-y-3 bg-slate-950/60 border border-slate-800 p-4 rounded-xl" id="customer-loyalty-card">
                <div className="flex justify-between items-center">
                  <div><h4 className="text-xs font-bold text-white uppercase flex items-center gap-1.5"><Star size={13} className="text-amber-400"/>Cartão fidelidade</h4><p className="text-[10px] text-slate-400 mt-1">{customerLoyaltyBalance} de {loyaltyTarget} marcações</p></div>
                  <div className="flex gap-2">
                    <button type="button" disabled={!canEdit || isSaving || customerLoyaltyBalance === 0} onClick={() => void handleAdjustLoyalty(-1)} className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-red-400 disabled:opacity-40" title="Remover marcação"><Minus size={14}/></button>
                    <button type="button" disabled={!canEdit || isSaving} onClick={() => void handleAdjustLoyalty(1)} className="p-2 rounded-lg bg-sky-600 text-white disabled:opacity-40" title="Adicionar marcação"><Plus size={14}/></button>
                  </div>
                </div>
                <div className="grid grid-cols-10 gap-1.5">
                  {Array.from({ length: loyaltyTarget }, (_, index) => <span key={index} className={`aspect-square rounded-full border flex items-center justify-center text-[9px] font-bold ${index < customerLoyaltyBalance ? 'bg-sky-500 border-sky-400 text-slate-950' : 'border-dashed border-slate-700 text-slate-600'}`}>{index < customerLoyaltyBalance ? '✓' : index + 1}</span>)}
                </div>
                <div className="pt-2 border-t border-slate-800"><h5 className="text-[9px] uppercase text-slate-500 font-bold flex items-center gap-1 mb-2"><History size={11}/>Histórico de alterações</h5><div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {customerLoyaltyEntries.map(entry => <div key={entry.id} className="text-[10px] flex justify-between gap-2 bg-slate-900/60 rounded-lg p-2"><div><span className={entry.delta > 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{entry.delta > 0 ? '+1' : '-1'} marcação</span><p className="text-slate-500">{entry.source === 'referral' ? 'Indicação concluída' : entry.note}</p></div><div className="text-right text-slate-500"><p>{new Date(entry.createdAt).toLocaleString('pt-BR')}</p><p>{entry.actorName || 'Sistema'}</p></div></div>)}
                  {customerLoyaltyEntries.length === 0 && <p className="text-[10px] text-slate-500 italic">Nenhuma alteração registrada.</p>}
                </div></div>
              </section>

              {/* CLIENT-ORIENTED VEHICLE SECTION */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-white font-mono flex items-center gap-1.5 uppercase">
                    <Car size={13} className="text-sky-400" />
                    VEÍCULOS ({customerVehicles.length})
                  </h4>
                  {canCreate && (
                    <button 
                      onClick={handleOpenAddVehicle}
                      className="px-2 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-[10px] flex items-center gap-1 font-bold shadow-md shadow-sky-500/10 cursor-pointer"
                    >
                      <Plus size={10} />
                      <span>Novo Veículo</span>
                    </button>
                  )}
                </div>

                {customerVehicles.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-950/30 border border-slate-850 p-4 rounded-xl text-center">
                    Nenhum veículo vinculado. Adicione o primeiro veículo do cliente.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {customerVehicles.map(v => {
                      // Filter history for this vehicle specifically
                      const vehicleHistory = customerHistory.filter(h => h.vehicleId === v.id);

                      return (
                        <div 
                          key={v.id} 
                          className={`p-3.5 rounded-xl border relative transition-all ${
                            v.isPrincipal 
                              ? 'bg-slate-950 border-sky-500/40 shadow-sm shadow-sky-500/5' 
                              : 'bg-slate-950/40 border-slate-800/60 hover:border-slate-800'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h5 className="text-xs font-extrabold text-white">{v.brand} {v.model}</h5>
                                {v.isPrincipal && (
                                  <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded px-1 py-0.5 text-[7.5px] font-mono font-bold uppercase tracking-wider flex items-center gap-0.5">
                                    <Star size={7} className="fill-current" /> Principal
                                  </span>
                                )}
                              </div>
                              <div className="text-[10.5px] text-slate-400 font-mono mt-0.5">
                                {v.color} • {v.year} • Porte: <strong className="text-slate-300 font-medium">{v.porte || 'Médio'}</strong>
                              </div>
                            </div>
                            <span className="bg-sky-500/10 text-sky-400 font-bold font-mono text-[9.5px] border border-sky-500/15 px-2 py-0.5 rounded-md uppercase shrink-0">
                              {v.plate}
                            </span>
                          </div>

                          {/* Actions Bar for individual vehicle */}
                          <div className="mt-3.5 pt-2 border-t border-slate-900 flex justify-between items-center text-[10px]">
                            <div className="flex gap-2">
                              {canEdit && !v.isPrincipal && (
                                <button
                                  onClick={() => handleSetPrincipalVehicle(v.id)}
                                  className="text-slate-400 hover:text-sky-400 transition-colors flex items-center gap-1 font-semibold"
                                  title="Marcar como veículo principal"
                                >
                                  <Star size={11} />
                                  <span>Definir Principal</span>
                                </button>
                              )}
                            </div>
                            <div className="flex gap-3">
                              {canEdit && (
                                <button
                                  onClick={() => handleOpenEditVehicle(v)}
                                  className="text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1 font-semibold"
                                >
                                  <Edit size={11} />
                                  <span>Editar</span>
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => void handleDeleteVehicleClick(v.id)}
                                  className="text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1 font-semibold"
                                >
                                  <Trash2 size={11} />
                                  <span>Excluir</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Specific Vehicle service history */}
                          <div className="mt-3 pt-2 border-t border-slate-900/60 bg-slate-950/20 rounded-lg">
                            <span className="text-[9px] uppercase font-mono text-slate-500 block mb-1">Histórico deste veículo:</span>
                            {vehicleHistory.length === 0 ? (
                              <p className="text-[10px] text-slate-500 italic">Nenhum serviço registrado para este veículo.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-24 overflow-y-auto scrollbar-thin pr-1">
                                {vehicleHistory.map(h => (
                                  <div key={h.id} className="text-[10px] bg-slate-900/30 border border-slate-850 p-1.5 rounded flex justify-between items-center">
                                    <div>
                                      <span className="font-semibold text-slate-200 block truncate max-w-[140px]">
                                        {h.serviceName}
                                      </span>
                                      <span className="text-[8px] font-mono text-slate-400">
                                        {new Date(h.date).toLocaleDateString('pt-BR')} • {h.employeeResponsible.split(' ')[0]}
                                      </span>
                                    </div>
                                    <span className="text-emerald-400 font-bold font-mono text-[9px]">
                                      R$ {h.value.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Client historical treatments */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-white font-mono flex items-center gap-1.5 uppercase border-b border-slate-800 pb-2">
                  <Users size={13} className="text-sky-400" />
                  HISTÓRICO FINANCEIRO TOTAL ({customerHistory.length})
                </h4>

                {customerHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhum serviço realizado anteriormente.</p>
                ) : (
                  <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                    {customerHistory.map(h => (
                      <div key={h.id} className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between">
                          <strong className="text-white font-bold">{h.serviceName}</strong>
                          <span className="text-emerald-400 font-bold font-mono">R$ {h.value.toFixed(2)}</span>
                        </div>
                        <p className="text-slate-400 text-[11px] font-mono">
                          Realizado em {new Date(h.date).toLocaleDateString('pt-BR')} por {h.employeeResponsible}
                        </p>
                        {h.notes && <p className="text-slate-400 text-[11px] italic">Obs: {h.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-center text-slate-500 p-6">
              <Users size={36} className="text-slate-600 mb-2 animate-pulse" />
              <p className="text-sm font-semibold">Nenhum cliente selecionado</p>
              <p className="text-xs mt-1 text-slate-400/80">
                Selecione um cliente da lista ao lado para ver sua ficha completa, gerenciar seus veículos e acompanhar o histórico de atendimentos.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: CADASTRO CLIENTE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Novo Cadastro de Cliente</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
              {errorMessage && (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-mono">
                  {errorMessage}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Nome Completo *</label>
                  <input 
                    type="text" 
                    required
                    disabled={isSaving}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white disabled:opacity-50"
                    placeholder="Ex: João da Silva Santos"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Telefone Celular *</label>
                  <input 
                    type="text" 
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                    placeholder="Ex: (11) 98888-7777"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">E-mail *</label>
                  <input 
                    type="email" 
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                    placeholder="Ex: joao.silva@gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">CPF (Opcional)</label>
                  <input 
                    type="text" 
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                    placeholder="Ex: 000.000.000-00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Data de Nascimento *</label>
                  <input 
                    type="date" 
                    required
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Endereço Completo</label>
                  <input 
                    type="text" 
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                    placeholder="Ex: Av. Paulista, 1000 - Apto 12"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Bairro</label>
                  <input 
                    type="text" 
                    value={formData.neighborhood}
                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                    placeholder="Ex: Bela Vista"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Origem do Cliente</label>
                  <select 
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="Indicação">Indicação de Amigo</option>
                    <option value="Google">Google Pesquisa</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Outros">Outros canais</option>
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Observações Internas</label>
                  <textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white h-16 resize-none"
                    placeholder="Ex: Cliente detalhista, tem preferência de horário, etc..."
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3 text-xs">
                <button 
                  type="button" 
                  disabled={isSaving}
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Concluir Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIÇÃO CLIENTE */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Editar Cadastro de Cliente</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              {errorMessage && (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-mono">
                  {errorMessage}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Nome Completo *</label>
                  <input 
                    type="text" 
                    required
                    disabled={isSaving}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Telefone Celular *</label>
                  <input 
                    type="text" 
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">E-mail *</label>
                  <input 
                    type="email" 
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">CPF (Opcional)</label>
                  <input 
                    type="text" 
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Data de Nascimento *</label>
                  <input 
                    type="date" 
                    required
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Endereço Completo</label>
                  <input 
                    type="text" 
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Bairro</label>
                  <input 
                    type="text" 
                    value={formData.neighborhood}
                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Status Atendimento</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ativo' | 'inativo' })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Origem</label>
                  <select 
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="Indicação">Indicação de Amigo</option>
                    <option value="Google">Google Pesquisa</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Outros">Outros canais</option>
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Observações Internas</label>
                  <textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-white h-16 resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3 text-xs">
                <button 
                  type="button" 
                  disabled={isSaving}
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR VEÍCULO */}
      {isAddVehicleOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Novo Veículo</h3>
                <p className="text-[10px] text-sky-400 font-mono">Vincular a: {selectedCustomer.name}</p>
              </div>
              <button onClick={() => setIsAddVehicleOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddVehicleSubmit} className="p-5 space-y-4 text-xs">
              {errorMessage && (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-mono">
                  {errorMessage}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Fabricante (Marca) *</label>
                  <select
                    required
                    disabled={isSaving}
                    value={vehicleData.brand}
                    onChange={(e) => handleVehicleBrandChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                    data-testid="admin-vehicle-brand"
                  >
                    <option value="" disabled>Selecione...</option>
                    {availableBrandNames.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Modelo *</label>
                  <select
                    required
                    disabled={isSaving || !vehicleData.brand}
                    value={vehicleData.model}
                    onChange={(e) => handleVehicleModelChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                    data-testid="admin-vehicle-model"
                  >
                    <option value="" disabled>Selecione...</option>
                    {availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Ano *</label>
                  <input 
                    type="text" 
                    required
                    disabled={isSaving}
                    value={vehicleData.year}
                    onChange={(e) => setVehicleData({ ...vehicleData, year: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                    placeholder="Ex: 2021"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Placa (Única) *</label>
                  <input 
                    type="text" 
                    required
                    disabled={isSaving}
                    value={vehicleData.plate}
                    onChange={(e) => setVehicleData({ ...vehicleData, plate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white uppercase disabled:opacity-50"
                    placeholder="Ex: ABC1D23"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Cor Predominante *</label>
                  <input 
                    type="text" 
                    required
                    disabled={isSaving}
                    value={vehicleData.color}
                    onChange={(e) => setVehicleData({ ...vehicleData, color: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                    placeholder="Ex: Cinza"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Porte do Veículo *</label>
                  <select
                    value={vehicleData.porte}
                    disabled
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-70"
                    data-testid="admin-vehicle-porte"
                  >
                    <option value="Pequeno">Pequeno (P)</option>
                    <option value="Médio">Médio (M)</option>
                    <option value="Grande">Grande (G)</option>
                  </select>
                </div>
                <div className="col-span-2 flex items-center gap-2 mt-2">
                  <input 
                    type="checkbox"
                    id="isPrincipalAdd"
                    checked={vehicleData.isPrincipal}
                    onChange={(e) => setVehicleData({ ...vehicleData, isPrincipal: e.target.checked })}
                    className="w-4 h-4 bg-slate-950 border border-slate-800 text-sky-500 focus:ring-sky-500 rounded"
                  />
                  <label htmlFor="isPrincipalAdd" className="text-xs text-slate-300 select-none cursor-pointer">
                    Definir este como veículo principal do cliente
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3 text-xs">
                <button 
                  type="button" 
                  disabled={isSaving}
                  onClick={() => setIsAddVehicleOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? 'Vinculando...' : 'Vincular Veículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR VEÍCULO */}
      {isEditVehicleOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Editar Veículo</h3>
                <p className="text-[10px] text-sky-400 font-mono">Do cliente: {selectedCustomer.name}</p>
              </div>
              <button onClick={() => setIsEditVehicleOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleEditVehicleSubmit} className="p-5 space-y-4 text-xs">
              {errorMessage && (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-mono">
                  {errorMessage}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Fabricante (Marca) *</label>
                  <select
                    required
                    disabled={isSaving}
                    value={vehicleData.brand}
                    onChange={(e) => handleVehicleBrandChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                    data-testid="admin-vehicle-brand"
                  >
                    <option value="" disabled>Selecione...</option>
                    {availableBrandNames.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Modelo *</label>
                  <select
                    required
                    disabled={isSaving || !vehicleData.brand}
                    value={vehicleData.model}
                    onChange={(e) => handleVehicleModelChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                    data-testid="admin-vehicle-model"
                  >
                    <option value="" disabled>Selecione...</option>
                    {availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Ano *</label>
                  <input 
                    type="text" 
                    required
                    disabled={isSaving}
                    value={vehicleData.year}
                    onChange={(e) => setVehicleData({ ...vehicleData, year: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Placa *</label>
                  <input 
                    type="text" 
                    required
                    disabled={isSaving}
                    value={vehicleData.plate}
                    onChange={(e) => setVehicleData({ ...vehicleData, plate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white uppercase disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Cor Predominante *</label>
                  <input 
                    type="text" 
                    required
                    disabled={isSaving}
                    value={vehicleData.color}
                    onChange={(e) => setVehicleData({ ...vehicleData, color: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Porte do Veículo *</label>
                  <select
                    value={vehicleData.porte}
                    disabled
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-70"
                    data-testid="admin-vehicle-porte"
                  >
                    <option value="Pequeno">Pequeno (P)</option>
                    <option value="Médio">Médio (M)</option>
                    <option value="Grande">Grande (G)</option>
                  </select>
                </div>
                <div className="col-span-2 flex items-center gap-2 mt-2">
                  <input 
                    type="checkbox"
                    id="isPrincipalEdit"
                    checked={vehicleData.isPrincipal}
                    onChange={(e) => setVehicleData({ ...vehicleData, isPrincipal: e.target.checked })}
                    className="w-4 h-4 bg-slate-950 border border-slate-800 text-sky-500 focus:ring-sky-500 rounded"
                  />
                  <label htmlFor="isPrincipalEdit" className="text-xs text-slate-300 select-none cursor-pointer">
                    Definir este como veículo principal do cliente
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3 text-xs">
                <button 
                  type="button" 
                  disabled={isSaving}
                  onClick={() => setIsEditVehicleOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
