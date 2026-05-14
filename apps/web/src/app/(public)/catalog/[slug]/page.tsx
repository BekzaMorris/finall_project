import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Product } from '@kiroportal/types';
import { ImageGallery } from './ImageGallery';
import { ProductInfo } from './ProductInfo';
import { SpecificationsTable } from './SpecificationsTable';

// ISR: revalidate every 10 minutes
export const revalidate = 600;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

async function fetchProduct(slug: string): Promise<Product | null> {
  const apiUrl = process.env.API_URL || 'http://localhost:4000';

  try {
    const response = await fetch(`${apiUrl}/api/products/${slug}`, {
      next: { revalidate: 600 },
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProduct(slug);

  if (!product) {
    return {
      title: 'Товар не найден',
    };
  }

  // Use custom SEO fields with fallbacks per requirement 19.2, 19.4
  const title = product.seoTitle || product.name.slice(0, 60);
  const description =
    product.seoDescription || product.description?.slice(0, 160) || product.shortDescription?.slice(0, 160);

  const canonicalUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://kiroportal.ru'}/catalog/${product.slug}`;

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
      images: product.images?.[0]?.url ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await fetchProduct(slug);

  if (!product) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Breadcrumbs */}
      <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/" className="hover:text-text-primary transition-colors">
          Главная
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/catalog" className="hover:text-text-primary transition-colors">
          Каталог
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-text-primary font-medium line-clamp-1">{product.name}</span>
      </nav>

      {/* Main product section: gallery + info */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Image gallery */}
        <ImageGallery images={product.images} productName={product.name} />

        {/* Product info + actions */}
        <ProductInfo product={product} />
      </div>

      {/* Specifications table */}
      <SpecificationsTable product={product} />
    </div>
  );
}
