import type { Product } from './product';
import type { ProductFilters } from './catalog';

// ─── Configurator Types ──────────────────────────────────────────────────────

export interface WorkloadType {
  id: string;
  name: string;
  description: string;
  icon?: string;
  defaults: {
    minCores: number;
    minRamGb: number;
    storageType: string;
  };
}

export interface CpuConfig {
  family: string;
  cores: { min: number; max: number };
  count: number;
  frequency: { min: number; max: number };
  socket?: string;
}

export interface RamConfig {
  sizeGb: { min: number; max: number };
  type: string;
  frequency?: { min: number; max: number };
  slots?: number;
}

export interface StorageConfig {
  type: string;
  sizeGb: { min: number; max: number };
  hotSwap: boolean;
  count?: number;
}

export interface ConfiguratorState {
  step: 1 | 2 | 3 | 4;
  workloadType?: WorkloadType;
  cpu?: CpuConfig;
  ram?: RamConfig;
  storage?: StorageConfig;
}

export interface MatchResult {
  products: Product[];
  totalMatches: number;
  filters: ProductFilters;
}
