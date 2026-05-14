import { z } from 'zod';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validates that a number has at most 2 decimal places.
 */
function hasMaxTwoDecimals(val: number): boolean {
  const str = val.toString();
  const decimalIndex = str.indexOf('.');
  if (decimalIndex === -1) return true;
  return str.length - decimalIndex - 1 <= 2;
}

/**
 * Validates that a number is a power of 2 within the allowed RAM range (8-2048).
 */
const VALID_RAM_VALUES = [8, 16, 32, 64, 128, 256, 512, 1024, 2048] as const;

function isPowerOfTwoInRange(val: number): boolean {
  return (VALID_RAM_VALUES as readonly number[]).includes(val);
}

// ─── Product Field Schemas ───────────────────────────────────────────────────

const priceSchema = z
  .number()
  .positive('Price must be positive')
  .refine(hasMaxTwoDecimals, 'Price must have at most 2 decimal places');

const cpuCoresSchema = z
  .number()
  .int('CPU cores must be an integer')
  .min(1, 'CPU cores must be at least 1')
  .max(128, 'CPU cores must be at most 128');

const cpuCountSchema = z
  .number()
  .int('CPU count must be an integer')
  .min(1, 'CPU count must be at least 1')
  .max(8, 'CPU count must be at most 8');

const ramGbSchema = z
  .number()
  .int('RAM must be an integer')
  .refine(isPowerOfTwoInRange, 'RAM must be a power of 2 between 8 and 2048 GB');

const unitCountSchema = z
  .number()
  .int('Unit count must be an integer')
  .min(1, 'Unit count must be at least 1')
  .max(48, 'Unit count must be at most 48');

const psuWattSchema = z
  .number()
  .int('PSU wattage must be an integer')
  .min(100, 'PSU wattage must be at least 100')
  .max(3000, 'PSU wattage must be at most 3000');

const conditionEnum = z.enum(['NEW', 'USED', 'REFURBISHED']);
const stockStatusEnum = z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER']);

// ─── Create Product Schema ───────────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(500, 'Name must be at most 500 characters'),
  sku: z.string().min(1, 'SKU is required').max(100, 'SKU must be at most 100 characters'),
  brand: z.string().min(1, 'Brand is required').max(200, 'Brand must be at most 200 characters'),
  condition: conditionEnum,
  price: priceSchema,
  priceOld: priceSchema.optional(),
  stock: z.number().int().min(0).optional(),
  stockStatus: stockStatusEnum,

  // CPU Specifications
  cpuFamily: z.string().max(100).optional(),
  cpuModel: z.string().max(200).optional(),
  cpuCores: cpuCoresSchema.optional(),
  cpuThreads: z.number().int().positive().optional(),
  cpuFreqMhz: z.number().int().positive().optional(),
  cpuBoostMhz: z.number().int().positive().optional(),
  cpuSocket: z.string().max(100).optional(),
  cpuCount: cpuCountSchema.optional(),
  cpuMaxCount: z.number().int().min(1).max(8).optional(),

  // RAM Specifications
  ramGb: ramGbSchema.optional(),
  ramType: z.string().max(50).optional(),
  ramFreqMhz: z.number().int().positive().optional(),
  ramSlotsUsed: z.number().int().min(0).optional(),
  ramSlotsTotal: z.number().int().min(1).optional(),

  // Storage Specifications
  diskType: z.string().max(50).optional(),
  diskGb: z.number().int().positive().optional(),
  diskBays: z.number().int().positive().optional(),
  diskRaid: z.string().max(50).optional(),
  diskHotswap: z.boolean().optional(),

  // Form Factor / Physical
  formFactor: z.string().max(50).optional(),
  unitCount: unitCountSchema.optional(),
  psuWatt: psuWattSchema.optional(),
  weightKg: z.number().positive().optional(),

  // Metadata
  customFields: z.record(z.unknown()).optional(),
  description: z.string().max(10000).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
}).strict();

// ─── Update Product Schema ───────────────────────────────────────────────────

export const updateProductSchema = createProductSchema.partial().strict();

// ─── Exports for testing ─────────────────────────────────────────────────────

export {
  priceSchema,
  cpuCoresSchema,
  cpuCountSchema,
  ramGbSchema,
  unitCountSchema,
  psuWattSchema,
  hasMaxTwoDecimals,
  isPowerOfTwoInRange,
  VALID_RAM_VALUES,
};
