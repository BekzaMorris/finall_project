import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCacheKey } from './cache.js';

describe('generateCacheKey', () => {
  it('generates a deterministic key regardless of param order', () => {
    const key1 = generateCacheKey('products', {
      brand: 'Dell',
      condition: 'NEW',
      cpuCores: 16,
    });
    const key2 = generateCacheKey('products', {
      cpuCores: 16,
      brand: 'Dell',
      condition: 'NEW',
    });
    const key3 = generateCacheKey('products', {
      condition: 'NEW',
      cpuCores: 16,
      brand: 'Dell',
    });

    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
  });

  it('includes the prefix in the key', () => {
    const key = generateCacheKey('products', { brand: 'Dell' });
    expect(key).toMatch(/^products:/);
  });

  it('produces a 16-char hex hash after the prefix', () => {
    const key = generateCacheKey('filters', { type: 'cpu' });
    const hash = key.split(':')[1];
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produces different keys for different params', () => {
    const key1 = generateCacheKey('products', { brand: 'Dell' });
    const key2 = generateCacheKey('products', { brand: 'HP' });
    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different prefixes', () => {
    const key1 = generateCacheKey('products', { brand: 'Dell' });
    const key2 = generateCacheKey('filters', { brand: 'Dell' });
    expect(key1).not.toBe(key2);
  });

  it('handles empty params', () => {
    const key1 = generateCacheKey('products', {});
    const key2 = generateCacheKey('products', {});
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^products:[0-9a-f]{16}$/);
  });

  it('handles nested objects deterministically', () => {
    const key1 = generateCacheKey('products', {
      priceRange: { min: 100, max: 500 },
      brand: 'Dell',
    });
    const key2 = generateCacheKey('products', {
      brand: 'Dell',
      priceRange: { min: 100, max: 500 },
    });
    expect(key1).toBe(key2);
  });

  it('handles arrays in params', () => {
    const key1 = generateCacheKey('products', {
      brands: ['Dell', 'HP'],
      condition: 'NEW',
    });
    const key2 = generateCacheKey('products', {
      condition: 'NEW',
      brands: ['Dell', 'HP'],
    });
    expect(key1).toBe(key2);
  });

  it('handles null and undefined values', () => {
    const key1 = generateCacheKey('products', {
      brand: null,
      condition: 'NEW',
    });
    const key2 = generateCacheKey('products', {
      condition: 'NEW',
      brand: null,
    });
    expect(key1).toBe(key2);
  });
});
