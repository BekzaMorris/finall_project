import { describe, it, expect } from 'vitest';
import { createProductSchema, updateProductSchema, priceSchema, cpuCoresSchema, ramGbSchema, psuWattSchema, unitCountSchema, cpuCountSchema } from './product.schema.js';

describe('Product Schema', () => {
  // ─── Price Validation ────────────────────────────────────────────────────────

  describe('priceSchema', () => {
    it('accepts a valid positive price with 2 decimals', () => {
      expect(priceSchema.parse(99.99)).toBe(99.99);
    });

    it('accepts a valid integer price', () => {
      expect(priceSchema.parse(100)).toBe(100);
    });

    it('accepts a price with 1 decimal place', () => {
      expect(priceSchema.parse(49.5)).toBe(49.5);
    });

    it('rejects zero price', () => {
      expect(() => priceSchema.parse(0)).toThrow();
    });

    it('rejects negative price', () => {
      expect(() => priceSchema.parse(-10)).toThrow();
    });

    it('rejects price with more than 2 decimal places', () => {
      expect(() => priceSchema.parse(19.999)).toThrow();
    });

    it('rejects price with 3 decimal places', () => {
      expect(() => priceSchema.parse(1.123)).toThrow();
    });
  });

  // ─── CPU Cores Validation ──────────────────────────────────────────────────

  describe('cpuCoresSchema', () => {
    it('accepts minimum value of 1', () => {
      expect(cpuCoresSchema.parse(1)).toBe(1);
    });

    it('accepts maximum value of 128', () => {
      expect(cpuCoresSchema.parse(128)).toBe(128);
    });

    it('accepts a mid-range value', () => {
      expect(cpuCoresSchema.parse(64)).toBe(64);
    });

    it('rejects 0 cores', () => {
      expect(() => cpuCoresSchema.parse(0)).toThrow();
    });

    it('rejects negative cores', () => {
      expect(() => cpuCoresSchema.parse(-1)).toThrow();
    });

    it('rejects cores above 128', () => {
      expect(() => cpuCoresSchema.parse(129)).toThrow();
    });

    it('rejects non-integer cores', () => {
      expect(() => cpuCoresSchema.parse(4.5)).toThrow();
    });
  });

  // ─── CPU Count Validation ──────────────────────────────────────────────────

  describe('cpuCountSchema', () => {
    it('accepts 1 CPU', () => {
      expect(cpuCountSchema.parse(1)).toBe(1);
    });

    it('accepts 8 CPUs', () => {
      expect(cpuCountSchema.parse(8)).toBe(8);
    });

    it('rejects 0 CPUs', () => {
      expect(() => cpuCountSchema.parse(0)).toThrow();
    });

    it('rejects more than 8 CPUs', () => {
      expect(() => cpuCountSchema.parse(9)).toThrow();
    });
  });

  // ─── RAM Validation (Power of 2) ──────────────────────────────────────────

  describe('ramGbSchema', () => {
    it('accepts 8 GB (minimum valid)', () => {
      expect(ramGbSchema.parse(8)).toBe(8);
    });

    it('accepts 16 GB', () => {
      expect(ramGbSchema.parse(16)).toBe(16);
    });

    it('accepts 32 GB', () => {
      expect(ramGbSchema.parse(32)).toBe(32);
    });

    it('accepts 64 GB', () => {
      expect(ramGbSchema.parse(64)).toBe(64);
    });

    it('accepts 128 GB', () => {
      expect(ramGbSchema.parse(128)).toBe(128);
    });

    it('accepts 256 GB', () => {
      expect(ramGbSchema.parse(256)).toBe(256);
    });

    it('accepts 512 GB', () => {
      expect(ramGbSchema.parse(512)).toBe(512);
    });

    it('accepts 1024 GB', () => {
      expect(ramGbSchema.parse(1024)).toBe(1024);
    });

    it('accepts 2048 GB (maximum valid)', () => {
      expect(ramGbSchema.parse(2048)).toBe(2048);
    });

    it('rejects 4 GB (below minimum)', () => {
      expect(() => ramGbSchema.parse(4)).toThrow();
    });

    it('rejects 4096 GB (above maximum)', () => {
      expect(() => ramGbSchema.parse(4096)).toThrow();
    });

    it('rejects non-power-of-2 value (48)', () => {
      expect(() => ramGbSchema.parse(48)).toThrow();
    });

    it('rejects non-power-of-2 value (100)', () => {
      expect(() => ramGbSchema.parse(100)).toThrow();
    });

    it('rejects non-integer value', () => {
      expect(() => ramGbSchema.parse(16.5)).toThrow();
    });
  });

  // ─── Unit Count Validation ─────────────────────────────────────────────────

  describe('unitCountSchema', () => {
    it('accepts 1 unit', () => {
      expect(unitCountSchema.parse(1)).toBe(1);
    });

    it('accepts 48 units', () => {
      expect(unitCountSchema.parse(48)).toBe(48);
    });

    it('rejects 0 units', () => {
      expect(() => unitCountSchema.parse(0)).toThrow();
    });

    it('rejects 49 units', () => {
      expect(() => unitCountSchema.parse(49)).toThrow();
    });
  });

  // ─── PSU Wattage Validation ────────────────────────────────────────────────

  describe('psuWattSchema', () => {
    it('accepts 100W (minimum)', () => {
      expect(psuWattSchema.parse(100)).toBe(100);
    });

    it('accepts 3000W (maximum)', () => {
      expect(psuWattSchema.parse(3000)).toBe(3000);
    });

    it('accepts a mid-range value (750W)', () => {
      expect(psuWattSchema.parse(750)).toBe(750);
    });

    it('rejects 99W (below minimum)', () => {
      expect(() => psuWattSchema.parse(99)).toThrow();
    });

    it('rejects 3001W (above maximum)', () => {
      expect(() => psuWattSchema.parse(3001)).toThrow();
    });

    it('rejects non-integer wattage', () => {
      expect(() => psuWattSchema.parse(500.5)).toThrow();
    });
  });

  // ─── Full Create Product Schema ────────────────────────────────────────────

  describe('createProductSchema', () => {
    const validProduct = {
      name: 'Dell PowerEdge R740',
      sku: 'PE-R740-001',
      brand: 'Dell',
      condition: 'NEW' as const,
      price: 4999.99,
      stockStatus: 'IN_STOCK' as const,
    };

    it('accepts a valid minimal product', () => {
      const result = createProductSchema.parse(validProduct);
      expect(result.name).toBe('Dell PowerEdge R740');
      expect(result.price).toBe(4999.99);
    });

    it('accepts a product with all optional fields', () => {
      const fullProduct = {
        ...validProduct,
        cpuCores: 32,
        cpuCount: 2,
        ramGb: 256,
        unitCount: 2,
        psuWatt: 750,
        customFields: { warranty: '3 years' },
        description: 'A powerful server',
      };
      const result = createProductSchema.parse(fullProduct);
      expect(result.cpuCores).toBe(32);
      expect(result.ramGb).toBe(256);
    });

    it('rejects unknown fields', () => {
      expect(() =>
        createProductSchema.parse({ ...validProduct, unknownField: 'test' }),
      ).toThrow();
    });

    it('rejects missing required fields', () => {
      expect(() => createProductSchema.parse({ name: 'Test' })).toThrow();
    });
  });

  // ─── Update Product Schema ─────────────────────────────────────────────────

  describe('updateProductSchema', () => {
    it('accepts partial updates', () => {
      const result = updateProductSchema.parse({ price: 1999.99 });
      expect(result.price).toBe(1999.99);
    });

    it('accepts empty object (no updates)', () => {
      const result = updateProductSchema.parse({});
      expect(result).toEqual({});
    });

    it('rejects unknown fields', () => {
      expect(() => updateProductSchema.parse({ foo: 'bar' })).toThrow();
    });
  });
});
