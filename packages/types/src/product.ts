import { Condition, StockStatus } from './enums';

// ─── Product Types ───────────────────────────────────────────────────────────

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  alt?: string;
  order: number;
  createdAt: Date;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  condition: Condition;
  stockStatus: StockStatus;
  price: number;
  originalPrice?: number;
  brand: string;
  model: string;

  // CPU Specifications
  cpuFamily: string;
  cpuModel: string;
  cpuCores: number;
  cpuThreads: number;
  cpuCount: number;
  cpuFrequency: number; // GHz
  cpuBoostFrequency?: number; // GHz
  cpuSocket: string;

  // RAM Specifications
  ramGb: number;
  ramType: string; // DDR4, DDR5
  ramFrequency: number; // MHz
  ramSlots: number;
  ramSlotsUsed: number;

  // Storage Specifications
  storageType: string; // SSD, HDD, NVMe
  storageSizeGb: number;
  storageCount: number;
  hotSwap: boolean;

  // Physical Specifications
  formFactor: string; // 1U, 2U, 4U, Tower
  units: number;
  psuWattage: number;
  psuRedundant: boolean;

  // Metadata
  customFields: Record<string, unknown>; // JSONB
  images: ProductImage[];
  seoTitle?: string;
  seoDescription?: string;
  featured: boolean;
  viewCount: number;

  createdAt: Date;
  updatedAt: Date;
}
