'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Ticket as TicketIcon,
  Eye,
  MessageSquare,
  AlertCircle,
  User,
  Clock,
} from 'lucide-react';
import { Badge, Button, Modal } from '@kiroportal/ui';
import type { BadgeVariant } from '@kiroportal/ui';
import { TicketStatus, TicketPriority } from '@kiroportal/types';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TicketMessage {
  id: string;
  ticketId: string;
  userId: string;
  userName?: string;
  content: string;
  attachments: string[];
  isInternal: boolean;
  createdAt: string;
}

interface TicketListItem {
  id: string;
  ticketNumber: string;
  subject: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedManagerId?: string;
  assignedManagerName?: string;
  orderId?: string;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

interface TicketsResponse {
  items: TicketListItem[];
  nextCursor: string | null;
  totalCount: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const statusConfig: Record<TicketStatus, { label: string; variant: BadgeVariant }> = {
  [TicketStatus.OPEN]: { label: 'Открыт', variant: 'warning' },
  [TicketStatus.IN_PROGRESS]: { label: 'В работе', variant: 'info' },
  [TicketStatus.WAITING_CUSTOMER]: { label: 'Ожидает клиента', variant: 'default' },
  [TicketStatus.RESOLVED]: { label: 'Решён', variant: 'success' },
  [TicketStatus.CLOSED]: { label: 'Закрыт', variant: 'default' },
};

const priorityConfig: Record<TicketPriority, { label: string; variant: BadgeVariant }> = {
  [TicketPriority.LOW]: { label: 'Низкий', variant: 'default' },
  [TicketPriority.MEDIUM]: { label: 'Средний', variant: 'info' },
  [TicketPriority.HIGH]: { label: 'Высокий', variant: 'warning' },
  [TicketPriority.URGENT]: { label: 'Срочный', variant: 'error' },
};

const PAGE_SIZE = 20;

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminTicketsPage() {
  const queryClient = useQueryClient();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  // Detail modal
  const [selectedTicket, setSelectedTicket] = useState<TicketListItem | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(false);

  // Load full ticket with messages when clicking
  const openTicketDetail = async (ticket: TicketListItem) => {
    setSelectedTicket(ticket); // Show modal immediately with basic info
    setLoadingTicket(true);
    try {
      const fullTicket = await apiClient<TicketListItem>(`/tickets/${ticket.id}`);
      setSelectedTicket(fullTicket);
    } catch {
      // Keep the basic ticket info if fetch fails
    } finally {
      setLoadingTicket(false);
    }
  };

  // Fetch tickets
  const { data, isLoading, isError } = useQuery<TicketsResponse>({
    queryKey: ['admin-tickets', statusFilter, priorityFilter, cursor],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (cursor) params.set('cursor', cursor);
      return apiClient<TicketsResponse>(`/admin/tickets?${params.toString()}`);
    },
  });

  // Status change mutation
  const statusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: TicketStatus }) =>
      apiClient(`/admin/tickets/${ticketId}/status`, {
        method: 'PATCH',
        body: { status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      setSelectedTicket(null);
    },
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: ({ ticketId, managerId }: { ticketId: string; managerId: string }) =>
      apiClient(`/admin/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        body: { managerId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
    },
  });

  // Internal message mutation
  const messageMutation = useMutation({
    mutationFn: ({ ticketId, content, isInternal }: { ticketId: string; content: string; isInternal: boolean }) =>
      apiClient(`/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: { content, isInternal },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
    },
  });

  // Pagination
  const handleNextPage = () => {
    if (data?.nextCursor) {
      setCursorHistory((prev) => [...prev, cursor ?? '__start__']);
      setCursor(data.nextCursor);
    }
  };

  const handlePrevPage = () => {
    const prev = cursorHistory[cursorHistory.length - 1];
    if (prev !== undefined) {
      setCursorHistory((h) => h.slice(0, -1));
      setCursor(prev === '__start__' ? undefined : prev);
    }
  };

  const handleFilterChange = (type: 'status' | 'priority', value: string) => {
    if (type === 'status') setStatusFilter(value);
    else setPriorityFilter(value);
    setCursor(undefined);
    setCursorHistory([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Тикеты</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Управление обращениями клиентов
          </p>
        </div>
        {data && (
          <span className="text-sm text-text-secondary">
            Всего: {data.totalCount}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={statusFilter}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="rounded-lg border border-border-primary bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
        >
          <option value="">Все статусы</option>
          {Object.values(TicketStatus).map((status) => (
            <option key={status} value={status}>
              {statusConfig[status].label}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => handleFilterChange('priority', e.target.value)}
          className="rounded-lg border border-border-primary bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
        >
          <option value="">Все приоритеты</option>
          {Object.values(TicketPriority).map((priority) => (
            <option key={priority} value={priority}>
              {priorityConfig[priority].label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && <TicketsTableSkeleton />}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-border-primary bg-surface-secondary p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-text-tertiary" />
          <p className="mt-2 text-sm text-text-secondary">Не удалось загрузить тикеты.</p>
        </div>
      )}

      {/* Empty */}
      {data && data.items.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border-primary bg-surface-secondary p-12 text-center">
          <TicketIcon className="h-16 w-16 text-text-tertiary opacity-40" />
          <h3 className="text-lg font-medium text-text-primary">Нет тикетов</h3>
          <p className="text-sm text-text-secondary">
            {statusFilter || priorityFilter ? 'Нет тикетов с выбранными фильтрами' : 'Обращения пока не поступали'}
          </p>
        </div>
      )}

      {/* Table */}
      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border-primary">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-primary bg-surface-tertiary">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Номер</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Тема</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Клиент</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Приоритет</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Статус</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Назначен</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Дата</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {data.items.map((ticket) => {
                  const statusInfo = statusConfig[ticket.status];
                  const priorityInfo = priorityConfig[ticket.priority];
                  return (
                    <tr
                      key={ticket.id}
                      className="hover:bg-surface-tertiary/50 transition-colors cursor-pointer"
                      onClick={() => openTicketDetail(ticket)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium text-text-primary">
                          {ticket.ticketNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary truncate max-w-[200px]">
                          {ticket.subject}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-text-primary truncate text-xs">
                            {ticket.userName || '—'}
                          </p>
                          <p className="text-text-tertiary truncate text-xs">
                            {ticket.userEmail || ''}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={priorityInfo.variant}>
                          {priorityInfo.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-secondary">
                          {ticket.assignedManagerName || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-text-secondary text-xs">
                          {formatDate(ticket.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicket(ticket);
                          }}
                          className="gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Детали
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(data.nextCursor || cursorHistory.length > 0) && (
            <div className="flex items-center justify-between border-t border-border-primary pt-4">
              <p className="text-sm text-text-secondary">
                Всего: <span className="font-medium text-text-primary">{data.totalCount}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={cursorHistory.length === 0}
                  onClick={handlePrevPage}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Назад
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!data.nextCursor}
                  onClick={handleNextPage}
                  className="gap-1"
                >
                  Вперёд
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Ticket Detail Modal */}
      <Modal
        open={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title={`Тикет ${selectedTicket?.ticketNumber || ''}`}
      >
        {selectedTicket && (
          <TicketDetailView
            ticket={selectedTicket}
            onStatusChange={(status) =>
              statusMutation.mutate({ ticketId: selectedTicket.id, status })
            }
            isChangingStatus={statusMutation.isPending}
            onReload={async () => {
              try {
                const fullTicket = await apiClient<TicketListItem>(`/tickets/${selectedTicket.id}`);
                setSelectedTicket(fullTicket);
              } catch {}
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// ─── Ticket Detail View ──────────────────────────────────────────────────────

interface TicketDetailViewProps {
  ticket: TicketListItem;
  onStatusChange: (status: TicketStatus) => void;
  isChangingStatus: boolean;
  onReload?: () => void;
}

function TicketDetailView({ ticket, onStatusChange, isChangingStatus, onReload }: TicketDetailViewProps) {
  const statusInfo = statusConfig[ticket.status];
  const priorityInfo = priorityConfig[ticket.priority];

  return (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto">
      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        <Badge variant={priorityInfo.variant}>{priorityInfo.label}</Badge>
        {ticket.assignedManagerName && (
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <User className="h-3 w-3" />
            {ticket.assignedManagerName}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-text-tertiary">
          <Clock className="h-3 w-3" />
          {formatDate(ticket.createdAt)}
        </span>
      </div>

      {/* Subject */}
      <div>
        <h4 className="text-sm font-medium text-text-primary">{ticket.subject}</h4>
        <p className="text-xs text-text-tertiary mt-1">
          От: {ticket.userName || '—'} ({ticket.userEmail || '—'})
        </p>
      </div>

      {/* Messages */}
      <div>
        <h4 className="text-sm font-medium text-text-primary mb-2">
          <MessageSquare className="inline h-4 w-4 mr-1" />
          Сообщения ({ticket.messages?.length ?? 0})
        </h4>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {(ticket.messages ?? []).map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg border px-3 py-2 text-sm ${
                msg.isInternal
                  ? 'border-status-warning/30 bg-status-warning/5'
                  : 'border-border-primary bg-surface-tertiary'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-text-primary">
                  {msg.user?.name || msg.userName || 'Пользователь'}
                  {msg.isInternal && (
                    <span className="ml-1.5 text-status-warning text-[10px] font-normal">
                      (внутренняя заметка)
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-text-tertiary">
                  {formatDate(msg.createdAt)}
                </span>
              </div>
              <p className="text-text-secondary whitespace-pre-wrap">{msg.content}</p>
              {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {msg.attachments.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-accent-primary hover:underline"
                    >
                      Вложение {idx + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Reply form */}
      {ticket.status !== TicketStatus.CLOSED && (
        <div className="border-t border-border-primary pt-4 space-y-3">
          <h4 className="text-sm font-medium text-text-primary">Ответить клиенту</h4>
          <ReplyForm ticketId={ticket.id} onSent={onStatusChange} onMessageSent={onReload} />
        </div>
      )}

      {/* Status change */}
      {ticket.status !== TicketStatus.CLOSED && (
        <div className="border-t border-border-primary pt-4 space-y-3">
          <h4 className="text-sm font-medium text-text-primary">Изменить статус</h4>
          <div className="flex flex-wrap gap-2">
            {Object.values(TicketStatus)
              .filter((s) => s !== ticket.status)
              .map((nextStatus) => {
                const nextInfo = statusConfig[nextStatus];
                return (
                  <Button
                    key={nextStatus}
                    variant="secondary"
                    size="sm"
                    disabled={isChangingStatus}
                    onClick={() => onStatusChange(nextStatus)}
                  >
                    {nextInfo.label}
                  </Button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reply Form ──────────────────────────────────────────────────────────────

function ReplyForm({ ticketId, onSent, onMessageSent }: { ticketId: string; onSent: (status: TicketStatus) => void; onMessageSent?: () => void }) {
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      await apiClient(`/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: { content: trimmed, isInternal },
      });
      setMessage('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      // Reload ticket to show new message
      if (onMessageSent) onMessageSent();
    } catch {
      // silently fail
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Написать ответ клиенту..."
        rows={3}
        maxLength={5000}
        className="w-full rounded-lg border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary resize-none"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isInternal}
            onChange={(e) => setIsInternal(e.target.checked)}
            className="h-4 w-4 rounded border-border-primary"
          />
          <span className="text-xs text-text-secondary">Внутренняя заметка (не видна клиенту)</span>
        </label>
        <div className="flex items-center gap-2">
          {success && <span className="text-xs text-status-success">Отправлено ✓</span>}
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!message.trim() || sending}
          >
            {sending ? 'Отправка...' : 'Отправить'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function TicketsTableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-primary">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary bg-surface-tertiary">
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Номер</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Тема</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Клиент</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Приоритет</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Статус</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Назначен</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Дата</th>
            <th className="px-4 py-3 text-right font-medium text-text-secondary">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3">
                <div className="h-4 w-20 animate-pulse rounded bg-surface-tertiary" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-40 animate-pulse rounded bg-surface-tertiary" />
              </td>
              <td className="px-4 py-3">
                <div className="space-y-1">
                  <div className="h-3 w-24 animate-pulse rounded bg-surface-tertiary" />
                  <div className="h-3 w-32 animate-pulse rounded bg-surface-tertiary" />
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="h-5 w-16 animate-pulse rounded-full bg-surface-tertiary" />
              </td>
              <td className="px-4 py-3">
                <div className="h-5 w-16 animate-pulse rounded-full bg-surface-tertiary" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-20 animate-pulse rounded bg-surface-tertiary" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-24 animate-pulse rounded bg-surface-tertiary" />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="h-7 w-16 animate-pulse rounded bg-surface-tertiary ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
