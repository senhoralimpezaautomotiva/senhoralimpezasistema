/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { dbInstance, hasModulePermission, mapDbUserToFrontend } from './db/localDb';
import { Customer, Vehicle, Service, Appointment, CashTransaction, SystemConfig, AutomationTrigger, AutomationLog, AppointmentStatus, VehicleModel, User, CreateUserInput, CommissionRecord, SystemModuleId } from './types';
import { ShieldAlert, LogOut, LayoutDashboard } from 'lucide-react';

const ALL_MODULE_IDS: SystemModuleId[] = [
  'dashboard',
  'clientes',
  'servicos',
  'agenda',
  'historico',
  'financeiro',
  'relatorios',
  'usuarios',
  'mensagens',
  'automacoes',
  'indicacoes',
  'configuracoes'
];

// Importing modules
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import DashboardModule from './components/DashboardModule';
import ClientesModule from './components/ClientesModule';
import ServicosModule from './components/ServicosModule';
import AgendaModule from './components/AgendaModule';
import HistoricoModule from './components/HistoricoModule';
import FinanceiroModule from './components/FinanceiroModule';
import RelatoriosModule from './components/RelatoriosModule';
import UsuariosModule from './components/UsuariosModule';
import AutomacoesModule from './components/AutomacoesModule';
import AutomacoesTab from './components/AutomacoesTab';
import IndicacoesModule from './components/IndicacoesModule';
import ConfiguracoesModule from './components/ConfiguracoesModule';
import ClientPortal from './components/ClientPortal';

export default function App() {
  // Session authentication state
  const [user, setUser] = useState<(User & { authProvider?: 'supabase' }) | null>(null);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [authError, setAuthError] = useState('');
  
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Client Portal routing active state
  const [isClientPortal, setIsClientPortal] = useState<boolean>(false);

  // React state copies of dbInstance datasets for immediate reactive rendering
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [finances, setFinances] = useState<CashTransaction[]>([]);
  const [config, setConfig] = useState<SystemConfig>(dbInstance.config);
  const [automations, setAutomations] = useState<AutomationTrigger[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [vehicleModels, setVehicleModels] = useState<VehicleModel[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);

  // Restore and monitor the real Supabase Auth session.
  useEffect(() => {
    const supabase = dbInstance.getSupabaseClient();
    let disposed = false;
    let profileRequestId = 0;
    let lastHandledAccessToken: string | null = null;

    // These legacy values are no longer accepted as authentication sources.
    localStorage.removeItem('sl_session_user');
    localStorage.removeItem('sl_remembered_password');

    const applySession = async (session: Session | null, force = false) => {
      const accessToken = session?.access_token || null;
      if (!force && accessToken && accessToken === lastHandledAccessToken) return;
      lastHandledAccessToken = accessToken;

      const currentRequestId = ++profileRequestId;

      if (!session?.user) {
        if (!disposed) {
          setUser(null);
          setAuthInitializing(false);
        }
        return;
      }

      if (!disposed) {
        setAuthInitializing(true);
        setAuthError('');
      }

      try {
        const { data: profileRow, error: profileError } = await supabase
          .from('usuarios')
          .select(`
            id,
            auth_user_id,
            nome,
            email,
            telefone,
            status,
            perfil,
            foto_url,
            permissions,
            commissions,
            default_commission_percent,
            created_at,
            updated_at
          `)
          .eq('auth_user_id', session.user.id)
          .maybeSingle();

        if (disposed || currentRequestId !== profileRequestId) return;

        if (profileError) {
          throw new Error(`Não foi possível carregar o perfil do usuário: ${profileError.message}`);
        }

        if (!profileRow) {
          throw new Error(
            'Perfil não encontrado para o usuário autenticado. Verifique se public.usuarios.auth_user_id corresponde ao ID do usuário no Supabase Auth.'
          );
        }

        if (profileRow.auth_user_id !== session.user.id) {
          throw new Error('O perfil retornado não corresponde ao usuário autenticado.');
        }

        const profile = mapDbUserToFrontend(profileRow);
        if (profile.status !== 'ativo') {
          throw new Error('Sua conta de usuário está inativa. Entre em contato com o administrador do sistema.');
        }

        setUser({ ...profile, authProvider: 'supabase' });
      } catch (error: any) {
        if (!disposed && currentRequestId === profileRequestId) {
          setUser(null);
          setAuthError(error.message || 'Não foi possível validar o perfil autenticado.');
        }

        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error('Erro ao encerrar sessão inválida do Supabase:', signOutError);
        }
      } finally {
        if (!disposed && currentRequestId === profileRequestId) {
          setAuthInitializing(false);
        }
      }
    };

    const restoreSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (disposed) return;

      if (error) {
        setUser(null);
        setAuthError(`Não foi possível restaurar a sessão: ${error.message}`);
        setAuthInitializing(false);
        return;
      }

      await applySession(data.session, true);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Keep the auth callback synchronous and load the profile just after it returns.
      window.setTimeout(() => {
        void applySession(session);
      }, 0);
    });

    void restoreSession();

    return () => {
      disposed = true;
      profileRequestId++;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Hydrate all non-authentication states on mount
  useEffect(() => {

    // Register sync callback to dynamically re-render React components
    dbInstance.onSyncCallback = () => {
      syncWithDatabase();
    };

    // Initial load from offline cache
    syncWithDatabase();

    // Check url search parameter or hash for client portal
    const checkPortalUrl = () => {
      const isPortal = window.location.search.includes('portal=true') || window.location.hash.includes('portal');
      if (isPortal) {
        setIsClientPortal(true);
      }
    };
    checkPortalUrl();
    window.addEventListener('hashchange', checkPortalUrl);
    window.addEventListener('popstate', checkPortalUrl);

    // Fetch live data if Supabase connection is active
    if (dbInstance.config.useRealSupabase) {
      dbInstance.syncWithSupabase();
    }

    return () => {
      window.removeEventListener('hashchange', checkPortalUrl);
      window.removeEventListener('popstate', checkPortalUrl);
    };
  }, []);

  // Synchronize CSS class with active system theme
  useEffect(() => {
    const activeTheme = config.theme || 'dark';
    if (activeTheme === 'light') {
      document.documentElement.classList.add('theme-light');
      document.documentElement.classList.remove('theme-dark');
    } else {
      document.documentElement.classList.add('theme-dark');
      document.documentElement.classList.remove('theme-light');
    }
  }, [config.theme]);

  // Helper to sync local state with the central DB instance
  const syncWithDatabase = () => {
    setCustomers([...dbInstance.customers]);
    setVehicles([...dbInstance.vehicles]);
    setServices([...dbInstance.services]);
    setAppointments([...dbInstance.appointments]);
    setHistory([...dbInstance.history]);
    setFinances([...dbInstance.finances]);
    setConfig({ ...dbInstance.config });
    setAutomations([...dbInstance.automations]);
    setLogs([...dbInstance.logs]);
    setVehicleModels([...dbInstance.vehicleModels]);
    setUsers([...dbInstance.users]);
    setCommissions([...dbInstance.commissions]);

    // Keep the in-memory profile permissions up to date with DB state.
    setUser(prevUser => {
      if (!prevUser) return null;
      const authenticatedUserId = prevUser.authUserId;
      const latestInDb = dbInstance.users.find(
        candidate => authenticatedUserId && candidate.authUserId === authenticatedUserId
      );
      if (latestInDb) {
        return { ...prevUser, ...latestInDb };
      }
      return prevUser;
    });
  };

  // Automatically adjust activeTab if user lacks permission for current activeTab
  useEffect(() => {
    if (user) {
      const isAllowed = hasModulePermission(user as any, activeTab as SystemModuleId, 'view');
      if (!isAllowed) {
        const allowedModule = ALL_MODULE_IDS.find(id => hasModulePermission(user as any, id, 'view'));
        if (allowedModule) {
          setActiveTab(allowedModule);
        }
      }
    }
  }, [user, activeTab]);

  // User & Commission handlers
  const handleAddUser = async (u: CreateUserInput) => {
    const newUser = await dbInstance.addUser(u);
    syncWithDatabase();
    return newUser;
  };

  const handleUpdateUser = async (id: string, u: Partial<User>) => {
    await dbInstance.updateUser(id, u);
    syncWithDatabase();
  };

  const handleDeleteUser = async (id: string) => {
    await dbInstance.deleteUser(id);
    syncWithDatabase();
  };

  const handleMarkCommissionAsPaid = (id: string, notes?: string) => {
    dbInstance.markCommissionAsPaid(id, notes);
    syncWithDatabase();
  };

  const handleMarkBulkCommissionsAsPaid = (ids: string[], notes?: string) => {
    dbInstance.markBulkCommissionsAsPaid(ids, notes);
    syncWithDatabase();
  };

  // Auth handlers
  const handleProfileUpdate = (updatedUser: any) => {
    setUser(updatedUser);
  };

  const handleLogout = async () => {
    const supabase = dbInstance.getSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Erro ao sair do Supabase:', error);
      return;
    }

    setUser(null);
    setAuthError('');
  };

  // Customer handlers
  const handleAddCustomer = async (c: Omit<Customer, 'id' | 'clientSince' | 'lastServiceDate'>) => {
    try {
      const newCustomer = await dbInstance.addCustomer(c);
      syncWithDatabase();
      return newCustomer;
    } catch (e) {
      console.error('Erro ao adicionar cliente:', e);
      throw e;
    }
  };

  const handleUpdateCustomer = async (id: string, c: Partial<Customer>) => {
    try {
      await dbInstance.updateCustomer(id, c);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao atualizar cliente:', e);
      throw e;
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      await dbInstance.deleteCustomer(id);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao excluir cliente:', e);
      throw e;
    }
  };

  // Vehicle handlers
  const handleAddVehicle = async (v: Omit<Vehicle, 'id'>) => {
    try {
      const newVehicle = await dbInstance.addVehicle(v);
      syncWithDatabase();
      return newVehicle;
    } catch (e) {
      console.error('Erro ao adicionar veículo:', e);
      throw e;
    }
  };

  const handleUpdateVehicle = async (id: string, v: Partial<Vehicle>) => {
    try {
      await dbInstance.updateVehicle(id, v);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao atualizar veículo:', e);
      throw e;
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    try {
      await dbInstance.deleteVehicle(id);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao excluir veículo:', e);
      throw e;
    }
  };

  // Vehicle Model handlers
  const handleAddVehicleModel = async (model: Omit<VehicleModel, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await dbInstance.addVehicleModel(model);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao adicionar modelo de veículo:', e);
      throw e;
    }
  };

  const handleUpdateVehicleModel = async (id: string, updated: Partial<VehicleModel>) => {
    try {
      await dbInstance.updateVehicleModel(id, updated);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao atualizar modelo de veículo:', e);
      throw e;
    }
  };

  const handleDeleteVehicleModel = async (id: string) => {
    try {
      await dbInstance.deleteVehicleModel(id);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao excluir modelo de veículo:', e);
      throw e;
    }
  };

  // Service handlers
  const handleAddService = async (s: Omit<Service, 'id'>) => {
    try {
      await dbInstance.addService(s);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao adicionar serviço:', e);
      throw e;
    }
  };

  const handleUpdateService = async (id: string, s: Partial<Service>) => {
    try {
      await dbInstance.updateService(id, s);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao atualizar serviço:', e);
      throw e;
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await dbInstance.deleteService(id);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao excluir serviço:', e);
      throw e;
    }
  };

  // Appointment handlers
  const handleAddAppointment = async (appt: Omit<Appointment, 'id'>) => {
    try {
      await dbInstance.addAppointment(appt);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao adicionar agendamento:', e);
      throw e;
    }
  };

  const handleUpdateAppointmentStatus = async (id: string, status: AppointmentStatus, notes?: string) => {
    try {
      await dbInstance.updateAppointmentStatus(id, status, notes);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao atualizar status do agendamento:', e);
      throw e;
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      await dbInstance.deleteAppointment(id);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao excluir agendamento:', e);
      throw e;
    }
  };

  // Finances handlers
  const handleAddTransaction = async (t: Omit<CashTransaction, 'id'>) => {
    try {
      await dbInstance.addTransaction(t);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao adicionar transação:', e);
      throw e;
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await dbInstance.deleteTransaction(id);
      syncWithDatabase();
    } catch (e) {
      console.error('Erro ao deletar transação:', e);
      throw e;
    }
  };

  // Automation triggers handlers
  const handleUpdateAutomationTrigger = (id: string, updated: Partial<AutomationTrigger>) => {
    dbInstance.updateAutomationTrigger(id, updated);
    syncWithDatabase();
  };

  const handleTestTrigger = (id: string) => {
    dbInstance.testTrigger(id);
    syncWithDatabase();
  };

  const handleResetLogs = () => {
    dbInstance.logs = [];
    dbInstance.save();
    syncWithDatabase();
  };

  // Config handler
  const handleUpdateConfig = (updated: Partial<SystemConfig>) => {
    dbInstance.updateConfig(updated);
    syncWithDatabase();
  };

  // If Client Portal is active, render it directly (fully separated from admin)
  if (isClientPortal) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-y-auto">
        {/* Decorative background gradients */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-slate-500/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />
        <ClientPortal 
          config={config}
          onBackToAdmin={() => {
            setIsClientPortal(false);
            window.history.pushState({}, '', window.location.pathname);
          }}
          onSyncNeeded={syncWithDatabase}
        />
      </div>
    );
  }

  // Do not render an administrative state before Supabase validates the session/profile.
  if (authInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-sky-500 animate-spin" />
          <span className="text-xs font-mono">Validando sessão...</span>
        </div>
      </div>
    );
  }

  // If user is not authenticated, render Login Screen
  if (!user) {
    return <LoginScreen authError={authError} onGoToPortal={() => setIsClientPortal(true)} />;
  }

  // Render correct dashboard component based on selected sidebar tab
  const renderTabContent = () => {
    if (!user) return null;

    if (!hasModulePermission(user as any, activeTab as SystemModuleId, 'view')) {
      const allowedModule = ALL_MODULE_IDS.find(id => hasModulePermission(user as any, id, 'view'));
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 shadow-lg shadow-red-500/5">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Acesso Negado</h2>
          <p className="text-slate-400 text-sm max-w-md mb-6">
            Seu usuário não possui permissão para visualizar o módulo <span className="font-semibold text-slate-200">{activeTab}</span>. Entre em contato com o administrador para solicitar acesso.
          </p>
          {allowedModule ? (
            <button
              onClick={() => setActiveTab(allowedModule)}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs rounded-xl transition-all shadow-md shadow-sky-500/20 flex items-center gap-2"
            >
              <LayoutDashboard className="w-4 h-4" />
              Ir para Módulo Permitido
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-all flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair do Sistema
            </button>
          )}
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardModule 
            customers={customers}
            vehicles={vehicles}
            services={services}
            appointments={appointments}
            history={history}
            finances={finances}
            config={config}
            onNavigate={setActiveTab}
            onUpdateStatus={(id, status) => handleUpdateAppointmentStatus(id, status)}
            onAddAppointment={handleAddAppointment}
            onUpdateAppointment={async (id, updated) => {
              try {
                await dbInstance.updateAppointment(id, updated);
                syncWithDatabase();
              } catch (e) {
                console.error('Erro ao atualizar agendamento:', e);
              }
            }}
            onDeleteAppointment={handleDeleteAppointment}
            onAddCustomer={handleAddCustomer}
            onAddVehicle={handleAddVehicle}
          />
        );
      case 'clientes':
        return (
          <ClientesModule 
            customers={customers}
            vehicles={vehicles}
            history={history}
            currentUser={user}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onAddVehicle={handleAddVehicle}
            onUpdateVehicle={handleUpdateVehicle}
            onDeleteVehicle={handleDeleteVehicle}
          />
        );
      case 'servicos':
        return (
          <ServicosModule 
            services={services}
            currentUser={user}
            onAddService={handleAddService}
            onUpdateService={handleUpdateService}
            onDeleteService={handleDeleteService}
          />
        );
      case 'agenda':
        return (
          <AgendaModule 
            appointments={appointments}
            customers={customers}
            vehicles={vehicles}
            services={services}
            users={users}
            config={config}
            currentUser={user}
            onAddAppointment={handleAddAppointment}
            onUpdateStatus={handleUpdateAppointmentStatus}
            onDeleteAppointment={handleDeleteAppointment}
            onUpdateAppointment={async (id, updated) => {
              try {
                await dbInstance.updateAppointment(id, updated);
                syncWithDatabase();
              } catch (e) {
                console.error('Erro ao atualizar agendamento:', e);
              }
            }}
          />
        );
      case 'historico':
        return <HistoricoModule history={history} />;
      case 'financeiro':
        return (
          <FinanceiroModule 
            finances={finances}
            currentUser={user}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        );
      case 'relatorios':
        return (
          <RelatoriosModule 
            customers={customers}
            vehicles={vehicles}
            history={history}
            finances={finances}
            appointments={appointments}
            config={config}
          />
        );
      case 'usuarios':
        return (
          <UsuariosModule 
            users={users}
            services={services}
            appointments={appointments}
            commissions={commissions}
            currentUser={user}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onMarkCommissionAsPaid={handleMarkCommissionAsPaid}
            onMarkBulkCommissionsAsPaid={handleMarkBulkCommissionsAsPaid}
          />
        );
      case 'mensagens':
        return (
          <AutomacoesModule 
            automations={automations}
            logs={logs}
            config={config}
            currentUser={user}
            onUpdateTrigger={handleUpdateAutomationTrigger}
            onTestTrigger={handleTestTrigger}
            onResetLogs={handleResetLogs}
          />
        );
      case 'automacoes':
        return (
          <AutomacoesTab 
            automations={automations}
            appointments={appointments}
            customers={customers}
            vehicles={vehicles}
            services={services}
            logs={logs}
            currentUser={user}
            onUpdateTrigger={handleUpdateAutomationTrigger}
            onSyncNeeded={syncWithDatabase}
          />
        );
      case 'indicacoes':
        return (
          <IndicacoesModule 
            customers={customers}
            appointments={appointments}
            config={config}
            currentUser={user}
            onUpdateConfig={handleUpdateConfig}
          />
        );
      case 'configuracoes':
        return (
          <ConfiguracoesModule 
            config={config}
            onUpdateConfig={handleUpdateConfig}
            currentUser={user}
            onUpdateCurrentUser={handleProfileUpdate}
          />
        );
      default:
        return <div className="text-white text-xs p-5">Módulo indisponível ou em desenvolvimento.</div>;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-100 overflow-hidden" id="app-layout">
      {/* Navigation Sidebar */}
      <Sidebar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        config={config}
      />

      {/* Main Container viewport */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Top Mini Header */}
        <header className="h-14 border-b border-slate-900 bg-slate-950/40 px-6 flex justify-between items-center shrink-0">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
            Painel Administrativo &gt; <span className="text-sky-400 capitalize font-medium">{activeTab}</span>
          </span>
          <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-850/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Sistema Local (Sincronizado)</span>
          </div>
        </header>

        {/* Dynamic viewport scroll container */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
}
