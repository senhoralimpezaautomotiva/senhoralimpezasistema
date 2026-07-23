/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  SlidersHorizontal, 
  Car, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VehicleModel } from '../types';

interface ModelosVeiculosModuleProps {
  vehicleModels: VehicleModel[];
  onAddVehicleModel: (model: Omit<VehicleModel, 'id' | 'created_at' | 'updated_at'>) => Promise<any>;
  onUpdateVehicleModel: (id: string, updated: Partial<VehicleModel>) => Promise<any>;
  onDeleteVehicleModel: (id: string) => Promise<any>;
}

export default function ModelosVeiculosModule({
  vehicleModels,
  onAddVehicleModel,
  onUpdateVehicleModel,
  onDeleteVehicleModel
}: ModelosVeiculosModuleProps) {
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSize, setSelectedSize] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('ALL');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Add Model Form States
  const [isAdding, setIsAdding] = useState(false);
  const [newModel, setNewModel] = useState({
    manufacturer: '',
    model: '',
    size_category: 'M' as 'P' | 'M' | 'G',
    active: true
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  // Inline Editing States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    manufacturer: string;
    model: string;
    size_category: 'P' | 'M' | 'G';
    active: boolean;
  }>({
    manufacturer: '',
    model: '',
    size_category: 'M',
    active: true
  });
  const [editError, setEditError] = useState<string | null>(null);

  // Unique manufacturers for the filter dropdown
  const manufacturersList = useMemo(() => {
    const list = new Set<string>();
    vehicleModels.forEach(m => {
      if (m.manufacturer) list.add(m.manufacturer);
    });
    return Array.from(list).sort();
  }, [vehicleModels]);

  // Filtered List
  const filteredModels = useMemo(() => {
    return vehicleModels.filter(m => {
      const matchesSearch = 
        m.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.model.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSize = selectedSize === 'ALL' || m.size_category === selectedSize;
      
      const matchesStatus = 
        selectedStatus === 'ALL' || 
        (selectedStatus === 'ACTIVE' && m.active) || 
        (selectedStatus === 'INACTIVE' && !m.active);
      
      const matchesMfg = selectedManufacturer === 'ALL' || m.manufacturer === selectedManufacturer;

      return matchesSearch && matchesSize && matchesStatus && matchesMfg;
    });
  }, [vehicleModels, searchTerm, selectedSize, selectedStatus, selectedManufacturer]);

  // Paginated List
  const paginatedModels = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredModels.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredModels, currentPage]);

  const totalPages = Math.ceil(filteredModels.length / itemsPerPage) || 1;

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSize, selectedStatus, selectedManufacturer]);

  // Form Submit Action
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!newModel.manufacturer.trim()) {
      setAddError('O fabricante é obrigatório.');
      return;
    }
    
    setIsSubmitLoading(true);
    try {
      await onAddVehicleModel({
        manufacturer: newModel.manufacturer.trim(),
        model: newModel.model.trim(),
        size_category: newModel.size_category,
        active: newModel.active
      });
      // Reset form
      setNewModel({
        manufacturer: '',
        model: '',
        size_category: 'M',
        active: true
      });
      setIsAdding(false);
    } catch (err: any) {
      setAddError(err.message || 'Erro ao salvar modelo no Supabase.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // Toggle Active quick action
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await onUpdateVehicleModel(id, { active: !currentStatus });
    } catch (err: any) {
      console.error('Erro ao alternar status ativo:', err.message);
    }
  };

  // Set row to edit mode
  const startEditing = (m: VehicleModel) => {
    setEditError(null);
    setEditingId(m.id);
    setEditForm({
      manufacturer: m.manufacturer,
      model: m.model,
      size_category: m.size_category,
      active: m.active
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditError(null);
  };

  // Save Inline Edit
  const handleSaveEdit = async (id: string) => {
    setEditError(null);
    if (!editForm.manufacturer.trim()) {
      setEditError('Fabricante não pode ficar em branco.');
      return;
    }

    try {
      await onUpdateVehicleModel(id, {
        manufacturer: editForm.manufacturer.trim(),
        model: editForm.model.trim(),
        size_category: editForm.size_category,
        active: editForm.active
      });
      setEditingId(null);
    } catch (err: any) {
      setEditError(err.message || 'Erro ao atualizar modelo.');
    }
  };

  // Delete Action
  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Deseja realmente excluir o modelo de referência "${name}"?`)) {
      try {
        await onDeleteVehicleModel(id);
      } catch (err: any) {
        alert(err.message || 'Erro ao excluir modelo.');
      }
    }
  };

  return (
    <div className="space-y-6" id="modelos-veiculos-view">
      {/* Intro Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Car size={18} className="text-sky-400 animate-pulse" />
            <span>Cadastro de Modelos de Referência</span>
          </h2>
          <p className="text-xs text-slate-400 max-w-xl">
            Este catálogo serve como base para identificar o porte (Pequeno, Médio, Grande) dos veículos adicionados pelos clientes. O porte determina automaticamente a precificação dos serviços de limpeza e estética.
          </p>
        </div>
        
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shrink-0 ${
            isAdding 
              ? 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700' 
              : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/15'
          }`}
          id="btn-toggle-add-model"
        >
          {isAdding ? (
            <>
              <X size={14} />
              <span>Fechar Formulário</span>
            </>
          ) : (
            <>
              <Plus size={14} />
              <span>Adicionar Novo Modelo</span>
            </>
          )}
        </button>
      </div>

      {/* Slide-down Form to Add New Model */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddSubmit} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 text-xs" id="form-add-model">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                  <Sparkles size={14} className="text-amber-400" />
                  Novo Modelo de Veículo
                </h3>
                <span className="text-[10px] text-slate-500">Insira as especificações para o banco de dados</span>
              </div>

              {addError && (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-mono">
                  {addError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Fabricante / Marca *</label>
                  <input
                    type="text"
                    required
                    disabled={isSubmitLoading}
                    value={newModel.manufacturer}
                    onChange={(e) => setNewModel({ ...newModel, manufacturer: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3.5 py-2.5 text-white transition-all text-xs"
                    placeholder="Ex: Fiat, Toyota, Honda"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nome do Modelo *</label>
                  <input
                    type="text"
                    required
                    disabled={isSubmitLoading}
                    value={newModel.model}
                    onChange={(e) => setNewModel({ ...newModel, model: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3.5 py-2.5 text-white transition-all text-xs"
                    placeholder="Ex: Uno, Corolla, Civic (Vazio para marca genérica)"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Porte do Veículo (Categoria) *</label>
                  <select
                    value={newModel.size_category}
                    disabled={isSubmitLoading}
                    onChange={(e) => setNewModel({ ...newModel, size_category: e.target.value as 'P' | 'M' | 'G' })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white font-medium text-xs"
                  >
                    <option value="P">Pequeno (Hatchback / Compactos)</option>
                    <option value="M">Médio (Sedans / Crossovers)</option>
                    <option value="G">Grande (SUVs / Picapes / Vans)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status Inicial</label>
                  <div className="flex items-center h-10">
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={newModel.active}
                        disabled={isSubmitLoading}
                        onChange={(e) => setNewModel({ ...newModel, active: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white peer-checked:after:border-white"></div>
                      <span className="ml-3 text-xs font-semibold text-slate-300 peer-checked:text-emerald-400">
                        {newModel.active ? 'Ativo e Disponível' : 'Inativo / Oculto'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitLoading}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/10 flex items-center gap-2 transition-all cursor-pointer"
                  id="btn-save-new-model"
                >
                  {isSubmitLoading ? 'Salvando...' : 'Confirmar Cadastro'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Advanced Filters Panel */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">
          <SlidersHorizontal size={14} className="text-sky-400" />
          <span>Filtros Rápidos e Busca</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          {/* Term Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search size={14} />
            </div>
            <input
              type="text"
              placeholder="Buscar por fabricante ou modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl text-slate-200 placeholder-slate-500"
            />
          </div>

          {/* Manufacturer Filter */}
          <div>
            <select
              value={selectedManufacturer}
              onChange={(e) => setSelectedManufacturer(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-slate-300"
            >
              <option value="ALL">Todos Fabricantes</option>
              {manufacturersList.map(mfg => (
                <option key={mfg} value={mfg}>{mfg}</option>
              ))}
            </select>
          </div>

          {/* Size Category Filter */}
          <div>
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-slate-300"
            >
              <option value="ALL">Todas as Categorias (P / M / G)</option>
              <option value="P">Pequeno (P)</option>
              <option value="M">Médio (M)</option>
              <option value="G">Grande (G)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-slate-300"
            >
              <option value="ALL">Todos os Status (Ativo/Inativo)</option>
              <option value="ACTIVE">Apenas Ativos</option>
              <option value="INACTIVE">Apenas Inativos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Catalog View Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex justify-between items-center">
          <span className="text-xs font-mono font-bold text-slate-400">
            RESULTADOS: <span className="text-sky-400">{filteredModels.length}</span> MODELO(S) ENCONTRADO(S)
          </span>
          <span className="text-[10px] text-slate-500 flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded border border-slate-800">
            <Info size={12} className="text-sky-400 shrink-0" />
            Clique em "Editar" para alterar marca, modelo e porte inline.
          </span>
        </div>

        {filteredModels.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            Nenhum modelo de veículo encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/20 font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold">Fabricante / Marca</th>
                  <th className="py-3.5 px-4 font-bold">Modelo</th>
                  <th className="py-3.5 px-4 font-bold">Porte do Veículo (Categoria)</th>
                  <th className="py-3.5 px-4 font-bold text-center">Status de Uso</th>
                  <th className="py-3.5 px-4 font-bold text-right">Ações Administrativas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedModels.map((m) => {
                  const isEditingThisRow = editingId === m.id;

                  return (
                    <tr 
                      key={m.id} 
                      className={`hover:bg-slate-950/20 transition-colors ${
                        isEditingThisRow ? 'bg-sky-500/5' : ''
                      }`}
                    >
                      {/* COLUMN: MANUFACTURER */}
                      <td className="py-4 px-4 font-medium">
                        {isEditingThisRow ? (
                          <input
                            type="text"
                            value={editForm.manufacturer}
                            onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                            className="bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-sky-500 rounded px-2.5 py-1 text-white w-full max-w-[150px] text-xs font-semibold"
                          />
                        ) : (
                          <span className="text-white font-bold">{m.manufacturer}</span>
                        )}
                      </td>

                      {/* COLUMN: MODEL */}
                      <td className="py-4 px-4 font-semibold">
                        {isEditingThisRow ? (
                          <input
                            type="text"
                            value={editForm.model}
                            onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                            className="bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-sky-500 rounded px-2.5 py-1 text-white w-full max-w-[180px] text-xs font-semibold"
                          />
                        ) : (
                          <span className="text-slate-300">{m.model || <em className="text-slate-600 font-normal">Qualquer Modelo</em>}</span>
                        )}
                      </td>

                      {/* COLUMN: SIZE CATEGORY */}
                      <td className="py-4 px-4">
                        {isEditingThisRow ? (
                          <select
                            value={editForm.size_category}
                            onChange={(e) => setEditForm({ ...editForm, size_category: e.target.value as 'P' | 'M' | 'G' })}
                            className="bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-sky-500 rounded px-2 py-1 text-white text-xs"
                          >
                            <option value="P">Pequeno (Hatchback)</option>
                            <option value="M">Médio (Sedans / SUVs M)</option>
                            <option value="G">Grande (SUVs G / Picapes)</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-2">
                            {m.size_category === 'P' && (
                              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                P - PEQUENO (Hatch / Compacto)
                              </span>
                            )}
                            {m.size_category === 'M' && (
                              <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                M - MÉDIO (Sedan / Crossover)
                              </span>
                            )}
                            {m.size_category === 'G' && (
                              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                G - GRANDE (SUV / Picape / Van)
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* COLUMN: STATUS ACTIVE */}
                      <td className="py-4 px-4 text-center">
                        {isEditingThisRow ? (
                          <select
                            value={editForm.active ? 'true' : 'false'}
                            onChange={(e) => setEditForm({ ...editForm, active: e.target.value === 'true' })}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300"
                          >
                            <option value="true">Ativo</option>
                            <option value="false">Inativo</option>
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleActive(m.id, m.active)}
                            title={m.active ? "Clique para desativar este modelo" : "Clique para ativar este modelo"}
                            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-850 hover:border-slate-700 transition-all select-none cursor-pointer"
                          >
                            {m.active ? (
                              <>
                                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                                <span className="text-[10px] font-bold text-emerald-400">Ativo</span>
                              </>
                            ) : (
                              <>
                                <XCircle size={12} className="text-slate-500 shrink-0" />
                                <span className="text-[10px] font-bold text-slate-400">Inativo</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>

                      {/* COLUMN: ACTIONS */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isEditingThisRow ? (
                            <>
                              {editError && (
                                <span className="text-[10px] text-red-400 mr-2 font-mono truncate max-w-[150px]" title={editError}>
                                  {editError}
                                </span>
                              )}
                              <button
                                onClick={() => handleSaveEdit(m.id)}
                                title="Salvar Alterações"
                                className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors cursor-pointer"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={cancelEditing}
                                title="Cancelar"
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditing(m)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-400 hover:text-amber-300 font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-slate-750"
                              >
                                <Edit2 size={11} />
                                <span>Editar</span>
                              </button>
                              <button
                                onClick={() => handleDelete(m.id, `${m.manufacturer} ${m.model}`)}
                                className="p-1.5 bg-slate-800/40 hover:bg-red-500/10 border border-slate-850 hover:border-red-500/30 text-red-400 rounded-lg transition-all cursor-pointer"
                                title="Excluir Modelo"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
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

        {/* Dynamic Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between text-xs select-none">
            <span className="text-slate-400">
              Página <strong className="text-white">{currentPage}</strong> de <strong className="text-white">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Página Anterior"
              >
                <ChevronLeft size={14} />
              </button>

              {/* Page numbers around current */}
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const isCurrent = pageNum === currentPage;
                // Only show current, 1, last, and pages adjacent to current
                if (
                  pageNum === 1 || 
                  pageNum === totalPages || 
                  Math.abs(pageNum - currentPage) <= 1
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center transition-colors cursor-pointer ${
                        isCurrent 
                          ? 'bg-sky-500 text-white shadow-md shadow-sky-500/10' 
                          : 'bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                } else if (
                  (pageNum === 2 && currentPage > 3) || 
                  (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                ) {
                  return <span key={pageNum} className="text-slate-600 px-1 font-bold">...</span>;
                }
                return null;
              })}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Próxima Página"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
