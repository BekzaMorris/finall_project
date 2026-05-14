import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, SlidersHorizontal } from 'lucide-react';
import type { Product, PaginatedResult } from '@kiroportal/types';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { FilterSidebar } from './FilterSidebar';
import { MobileFilterDrawer } from './MobileFilterDrawer';
import { PaginationControls } from './PaginationControls';

// ISR: revalidate every 10 minutes
export const revalidate = 600;

export async function generateMetadata({ searchParams }: CatalogPageProps): Promise<Metadata> {
  const resolvedParams = await searchParams;

  // Build dynamic description based on active filters
  const filterParts: string[] = [];
  if (resolvedParams.condition) filterParts.push(`${resolvedParams.condition}`);
  if (resolvedParams.brand) filterParts.push(`${resolvedParams.brand}`);
  if (resolvedParams.formFactor) filterParts.push(`${resolvedParams.formFactor}`);

  const title = filterParts.length > 0
    ? `Каталог серверов — ${filterParts.join(', ')}`.slice(0, 60)
    : 'Каталог серверов';

  const description = filterParts.length > 0
    ? `Серверы ${filterParts.join(', ')} — подбор по характеристикам, цене и наличию`.slice(0, 160)
    : 'Каталог новых и б/у серверов с фильтрацией по CPU, RAM, хранилищу, цене и наличию';

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kiroportal.ru';
  const canonicalUrl = `${siteUrl}/catalog`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonicalUrl,
    },
  };
}

interface CatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function fetchProducts(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<PaginatedResult<Product>> {
  const apiUrl = process.env.API_URL || 'http://localhost:4000';

  // Build query string from search params
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      params.set(key, value.join(','));
    } else {
      params.set(key, value);
    }
  }

  // Default limit if not specified
  if (!params.has('limit')) {
    params.set('limit', '20');
  }

  try {
    const response = await fetch(`${apiUrl}/api/products?${params.toString()}`, {
      next: { revalidate: 600 },
    });

    if (!response.ok) {
      return { items: [], nextCursor: null, prevCursor: null, totalCount: 0 };
    }

    return response.json();
  } catch {
    return { items: [], nextCursor: null, prevCursor: null, totalCount: 0 };
  }
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const resolvedParams = await searchParams;
  const data = await fetchProducts(resolvedParams);

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumbs */}
      <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/" className="hover:text-text-primary transition-colors">
          Главная
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-text-primary font-medium">Каталог</span>
      </nav>

      {/* Page title + mobile filter button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Каталог серверов</h1>
        <MobileFilterDrawer />
      </div>

      {/* Two-column layout */}
      <div className="flex gap-8">
        {/* Sidebar - desktop only */}
        <aside className="hidden lg:block w-64 shrink-0">
          <FilterSidebar />
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <Suspense fallback={<CatalogGridSkeleton />}>
            <CatalogGrid products={data.items} totalCount={data.totalCount} />
          </Suspense>

          {/* Pagination */}
          {(data.nextCursor || data.prevCursor) && (
            <div className="mt-6">
              <PaginationControls
                nextCursor={data.nextCursor}
                prevCursor={data.prevCursor}
                totalCount={data.totalCount}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CatalogGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-96 animate-pulse rounded-lg border border-border-primary bg-surface-tertiary"
        />
      ))}
    </div>
  );
}
