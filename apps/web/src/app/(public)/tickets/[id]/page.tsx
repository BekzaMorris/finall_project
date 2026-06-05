'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Send, Paperclip, Loader2 } from 'lucide-react';
import { Badge, Button } from '@kiroportal/ui';
import { TicketStatus, TicketPriority } from '@kiroportal/types';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TicketMessage {
  id: string;
  ticketId: string;
  userId: string | null;
  content: string;
  attachments: string[];
  isInternal: boolean;
  createdAt: string;
  user?: { id: string; name: string; role: string } | null;
}

interface TicketDetail {
  id: string;
  number: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  email: string;
  assignedTo?: { id: string; name: string } | null;
  messages: TicketMessage[];
  createdAt: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const statusConfig: Record<TicketStatus, { label: string; variant: 'info' | 'warning' | 'success' | 'default' }> = {
  [TicketStatus.OPEN]: { label: 'Открыт', variant: 'info' },
  [TicketStatus.IN_PROGRESS]: { label: 'В работе', variant: 'warning' },
  [TicketStatus.WAITING_CUSTOMER]: { label: 'Ожидает ответа', variant: 'warning' },
  [TicketStatus.RESOLVED]: { label: 'Решён', variant: 'success' },
  [TicketStatus.CLOSED]: { label: 'Закрыт', variant: 'default' },
};

const priorityConfig: Record<TicketPriority, { label: string; variant: 'default' | 'info' | 'warning' | 'error' }> = {
  [TicketPriority.LOW]: { label: 'Низкий', variant: 'default' },
  [TicketPriority.MEDIUM]: { label: 'Обычный', variant: 'info' },
  [TicketPriority.HIGH]: { label: 'Высокий', variant: 'warning' },
  [TicketPriority.URGENT]: { label: 'Критичный', variant: 'error' },
};

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const ticketId = params.id as string;

  const [newMessage, setNewMessage] = useState('');
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Wait for hydration before checking auth
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if not authenticated (only after hydration)
  useEffect(() => {
    if (mounted && !user) {
      router.push(`/login?redirect=/tickets/${ticketId}`);
    }
  }, [mounted, user, router, ticketId]);

  // Fetch ticket
  const { data: ticket, isLoading, isError } = useQuery<TicketDetail>({
    queryKey: ['ticket', ticketId],
    queryFn: () => apiClient<TicketDetail>(`/tickets/${ticketId}`),
    enabled: !!user && !!ticketId,
    refetchInterval: 30000, // Poll every 30s for new messages
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      apiClient(`/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: { content },
      }),
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages.length]);

  const handleSend = () => {
    const trimmed = newMessage.trim();
    if (!trimmed || trimmed.length > 5000) return;
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isClosed = ticket?.status === TicketStatus.CLOSED;

  if (!mounted || !user) return null;

  // Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
      </div>
    );
  }

  // Error
  if (isError || !ticket) {
    return (
      <div className="flex flex-col gap-6">
        <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Link href="/" className="hover:text-text-primary transition-colors">Главная</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/tickets" className="hover:text-text-primary transition-colors">Тикеты</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-text-primary font-medium">Тикет</span>
        </nav>
        <div className="rounded-lg border border-border-primary bg-surface-secondary p-8 text-center">
          <p className="text-text-secondary">Тикет не найден или у вас нет доступа.</p>
          <Link href="/tickets" className="mt-4 inline-block">
            <Button variant="secondary">Вернуться к тикетам</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = statusConfig[ticket.status];
  const priorityInfo = priorityConfig[ticket.priority];

  return (
    <div className="flex flex-col gap-6 h-[calc(100dvh-12rem)]">
      {/* Breadcrumbs */}
      <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary shrink-0">
        <Link href="/" className="hover:text-text-primary transition-colors">Главная</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/tickets" className="hover:text-text-primary transition-colors">Тикеты</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-text-primary font-medium">{ticket.number}</span>
      </nav>

      {/* Ticket header */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-text-primary">{ticket.subject}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          <Badge variant={priorityInfo.variant}>{priorityInfo.label}</Badge>
          <span className="text-xs text-text-tertiary">
            {ticket.number} • {formatDateTime(ticket.createdAt)}
          </span>
          {ticket.assignedTo && (
            <span className="text-xs text-text-secondary">
              Менеджер: {ticket.assignedTo.name}
            </span>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-border-primary bg-surface-secondary p-4 space-y-4 min-h-0">
        {ticket.messages.map((msg) => {
          const isOwnMessage = msg.userId === user.id;
          return (
            <div
              key={msg.id}
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-4 py-3 ${
                  isOwnMessage
                    ? 'bg-accent-primary/10 border border-accent-primary/20'
                    : 'bg-surface-tertiary border border-border-primary'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium ${isOwnMessage ? 'text-accent-primary' : 'text-text-primary'}`}>
                    {msg.user?.name || 'Пользователь'}
                  </span>
                  <span className="text-[10px] text-text-tertiary">
                    {formatDateTime(msg.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-text-primary whitespace-pre-wrap break-words">
                  {msg.content}
                </p>
                {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.attachments.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-surface-secondary px-2 py-0.5 text-[10px] text-accent-primary hover:underline"
                      >
                        <Paperclip className="h-3 w-3" />
                        Файл {idx + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="shrink-0">
        {isClosed ? (
          <div className="rounded-lg border border-border-primary bg-surface-tertiary px-4 py-3 text-center text-sm text-text-secondary">
            Тикет закрыт. Отправка сообщений недоступна.
          </div>
        ) : (
          <div className="flex items-end gap-2 rounded-lg border border-border-primary bg-surface-secondary p-3">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Написать сообщение..."
              rows={2}
              maxLength={5000}
              className="flex-1 resize-none rounded-md border-0 bg-transparent px-2 py-1 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!newMessage.trim() || sendMutation.isPending}
              className="shrink-0 gap-1.5"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
