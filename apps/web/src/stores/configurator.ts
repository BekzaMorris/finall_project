import { create } from 'zustand';
import type {
  CpuConfig,
  RamConfig,
  StorageConfig,
  ProductFilters,
} from '@kiroportal/types';
import { apiClient } from '../lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContactInfo {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  company?: string;
}

interface MatchResponse {
  totalMatches: number;
  filters: ProductFilters;
}

interface QuoteResponse {
  quoteId: string;
  message: string;
}

// ─── Store State ─────────────────────────────────────────────────────────────

interface ConfiguratorState {
  step: 1 | 2 | 3 | 4;
  workloadType: string | null;
  cpu: Partial<CpuConfig> | null;
  ram: Partial<RamConfig> | null;
  storage: Partial<StorageConfig> | null;
  matchCount: number | null;
  isLoading: boolean;
  error: string | null;
  filters: ProductFilters | null;
}

interface ConfiguratorActions {
  setStep: (step: 1 | 2 | 3 | 4) => void;
  setWorkloadType: (type: string) => void;
  setCpu: (config: Partial<CpuConfig>) => void;
  setRam: (config: Partial<RamConfig>) => void;
  setStorage: (config: Partial<StorageConfig>) => void;
  fetchMatches: () => Promise<void>;
  getFiltersForCatalog: () => string;
  submitQuote: (contactInfo: ContactInfo) => Promise<QuoteResponse>;
  reset: () => void;
}

type ConfiguratorStore = ConfiguratorState & ConfiguratorActions;

// ─── Initial State ───────────────────────────────────────────────────────────

const initialState: ConfiguratorState = {
  step: 1,
  workloadType: null,
  cpu: null,
  ram: null,
  storage: null,
  matchCount: null,
  isLoading: false,
  error: null,
  filters: null,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useConfiguratorStore = create<ConfiguratorStore>()((set, get) => ({
  ...initialState,

  setStep: (step) => {
    set({ step });
  },

  setWorkloadType: (type) => {
    set({ workloadType: type, step: 2, error: null });
    get().fetchMatches();
  },

  setCpu: (config) => {
    set({ cpu: config, step: 3, error: null });
    get().fetchMatches();
  },

  setRam: (config) => {
    set({ ram: config, step: 4, error: null });
    get().fetchMatches();
  },

  setStorage: (config) => {
    set({ storage: config, error: null });
    get().fetchMatches();
  },

  fetchMatches: async () => {
    const { workloadType, cpu, ram, storage, step } = get();

    set({ isLoading: true, error: null });

    try {
      const body: Record<string, unknown> = { step };

      if (workloadType) {
        body.workloadType = workloadType;
      }
      if (cpu) {
        body.cpu = cpu;
      }
      if (ram) {
        body.ram = ram;
      }
      if (storage) {
        body.storage = storage;
      }

      const result = await apiClient<MatchResponse>('/configurator/match', {
        method: 'POST',
        body,
      });

      const newState: Partial<ConfiguratorState> = {
        matchCount: result.totalMatches,
        filters: result.filters,
        isLoading: false,
      };

      // Display notification when match count reaches zero
      if (result.totalMatches === 0) {
        newState.error =
          'No products match the current criteria. Please revise your parameters.';
      }

      set(newState);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch matches';
      set({ isLoading: false, error: message });
    }
  },

  getFiltersForCatalog: () => {
    const { filters } = get();
    if (!filters) return '/catalog';

    const params = new URLSearchParams();

    if (filters.cpuFamily?.length) {
      params.set('cpuFamily', filters.cpuFamily.join(','));
    }
    if (filters.cpuCores) {
      if (filters.cpuCores.min !== undefined) {
        params.set('cpuCoresMin', String(filters.cpuCores.min));
      }
      if (filters.cpuCores.max !== undefined) {
        params.set('cpuCoresMax', String(filters.cpuCores.max));
      }
    }
    if (filters.cpuCount?.length) {
      params.set('cpuCount', filters.cpuCount.join(','));
    }
    if (filters.cpuFrequency) {
      if (filters.cpuFrequency.min !== undefined) {
        params.set('cpuFrequencyMin', String(filters.cpuFrequency.min));
      }
      if (filters.cpuFrequency.max !== undefined) {
        params.set('cpuFrequencyMax', String(filters.cpuFrequency.max));
      }
    }
    if (filters.cpuSocket?.length) {
      params.set('cpuSocket', filters.cpuSocket.join(','));
    }
    if (filters.ramGb) {
      if (filters.ramGb.min !== undefined) {
        params.set('ramGbMin', String(filters.ramGb.min));
      }
      if (filters.ramGb.max !== undefined) {
        params.set('ramGbMax', String(filters.ramGb.max));
      }
    }
    if (filters.ramType?.length) {
      params.set('ramType', filters.ramType.join(','));
    }
    if (filters.ramFrequency) {
      if (filters.ramFrequency.min !== undefined) {
        params.set('ramFrequencyMin', String(filters.ramFrequency.min));
      }
      if (filters.ramFrequency.max !== undefined) {
        params.set('ramFrequencyMax', String(filters.ramFrequency.max));
      }
    }
    if (filters.storageType?.length) {
      params.set('storageType', filters.storageType.join(','));
    }
    if (filters.storageSize) {
      if (filters.storageSize.min !== undefined) {
        params.set('storageSizeMin', String(filters.storageSize.min));
      }
      if (filters.storageSize.max !== undefined) {
        params.set('storageSizeMax', String(filters.storageSize.max));
      }
    }
    if (filters.hotSwap !== undefined) {
      params.set('hotSwap', String(filters.hotSwap));
    }
    if (filters.condition?.length) {
      params.set('condition', filters.condition.join(','));
    }
    if (filters.stockStatus?.length) {
      params.set('stockStatus', filters.stockStatus.join(','));
    }

    const queryString = params.toString();
    return queryString ? `/catalog?${queryString}` : '/catalog';
  },

  submitQuote: async (contactInfo) => {
    const { workloadType, cpu, ram, storage } = get();

    const body = {
      configuration: {
        workloadType: workloadType ?? undefined,
        cpu: cpu ?? undefined,
        ram: ram ?? undefined,
        storage: storage ?? undefined,
      },
      ...contactInfo,
    };

    const result = await apiClient<QuoteResponse>('/configurator/quote', {
      method: 'POST',
      body,
    });

    return result;
  },

  reset: () => {
    set(initialState);
  },
}));
