/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Wrench, 
  Calendar, 
  History, 
  DollarSign, 
  BarChart3, 
  Settings, 
  LogOut,
  Zap,
  ChevronLeft,
  ChevronRight,
  Gift,
  MessageSquare,
  UserCog
} from 'lucide-react';
import { SystemConfig, SystemModuleId, User } from '../types';
import { hasModulePermission } from '../db/localDb';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: (Partial<User> & { name: string; email: string; role: string }) | null;
  onLogout: () => void;
  config: SystemConfig;
}

export default function Sidebar({ activeTab, setActiveTab, user, onLogout, config }: SidebarProps) {
  // Read initial collapse state from localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('sl_sidebar_collapsed');
    return saved === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sl_sidebar_collapsed', String(next));
      return next;
    });
  };

  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'servicos', label: 'Serviços', icon: Wrench },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'historico', label: 'Histórico', icon: History },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'usuarios', label: 'Usuários', icon: UserCog },
    { id: 'mensagens', label: 'Mensagens', icon: MessageSquare },
    { id: 'automacoes', label: 'Automações', icon: Zap },
    { id: 'indicacoes', label: 'Indicações', icon: Gift },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  // Filter menu items by user permissions
  const menuItems = allMenuItems.filter(item => 
    hasModulePermission(user as any, item.id as SystemModuleId, 'view')
  );

  return (
    <aside 
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } bg-slate-950 border-r border-slate-800 flex flex-col h-screen shrink-0 text-slate-300 select-none z-20 transition-all duration-300 ease-in-out relative`} 
      id="main-sidebar"
    >
      {/* Brand Logo & Name */}
      <div className={`p-4 border-b border-slate-800 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} h-16 shrink-0 relative`}>
        {config.logoUrl ? (
          <img 
            src={config.logoUrl} 
            alt="Logo" 
            className="w-9 h-9 rounded-xl object-cover border border-slate-700 shadow-md"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center text-white font-bold shadow-lg shadow-sky-500/20 shrink-0">
            SL
          </div>
        )}
        {!isCollapsed && (
          <div className="overflow-hidden animate-fadeIn">
            <h2 className="text-xs font-bold text-white truncate">{config.companyName || 'Senhora Limpeza'}</h2>
            <span className="text-[9px] uppercase font-mono tracking-wider text-sky-400 font-semibold">Estética Premium</span>
          </div>
        )}

        {/* Collapsible toggle button */}
        <button 
          onClick={toggleCollapse}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-full flex items-center justify-center cursor-pointer shadow-md z-30 transition-all"
          title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* Navigation Menu Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative group ${
                isActive 
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/10' 
                  : 'hover:bg-slate-900/60 hover:text-slate-100 text-slate-400'
              }`}
            >
              <IconComponent size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
              {!isCollapsed && <span className="animate-fadeIn truncate">{item.label}</span>}
              {!isCollapsed && item.id === 'mensagens' && (
                <span className="ml-auto text-[8px] bg-emerald-500/10 text-emerald-400 font-bold px-1 py-0.5 rounded border border-emerald-500/20">
                  Z-API
                </span>
              )}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg border border-slate-800 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap z-50 shadow-xl">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Info Footing */}
      {user && (
        <div className={`p-4 border-t border-slate-800 bg-slate-900/30 flex flex-col gap-3 shrink-0`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-100 font-bold text-xs border border-slate-600 shrink-0">
              {user.name.charAt(0)}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden animate-fadeIn">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <p className="text-[9px] font-mono text-slate-400 truncate">{user.role}</p>
              </div>
            )}
          </div>
          
          <button
            onClick={onLogout}
            title={isCollapsed ? "Sair do Sistema" : undefined}
            className={`w-full flex items-center justify-center ${isCollapsed ? 'p-2' : 'gap-2 px-3 py-2'} border border-slate-800 hover:border-red-500/30 rounded-xl text-xs font-medium hover:bg-red-500/5 hover:text-red-400 transition-all text-slate-400 relative group`}
            id="btn-logout"
          >
            <LogOut size={14} />
            {!isCollapsed && <span className="truncate">Sair do Sistema</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg border border-slate-800 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap z-50 shadow-xl">
                Sair do Sistema
              </div>
            )}
          </button>
        </div>
      )}
    </aside>
  );
}
