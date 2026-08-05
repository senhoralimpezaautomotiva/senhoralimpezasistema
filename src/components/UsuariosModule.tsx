/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Percent, 
  DollarSign, 
  Search, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  CheckCircle2, 
  Clock, 
  Plus,
  Phone,
  Mail,
  Award,
  Save,
  CheckSquare,
  Square
} from 'lucide-react';
import { 
  User, 
  CreateUserInput,
  UserRole, 
  SystemModuleId, 
  ModulePermission, 
  ServiceCommissionRule, 
  CommissionRecord, 
  Service
} from '../types';
import { DEFAULT_ROLE_PERMISSIONS, hasModulePermission } from '../db/localDb';
import { safeLog } from '../security/safeOutput';
import { useManagedTimeout } from '../hooks/useManagedTimeout';

interface UsuariosModuleProps {
  users: User[];
  services: Service[];
  commissions: CommissionRecord[];
  currentUser?: any;
  onAddUser: (user: CreateUserInput) => Promise<User>;
  onUpdateUser: (id: string, updated: Partial<User>) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onMarkCommissionAsPaid: (commissionId: string, notes?: string) => void;
  onMarkBulkCommissionsAsPaid: (commissionIds: string[], notes?: string) => void;
}

const MODULE_LABELS: Record<SystemModuleId, { name: string; description: string }> = {
  dashboard: { name: 'Dashboard', description: 'Visão geral de métricas, faturamento e resumo diário' },
  clientes: { name: 'Clientes', description: 'Cadastro, edição, histórico e programa de indicações' },
  servicos: { name: 'Serviços', description: 'Tabela de preços comercial e serviços por porte' },
  orcamentos: { name: 'Orçamentos', description: 'Criação, envio e acompanhamento de propostas comerciais' },
  agenda: { name: 'Agenda', description: 'Calendários, grade de horários e agendamentos de serviços' },
  historico: { name: 'Histórico', description: 'Registro de atendimentos concluídos e entregues' },
  financeiro: { name: 'Financeiro', description: 'Fluxo de caixa, receitas, despesas e lançamentos' },
  relatorios: { name: 'Relatórios', description: 'Análises de desempenho, faturamento e exportação de dados' },
  mensagens: { name: 'Mensagens Z-API', description: 'Envio manual e histórico de mensagens de WhatsApp' },
  automacoes: { name: 'Automações', description: 'Gatilhos de mensagens automáticas pré e pós serviço' },
  indicacoes: { name: 'Indicações', description: 'Gestão de códigos de desconto e programa "Indique e Ganhe"' },
  configuracoes: { name: 'Configurações', description: 'Dados da empresa, horário de funcionamento e temas' },
  usuarios: { name: 'Usuários e Permissões', description: 'Gestão de equipe, perfis de acesso e comissões' },
};

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
];

export default function UsuariosModule({
  users,
  services,
  commissions,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onMarkCommissionAsPaid,
  onMarkBulkCommissionsAsPaid
}: UsuariosModuleProps) {
  const canCreate = hasModulePermission(currentUser, 'usuarios', 'create');
  const canEdit = hasModulePermission(currentUser, 'usuarios', 'edit');
  const canDelete = hasModulePermission(currentUser, 'usuarios', 'delete');
  const scheduleTimeout = useManagedTimeout();
  const [activeTab, setActiveTab] = useState<'usuarios' | 'permissoes' | 'comissoes' | 'relatorio_comissoes'>('usuarios');

  // Search & Filter State for Users
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // User Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [userSaveSuccess, setUserSaveSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    email: string;
    password: string;
    photoUrl: string;
    status: 'ativo' | 'inativo';
    role: UserRole;
    defaultCommissionPercent: number;
  }>({
    name: '',
    phone: '',
    email: '',
    password: '',
    photoUrl: AVATAR_PRESETS[0],
    status: 'ativo',
    role: 'tecnico',
    defaultCommissionPercent: 10
  });

  // Permissions Matrix Tab Selected User
  const [selectedUserIdForPermissions, setSelectedUserIdForPermissions] = useState<string>(users[0]?.id || '');
  const [tempPermissions, setTempPermissions] = useState<Record<SystemModuleId, ModulePermission>>(
    users[0]?.permissions || DEFAULT_ROLE_PERMISSIONS.admin
  );
  const [permissionsSaveSuccess, setPermissionsSaveSuccess] = useState(false);

  // Commission Config Tab Selected User
  const [selectedUserIdForCommissions, setSelectedUserIdForCommissions] = useState<string>(users[0]?.id || '');
  const [userDefaultCommission, setUserDefaultCommission] = useState<number>(10);
  const [userCommissionRules, setUserCommissionRules] = useState<Record<string, number>>({});
  const [commissionsSaveSuccess, setCommissionsSaveSuccess] = useState(false);

  // Commission Report Tab Filters
  const [commSearchTerm, setCommSearchTerm] = useState('');
  const [commUserFilter, setCommUserFilter] = useState<string>('todos');
  const [commStatusFilter, setCommStatusFilter] = useState<string>('todas');
  const [commStartDate, setCommStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // 1st day of current month
    return d.toISOString().split('T')[0];
  });
  const [commEndDate, setCommEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Payment Notes Modal State
  const [payingCommId, setPayingCommId] = useState<string | null>(null);
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [selectedCommIds, setSelectedCommIds] = useState<string[]>([]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            user.phone.includes(searchTerm);
      const matchesRole = roleFilter === 'todos' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'todos' || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Select User for Permissions Setup
  const handleSelectUserPermissions = (userId: string) => {
    setSelectedUserIdForPermissions(userId);
    const target = users.find(u => u.id === userId);
    if (target) {
      setTempPermissions(target.permissions || DEFAULT_ROLE_PERMISSIONS[target.role] || DEFAULT_ROLE_PERMISSIONS.atendente);
    }
  };

  // Select User for Commission Rules Setup
  const handleSelectUserCommissions = (userId: string) => {
    setSelectedUserIdForCommissions(userId);
    const target = users.find(u => u.id === userId);
    if (target) {
      setUserDefaultCommission(target.defaultCommissionPercent ?? 10);
      const map: Record<string, number> = {};
      (target.commissions || []).forEach(rule => {
        map[rule.serviceId] = rule.percentage;
      });
      setUserCommissionRules(map);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingUserId(null);
    setFormError(null);
    setUserSaveSuccess(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      password: '',
      photoUrl: AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)],
      status: 'ativo',
      role: 'tecnico',
      defaultCommissionPercent: 10
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (user: User) => {
    if (!canEdit) return;
    setEditingUserId(user.id);
    setFormError(null);
    setFormData({
      name: user.name,
      phone: user.phone,
      email: user.email,
      password: '',
      photoUrl: user.photoUrl || AVATAR_PRESETS[0],
      status: user.status,
      role: user.role,
      defaultCommissionPercent: user.defaultCommissionPercent ?? 10
    });
    setIsModalOpen(true);
  };

  // Submit User Form
  const handleSubmitUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUserId ? !canEdit : !canCreate) return;
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Por favor, informe o nome do usuário.');
      return;
    }
    if (!formData.email.trim()) {
      setFormError('Por favor, informe o e-mail do usuário.');
      return;
    }
    if (!editingUserId && formData.password.length < 6) {
      setFormError('A senha deve conter no mínimo 6 caracteres para autenticação no Supabase.');
      return;
    }

    setSavingUser(true);
    try {
      if (editingUserId) {
        await onUpdateUser(editingUserId, {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          photoUrl: formData.photoUrl,
          status: formData.status,
          role: formData.role,
          defaultCommissionPercent: formData.defaultCommissionPercent
        });
      } else {
        const initialPermissions = DEFAULT_ROLE_PERMISSIONS[formData.role] || DEFAULT_ROLE_PERMISSIONS.tecnico;
        const createdUser = await onAddUser({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          password: formData.password,
          photoUrl: formData.photoUrl,
          status: formData.status,
          role: formData.role,
          permissions: initialPermissions,
          commissions: [],
          defaultCommissionPercent: formData.defaultCommissionPercent
        });
        setUserSaveSuccess(
          `Usuário ${createdUser.name} criado no Authentication e em public.usuarios com sucesso.`
        );
        scheduleTimeout(() => setUserSaveSuccess(null), 5000);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      safeLog('error', 'users.user.save', 'error', { error: err });
      setFormError('Erro ao salvar usuário.');
    } finally {
      setSavingUser(false);
    }
  };

  // Save Permissions Matrix Changes
  const handleSavePermissions = async () => {
    if (!selectedUserIdForPermissions || !canEdit) return;
    try {
      await onUpdateUser(selectedUserIdForPermissions, {
        permissions: tempPermissions
      });
      setPermissionsSaveSuccess(true);
      scheduleTimeout(() => setPermissionsSaveSuccess(false), 3000);
    } catch (err) {
      safeLog('error', 'users.permissions.save', 'error', { error: err });
    }
  };

  // Save Commission Rules
  const handleSaveCommissionRules = async () => {
    if (!selectedUserIdForCommissions || !canEdit) return;
    const rulesList: ServiceCommissionRule[] = Object.entries(userCommissionRules)
      .filter(([_, percent]) => typeof percent === 'number' && !isNaN(percent) && percent > 0)
      .map(([serviceId, percentage]) => ({ serviceId, percentage: Number(percentage) }));

    try {
      await onUpdateUser(selectedUserIdForCommissions, {
        defaultCommissionPercent: userDefaultCommission,
        commissions: rulesList
      });
      setCommissionsSaveSuccess(true);
      scheduleTimeout(() => setCommissionsSaveSuccess(false), 3000);
    } catch (err) {
      safeLog('error', 'users.commissions.save', 'error', { error: err });
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!canDelete || user.role === 'admin') return;
    if (!confirm(`Tem certeza que deseja excluir o usuário ${user.name}?`)) return;
    try {
      await onDeleteUser(user.id);
    } catch (error) {
      safeLog('error', 'users.user.delete', 'error', {
        entityId: user.id,
        error
      });
      setFormError('Erro ao excluir usuário.');
    }
  };

  // Filtered Commissions for Report
  const filteredCommissions = useMemo(() => {
    return commissions.filter(comm => {
      const matchesSearch = comm.userName.toLowerCase().includes(commSearchTerm.toLowerCase()) ||
                            comm.customerName.toLowerCase().includes(commSearchTerm.toLowerCase()) ||
                            comm.serviceName.toLowerCase().includes(commSearchTerm.toLowerCase());
      const matchesUser = commUserFilter === 'todos' || comm.userId === commUserFilter;
      const matchesStatus = commStatusFilter === 'todas' || comm.status === commStatusFilter;
      
      const commDate = comm.date;
      const matchesDate = (!commStartDate || commDate >= commStartDate) &&
                          (!commEndDate || commDate <= commEndDate);

      return matchesSearch && matchesUser && matchesStatus && matchesDate;
    });
  }, [commissions, commSearchTerm, commUserFilter, commStatusFilter, commStartDate, commEndDate]);

  // Report Metrics
  const totalCommissionGenerated = useMemo(() => {
    return filteredCommissions.reduce((sum, c) => sum + c.commissionValue, 0);
  }, [filteredCommissions]);

  const totalCommissionPending = useMemo(() => {
    return filteredCommissions.filter(c => c.status === 'pendente').reduce((sum, c) => sum + c.commissionValue, 0);
  }, [filteredCommissions]);

  const totalCommissionPaid = useMemo(() => {
    return filteredCommissions.filter(c => c.status === 'paga').reduce((sum, c) => sum + c.commissionValue, 0);
  }, [filteredCommissions]);

  const handleConfirmSinglePayment = () => {
    if (payingCommId) {
      onMarkCommissionAsPaid(payingCommId, paymentNotes);
      setPayingCommId(null);
      setPaymentNotes('');
    }
  };

  const handleConfirmBulkPayment = () => {
    if (selectedCommIds.length > 0) {
      onMarkBulkCommissionsAsPaid(selectedCommIds, 'Pagamento em lote realizado');
      setSelectedCommIds([]);
    }
  };

  const toggleSelectAllCommissions = () => {
    const pendingIds = filteredCommissions.filter(c => c.status === 'pendente').map(c => c.id);
    if (selectedCommIds.length === pendingIds.length && pendingIds.length > 0) {
      setSelectedCommIds([]);
    } else {
      setSelectedCommIds(pendingIds);
    }
  };

  const toggleSelectComm = (id: string) => {
    setSelectedCommIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const getRoleBadgeClass = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'gerente':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'atendente':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'tecnico':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'gerente': return 'Gerente';
      case 'atendente': return 'Atendente';
      case 'tecnico': return 'Técnico Operacional';
      default: return 'Perfil Personalizado';
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Gestão de Usuários e Comissões
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Multi-Usuário
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Controle de acesso por permissões, cadastro de equipe e relatório de comissionamento por serviço
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-sky-500/20 hover:shadow-sky-500/30 cursor-pointer"
          >
            <UserPlus size={16} />
            <span>Cadastrar Novo Usuário</span>
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'usuarios'
              ? 'border-sky-500 text-sky-400 bg-sky-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users size={16} />
          <span>Equipe & Usuários</span>
          <span className="ml-1 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-full font-mono">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('permissoes');
            if (!selectedUserIdForPermissions && users[0]) {
              handleSelectUserPermissions(users[0].id);
            }
          }}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'permissoes'
              ? 'border-sky-500 text-sky-400 bg-sky-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck size={16} />
          <span>Matriz de Permissões</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('comissoes');
            if (!selectedUserIdForCommissions && users[0]) {
              handleSelectUserCommissions(users[0].id);
            }
          }}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'comissoes'
              ? 'border-sky-500 text-sky-400 bg-sky-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Percent size={16} />
          <span>Comissão por Serviço</span>
        </button>

        <button
          onClick={() => setActiveTab('relatorio_comissoes')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'relatorio_comissoes'
              ? 'border-sky-500 text-sky-400 bg-sky-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign size={16} />
          <span>Relatório de Comissões</span>
          {commissions.filter(c => c.status === 'pendente').length > 0 && (
            <span className="ml-1 text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-mono">
              {commissions.filter(c => c.status === 'pendente').length} pendentes
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: USER LIST & CRUD */}
      {activeTab === 'usuarios' && (
        <div className="space-y-5">
          {userSaveSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <CheckCircle2 size={16} />
              <span>{userSaveSuccess}</span>
            </div>
          )}

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="todos">Todos os Perfis</option>
                <option value="admin">Administrador</option>
                <option value="gerente">Gerente</option>
                <option value="atendente">Atendente</option>
                <option value="tecnico">Técnico Operacional</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="todos">Todos os Status</option>
                <option value="ativo">Usuários Ativos</option>
                <option value="inativo">Usuários Inativos</option>
              </select>
            </div>
          </div>

          {/* Users Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-md relative group"
              >
                <div className="space-y-4">
                  {/* User Top Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.photoUrl || AVATAR_PRESETS[0]}
                        alt={user.name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-700 shadow-sm"
                      />
                      <div>
                        <h3 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">
                          {user.name}
                        </h3>
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border mt-1 ${getRoleBadgeClass(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </div>
                    </div>

                    {/* Status badge */}
                    <button
                      onClick={() => {
                        if (canEdit) void onUpdateUser(user.id, { status: user.status === 'ativo' ? 'inativo' : 'ativo' });
                      }}
                      disabled={!canEdit}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all disabled:cursor-default disabled:opacity-60 ${
                        user.status === 'ativo'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                      }`}
                      title="Clique para alternar status do usuário"
                    >
                      {user.status === 'ativo' ? '• Ativo' : '• Inativo'}
                    </button>
                  </div>

                  {/* User Contact Info */}
                  <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-slate-500 shrink-0" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-500 shrink-0" />
                      <span>{user.phone || 'Telefone não cadastrado'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sky-400 font-mono text-[11px] pt-1">
                      <Percent size={13} className="shrink-0" />
                      <span>Comissão padrão: <strong className="text-white">{user.defaultCommissionPercent ?? 10}%</strong></span>
                    </div>
                  </div>
                </div>

                {/* User Actions */}
                <div className="border-t border-slate-800/80 pt-3 mt-4 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <>
                        <button
                          onClick={() => {
                            handleSelectUserPermissions(user.id);
                            setActiveTab('permissoes');
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-sky-500/20 hover:text-sky-400 text-slate-300 rounded-lg transition-colors cursor-pointer"
                          title="Configurar Permissões"
                        >
                          <ShieldCheck size={14} />
                        </button>
                        <button
                          onClick={() => {
                            handleSelectUserCommissions(user.id);
                            setActiveTab('comissoes');
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-300 rounded-lg transition-colors cursor-pointer"
                          title="Configurar Regras de Comissão"
                        >
                          <Percent size={14} />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <button
                        onClick={() => handleOpenEditModal(user)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors text-xs cursor-pointer"
                      >
                        <Edit size={13} />
                        <span>Editar</span>
                      </button>
                    )}
                    {canDelete && user.role !== 'admin' && (
                      <button
                        onClick={() => void handleDeleteUser(user)}
                        className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                        title="Excluir Usuário"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <div className="col-span-full py-12 text-center bg-slate-900/30 rounded-2xl border border-slate-800 space-y-3">
                <Users className="mx-auto text-slate-600" size={36} />
                <p className="text-sm text-slate-400">Nenhum usuário localizado com os filtros selecionados.</p>
                <button
                  onClick={handleOpenCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-white text-xs font-semibold rounded-xl"
                >
                  <Plus size={14} />
                  <span>Cadastrar Usuário</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PERMISSIONS MATRIX */}
      {activeTab === 'permissoes' && (
        <div className="space-y-6">
          {/* User Selector Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-300 uppercase whitespace-nowrap">
                Selecione o Usuário:
              </label>
              <select
                value={selectedUserIdForPermissions}
                onChange={(e) => handleSelectUserPermissions(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[220px]"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({getRoleLabel(u.role)})
                  </option>
                ))}
              </select>
            </div>

            {/* Role Preset Quick Buttons */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px] mr-1">Predefinição rápida:</span>
              {(['admin', 'gerente', 'atendente', 'tecnico'] as UserRole[]).map(r => (
                <button
                  key={r}
                  onClick={() => setTempPermissions(DEFAULT_ROLE_PERMISSIONS[r])}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-[11px] transition-colors cursor-pointer"
                >
                  {getRoleLabel(r)}
                </button>
              ))}
            </div>
          </div>

          {permissionsSaveSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 size={16} />
              <span>Matriz de permissões salva com sucesso para este usuário!</span>
            </div>
          )}

          {/* Matrix Grid */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-[11px] uppercase">
                    <th className="p-4">Módulo do Sistema</th>
                    <th className="p-4 text-center">Visualizar</th>
                    <th className="p-4 text-center">Criar / Inserir</th>
                    <th className="p-4 text-center">Editar / Alterar</th>
                    <th className="p-4 text-center">Excluir / Deletar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(Object.keys(MODULE_LABELS) as SystemModuleId[]).map((modId) => {
                    const mod = MODULE_LABELS[modId];
                    const p = tempPermissions[modId] || { view: false, create: false, edit: false, delete: false };

                    const toggleOp = (op: keyof ModulePermission) => {
                      setTempPermissions(prev => ({
                        ...prev,
                        [modId]: {
                          ...p,
                          [op]: !p[op]
                        }
                      }));
                    };

                    return (
                      <tr key={modId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4">
                          <p className="font-semibold text-white">{mod.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{mod.description}</p>
                        </td>

                        {(['view', 'create', 'edit', 'delete'] as (keyof ModulePermission)[]).map((op) => (
                          <td key={op} className="p-4 text-center">
                            <button
                              type="button"
                              onClick={() => toggleOp(op)}
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer ${
                                p[op]
                                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                                  : 'bg-slate-800 text-slate-600 border border-slate-700 hover:border-slate-500'
                              }`}
                            >
                              {p[op] ? <Check size={14} /> : <X size={12} />}
                            </button>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
              <button
                onClick={handleSavePermissions}
                className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs rounded-xl shadow-md cursor-pointer transition-all"
              >
                <Save size={16} />
                <span>Salvar Alterações de Permissão</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COMMISSION PER SERVICE */}
      {activeTab === 'comissoes' && (
        <div className="space-y-6">
          {/* User Selector Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-300 uppercase whitespace-nowrap">
                Selecione o Usuário:
              </label>
              <select
                value={selectedUserIdForCommissions}
                onChange={(e) => handleSelectUserCommissions(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[220px]"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({getRoleLabel(u.role)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-300 font-semibold uppercase">
                Comissão Padrão (%):
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={userDefaultCommission}
                onChange={(e) => setUserDefaultCommission(parseFloat(e.target.value) || 0)}
                className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {commissionsSaveSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 size={16} />
              <span>Regras de comissionamento salvas com sucesso para este usuário!</span>
            </div>
          )}

          {/* Services Table with Custom Commission Override */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 bg-slate-950/40">
              <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                Comissão Específica por Serviço Comercial
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Defina um percentual personalizado para serviços específicos. Se deixado em branco ou 0, será aplicada a comissão padrão ({userDefaultCommission}%).
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-[11px] uppercase">
                    <th className="p-4">Serviço</th>
                    <th className="p-4">Preço Base (R$)</th>
                    <th className="p-4">Comissão Personalizada (%)</th>
                    <th className="p-4 text-right">Valor Estimado de Comissão (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {services.map((service) => {
                    const customValue = userCommissionRules[service.id];
                    const activePercent = customValue !== undefined && !isNaN(customValue) ? customValue : userDefaultCommission;
                    const estimatedValue = (service.basePrice * activePercent) / 100;

                    return (
                      <tr key={service.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4">
                          <p className="font-semibold text-white">{service.name}</p>
                          <p className="text-[11px] text-slate-400 truncate max-w-md">{service.description}</p>
                        </td>
                        <td className="p-4 font-mono text-slate-300">
                          R$ {service.basePrice.toFixed(2)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              placeholder={`${userDefaultCommission}%`}
                              value={userCommissionRules[service.id] ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                setUserCommissionRules(prev => ({
                                  ...prev,
                                  [service.id]: val as any
                                }));
                              }}
                              className="w-28 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                            />
                            <span className="text-slate-500">%</span>
                          </div>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-emerald-400">
                          R$ {estimatedValue.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
              <button
                onClick={handleSaveCommissionRules}
                className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs rounded-xl shadow-md cursor-pointer transition-all"
              >
                <Save size={16} />
                <span>Salvar Regras de Comissão</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COMMISSION REPORT & PAYMENTS */}
      {activeTab === 'relatorio_comissoes' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Gerado</span>
                <DollarSign size={18} className="text-sky-400" />
              </div>
              <p className="text-2xl font-bold font-mono text-white">
                R$ {totalCommissionGenerated.toFixed(2)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Período selecionado</p>
            </div>

            <div className="bg-slate-900/60 border border-amber-500/30 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between text-amber-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Comissões Pendentes</span>
                <Clock size={18} />
              </div>
              <p className="text-2xl font-bold font-mono text-amber-400">
                R$ {totalCommissionPending.toFixed(2)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Aguardando pagamento ao técnico</p>
            </div>

            <div className="bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between text-emerald-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Comissões Pagas</span>
                <CheckCircle2 size={18} />
              </div>
              <p className="text-2xl font-bold font-mono text-emerald-400">
                R$ {totalCommissionPaid.toFixed(2)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Pagas com sucesso</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Atendimentos</span>
                <Award size={18} className="text-purple-400" />
              </div>
              <p className="text-2xl font-bold font-mono text-white">
                {filteredCommissions.length}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Com responsável alocado</p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Buscar responsável, cliente, serviço..."
                value={commSearchTerm}
                onChange={(e) => setCommSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <select
                value={commUserFilter}
                onChange={(e) => setCommUserFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="todos">Todos os Responsáveis</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={commStatusFilter}
                onChange={(e) => setCommStatusFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="todas">Todos os Status</option>
                <option value="pendente">Pendentes</option>
                <option value="paga">Pagas</option>
              </select>
            </div>

            <div>
              <input
                type="date"
                value={commStartDate}
                onChange={(e) => setCommStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                title="Data Início"
              />
            </div>

            <div>
              <input
                type="date"
                value={commEndDate}
                onChange={(e) => setCommEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                title="Data Fim"
              />
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedCommIds.length > 0 && (
            <div className="bg-sky-500/10 border border-sky-500/30 p-3 rounded-xl flex items-center justify-between text-xs text-sky-300 animate-fadeIn">
              <span className="font-semibold">
                {selectedCommIds.length} comissão(ões) pendente(s) selecionada(s)
              </span>
              <button
                onClick={handleConfirmBulkPayment}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                Marcar Selecionadas como Pagas
              </button>
            </div>
          )}

          {/* Commission Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-[11px] uppercase">
                    <th className="p-4 w-10 text-center">
                      <button
                        onClick={toggleSelectAllCommissions}
                        className="text-slate-400 hover:text-white"
                        title="Selecionar Pendentes"
                      >
                        {selectedCommIds.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </th>
                    <th className="p-4">Data</th>
                    <th className="p-4">Responsável</th>
                    <th className="p-4">Cliente / Serviço</th>
                    <th className="p-4 text-right">Valor Serviço</th>
                    <th className="p-4 text-center">% Comissão</th>
                    <th className="p-4 text-right">Valor Comissão</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCommissions.map((comm) => {
                    const isSelected = selectedCommIds.includes(comm.id);

                    return (
                      <tr key={comm.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-center">
                          {comm.status === 'pendente' ? (
                            <button
                              onClick={() => toggleSelectComm(comm.id)}
                              className="text-slate-400 hover:text-sky-400 cursor-pointer"
                            >
                              {isSelected ? <CheckSquare size={16} className="text-sky-400" /> : <Square size={16} />}
                            </button>
                          ) : (
                            <CheckCircle2 size={16} className="text-emerald-500/40 mx-auto" />
                          )}
                        </td>
                        <td className="p-4 font-mono text-slate-300 whitespace-nowrap">
                          {comm.date.split('-').reverse().join('/')}
                        </td>
                        <td className="p-4 font-semibold text-white whitespace-nowrap">
                          {comm.userName}
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-white">{comm.serviceName}</p>
                          <p className="text-[11px] text-slate-400">{comm.customerName}</p>
                        </td>
                        <td className="p-4 font-mono text-right text-slate-300">
                          R$ {comm.serviceValue.toFixed(2)}
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                            {comm.commissionPercent}%
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-right text-emerald-400 text-sm">
                          R$ {comm.commissionValue.toFixed(2)}
                        </td>
                        <td className="p-4 text-center">
                          {comm.status === 'pendente' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Clock size={10} /> Pendente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 size={10} /> Paga
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {comm.status === 'pendente' ? (
                            <button
                              onClick={() => setPayingCommId(comm.id)}
                              className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              Pagar
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {comm.paidAt ? `Pago em ${comm.paidAt.split('-').reverse().join('/')}` : 'Pago'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredCommissions.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        Nenhuma comissão registrada para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT USER */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <UserPlus size={16} className="text-sky-400" />
                {editingUserId ? 'Editar Usuário' : 'Novo Usuário do Sistema'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitUserForm} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs font-mono">
                  {formError}
                </div>
              )}

              {/* Photo Preset Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                  Foto de Perfil / Avatar
                </label>
                <div className="flex items-center gap-3 overflow-x-auto py-1">
                  {AVATAR_PRESETS.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Avatar ${i}`}
                      onClick={() => setFormData({ ...formData, photoUrl: url })}
                      className={`w-10 h-10 rounded-xl object-cover cursor-pointer border-2 transition-all ${
                        formData.photoUrl === url ? 'border-sky-500 scale-105 shadow-md shadow-sky-500/20' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Gabriel Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Telefone *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="(11) 99999-8888"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    E-mail (Login) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="usuario@senhoralimpeza.com.br"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {!editingUserId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Senha de Acesso *
                  </label>
                  <input
                    type="password"
                    required={!editingUserId}
                    placeholder={editingUserId ? 'Manter senha atual' : 'Senha de acesso'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Comissão Padrão (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formData.defaultCommissionPercent}
                    onChange={(e) => setFormData({ ...formData, defaultCommissionPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Perfil de Acesso *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="admin">Administrador (Acesso Total)</option>
                    <option value="gerente">Gerente</option>
                    <option value="atendente">Atendente</option>
                    <option value="tecnico">Técnico Operacional</option>
                    <option value="personalizado">Personalizado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Status do Usuário *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ativo' | 'inativo' })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {savingUser ? 'Salvando...' : editingUserId ? 'Atualizar Usuário' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PAYMENT CONFIRMATION */}
      {payingCommId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400" />
                Confirmar Pagamento de Comissão
              </h3>
              <button onClick={() => setPayingCommId(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-slate-300">
              Você está marcando esta comissão como <strong className="text-emerald-400">PAGA</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Observações de Pagamento (Opcional):
              </label>
              <textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Ex: Pago via PIX no dia 15/10/2026..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white h-20 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setPayingCommId(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSinglePayment}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-md"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
