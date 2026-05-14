'use client';

import { AlertTriangle, X } from 'lucide-react';

interface DeleteProductModalProps {
  productName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteProductModal({
  productName,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteProductModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-border-primary bg-surface-secondary p-6 shadow-xl">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-status-error/10">
          <AlertTriangle className="h-6 w-6 text-status-error" />
        </div>

        {/* Content */}
        <h3 className="mt-4 text-lg font-semibold text-text-primary">
          Удалить товар?
        </h3>
        <p className="mt-2 text-sm text-text-secondary">
          Товар <span className="font-medium text-text-primary">&quot;{productName}&quot;</span>{' '}
          будет деактивирован и скрыт из каталога. Связанные заказы сохранятся.
        </p>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-lg border border-border-primary px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-tertiary transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-lg bg-status-error px-4 py-2 text-sm font-medium text-white hover:bg-status-error/90 transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Удаление...' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}
