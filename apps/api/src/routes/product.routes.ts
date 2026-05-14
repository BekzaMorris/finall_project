import { Router, type Request, type Response } from 'express';
import {
  getCachedProducts,
  getCachedFilterOptions,
  getCachedProductCount,
} from '../services/catalog-cache.service.js';
import { getProductBySlug, searchProducts } from '../services/catalog.service.js';
import {
  productFiltersSchema,
  paginationSchema,
  searchSchema,
} from '../schemas/catalog.schema.js';
import { validateQuery } from '../middleware/validate.js';

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

// ─── Combined Schemas ────────────────────────────────────────────────────────

/** Merged schema for product listing: filters + pagination */
const productListSchema = productFiltersSchema.merge(paginationSchema);

/**
 * GET /api/products
 * List products with filters and cursor-based pagination.
 * Validates query params with productFiltersSchema + paginationSchema.
 * Returns PaginatedResult with items, cursors, and totalCount.
 * Returns empty list with count 0 when no products match.
 * Public endpoint — no authentication required.
 */
router.get(
  '/',
  validateQuery(productListSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { cursor, limit, direction, ...filters } = req.query as Record<string, unknown>;

    const result = await getCachedProducts(
      filters as Parameters<typeof getCachedProducts>[0],
      { cursor: cursor as string | undefined, limit: limit as number, direction: direction as 'forward' | 'backward' },
    );

    res.status(200).json(result);
  },
);

/**
 * GET /api/products/search
 * Full-text search for products.
 * Validates query with searchSchema (q: string, limit: number).
 * Returns array of matching products ordered by relevance.
 * Public endpoint — no authentication required.
 */
router.get(
  '/search',
  validateQuery(searchSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { q, limit } = req.query as unknown as { q: string; limit: number };

    const products = await searchProducts(q, limit);

    res.status(200).json(products);
  },
);

/**
 * GET /api/products/count
 * Get product count for the given filters.
 * Used for debounced filter count updates in the UI.
 * Validates query with productFiltersSchema.
 * Returns { count: number }.
 * Returns count 0 when no products match.
 * Public endpoint — no authentication required.
 */
router.get(
  '/count',
  validateQuery(productFiltersSchema),
  async (req: Request, res: Response): Promise<void> => {
    const filters = req.query as Parameters<typeof getCachedProductCount>[0];

    const count = await getCachedProductCount(filters);

    res.status(200).json({ count });
  },
);

/**
 * GET /api/products/filters
 * Get available filter options (distinct values for each filter field).
 * Used to populate the filter sidebar with available choices.
 * Returns FilterOptions object.
 * Public endpoint — no authentication required.
 */
router.get(
  '/filters',
  async (_req: Request, res: Response): Promise<void> => {
    const filterOptions = await getCachedFilterOptions();

    res.status(200).json(filterOptions);
  },
);

/**
 * GET /api/products/:slug
 * Get a single product by its URL slug.
 * Returns the complete product record with all specifications and images.
 * Returns 404 if the product is not found or not active.
 * Public endpoint — no authentication required.
 */
router.get(
  '/:slug',
  async (req: Request, res: Response): Promise<void> => {
    const slug = req.params.slug as string;

    const product = await getProductBySlug(slug);

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.status(200).json(product);
  },
);

export { router as productRouter };
