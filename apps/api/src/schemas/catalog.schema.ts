import { z } from 'zod';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates a range filter schema that coerces string values from query params.
 */
function rangeFilterSchema() {
  return z.object({
    min: z.coerce.number().optional(),
    max: z.coerce.number().optional(),
  }).optional();
}

/**
 * Coerces a comma-separated string or array into a string array.
 */
function commaSeparatedArray() {
  return z.preprocess((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.length > 0) return val.split(',');
    return undefined;
  }, z.array(z.string()).optional());
}

/**
 * Coerces a comma-separated string or array into a number array.
 */
function commaSeparatedNumberArray() {
  return z.preprocess((val) => {
    if (Array.isArray(val)) return val.map(Number);
    if (typeof val === 'string' && val.length > 0) return val.split(',').map(Number);
    return undefined;
  }, z.array(z.number()).optional());
}

/**
 * Coerces a string to boolean for query params.
 */
function coerceBoolean() {
  return z.preprocess((val) => {
    if (val === 'true' || val === '1') return true;
    if (val === 'false' || val === '0') return false;
    return undefined;
  }, z.boolean().optional());
}

// ─── Enums ───────────────────────────────────────────────────────────────────

const conditionEnum = z.enum(['NEW', 'USED', 'REFURBISHED']);
const stockStatusEnum = z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER']);
const sortOptionEnum = z.enum(['price_asc', 'price_desc', 'newest', 'popular']);

// ─── Product Filters Schema ──────────────────────────────────────────────────

export const productFiltersSchema = z.object({
  // Multi-value enum/string filters
  condition: commaSeparatedArray().pipe(
    z.array(conditionEnum).optional(),
  ),
  brand: commaSeparatedArray(),
  cpuFamily: commaSeparatedArray(),
  cpuSocket: commaSeparatedArray(),
  ramType: commaSeparatedArray(),
  storageType: commaSeparatedArray(),
  formFactor: commaSeparatedArray(),
  stockStatus: commaSeparatedArray().pipe(
    z.array(stockStatusEnum).optional(),
  ),

  // Multi-value number filters
  cpuCount: commaSeparatedNumberArray(),
  ramSlots: commaSeparatedNumberArray(),
  units: commaSeparatedNumberArray(),

  // Range filters
  cpuCores: rangeFilterSchema(),
  cpuFrequency: rangeFilterSchema(),
  ramGb: rangeFilterSchema(),
  ramFrequency: rangeFilterSchema(),
  storageSize: rangeFilterSchema(),
  psuWattage: rangeFilterSchema(),
  priceRange: rangeFilterSchema(),

  // Boolean filters
  hotSwap: coerceBoolean(),

  // Sort
  sort: sortOptionEnum.optional(),
});

// ─── Pagination Schema ───────────────────────────────────────────────────────

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  direction: z.enum(['forward', 'backward']).default('forward'),
});

// ─── Search Schema ───────────────────────────────────────────────────────────

export const searchSchema = z.object({
  q: z.string().min(1, 'Search query must be at least 1 character').max(200, 'Search query must be at most 200 characters'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Exports ─────────────────────────────────────────────────────────────────

export { conditionEnum, stockStatusEnum, sortOptionEnum };
