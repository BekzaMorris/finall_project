'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  Plus,
  Ticket,
  AlertCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { Button, Badge } from '@kiroportal/ui';
import { TicketStatus, TicketPriority } from '@kiroportal/types';
import type { PaginatedResult } from '@kiroportal/types';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth';
import { CreateTicketModal } from './CreateTicketModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TicketListItem {
  id: string;
  ticketNumber: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
}

// ─── Status / Priority Mappings ──────────────────────────────────────────────

const statusConfig: Record<TicketStatus, { label: string; variant: 'info' | 'warning' | 'success' | 'default' | 'error' }> = {
  [TicketStatus.OPEN]: { label: 'Открыт', variant: 'info' },
  [TicketStatus.IN_PROGRESS]: { label: 'В работе', variant: 'warning' },
  [TicketStatus.WAITING_CUSTOMER]: { label: 'Ожидает ответа', variant: 'warning' },
  [TicketStatus.RESOLVED]: { label: 'Решён', variant: 'success' },
  [TicketStatus.CLOSED]: { label: 'Закрыт', variant: 'default' },
};

const priorityConfig: Record<TicketPriority, { label: string; variant: 'default' | 'warning' | 'error' | 'info' }> = {
  [TicketPriority.LOW]: { label: 'Низкий', variant: 'default' },
  [TicketPriority.MEDIUM]: { label: 'Обычный', variant: 'info' },
  [TicketPriority.HIGH]: { label: 'Высокий', variant: 'warning' },
  [TicketPriority.URGENT]: { label: 'Критичный', variant: 'error' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchTickets = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '20');
      if (cursor) {
        params.set('cursor', cursor);
      }

      const data = await apiClient<PaginatedResult<TicketListItem>>(
        `/tickets?${params.toString()}`,
      );
      setTickets(data.items);
      setNextCursor(data.nextCursor);
      setPrevCursor(data.prevCursor);
      setTotalCount(data.totalCount);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Не удалось загрузить тикеты');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/tickets');
      return;
    }
    fetchTickets(currentCursor);
  }, [user, router, fetchTickets, currentCursor]);

  function handleNextPage() {
    if (nextCursor) {
      setCurrentCursor(nextCursor);
    }
  }

  function handlePrevPage() {
    if (prevCursor) {
      setCurrentCursor(prevCursor);
    }
  }

  function handleTicketCreated(ticketId: string) {
    setShowCreateModal(false);
    router.push(`/tickets/${ticketId}`);
  }

  function formatDate(dateStr: string): string {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  }

  // Not logged in — will redirect
  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumbs */}
      <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/" className="hover:text-text-primary transition-colors">
          Главная
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-text-primary font-medium">Мои тикеты</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Мои тикеты</h1>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Создать тикет
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-status-error/20 bg-status-error/5 p-4">
          <AlertCircle className="h-5 w-5 text-status-error shrink-0" />
          <p className="text-sm text-status-error">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && tickets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Ticket className="h-16 w-16 text-text-tertiary mb-4" />
          <h2 className="text-xl font-bold text-text-primary mb-2">
            У вас пока нет тикетов
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            Создайте тикет, чтобы связаться с нашей поддержкой
          </p>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Создать тикет
          </Button>
        </div>
      )}

      {/* Tickets list */}
      {!loading && !error && tickets.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border border-border-primary">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-primary bg-surface-secondary">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Номер
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Тема
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Приоритет
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Дата
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {tickets.map((ticket) => {
                  const status = statusConfig[ticket.status];
                  const priority = priorityConfig[ticket.priority];
                  return (
                    <tr
                      key={ticket.id}
                      className="hover:bg-surface-secondary/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono text-accent-primary">
                          {ticket.ticketNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-text-primary line-clamp-1">
                          {ticket.subject}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={priority.variant}>{priority.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(ticket.createdAt)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(nextCursor || prevCursor) && (
            <div className="flex items-center justify-between border-t border-border-primary pt-4">
              <p className="text-sm text-text-secondary">
                Всего: <span className="font-medium text-text-primary">{totalCount}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!prevCursor}
                  onClick={handlePrevPage}
                >
                  Назад
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!nextCursor}
                  onClick={handleNextPage}
                >
                  Вперёд
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Ticket Modal */}
      <CreateTicketModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleTicketCreated}
      />
    </div>
  );
}
