/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { dbInstance, hasModulePermission, mapDbUserToFrontend } from './db/localDb';
import { Customer, Vehicle, Service, Appointment, CashTransaction, SystemConfig, AutomationTrigger, AppointmentStatus, User, CreateUserInput, CommissionRecord, SystemModuleId, HistoryRecord, Budget, BudgetDraft, BudgetStatus, LoyaltyCardEntry } from './types';
import { ShieldAlert, LogOut, LayoutDashboard } from 'lucide-react';
import { safeLog } from './security/safeOutput';
import { isClientPortalEnabled } from './config/publicEnvironment';

const ALL_MODULE_IDS: SystemModuleId[] = [
  'dashboard',
  'clientes',
  'servicos',
  'orcamentos',
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

import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';

const DashboardModule = lazy(() => import('./components/DashboardModule'));
const ClientesModule = lazy(() => import('./components/ClientesModule'));
const ServicosModule = lazy(() => import('./components/ServicosModule'));
const OrcamentosModule = lazy(() => import('./components/OrcamentosModule'));
const AgendaModule = lazy(() => import('./components/AgendaModule'));
const HistoricoModule = lazy(() => import('./components/HistoricoModule'));
const FinanceiroModule = lazy(() => import('./components/FinanceiroModule'));
const RelatoriosModule = lazy(() => import('./components/RelatoriosModule'));
const UsuariosModule = lazy(() => import('./components/UsuariosModule'));
const AutomacoesModule = lazy(() => import('./components/AutomacoesModule'));
const AutomacoesTab = lazy(() => import('./components/AutomacoesTab'));
const IndicacoesModule = lazy(() => import('./components/IndicacoesModule'));
const ConfiguracoesModule = lazy(() => import('./components/ConfiguracoesModule'));
const CLIENT_PORTAL_ENABLED = isClientPortalEnabled();
const ClientPortal = CLIENT_PORTAL_ENABLED
  ? lazy(() => import('./components/ClientPortal'))
  : null;

const ModuleLoader = () => (
  <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 text-slate-400">
    <div className="w-7 h-7 rounded-full border-2 border-slate-700 border-t-sky-500 animate-spin" />
    <span className="text-xs font-mono">Carregando módulo...</span>
  </div>
);

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
  const [loyaltyEntries, setLoyaltyEntries] = useState<LoyaltyCardEntry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [finances, setFinances] = useState<CashTransaction[]>([]);
  const [config, setConfig] = useState<SystemConfig>(dbInstance.config);
  const [automations, setAutomations] = useState<AutomationTrigger[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const adminAutoRefreshInFlightRef = useRef(false);

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
        safeLog('error', 'authentication.profile.validate', 'error', { error });
        if (!disposed && currentRequestId === profileRequestId) {
          setUser(null);
          setAuthError('Não foi possível validar o perfil autenticado.');
        }

        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          safeLog('error', 'authentication.invalid_session.sign_out', 'error', {
            error: signOutError
          });
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
        safeLog('error', 'authentication.session.restore', 'error', { error });
        setAuthError('Não foi possível restaurar a sessão.');
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
      const isPortal =
        CLIENT_PORTAL_ENABLED &&
        (window.location.search.includes('portal=true') ||
          window.location.hash.includes('portal'));
      setIsClientPortal(isPortal);
    };
    checkPortalUrl();
    window.addEventListener('hashchange', checkPortalUrl);
    window.addEventListener('popstate', checkPortalUrl);

    return () => {
      window.removeEventListener('hashchange', checkPortalUrl);
      window.removeEventListener('popstate', checkPortalUrl);
    };
  }, []);

  // Dados operacionais só são sincronizados depois que o perfil administrativo
  // autenticado e ativo foi validado. O portal usa um cliente Supabase isolado.
  useEffect(() => {
    if (!user || isClientPortal || !config.useRealSupabase) return;

    const refreshAdminData = async () => {
      if (adminAutoRefreshInFlightRef.current) return;
      adminAutoRefreshInFlightRef.current = true;
      try {
        await dbInstance.syncWithSupabase();
      } finally {
        adminAutoRefreshInFlightRef.current = false;
      }
    };

    void refreshAdminData();
    const intervalId = window.setInterval(() => {
      void refreshAdminData();
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user?.id, isClientPortal, config.useRealSupabase]);

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
    setLoyaltyEntries([...dbInstance.loyaltyEntries]);
    setVehicles([...dbInstance.vehicles]);
    setServices([...dbInstance.services]);
    setAppointments([...dbInstance.appointments]);
    setBudgets([...dbInstance.budgets]);
    setHistory([...dbInstance.history]);
    setFinances([...dbInstance.finances]);
    setConfig({ ...dbInstance.config });
    setAutomations([...dbInstance.automations]);
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
      const isAllowed = hasModulePermission(user, activeTab as SystemModuleId, 'view');
      if (!isAllowed) {
        const allowedModule = ALL_MODULE_IDS.find(id => hasModulePermission(user, id, 'view'));
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
  const handleProfileUpdate = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const handleLogout = async () => {
    const supabase = dbInstance.getSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      safeLog('error', 'authentication.sign_out', 'error', { error });
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
      safeLog('error', 'customer.create', 'error', { error: e });
      throw e;
    }
  };

  const handleUpdateCustomer = async (id: string, c: Partial<Customer>) => {
    try {
      await dbInstance.updateCustomer(id, c);
      syncWithDatabase();
    } catch (e) {
      safeLog('error', 'customer.update', 'error', { entityId: id, error: e });
      throw e;
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      await dbInstance.deleteCustomer(id);
      syncWithDatabase();
    } catch (e) {
      safeLog('error', 'customer.delete', 'error', { entityId: id, error: e });
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
      safeLog('error', 'vehicle.create', 'error', { error: e });
      throw e;
    }
  };

  const handleUpdateVehicle = async (id: string, v: Partial<Vehicle>) => {
    try {
      await dbInstance.updateVehicle(id, v);
      syncWithDatabase();
    } catch (e) {
      safeLog('error', 'vehicle.update', 'error', { entityId: id, error: e });
      throw e;
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    try {
      await dbInstance.deleteVehicle(id);
      syncWithDatabase();
    } catch (e) {
      safeLog('error', 'vehicle.delete', 'error', { entityId: id, error: e });
      throw e;
    }
  };

  // Service handlers
  const handleAddService = async (s: Omit<Service, 'id'>) => {
    try {
      await dbInstance.addService(s);
      syncWithDatabase();
    } catch (e) {
      safeLog('error', 'service.create', 'error', { error: e });
      throw e;
    }
  };

  const handleUpdateService = async (id: string, s: Partial<Service>) => {
    try {
      await dbInstance.updateService(id, s);
      syncWithDatabase();
    } catch (e) {
      safeLog('error', 'service.update', 'error', { entityId: id, error: e });
      throw e;
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await dbInstance.deleteService(id);
      syncWithDatabase();
    } catch (e) {
      safeLog('error', 'service.delete', 'error', { entityId: id, error: e });
      throw e;
    }
  };

  // Appointment handlers
  const handleAddAppointment = async (appt: Omit<Appointment, 'id'>) => {
    try {
      await dbInstance.addAppointment(appt);
      syncWithDatabase();
    } catch (e) {
      safeLog('error', 'appointment.create', 'error', { error: e });
      throw e;
    }
  };

  const handleUpdateAppointmentStatus = async (id: string, status: AppointmentStatus, notes?: string) => {
    try {
      await dbInstance.updateAppointmentStatus(id, status, notes);
      syncWithDatabase();
    } catch (e) {
      safeLog('error', 'appointment.status.update', 'error', { entityId: id, error: e });
      throw e;
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      await dbInstance.deleteAppointment(id);
      syncWithDatabase();
    } catch (e) {
      safeLog('error', 'appointment.delete', 'error', { entityId: id, error: e });
      throw e;
    }
  };

  const handleSaveBudget = async (draft: BudgetDraft) => {
    const budget = await dbInstance.saveBudget(draft);
    syncWithDatabase();
    return budget;
  };

  const handleSendBudget = async (id: string) => {
    await dbInstance.sendBudget(id);
    syncWithDatabase();
  };

  const handleUpdateBudgetStatus = async (
    id: string,
    status: Exclude<BudgetStatus, 'rascunho' | 'enviado'>
  ) => {
    await dbInstance.updateBudgetStatus(id, status);
    syncWithDatabase();
  };

  // Finances handlers
  const handleAddTransaction = async (t: Omit<CashTransaction, 'id'>) => {
    try {
      await dbInstance.addTransaction(t);
      syncWithDatabase();
    } catch (e) {
      safeLog('error', 'finance.transaction.create', 'error', { error: e });
      throw e;
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await dbInstance.deleteTransaction(id);
      syncWithDatabase();
    } catch (e) {
      safeLog('error', 'finance.transaction.delete', 'error', { entityId: id, error: e });
      throw e;
    }
  };

  // Automation triggers handlers
  const handleUpdateAutomationTrigger = (id: string, updated: Partial<AutomationTrigger>) => {
    dbInstance.updateAutomationTrigger(id, updated);
    syncWithDatabase();
  };

  // Config handler
  const handleUpdateConfig = (updated: Partial<SystemConfig>) => {
    dbInstance.updateConfig(updated);
    syncWithDatabase();
  };

  // If Client Portal is active, render it directly (fully separated from admin)
  if (CLIENT_PORTAL_ENABLED && isClientPortal && ClientPortal) {
    return (
      <Suspense fallback={<ModuleLoader />}>
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
      </Suspense>
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
    return (
      <LoginScreen
        authError={authError}
        onGoToPortal={
          CLIENT_PORTAL_ENABLED ? () => setIsClientPortal(true) : undefined
        }
      />
    );
  }

  // Render correct dashboard component based on selected sidebar tab
  const renderTabContent = () => {
    if (!user) return null;

    if (!hasModulePermission(user, activeTab as SystemModuleId, 'view')) {
      const allowedModule = ALL_MODULE_IDS.find(id => hasModulePermission(user, id, 'view'));
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
            currentUser={user}
            clientPortalEnabled={CLIENT_PORTAL_ENABLED}
            onNavigate={setActiveTab}
            onUpdateStatus={(id, status) => handleUpdateAppointmentStatus(id, status)}
            onAddAppointment={handleAddAppointment}
            onUpdateAppointment={async (id, updated) => {
              try {
                await dbInstance.updateAppointment(id, updated);
                syncWithDatabase();
              } catch (e) {
                safeLog('error', 'appointment.update', 'error', { entityId: id, error: e });
                throw e;
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
            loyaltyEntries={loyaltyEntries}
            loyaltyTarget={config.loyaltyReferralTarget || 10}
            onAdjustLoyaltyMark={async (customerId: string, delta: 1 | -1) => {
              await dbInstance.adjustLoyaltyMark(customerId, delta, user?.name || 'Usuário do sistema');
              syncWithDatabase();
            }}
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
      case 'orcamentos':
        return (
          <OrcamentosModule
            budgets={budgets}
            customers={customers}
            vehicles={vehicles}
            services={services}
            currentUser={user}
            onSave={handleSaveBudget}
            onSend={handleSendBudget}
            onUpdateStatus={handleUpdateBudgetStatus}
            onAddCustomer={handleAddCustomer}
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
                safeLog('error', 'appointment.update', 'error', { entityId: id, error: e });
                throw e;
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
            currentUser={user}
            onUpdateTrigger={handleUpdateAutomationTrigger}
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
            loyaltyEntries={loyaltyEntries}
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
          <Suspense fallback={<ModuleLoader />}>
            {renderTabContent()}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
