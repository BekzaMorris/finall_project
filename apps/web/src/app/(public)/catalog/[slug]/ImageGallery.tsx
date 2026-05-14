'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Cpu } from 'lucide-react';
import type { ProductImage } from '@kiroportal/types';

interface ImageGalleryProps {
  images: ProductImage[];
  productName: string;
}

export function ImageGallery({ images, productName }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const sortedImages = [...images].sort((a, b) => a.order - b.order);
  const selectedImage = sortedImages[selectedIndex];

  if (!sortedImages.length) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg border border-border-primary bg-surface-secondary">
        <Cpu className="h-24 w-24 text-text-tertiary opacity-30" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Main image */}
      <div className="relative aspect-square overflow-hidden rounded-lg border border-border-primary bg-surface-secondary">
        {selectedImage && (
          <Image
            src={selectedImage.url}
            alt={selectedImage.alt || productName}
            fill
            className="object-contain p-6"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        )}
      </div>

      {/* Thumbnails */}
      {sortedImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sortedImages.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setSelectedIndex(index)}
              className={[
                'relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-all',
                index === selectedIndex
                  ? 'border-accent-primary ring-1 ring-accent-primary/30'
                  : 'border-border-primary hover:border-text-tertiary',
              ].join(' ')}
              aria-label={`Показать изображение ${index + 1}`}
            >
              <Image
                src={image.url}
                alt={image.alt || `${productName} — фото ${index + 1}`}
                fill
                className="object-contain p-1"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
