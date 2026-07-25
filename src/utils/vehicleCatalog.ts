import type { VehicleModel } from '../types';

export type VehiclePorte = 'Pequeno' | 'Médio' | 'Grande';

export interface VehicleBrandOption {
  id: string;
  name: string;
  order: number;
}

export interface VehicleModelOption {
  id: string;
  brandId: string;
  brandName: string;
  name: string;
  sizeCategory: 'P' | 'M' | 'G';
}

export interface VehicleCatalog {
  brands: VehicleBrandOption[];
  models: VehicleModelOption[];
}

export function sizeCategoryToPorte(sizeCategory: string | null | undefined): VehiclePorte {
  const normalized = sizeCategory?.trim().toLocaleLowerCase('pt-BR');
  if (normalized === 'p' || normalized === 'pequeno') return 'Pequeno';
  if (normalized === 'g' || normalized === 'grande') return 'Grande';
  return 'Médio';
}

export function buildVehicleCatalog(models: VehicleModel[]): VehicleCatalog {
  const activeModels = models.filter(model =>
    model.active && model.manufacturer.trim() && model.model.trim()
  );
  const manufacturers = [...new Set(activeModels.map(model => model.manufacturer.trim()))]
    .sort((left, right) => left.localeCompare(right, 'pt-BR'));

  const brands = manufacturers.map((name, index) => ({
    id: `catalog-brand-${index}`,
    name,
    order: index + 1
  }));

  return {
    brands,
    models: activeModels.map(model => {
      const brandName = model.manufacturer.trim();
      const brand = brands.find(candidate => candidate.name === brandName);
      return {
        id: model.id,
        brandId: brand?.id ?? `catalog-brand-${brandName}`,
        brandName,
        name: model.model.trim(),
        sizeCategory: model.size_category
      };
    })
  };
}

export function findVehicleModel(
  catalog: VehicleCatalog,
  brandName: string,
  modelName: string
): VehicleModelOption | undefined {
  const normalizedBrand = brandName.trim().toLocaleLowerCase('pt-BR');
  const normalizedModel = modelName.trim().toLocaleLowerCase('pt-BR');
  return catalog.models.find(model =>
    model.brandName.toLocaleLowerCase('pt-BR') === normalizedBrand
    && model.name.toLocaleLowerCase('pt-BR') === normalizedModel
  );
}

export function resolveVehiclePorte(
  catalog: VehicleCatalog,
  brandName: string,
  modelName: string,
  fallback: VehiclePorte = 'Médio'
): VehiclePorte {
  const model = findVehicleModel(catalog, brandName, modelName);
  return model ? sizeCategoryToPorte(model.sizeCategory) : fallback;
}
