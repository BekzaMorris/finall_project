'use client';

import { useState, useRef, type FormEvent, type ChangeEvent } from 'react';
import { X, Upload, ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { Button, Input, Select, Modal } from '@kiroportal/ui';
import { TicketPriority } from '@kiroportal/types';
import { apiClient, ApiClientError } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CreateTicketModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (ticketId: string) => void;
}

interface UploadedAttachment {
  url: string;
  name: string;
  size: number;
}

interface FormErrors {
  subject?: string;
  message?: string;
  priority?: string;
  attachments?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const priorityOptions = [
  { value: TicketPriority.MEDIUM, label: 'Обычный' },
  { value: TicketPriority.HIGH, label: 'Высокий' },
  { value: TicketPriority.URGENT, label: 'Критичный' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function CreateTicketModal({ open, onClose, onCreated }: CreateTicketModalProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<TicketPriority>(TicketPriority.MEDIUM);
  const [orderId, setOrderId] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setSubject('');
    setMessage('');
    setPriority(TicketPriority.MEDIUM);
    setOrderId('');
    setAttachments([]);
    setErrors({});
    setServerError(null);
  }

  function handleClose() {
    if (!submitting && !uploading) {
      resetForm();
      onClose();
    }
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};

    const trimmedSubject = subject.trim();
    if (trimmedSubject.length < 5) {
      newErrors.subject = 'Тема должна содержать минимум 5 символов';
    } else if (trimmedSubject.length > 200) {
      newErrors.subject = 'Тема не должна превышать 200 символов';
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 1) {
      newErrors.message = 'Сообщение обязательно';
    } else if (trimmedMessage.length > 5000) {
      newErrors.message = 'Сообщение не должно превышать 5000 символов';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_ATTACHMENTS - attachments.length;
    if (remainingSlots <= 0) {
      setErrors((prev) => ({
        ...prev,
        attachments: `Максимум ${MAX_ATTACHMENTS} файлов`,
      }));
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    // Validate files client-side
    for (const file of filesToUpload) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setErrors((prev) => ({
          ...prev,
          attachments: 'Допускаются только изображения (JPEG, PNG, GIF, WebP)',
        }));
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setErrors((prev) => ({
          ...prev,
          attachments: 'Максимальный размер файла — 10 МБ',
        }));
        return;
      }
    }

    setErrors((prev) => ({ ...prev, attachments: undefined }));
    setUploading(true);

    try {
      const uploaded: UploadedAttachment[] = [];

      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || '/api'}/uploads/ticket`,
          {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
            },
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Ошибка загрузки файла');
        }

        const result = await response.json();
        uploaded.push({
          url: result.url,
          name: result.originalName || file.name,
          size: result.size || file.size,
        });
      }

      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        attachments: err instanceof Error ? err.message : 'Ошибка загрузки файла',
      }));
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => ({ ...prev, attachments: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        subject: subject.trim(),
        message: message.trim(),
        priority,
      };

      if (orderId.trim()) {
        body.orderId = orderId.trim();
      }

      if (attachments.length > 0) {
        body.attachments = attachments.map((a) => a.url);
      }

      const result = await apiClient<{ id: string }>('/tickets', {
        method: 'POST',
        body,
      });

      resetForm();
      onCreated(result.id);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError('Не удалось создать тикет. Попробуйте позже.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  }

  return (
    <Modal open={open} onClose={handleClose} title="Создать тикет">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Server error */}
        {serverError && (
          <div className="flex items-center gap-2 rounded-md border border-status-error/20 bg-status-error/5 p-3">
            <AlertCircle className="h-4 w-4 text-status-error shrink-0" />
            <p className="text-sm text-status-error">{serverError}</p>
          </div>
        )}

        {/* Subject */}
        <Input
          label="Тема"
          placeholder="Кратко опишите проблему"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          error={errors.subject}
          maxLength={200}
          required
        />

        {/* Message */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="ticket-message"
            className="text-sm font-medium text-text-primary"
          >
            Сообщение
          </label>
          <textarea
            id="ticket-message"
            placeholder="Подробно опишите вашу проблему или вопрос..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={5000}
            rows={5}
            required
            className={[
              'w-full rounded-md border bg-surface-secondary px-3 py-2 text-sm text-text-primary',
              'placeholder:text-text-tertiary resize-y min-h-[100px]',
              'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent',
              errors.message
                ? 'border-status-error focus:ring-status-error'
                : 'border-border-primary',
            ].join(' ')}
            aria-invalid={errors.message ? 'true' : undefined}
            aria-describedby={errors.message ? 'ticket-message-error' : undefined}
          />
          <div className="flex items-center justify-between">
            {errors.message ? (
              <p id="ticket-message-error" className="text-sm text-status-error" role="alert">
                {errors.message}
              </p>
            ) : (
              <span />
            )}
            <span className="text-xs text-text-tertiary">
              {message.length}/5000
            </span>
          </div>
        </div>

        {/* Priority */}
        <Select
          label="Приоритет"
          options={priorityOptions}
          value={priority}
          onChange={(e) => setPriority(e.target.value as TicketPriority)}
          error={errors.priority}
        />

        {/* Order link (optional) */}
        <Input
          label="Номер заказа (необязательно)"
          placeholder="ORD-000001"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
        />

        {/* File attachments */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-primary">
            Вложения (необязательно)
          </label>

          {/* Uploaded files */}
          {attachments.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {attachments.map((attachment, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-md border border-border-primary bg-surface-tertiary px-3 py-2"
                >
                  <ImageIcon className="h-4 w-4 text-text-tertiary shrink-0" />
                  <span className="text-sm text-text-primary truncate flex-1">
                    {attachment.name}
                  </span>
                  <span className="text-xs text-text-tertiary shrink-0">
                    {formatFileSize(attachment.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="rounded p-0.5 text-text-tertiary hover:text-status-error transition-colors"
                    aria-label={`Удалить ${attachment.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload button */}
          {attachments.length < MAX_ATTACHMENTS && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="ticket-file-input"
              />
              <label
                htmlFor="ticket-file-input"
                className={[
                  'inline-flex items-center gap-2 rounded-md border border-dashed border-border-primary',
                  'px-3 py-2 text-sm text-text-secondary cursor-pointer',
                  'hover:border-accent-primary hover:text-accent-primary transition-colors',
                  uploading ? 'opacity-50 pointer-events-none' : '',
                ].join(' ')}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? 'Загрузка...' : 'Прикрепить изображения'}
              </label>
              <p className="mt-1 text-xs text-text-tertiary">
                Макс. {MAX_ATTACHMENTS} файлов, до 10 МБ каждый. JPEG, PNG, GIF, WebP.
              </p>
            </div>
          )}

          {errors.attachments && (
            <p className="text-sm text-status-error" role="alert">
              {errors.attachments}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={submitting}
          >
            Отмена
          </Button>
          <Button type="submit" disabled={submitting || uploading}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Создание...
              </>
            ) : (
              'Создать тикет'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
