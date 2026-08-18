/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { 
  Wrench, 
  Search, 
  Plus, 
  Edit, 
  X, 
  Clock, 
  DollarSign,
  Image as ImageIcon,
  Star
} from 'lucide-react';
import { Service } from '../types';
import { hasModulePermission } from '../db/localDb';
import { getSharedSupabaseClient } from '../db/supabaseClient';
import { getPublicSupabaseEnvironment } from '../config/publicEnvironment';
import { safeLog } from '../security/safeOutput';

interface ServicosModuleProps {
  services: Service[];
  currentUser?: any;
  onAddService: (service: Omit<Service, 'id'>) => Promise<any>;
  onUpdateService: (id: string, service: Partial<Service>) => Promise<any>;
  onDeleteService: (id: string) => Promise<any>;
}

export default function ServicosModule({ 
  services, 
  currentUser,
  onAddService, 
  onUpdateService, 
  onDeleteService 
}: ServicosModuleProps) {
  const canCreate = hasModulePermission(currentUser, 'servicos', 'create');
  const canEdit = hasModulePermission(currentUser, 'servicos', 'edit');
  const canDelete = hasModulePermission(currentUser, 'servicos', 'delete');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpenAdd, setIsOpenAdd] = useState(false);
  const [isOpenEdit, setIsOpenEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingOfferImage, setIsUploadingOfferImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const addOfferImageInputRef = useRef<HTMLInputElement | null>(null);
  const editOfferImageInputRef = useRef<HTMLInputElement | null>(null);
  
  const [editId, setEditId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    basePrice: 0,
    estimatedTime: 60,
    pricingType: 'unico' as 'unico' | 'porte',
    priceP: 0,
    priceM: 0,
    priceG: 0,
    isFeatured: false,
    offerText: '',
    offerImageUrl: '',
    displayOrder: 0,
    portalVisibility: 'lista' as 'lista' | 'sugestao' | 'oculto',
    countsForLoyaltyCard: false
  });

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenAdd = () => {
    if (!canCreate) return;
    setErrorMessage(null);
    setFormData({
      name: '',
      description: '',
      basePrice: 150,
      estimatedTime: 120,
      pricingType: 'unico',
      priceP: 120,
      priceM: 150,
      priceG: 180,
      isFeatured: false,
      offerText: '',
      offerImageUrl: '',
      displayOrder: 0,
      portalVisibility: 'lista',
      countsForLoyaltyCard: false
    });
    setIsOpenAdd(true);
  };

  const handleOpenEdit = (s: Service) => {
    if (!canEdit) return;
    setErrorMessage(null);
    setEditId(s.id);
    setFormData({
      name: s.name,
      description: s.description,
      basePrice: s.basePrice,
      estimatedTime: s.estimatedTime,
      pricingType: s.pricingType || 'unico',
      priceP: s.priceP || s.basePrice,
      priceM: s.priceM || s.basePrice,
      priceG: s.priceG || s.basePrice,
      isFeatured: s.isFeatured ?? false,
      offerText: s.offerText ?? '',
      offerImageUrl: s.offerImageUrl ?? '',
      displayOrder: s.displayOrder ?? 0,
      portalVisibility: s.portalVisibility ?? (s.isFeatured ? 'sugestao' : 'lista'),
      countsForLoyaltyCard: s.countsForLoyaltyCard ?? false
    });
    setIsOpenEdit(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setErrorMessage(null);
    setIsSaving(true);
    try {
      // If pricingType is 'unico', make sure priceP, priceM, priceG are also set to basePrice (migration/compatibility)
      const dataToSubmit = {
        ...formData,
        priceP: formData.pricingType === 'porte' ? formData.priceP : formData.basePrice,
        priceM: formData.pricingType === 'porte' ? formData.priceM : formData.basePrice,
        priceG: formData.pricingType === 'porte' ? formData.priceG : formData.basePrice,
      };
      await onAddService(dataToSubmit);
      setIsOpenAdd(false);
    } catch (err: any) {
      safeLog('error', 'services.service.create', 'error', { error: err });
      setErrorMessage('Erro ao cadastrar serviço.');
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
      const dataToSubmit = {
        ...formData,
        priceP: formData.pricingType === 'porte' ? formData.priceP : formData.basePrice,
        priceM: formData.pricingType === 'porte' ? formData.priceM : formData.basePrice,
        priceG: formData.pricingType === 'porte' ? formData.priceG : formData.basePrice,
      };
      await onUpdateService(editId, dataToSubmit);
      setIsOpenEdit(false);
    } catch (err: any) {
      safeLog('error', 'services.service.update', 'error', { error: err });
      setErrorMessage('Erro ao atualizar dados do serviço.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOfferImageUpload = async (file: File | undefined | null) => {
    if (!file) return;
    setErrorMessage(null);
    setIsUploadingOfferImage(true);
    try {
      const config = getPublicSupabaseEnvironment();
      if (!config.isConfigured) {
        throw new Error('SUPABASE_STORAGE_REQUIRED');
      }
      const client = getSharedSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `offers/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const { error } = await client.storage
        .from('service-offers')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined
        });
      if (error) throw error;
      const { data } = client.storage.from('service-offers').getPublicUrl(path);
      setFormData(current => ({ ...current, offerImageUrl: data.publicUrl }));
    } catch (error) {
      safeLog('error', 'services.offer_image.upload', 'error', { error });
      setErrorMessage('Erro ao enviar imagem da oferta.');
    } finally {
      setIsUploadingOfferImage(false);
    }
  };

  const handleDeleteService = async (service: Service) => {
    if (!canDelete) return;
    if (!confirm(`Excluir o serviço "${service.name}"? Agendamentos que usam este serviço não serão apagados.`)) return;
    setErrorMessage(null);
    try {
      await onDeleteService(service.id);
    } catch (error) {
      safeLog('error', 'services.service.delete', 'error', {
        entityId: service.id,
        error
      });
      setErrorMessage('Erro ao excluir serviço.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="servicos-module-view">
      {/* Search and Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Pesquisar serviço por título ou palavras-chave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm rounded-xl text-slate-200 transition-all placeholder-slate-500"
          />
        </div>
        {canCreate && (
          <button 
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 font-semibold text-xs text-white rounded-xl shadow-lg shadow-sky-500/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
            id="btn-add-service"
          >
            <Plus size={16} />
            <span>Cadastrar Serviço</span>
          </button>
        )}
      </div>

      {/* Grid of services cards */}
      {filteredServices.length === 0 ? (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center text-slate-400 text-sm">
          Nenhum pacote de serviço cadastrado ou correspondente à pesquisa.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServices.map((s) => {
            const hours = Math.floor(s.estimatedTime / 60);
            const minutes = s.estimatedTime % 60;
            const timeStr = `${hours > 0 ? `${hours}h` : ''} ${minutes > 0 ? `${minutes}min` : ''}`.trim();

            return (
              <div key={s.id} className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between hover:border-slate-700/60 transition-all shadow-md group">
                <div className="space-y-3">
                  {/* Title and Badge Icon */}
                  <div className="flex justify-between items-start">
                    <h3 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">{s.name}</h3>
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
                      <Wrench size={14} />
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-slate-400 text-xs leading-relaxed min-h-[48px] line-clamp-3">
                    {s.description}
                  </p>

                  {/* Badges/Upsell Info */}
                  <div className="flex flex-wrap gap-1.5 pt-2 mb-2">
                    {s.portalVisibility === 'lista' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] font-bold uppercase tracking-wider">
                        📁 Lista no Portal
                      </span>
                    )}
                    {s.portalVisibility === 'sugestao' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold uppercase tracking-wider">
                        ✨ Sugestão/Upsell
                      </span>
                    )}
                    {s.portalVisibility === 'oculto' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold uppercase tracking-wider">
                        👁️ Oculto no Portal
                      </span>
                    )}
                    {s.countsForLoyaltyCard && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[9px] font-bold uppercase tracking-wider">
                        <Star size={10} />
                        Fidelidade
                      </span>
                    )}
                    {s.displayOrder !== undefined && s.displayOrder > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[9px] font-mono font-bold">
                        Ordem: {s.displayOrder}
                      </span>
                    )}
                    {s.portalVisibility === 'sugestao' && s.offerText && (
                      <span className="text-[10px] text-amber-400/80 italic block w-full mt-1">
                        "{s.offerText}"
                      </span>
                    )}
                  </div>

                  {/* Metrics Box */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/60">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Clock size={14} className="text-slate-500 shrink-0" />
                      <div>
                        <span className="text-[9px] text-slate-500 block leading-none">Tempo Estimado</span>
                        <span className="font-mono font-bold text-[11px]">{timeStr}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <DollarSign size={14} className="text-slate-500 shrink-0" />
                      <div className="min-w-0">
                        {s.pricingType === 'porte' ? (
                          <>
                            <span className="text-[9px] text-slate-500 block leading-none">Preço por Porte</span>
                            <span className="font-mono font-bold text-emerald-400 text-[10px] block mt-0.5" title="Preço por porte: Pequeno, Médio, Grande">
                              P: R${(s.priceP ?? s.basePrice).toFixed(0)} | M: R${(s.priceM ?? s.basePrice).toFixed(0)} | G: R${(s.priceG ?? s.basePrice).toFixed(0)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[9px] text-slate-500 block leading-none">Preço Único</span>
                            <span className="font-mono font-bold text-emerald-400 text-[11px]">R$ {s.basePrice.toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card action footer */}
                <div className="mt-5 pt-3 border-t border-slate-800/60 flex justify-end gap-2 text-xs">
                  {canEdit && (
                    <button 
                      onClick={() => handleOpenEdit(s)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600 rounded-lg font-semibold transition-colors flex items-center gap-1"
                    >
                      <Edit size={12} className="text-amber-400" />
                      <span>Editar</span>
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => void handleDeleteService(s)}
                      className="px-3 py-1.5 bg-slate-800/40 hover:bg-red-500/10 hover:text-red-400 border border-slate-850 hover:border-red-500/20 text-slate-400 rounded-lg transition-all"
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: ADICIONAR SERVIÇO */}
      {isOpenAdd && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl max-h-[92vh] rounded-2xl overflow-hidden shadow-2xl animate-scaleUp flex flex-col">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Novo Serviço Comercial</h3>
              <button onClick={() => setIsOpenAdd(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {errorMessage && (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-mono">
                  {errorMessage}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Título do Serviço *</label>
                <input 
                  type="text" 
                  required
                  disabled={isSaving}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                  placeholder="Ex: Vitrificação de Faróis"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Descrição Comercial *</label>
                <textarea 
                  required
                  disabled={isSaving}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white h-20 resize-none disabled:opacity-50"
                  placeholder="Descreva detalhadamente as etapas do serviço..."
                />
              </div>

              {/* Seletor de Tipo de Precificação */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Tipo de Precificação *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setFormData({ ...formData, pricingType: 'unico' })}
                    className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      formData.pricingType === 'unico' 
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Valor Único
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setFormData({ ...formData, pricingType: 'porte' })}
                    className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      formData.pricingType === 'porte' 
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Por Porte
                  </button>
                </div>
              </div>

              {formData.pricingType === 'porte' ? (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <span className="block text-[10px] font-bold text-sky-400 uppercase tracking-wider">Definição por Porte</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Porte P (R$)</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        step="0.01"
                        disabled={isSaving}
                        value={formData.priceP || ''}
                        onChange={(e) => setFormData({ ...formData, priceP: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2 py-1.5 text-white font-mono text-center text-xs disabled:opacity-50"
                        placeholder="Ex: 120"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Porte M (R$)</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        step="0.01"
                        disabled={isSaving}
                        value={formData.priceM || ''}
                        onChange={(e) => setFormData({ ...formData, priceM: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2 py-1.5 text-white font-mono text-center text-xs disabled:opacity-50"
                        placeholder="Ex: 150"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Porte G (R$)</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        step="0.01"
                        disabled={isSaving}
                        value={formData.priceG || ''}
                        onChange={(e) => setFormData({ ...formData, priceG: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2 py-1.5 text-white font-mono text-center text-xs disabled:opacity-50"
                        placeholder="Ex: 180"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Preço Base (R$) *</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.01"
                    disabled={isSaving}
                    value={formData.basePrice || ''}
                    onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono disabled:opacity-50"
                    placeholder="Ex: 150.00"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Tempo de Execução (minutos) *</label>
                <input 
                  type="number" 
                  required
                  min="15"
                  step="5"
                  disabled={isSaving}
                  value={formData.estimatedTime || ''}
                  onChange={(e) => setFormData({ ...formData, estimatedTime: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono disabled:opacity-50"
                  placeholder="Ex: 120"
                />
              </div>

              {/* Visibilidade no Portal */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Visibilidade no Portal *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setFormData({ ...formData, portalVisibility: 'lista' })}
                    className={`py-2 px-1 rounded-xl border text-center font-bold text-[10px] transition-all cursor-pointer ${
                      formData.portalVisibility === 'lista' 
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Lista de Serviços
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setFormData({ ...formData, portalVisibility: 'sugestao', isFeatured: true })}
                    className={`py-2 px-1 rounded-xl border text-center font-bold text-[10px] transition-all cursor-pointer ${
                      formData.portalVisibility === 'sugestao' 
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Sugestão
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setFormData({ ...formData, portalVisibility: 'oculto' })}
                    className={`py-2 px-1 rounded-xl border text-center font-bold text-[10px] transition-all cursor-pointer ${
                      formData.portalVisibility === 'oculto' 
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Oculto
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300">
                <input
                  type="checkbox"
                  disabled={isSaving}
                  checked={formData.countsForLoyaltyCard}
                  onChange={(e) => setFormData({ ...formData, countsForLoyaltyCard: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 disabled:opacity-50"
                />
                <span className="font-semibold">Conta para o cartão fidelidade</span>
              </label>

              {/* Configurações de Destaque / Upsell */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <span className="block text-[10px] font-bold text-sky-400 uppercase tracking-wider">Destaque &amp; Oferta (Upsell no Portal)</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Serviço em Destaque? *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => setFormData({ ...formData, isFeatured: true })}
                        className={`py-1.5 px-2 rounded-lg border text-center font-bold text-[10px] transition-all cursor-pointer ${
                          formData.isFeatured 
                            ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => setFormData({ ...formData, isFeatured: false })}
                        className={`py-1.5 px-2 rounded-lg border text-center font-bold text-[10px] transition-all cursor-pointer ${
                          !formData.isFeatured 
                            ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Não
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Ordem de Exibição</label>
                    <input 
                      type="number" 
                      min="0"
                      disabled={isSaving}
                      value={formData.displayOrder}
                      onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2 py-1.5 text-white font-mono text-center text-xs disabled:opacity-50"
                      placeholder="Ex: 1"
                    />
                  </div>
                </div>

                {formData.isFeatured && (
                  <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Texto da Oferta (Upsell)</label>
                    <input 
                      type="text" 
                      disabled={isSaving}
                      value={formData.offerText}
                      onChange={(e) => setFormData({ ...formData, offerText: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2 py-1.5 text-white text-xs disabled:opacity-50"
                      placeholder="Ex: Garante visibilidade máxima sob chuvas fortes."
                    />
                    </div>
                    <div>
                      <input
                        ref={addOfferImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => void handleOfferImageUpload(event.target.files?.[0])}
                      />
                      <button
                        type="button"
                        disabled={isSaving || isUploadingOfferImage}
                        onClick={() => addOfferImageInputRef.current?.click()}
                        className="w-full sm:w-auto px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 font-bold text-[10px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <ImageIcon size={12} />
                        {isUploadingOfferImage ? 'Enviando...' : 'Imagem da oferta'}
                      </button>
                      {formData.offerImageUrl && <p className="mt-1 text-[9px] text-emerald-300 truncate max-w-[170px]">Imagem adicionada</p>}
                    </div>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 -mx-4 -mb-4 px-4 py-3 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex justify-end gap-3 text-xs">
                <button 
                  type="button" 
                  disabled={isSaving}
                  onClick={() => setIsOpenAdd(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? 'Gravando...' : 'Confirmar Serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR SERVIÇO */}
      {isOpenEdit && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl max-h-[92vh] rounded-2xl overflow-hidden shadow-2xl animate-scaleUp flex flex-col">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Editar Serviço Comercial</h3>
              <button onClick={() => setIsOpenEdit(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {errorMessage && (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-mono">
                  {errorMessage}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Título do Serviço *</label>
                <input 
                  type="text" 
                  required
                  disabled={isSaving}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Descrição Comercial *</label>
                <textarea 
                  required
                  disabled={isSaving}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white h-20 resize-none disabled:opacity-50"
                />
              </div>

              {/* Seletor de Tipo de Precificação */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Tipo de Precificação *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setFormData({ ...formData, pricingType: 'unico' })}
                    className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      formData.pricingType === 'unico' 
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Valor Único
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setFormData({ ...formData, pricingType: 'porte' })}
                    className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      formData.pricingType === 'porte' 
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Por Porte
                  </button>
                </div>
              </div>

              {formData.pricingType === 'porte' ? (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <span className="block text-[10px] font-bold text-sky-400 uppercase tracking-wider">Definição por Porte</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Porte P (R$)</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        step="0.01"
                        disabled={isSaving}
                        value={formData.priceP || ''}
                        onChange={(e) => setFormData({ ...formData, priceP: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2 py-1.5 text-white font-mono text-center text-xs disabled:opacity-50"
                        placeholder="Ex: 120"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Porte M (R$)</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        step="0.01"
                        disabled={isSaving}
                        value={formData.priceM || ''}
                        onChange={(e) => setFormData({ ...formData, priceM: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2 py-1.5 text-white font-mono text-center text-xs disabled:opacity-50"
                        placeholder="Ex: 150"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Porte G (R$)</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        step="0.01"
                        disabled={isSaving}
                        value={formData.priceG || ''}
                        onChange={(e) => setFormData({ ...formData, priceG: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2 py-1.5 text-white font-mono text-center text-xs disabled:opacity-50"
                        placeholder="Ex: 180"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Preço Base (R$) *</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.01"
                    disabled={isSaving}
                    value={formData.basePrice || ''}
                    onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono disabled:opacity-50"
                    placeholder="Ex: 150.00"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Tempo Estimado (minutos) *</label>
                <input 
                  type="number" 
                  required
                  min="15"
                  step="5"
                  disabled={isSaving}
                  value={formData.estimatedTime || ''}
                  onChange={(e) => setFormData({ ...formData, estimatedTime: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono disabled:opacity-50"
                />
              </div>

              {/* Visibilidade no Portal */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Visibilidade no Portal *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setFormData({ ...formData, portalVisibility: 'lista' })}
                    className={`py-2 px-1 rounded-xl border text-center font-bold text-[10px] transition-all cursor-pointer ${
                      formData.portalVisibility === 'lista' 
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Lista de Serviços
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setFormData({ ...formData, portalVisibility: 'sugestao', isFeatured: true })}
                    className={`py-2 px-1 rounded-xl border text-center font-bold text-[10px] transition-all cursor-pointer ${
                      formData.portalVisibility === 'sugestao' 
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Sugestão
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setFormData({ ...formData, portalVisibility: 'oculto' })}
                    className={`py-2 px-1 rounded-xl border text-center font-bold text-[10px] transition-all cursor-pointer ${
                      formData.portalVisibility === 'oculto' 
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Oculto
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300">
                <input
                  type="checkbox"
                  disabled={isSaving}
                  checked={formData.countsForLoyaltyCard}
                  onChange={(e) => setFormData({ ...formData, countsForLoyaltyCard: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 disabled:opacity-50"
                />
                <span className="font-semibold">Conta para o cartão fidelidade</span>
              </label>

              {/* Configurações de Destaque / Upsell */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <span className="block text-[10px] font-bold text-sky-400 uppercase tracking-wider">Destaque &amp; Oferta (Upsell no Portal)</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Serviço em Destaque? *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => setFormData({ ...formData, isFeatured: true })}
                        className={`py-1.5 px-2 rounded-lg border text-center font-bold text-[10px] transition-all cursor-pointer ${
                          formData.isFeatured 
                            ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => setFormData({ ...formData, isFeatured: false })}
                        className={`py-1.5 px-2 rounded-lg border text-center font-bold text-[10px] transition-all cursor-pointer ${
                          !formData.isFeatured 
                            ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Não
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Ordem de Exibição</label>
                    <input 
                      type="number" 
                      min="0"
                      disabled={isSaving}
                      value={formData.displayOrder}
                      onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2 py-1.5 text-white font-mono text-center text-xs disabled:opacity-50"
                      placeholder="Ex: 1"
                    />
                  </div>
                </div>

                {formData.isFeatured && (
                  <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Texto da Oferta (Upsell)</label>
                    <input 
                      type="text" 
                      disabled={isSaving}
                      value={formData.offerText}
                      onChange={(e) => setFormData({ ...formData, offerText: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2 py-1.5 text-white text-xs disabled:opacity-50"
                      placeholder="Ex: Garante visibilidade máxima sob chuvas fortes."
                    />
                    </div>
                    <div>
                      <input
                        ref={editOfferImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => void handleOfferImageUpload(event.target.files?.[0])}
                      />
                      <button
                        type="button"
                        disabled={isSaving || isUploadingOfferImage}
                        onClick={() => editOfferImageInputRef.current?.click()}
                        className="w-full sm:w-auto px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 font-bold text-[10px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <ImageIcon size={12} />
                        {isUploadingOfferImage ? 'Enviando...' : 'Imagem da oferta'}
                      </button>
                      {formData.offerImageUrl && <p className="mt-1 text-[9px] text-emerald-300 truncate max-w-[170px]">Imagem adicionada</p>}
                    </div>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 -mx-4 -mb-4 px-4 py-3 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex justify-end gap-3 text-xs">
                <button 
                  type="button" 
                  disabled={isSaving}
                  onClick={() => setIsOpenEdit(false)}
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
    </div>
  );
}
