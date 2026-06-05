'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';

export interface UploadedImage {
  url: string;
  key: string;
  originalName: string;
}

interface ImageUploaderProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxImages?: number;
}

export function ImageUploader({ images, onChange, maxImages = 10 }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      setError(`Максимум ${maxImages} изображений`);
      return;
    }

    setError(null);
    setUploading(true);

    const filesToUpload = Array.from(files).slice(0, remaining);
    const uploaded: UploadedImage[] = [];

    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/')) {
        setError('Допускаются только изображения');
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('Максимальный размер файла — 10 МБ');
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('access_token') || '';
        const response = await fetch('/api/uploads/product', {
          method: 'POST',
          body: formData,
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setError(data.error || 'Ошибка загрузки');
          continue;
        }

        const result = await response.json();
        uploaded.push({
          url: result.url,
          key: result.key,
          originalName: result.originalName,
        });
      } catch {
        setError('Ошибка загрузки файла');
      }
    }

    if (uploaded.length > 0) {
      onChange([...images, ...uploaded]);
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, index) => (
            <div key={img.key || index} className="relative group aspect-square rounded-lg border border-border-primary bg-surface-tertiary overflow-hidden">
              <Image
                src={img.url}
                alt={img.originalName}
                fill
                className="object-contain p-2"
                sizes="150px"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface-primary/80 text-status-error opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Удалить"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {index === 0 && (
                <span className="absolute bottom-1 left-1 rounded bg-accent-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Главное
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {images.length < maxImages && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="product-image-upload"
          />
          <label
            htmlFor="product-image-upload"
            className={`inline-flex items-center gap-2 rounded-lg border border-dashed border-border-primary px-4 py-3 text-sm text-text-secondary cursor-pointer hover:border-accent-primary hover:text-accent-primary transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? 'Загрузка...' : 'Загрузить изображения'}
          </label>
          <p className="mt-1 text-xs text-text-tertiary">
            До {maxImages} файлов, макс. 10 МБ каждый. JPEG, PNG, WebP.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-status-error">{error}</p>
      )}
    </div>
  );
}
