import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfiguratorState, WorkloadType } from '@kiroportal/types';

// Mock the catalog service
vi.mock('./catalog.service.js', () => ({
  getProductCount: vi.fn().mockResolvedValue(0),
}));

import { getProductCount } from './catalog.service.js';
import {
  WORKLOAD_PROFILES,
  getWorkloadTypes,
  configToFilters,
  matchProducts,
} from './configurator.service.js';

const mockGetProductCount = getProductCount as ReturnType<typeof vi.fn>;

// ─── Helper: create a WorkloadType from profile ID ───────────────────────────

function makeWorkloadType(id: string): WorkloadType {
  const profile = WORKLOAD_PROFILES[id]!;
  return {
    id,
    name: id,
    description: `${id} workload`,
    defaults: {
      minCores: profile.minCores,
      minRamGb: profile.minRamGb,
      storageType: profile.storageType ?? '',
    },
  };
}

// ─── WORKLOAD_PROFILES Tests ─────────────────────────────────────────────────

describe('WORKLOAD_PROFILES', () => {
  it('defines all six workload profiles', () => {
    expect(Object.keys(WORKLOAD_PROFILES)).toEqual(
      expect.arrayContaining([
        'database',
        'virtualization',
        'web_hosting',
        'ai_ml',
        'file_storage',
        'general',
      ]),
    );
    expect(Object.keys(WORKLOAD_PROFILES)).toHaveLength(6);
  });

  it('database profile has correct specs', () => {
    expect(WORKLOAD_PROFILES.database).toEqual({
      minCores: 16,
      minRamGb: 64,
      storageType: 'NVMe',
      minStorageGb: 500,
    });
  });

  it('virtualization profile has correct specs', () => {
    expect(WORKLOAD_PROFILES.virtualization).toEqual({
      minCores: 32,
      minRamGb: 128,
      storageType: 'SSD',
      minStorageGb: 1000,
    });
  });

  it('web_hosting profile has correct specs', () => {
    expect(WORKLOAD_PROFILES.web_hosting).toEqual({
      minCores: 8,
      minRamGb: 32,
      storageType: 'SSD',
      minStorageGb: 250,
    });
  });

  it('ai_ml profile has correct specs', () => {
    expect(WORKLOAD_PROFILES.ai_ml).toEqual({
      minCores: 32,
      minRamGb: 256,
      storageType: 'NVMe',
      minStorageGb: 2000,
    });
  });

  it('file_storage profile has correct specs', () => {
    expect(WORKLOAD_PROFILES.file_storage).toEqual({
      minCores: 4,
      minRamGb: 16,
      storageType: 'HDD',
      minStorageGb: 4000,
    });
  });

  it('general profile has correct specs with undefined storageType', () => {
    expect(WORKLOAD_PROFILES.general).toEqual({
      minCores: 4,
      minRamGb: 16,
      storageType: undefined,
      minStorageGb: 100,
    });
  });
});

// ─── getWorkloadTypes Tests ──────────────────────────────────────────────────

describe('getWorkloadTypes', () => {
  it('returns all six workload types', () => {
    const types = getWorkloadTypes();
    expect(types).toHaveLength(6);
  });

  it('each workload type has id, name, description, and defaults', () => {
    const types = getWorkloadTypes();
    for (const wt of types) {
      expect(wt.id).toBeTruthy();
      expect(wt.name).toBeTruthy();
      expect(wt.description).toBeTruthy();
      expect(wt.defaults).toBeDefined();
      expect(wt.defaults.minCores).toBeGreaterThan(0);
      expect(wt.defaults.minRamGb).toBeGreaterThan(0);
    }
  });

  it('includes database workload type with correct defaults', () => {
    const types = getWorkloadTypes();
    const db = types.find(t => t.id === 'database');
    expect(db).toBeDefined();
    expect(db!.defaults.minCores).toBe(16);
    expect(db!.defaults.minRamGb).toBe(64);
    expect(db!.defaults.storageType).toBe('NVMe');
  });

  it('general workload type has empty string for storageType', () => {
    const types = getWorkloadTypes();
    const general = types.find(t => t.id === 'general');
    expect(general).toBeDefined();
    expect(general!.defaults.storageType).toBe('');
  });
});

// ─── configToFilters Tests ───────────────────────────────────────────────────

describe('configToFilters', () => {
  it('returns empty filters when no workload or selections', () => {
    const config: ConfiguratorState = { step: 1 };
    const filters = configToFilters(config);
    expect(filters).toEqual({});
  });

  it('applies workload profile defaults for database', () => {
    const config: ConfiguratorState = {
      step: 1,
      workloadType: makeWorkloadType('database'),
    };
    const filters = configToFilters(config);

    expect(filters.cpuCores).toEqual({ min: 16 });
    expect(filters.ramGb).toEqual({ min: 64 });
    expect(filters.storageType).toEqual(['NVMe']);
    expect(filters.storageSize).toEqual({ min: 500 });
  });

  it('applies workload profile defaults for ai_ml', () => {
    const config: ConfiguratorState = {
      step: 1,
      workloadType: makeWorkloadType('ai_ml'),
    };
    const filters = configToFilters(config);

    expect(filters.cpuCores).toEqual({ min: 32 });
    expect(filters.ramGb).toEqual({ min: 256 });
    expect(filters.storageType).toEqual(['NVMe']);
    expect(filters.storageSize).toEqual({ min: 2000 });
  });

  it('does not set storageType filter for general workload', () => {
    const config: ConfiguratorState = {
      step: 1,
      workloadType: makeWorkloadType('general'),
    };
    const filters = configToFilters(config);

    expect(filters.cpuCores).toEqual({ min: 4 });
    expect(filters.ramGb).toEqual({ min: 16 });
    expect(filters.storageType).toBeUndefined();
    expect(filters.storageSize).toEqual({ min: 100 });
  });

  it('overrides workload defaults with CPU user selections', () => {
    const config: ConfiguratorState = {
      step: 2,
      workloadType: makeWorkloadType('database'),
      cpu: {
        family: 'Xeon',
        cores: { min: 32, max: 64 },
        count: 2,
        frequency: { min: 2.4, max: 3.8 },
        socket: 'LGA 4189',
      },
    };
    const filters = configToFilters(config);

    // CPU selections override workload defaults
    expect(filters.cpuFamily).toEqual(['Xeon']);
    expect(filters.cpuCores).toEqual({ min: 32, max: 64 }); // overrides workload min:16
    expect(filters.cpuCount).toEqual([2]);
    expect(filters.cpuFrequency).toEqual({ min: 2.4, max: 3.8 });
    expect(filters.cpuSocket).toEqual(['LGA 4189']);

    // Workload defaults still apply for non-overridden fields
    expect(filters.ramGb).toEqual({ min: 64 });
    expect(filters.storageType).toEqual(['NVMe']);
    expect(filters.storageSize).toEqual({ min: 500 });
  });

  it('overrides workload defaults with RAM user selections', () => {
    const config: ConfiguratorState = {
      step: 3,
      workloadType: makeWorkloadType('database'),
      ram: {
        sizeGb: { min: 128, max: 512 },
        type: 'DDR5',
        frequency: { min: 4800, max: 5600 },
        slots: 16,
      },
    };
    const filters = configToFilters(config);

    // RAM selections override workload defaults
    expect(filters.ramGb).toEqual({ min: 128, max: 512 }); // overrides workload min:64
    expect(filters.ramType).toEqual(['DDR5']);
    expect(filters.ramFrequency).toEqual({ min: 4800, max: 5600 });
    expect(filters.ramSlots).toEqual([16]);

    // Workload defaults still apply for non-overridden fields
    expect(filters.cpuCores).toEqual({ min: 16 });
    expect(filters.storageType).toEqual(['NVMe']);
  });

  it('overrides workload defaults with storage user selections', () => {
    const config: ConfiguratorState = {
      step: 4,
      workloadType: makeWorkloadType('database'),
      storage: {
        type: 'SSD',
        sizeGb: { min: 1000, max: 4000 },
        hotSwap: true,
      },
    };
    const filters = configToFilters(config);

    // Storage selections override workload defaults
    expect(filters.storageType).toEqual(['SSD']); // overrides workload NVMe
    expect(filters.storageSize).toEqual({ min: 1000, max: 4000 }); // overrides workload min:500
    expect(filters.hotSwap).toBe(true);

    // Workload defaults still apply for non-overridden fields
    expect(filters.cpuCores).toEqual({ min: 16 });
    expect(filters.ramGb).toEqual({ min: 64 });
  });

  it('applies all steps together for full configuration', () => {
    const config: ConfiguratorState = {
      step: 4,
      workloadType: makeWorkloadType('virtualization'),
      cpu: {
        family: 'EPYC',
        cores: { min: 64, max: 128 },
        count: 2,
        frequency: { min: 2.0, max: 4.0 },
        socket: 'SP3',
      },
      ram: {
        sizeGb: { min: 256, max: 1024 },
        type: 'DDR4',
        frequency: { min: 3200, max: 3600 },
      },
      storage: {
        type: 'NVMe',
        sizeGb: { min: 2000, max: 8000 },
        hotSwap: true,
        count: 4,
      },
    };
    const filters = configToFilters(config);

    expect(filters.cpuFamily).toEqual(['EPYC']);
    expect(filters.cpuCores).toEqual({ min: 64, max: 128 });
    expect(filters.cpuCount).toEqual([2]);
    expect(filters.cpuFrequency).toEqual({ min: 2.0, max: 4.0 });
    expect(filters.cpuSocket).toEqual(['SP3']);
    expect(filters.ramGb).toEqual({ min: 256, max: 1024 });
    expect(filters.ramType).toEqual(['DDR4']);
    expect(filters.ramFrequency).toEqual({ min: 3200, max: 3600 });
    expect(filters.storageType).toEqual(['NVMe']);
    expect(filters.storageSize).toEqual({ min: 2000, max: 8000 });
    expect(filters.hotSwap).toBe(true);
  });

  it('handles partial CPU config (only family specified)', () => {
    const config: ConfiguratorState = {
      step: 2,
      workloadType: makeWorkloadType('web_hosting'),
      cpu: {
        family: 'Xeon',
        cores: { min: 0, max: 0 },
        count: 0,
        frequency: { min: 0, max: 0 },
      },
    };
    const filters = configToFilters(config);

    expect(filters.cpuFamily).toEqual(['Xeon']);
    // Zero values are falsy, so workload defaults remain
    expect(filters.cpuCores).toEqual({ min: 0, max: 0 });
  });

  it('does not set hotSwap filter when storage.hotSwap is undefined', () => {
    const config: ConfiguratorState = {
      step: 4,
      workloadType: makeWorkloadType('general'),
      storage: {
        type: 'SSD',
        sizeGb: { min: 500, max: 2000 },
        hotSwap: undefined as unknown as boolean,
      },
    };
    const filters = configToFilters(config);

    expect(filters.hotSwap).toBeUndefined();
  });
});

// ─── matchProducts Tests ─────────────────────────────────────────────────────

describe('matchProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getProductCount with filters derived from config', async () => {
    mockGetProductCount.mockResolvedValue(42);

    const config: ConfiguratorState = {
      step: 1,
      workloadType: makeWorkloadType('database'),
    };
    const result = await matchProducts(config);

    expect(mockGetProductCount).toHaveBeenCalledWith(
      expect.objectContaining({
        cpuCores: { min: 16 },
        ramGb: { min: 64 },
        storageType: ['NVMe'],
        storageSize: { min: 500 },
      }),
    );
    expect(result.totalMatches).toBe(42);
  });

  it('returns the equivalent filters for catalog redirect', async () => {
    mockGetProductCount.mockResolvedValue(10);

    const config: ConfiguratorState = {
      step: 2,
      workloadType: makeWorkloadType('web_hosting'),
      cpu: {
        family: 'Xeon',
        cores: { min: 16, max: 32 },
        count: 1,
        frequency: { min: 2.0, max: 4.0 },
      },
    };
    const result = await matchProducts(config);

    expect(result.filters).toEqual(
      expect.objectContaining({
        cpuFamily: ['Xeon'],
        cpuCores: { min: 16, max: 32 },
        cpuCount: [1],
        cpuFrequency: { min: 2.0, max: 4.0 },
        ramGb: { min: 32 },
        storageType: ['SSD'],
        storageSize: { min: 250 },
      }),
    );
  });

  it('returns empty products array (products fetched separately)', async () => {
    mockGetProductCount.mockResolvedValue(5);

    const config: ConfiguratorState = {
      step: 1,
      workloadType: makeWorkloadType('general'),
    };
    const result = await matchProducts(config);

    expect(result.products).toEqual([]);
  });

  it('returns 0 matches when no products match', async () => {
    mockGetProductCount.mockResolvedValue(0);

    const config: ConfiguratorState = {
      step: 4,
      workloadType: makeWorkloadType('ai_ml'),
      cpu: {
        family: 'NonExistent',
        cores: { min: 128, max: 256 },
        count: 8,
        frequency: { min: 5.0, max: 6.0 },
      },
      ram: {
        sizeGb: { min: 2048, max: 4096 },
        type: 'DDR6',
      },
      storage: {
        type: 'NVMe',
        sizeGb: { min: 100000, max: 200000 },
        hotSwap: true,
      },
    };
    const result = await matchProducts(config);

    expect(result.totalMatches).toBe(0);
  });

  it('progressive narrowing: more steps produce tighter filters', async () => {
    // Step 1: workload only
    const step1Config: ConfiguratorState = {
      step: 1,
      workloadType: makeWorkloadType('database'),
    };
    const step1Filters = configToFilters(step1Config);

    // Step 2: workload + CPU
    const step2Config: ConfiguratorState = {
      step: 2,
      workloadType: makeWorkloadType('database'),
      cpu: {
        family: 'Xeon',
        cores: { min: 32, max: 64 },
        count: 2,
        frequency: { min: 2.4, max: 3.8 },
      },
    };
    const step2Filters = configToFilters(step2Config);

    // Step 2 has more filter keys than step 1
    const step1Keys = Object.keys(step1Filters).filter(
      k => step1Filters[k as keyof typeof step1Filters] !== undefined,
    );
    const step2Keys = Object.keys(step2Filters).filter(
      k => step2Filters[k as keyof typeof step2Filters] !== undefined,
    );
    expect(step2Keys.length).toBeGreaterThanOrEqual(step1Keys.length);

    // Step 2 CPU cores are tighter (min:32 vs min:16 from workload)
    expect(step2Filters.cpuCores!.min).toBeGreaterThanOrEqual(step1Filters.cpuCores!.min!);
  });
});
