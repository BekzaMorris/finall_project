import { describe, it, expect, vi } from 'vitest';
import { generateSlug, generateUniqueSlug } from './slug.js';

describe('generateSlug', () => {
  it('converts spaces to hyphens and lowercases', () => {
    expect(generateSlug('Dell PowerEdge R740')).toBe('dell-poweredge-r740');
  });

  it('handles uppercase input', () => {
    expect(generateSlug('HP PROLIANT DL380')).toBe('hp-proliant-dl380');
  });

  it('removes special characters', () => {
    expect(generateSlug('Server (2023) - New!')).toBe('server-2023-new');
  });

  it('collapses consecutive hyphens', () => {
    expect(generateSlug('Dell --- PowerEdge')).toBe('dell-poweredge');
  });

  it('removes leading and trailing hyphens', () => {
    expect(generateSlug('---hello world---')).toBe('hello-world');
  });

  it('handles mixed special characters', () => {
    expect(generateSlug('Server @#$% Model & Version')).toBe(
      'server-model-version',
    );
  });

  it('truncates to max 200 characters', () => {
    const longName = 'a'.repeat(300);
    const slug = generateSlug(longName);
    expect(slug.length).toBeLessThanOrEqual(200);
  });

  it('removes trailing hyphen after truncation', () => {
    // Create a name that when slugified will have a hyphen at position 200
    const name = 'a'.repeat(199) + ' ' + 'b'.repeat(50);
    const slug = generateSlug(name);
    expect(slug.length).toBeLessThanOrEqual(200);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('only contains lowercase alphanumeric and hyphens', () => {
    const slug = generateSlug(
      'Café Résumé — Special™ Characters® & Symbols©',
    );
    expect(slug).toMatch(/^[a-z0-9-]*$/);
  });

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('');
  });

  it('handles string with only special characters', () => {
    expect(generateSlug('!@#$%^&*()')).toBe('');
  });

  it('handles numbers', () => {
    expect(generateSlug('Server 2024 Gen10')).toBe('server-2024-gen10');
  });

  it('handles unicode characters', () => {
    const slug = generateSlug('Сервер для бизнеса');
    expect(slug).toMatch(/^[a-z0-9-]*$/);
  });
});

describe('generateUniqueSlug', () => {
  function createMockPrisma(existingSlugs: string[]) {
    return {
      product: {
        findFirst: vi.fn(
          ({
            where,
          }: {
            where: { slug: string };
            select: { slug: boolean };
          }) => {
            const found = existingSlugs.includes(where.slug);
            return Promise.resolve(found ? { slug: where.slug } : null);
          },
        ),
      },
    };
  }

  it('returns base slug when no collision exists', async () => {
    const prisma = createMockPrisma([]);
    const slug = await generateUniqueSlug('Dell PowerEdge R740', prisma);
    expect(slug).toBe('dell-poweredge-r740');
  });

  it('appends -1 suffix on first collision', async () => {
    const prisma = createMockPrisma(['dell-poweredge-r740']);
    const slug = await generateUniqueSlug('Dell PowerEdge R740', prisma);
    expect(slug).toBe('dell-poweredge-r740-1');
  });

  it('appends -2 suffix when -1 also collides', async () => {
    const prisma = createMockPrisma([
      'dell-poweredge-r740',
      'dell-poweredge-r740-1',
    ]);
    const slug = await generateUniqueSlug('Dell PowerEdge R740', prisma);
    expect(slug).toBe('dell-poweredge-r740-2');
  });

  it('increments suffix until unique', async () => {
    const prisma = createMockPrisma([
      'server',
      'server-1',
      'server-2',
      'server-3',
    ]);
    const slug = await generateUniqueSlug('Server', prisma);
    expect(slug).toBe('server-4');
  });

  it('respects max 200 char limit with suffix', async () => {
    const longName = 'a'.repeat(200);
    const prisma = createMockPrisma(['a'.repeat(200)]);
    const slug = await generateUniqueSlug(longName, prisma);
    expect(slug.length).toBeLessThanOrEqual(200);
    expect(slug).toMatch(/^[a-z0-9-]*$/);
  });
});
