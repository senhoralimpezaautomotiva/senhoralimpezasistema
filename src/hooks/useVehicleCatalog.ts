import { useEffect, useState } from 'react';
import { PREFILLED_VEHICLE_MODELS } from '../data/prefilledModels';
import { dbInstance } from '../db/localDb';
import { safeLog } from '../security/safeOutput';
import type { VehicleModel } from '../types';
import { buildVehicleCatalog, type VehicleCatalog } from '../utils/vehicleCatalog';

const fallbackCatalog = buildVehicleCatalog(PREFILLED_VEHICLE_MODELS);

export function useVehicleCatalog(): VehicleCatalog {
  const [catalog, setCatalog] = useState<VehicleCatalog>(fallbackCatalog);

  useEffect(() => {
    let disposed = false;

    const loadCatalog = async () => {
      if (!dbInstance.config.useRealSupabase) {
        const localModels = dbInstance.vehicleModels.length
          ? dbInstance.vehicleModels
          : PREFILLED_VEHICLE_MODELS;
        if (!disposed) setCatalog(buildVehicleCatalog(localModels));
        return;
      }

      try {
        const supabase = dbInstance.getSupabaseClient();
        const [brandsResult, modelsResult] = await Promise.all([
          supabase
            .from('marcas_veiculos')
            .select('id,nome,ordem')
            .eq('ativo', true)
            .order('ordem', { ascending: true }),
          supabase
            .from('modelos_veiculos')
            .select('id,marca_id,nome,porte')
            .eq('ativo', true)
        ]);

        if (brandsResult.error || modelsResult.error) {
          throw brandsResult.error || modelsResult.error;
        }

        const brands = (brandsResult.data ?? []).map((brand, index) => ({
          id: String(brand.id),
          name: String(brand.nome),
          order: Number(brand.ordem ?? index + 1)
        }));
        const brandById = new Map(brands.map(brand => [brand.id, brand.name]));
        const models = (modelsResult.data ?? [])
          .map(model => ({
            id: String(model.id),
            brandId: String(model.marca_id),
            brandName: brandById.get(String(model.marca_id)) ?? '',
            name: String(model.nome ?? ''),
            sizeCategory: String(model.porte ?? 'M') as VehicleModel['size_category']
          }))
          .filter(model => model.brandName && model.name);

        if (!disposed && models.length) {
          setCatalog({ brands, models });
        }
      } catch (error) {
        safeLog('error', 'vehicle_catalog.load', 'error', { error });
        if (!disposed) setCatalog(fallbackCatalog);
      }
    };

    void loadCatalog();
    return () => {
      disposed = true;
    };
  }, []);

  return catalog;
}
