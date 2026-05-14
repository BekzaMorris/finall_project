import type {
  ConfiguratorState,
  WorkloadType,
  ProductFilters,
  MatchResult,
} from '@kiroportal/types';
import { getProductCount } from './catalog.service.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Internal workload profile with recommended minimum specs */
export interface WorkloadProfile {
  minCores: number;
  minRamGb: number;
  storageType: string | undefined;
  minStorageGb: number;
}

// ─── Workload Profiles ───────────────────────────────────────────────────────

/**
 * Maps workload types to recommended minimum hardware specifications.
 * These defaults are applied as the baseline when a workload is selected,
 * then overridden by user selections in subsequent steps.
 */
export const WORKLOAD_PROFILES: Record<string, WorkloadProfile> = {
  database: { minCores: 16, minRamGb: 64, storageType: 'NVMe', minStorageGb: 500 },
  virtualization: { minCores: 32, minRamGb: 128, storageType: 'SSD', minStorageGb: 1000 },
  web_hosting: { minCores: 8, minRamGb: 32, storageType: 'SSD', minStorageGb: 250 },
  ai_ml: { minCores: 32, minRamGb: 256, storageType: 'NVMe', minStorageGb: 2000 },
  file_storage: { minCores: 4, minRamGb: 16, storageType: 'HDD', minStorageGb: 4000 },
  general: { minCores: 4, minRamGb: 16, storageType: undefined, minStorageGb: 100 },
};

// ─── Workload Type Descriptions ──────────────────────────────────────────────

const WORKLOAD_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  database: {
    name: 'Database Server',
    description: 'Optimized for high-performance database workloads with fast NVMe storage and ample RAM.',
  },
  virtualization: {
    name: 'Virtualization Host',
    description: 'High core count and memory for running multiple virtual machines simultaneously.',
  },
  web_hosting: {
    name: 'Web Hosting',
    description: 'Balanced configuration for serving web applications and handling HTTP traffic.',
  },
  ai_ml: {
    name: 'AI / Machine Learning',
    description: 'Maximum compute and memory for training models and running inference workloads.',
  },
  file_storage: {
    name: 'File Storage',
    description: 'Large capacity storage optimized for file serving and backup operations.',
  },
  general: {
    name: 'General Purpose',
    description: 'Flexible configuration suitable for mixed workloads and general computing tasks.',
  },
};

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Returns the list of available workload types with descriptions.
 * Used to populate the workload selection step in the configurator wizard.
 */
export function getWorkloadTypes(): WorkloadType[] {
  return Object.entries(WORKLOAD_PROFILES).map(([id, profile]) => {
    const desc = WORKLOAD_DESCRIPTIONS[id] ?? { name: id, description: '' };
    return {
      id,
      name: desc.name,
      description: desc.description,
      defaults: {
        minCores: profile.minCores,
        minRamGb: profile.minRamGb,
        storageType: profile.storageType ?? '',
      },
    };
  });
}

/**
 * Converts a ConfiguratorState into ProductFilters.
 *
 * The algorithm:
 * 1. Start with workload profile defaults (baseline constraints)
 * 2. Override with user selections from each completed step
 *
 * This ensures the match count is monotonically non-increasing as steps advance,
 * because each step can only add or tighten constraints, never remove them.
 */
export function configToFilters(config: ConfiguratorState): ProductFilters {
  const filters: ProductFilters = {};

  // Step 1: Apply workload profile defaults
  if (config.workloadType) {
    const profileId = config.workloadType.id;
    const profile = WORKLOAD_PROFILES[profileId] ?? WORKLOAD_PROFILES.general!;

    filters.cpuCores = { min: profile.minCores };
    filters.ramGb = { min: profile.minRamGb };
    filters.storageSize = { min: profile.minStorageGb };
    if (profile.storageType) {
      filters.storageType = [profile.storageType];
    }
  }

  // Step 2: Override with CPU user selections (step >= 2)
  if (config.cpu) {
    if (config.cpu.family) {
      filters.cpuFamily = [config.cpu.family];
    }
    if (config.cpu.cores) {
      // User CPU cores selection overrides workload default
      filters.cpuCores = config.cpu.cores;
    }
    if (config.cpu.count) {
      filters.cpuCount = [config.cpu.count];
    }
    if (config.cpu.frequency) {
      filters.cpuFrequency = config.cpu.frequency;
    }
    if (config.cpu.socket) {
      filters.cpuSocket = [config.cpu.socket];
    }
  }

  // Step 3: Override with RAM user selections (step >= 3)
  if (config.ram) {
    if (config.ram.sizeGb) {
      // User RAM size selection overrides workload default
      filters.ramGb = config.ram.sizeGb;
    }
    if (config.ram.type) {
      filters.ramType = [config.ram.type];
    }
    if (config.ram.frequency) {
      filters.ramFrequency = config.ram.frequency;
    }
    if (config.ram.slots) {
      filters.ramSlots = [config.ram.slots];
    }
  }

  // Step 4: Override with storage user selections (step >= 4)
  if (config.storage) {
    if (config.storage.type) {
      // User storage type selection overrides workload default
      filters.storageType = [config.storage.type];
    }
    if (config.storage.sizeGb) {
      // User storage size selection overrides workload default
      filters.storageSize = config.storage.sizeGb;
    }
    if (config.storage.hotSwap !== undefined) {
      filters.hotSwap = config.storage.hotSwap;
    }
  }

  return filters;
}

/**
 * Matches products against the current configurator state.
 *
 * Progressive matching:
 * - Applies workload profile defaults as baseline
 * - Overrides with user selections from each completed step
 * - Returns the total match count and equivalent filters for catalog redirect
 *
 * The match count is monotonically non-increasing as steps advance because
 * each step only adds or tightens constraints.
 */
export async function matchProducts(config: ConfiguratorState): Promise<MatchResult> {
  const filters = configToFilters(config);
  const totalMatches = await getProductCount(filters);

  return {
    products: [], // Products are fetched separately via catalog when needed
    totalMatches,
    filters,
  };
}
