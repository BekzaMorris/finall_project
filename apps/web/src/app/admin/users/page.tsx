'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Users, Shield, ShieldAlert, User as UserIcon } from 'lucide-react';
import { Badge, Button, Modal } from '@kiroportal/ui';
import type { BadgeVariant } from '@kiroportal/ui';
import { Role } from '@kiroportal/types';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserItem {
  id: string;
  email: string;
  name: string;
  company?: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UsersResponse {
  items: UserItem[];
  nextCursor: string | null;
  totalCount: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const roleConfig: Record<Role, { label: string; variant: BadgeVariant }> = {
  [Role.CLIENT]: { label: 'Клиент', variant: 'default' },
  [Role.MANAGER]: { label: 'Менеджер', variant: 'info' },
  [Role.ADMIN]: { label: 'Администратор', variant: 'warning' },
};

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: Role.CLIENT, label: 'Клиент' },
  { value: Role.MANAGER, label: 'Менеджер' },
  { value: Role.ADMIN, label: 'Администратор' },
];

const PAGE_SIZE = 20;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  // Pagination state
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  // Deactivation confirmation modal
  const [deactivateTarget, setDeactivateTarget] = useState<UserItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);

  // Fetch users
  const { data, isLoading, isError } = useQuery<UsersResponse>({
    queryKey: ['admin-users', cursor],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      if (cursor) {
        params.set('cursor', cursor);
      }
      return apiClient<UsersResponse>(`/admin/users?${params.toString()}`);
    },
    enabled: !!currentUser,
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      apiClient(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: { role },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient(`/admin/users/${userId}/deactivate`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeactivateTarget(null);
    },
  });

  // Activate mutation
  const activateMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient(`/admin/users/${userId}/activate`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient(`/admin/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteTarget(null);
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (data: { email: string; password: string; name: string; role: string; company?: string; phone?: string }) =>
      apiClient('/admin/users', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreateModal(false);
    },
  });

  // Pagination handlers
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

  const isSelf = (userId: string) => currentUser?.id === userId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Пользователи</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Управление учётными записями и ролями
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-sm text-text-secondary">
              Всего: {data.totalCount}
            </span>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-primary/90 transition-colors"
          >
            + Добавить
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && <UsersTableSkeleton />}

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-border-primary bg-surface-secondary p-8 text-center">
          <p className="text-text-secondary">Не удалось загрузить список пользователей.</p>
        </div>
      )}

      {/* Empty state */}
      {data && data.items.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border-primary bg-surface-secondary p-12 text-center">
          <Users className="h-16 w-16 text-text-tertiary opacity-40" />
          <h3 className="text-lg font-medium text-text-primary">Нет пользователей</h3>
        </div>
      )}

      {/* Users table */}
      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border-primary">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-primary bg-surface-tertiary">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Имя</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Роль</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Статус</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Последний вход</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {data.items.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    isSelf={isSelf(user.id)}
                    onRoleChange={(role) =>
                      changeRoleMutation.mutate({ userId: user.id, role })
                    }
                    onDeactivate={() => setDeactivateTarget(user)}
                    onActivate={() => activateMutation.mutate(user.id)}
                    onDelete={() => setDeleteTarget(user)}
                    isRoleChanging={changeRoleMutation.isPending}
                    isActivating={activateMutation.isPending}
                  />
                ))}
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

      {/* Deactivation confirmation modal */}
      <Modal
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        title="Деактивация пользователя"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Вы уверены, что хотите деактивировать аккаунт пользователя{' '}
            <span className="font-medium text-text-primary">{deactivateTarget?.name}</span>{' '}
            ({deactivateTarget?.email})?
          </p>
          <p className="text-xs text-text-tertiary">
            Все активные сессии будут завершены, и пользователь не сможет войти в систему.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeactivateTarget(null)}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deactivateMutation.isPending}
              onClick={() => {
                if (deactivateTarget) {
                  deactivateMutation.mutate(deactivateTarget.id);
                }
              }}
            >
              {deactivateMutation.isPending ? 'Деактивация...' : 'Деактивировать'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create user modal */}
      <CreateUserModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={(data) => createUserMutation.mutate(data)}
        isPending={createUserMutation.isPending}
      />

      {/* Delete user modal */}
      <DeleteUserModal
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

// ─── User Row ────────────────────────────────────────────────────────────────

interface UserRowProps {
  user: UserItem;
  isSelf: boolean;
  onRoleChange: (role: Role) => void;
  onDeactivate: () => void;
  onActivate: () => void;
  onDelete: () => void;
  isRoleChanging: boolean;
  isActivating: boolean;
}

function UserRow({
  user,
  isSelf,
  onRoleChange,
  onDeactivate,
  onActivate,
  onDelete,
  isRoleChanging,
  isActivating,
}: UserRowProps) {
  const roleInfo = roleConfig[user.role];

  const roleIcon = user.role === Role.ADMIN
    ? <ShieldAlert className="h-3.5 w-3.5" />
    : user.role === Role.MANAGER
      ? <Shield className="h-3.5 w-3.5" />
      : <UserIcon className="h-3.5 w-3.5" />;

  return (
    <tr className={!user.isActive ? 'opacity-50' : undefined}>
      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary text-xs font-bold shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className={`font-medium text-text-primary truncate ${!user.isActive ? 'line-through' : ''}`}>
              {user.name}
              {isSelf && (
                <span className="ml-1.5 text-xs text-text-tertiary">(вы)</span>
              )}
            </p>
            {user.company && (
              <p className="text-xs text-text-tertiary truncate">{user.company}</p>
            )}
          </div>
        </div>
      </td>

      {/* Email */}
      <td className="px-4 py-3">
        <span className="text-text-secondary">{user.email}</span>
      </td>

      {/* Role */}
      <td className="px-4 py-3">
        {isSelf ? (
          <Badge variant={roleInfo.variant} className="gap-1">
            {roleIcon}
            {roleInfo.label}
          </Badge>
        ) : (
          <select
            value={user.role}
            onChange={(e) => onRoleChange(e.target.value as Role)}
            disabled={isRoleChanging}
            className="rounded-md border border-border-primary bg-surface-secondary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Изменить роль для ${user.name}`}
          >
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </td>

      {/* Active status */}
      <td className="px-4 py-3">
        {user.isActive ? (
          <Badge variant="success">Активен</Badge>
        ) : (
          <Badge variant="error">Неактивен</Badge>
        )}
      </td>

      {/* Last login */}
      <td className="px-4 py-3">
        <span className="text-text-secondary text-xs">
          {formatDate(user.lastLoginAt)}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        {isSelf ? (
          <span className="text-xs text-text-tertiary">—</span>
        ) : user.isActive ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-status-error hover:text-status-error hover:bg-status-error/10"
            onClick={onDeactivate}
          >
            Деактивировать
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-status-success hover:text-status-success hover:bg-status-success/10"
            onClick={onActivate}
            disabled={isActivating}
          >
            Активировать
          </Button>
        )}
        {!isSelf && (
          <Button
            variant="ghost"
            size="sm"
            className="text-status-error hover:text-status-error hover:bg-status-error/10 ml-1"
            onClick={onDelete}
          >
            Удалить
          </Button>
        )}
      </td>
    </tr>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function UsersTableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-primary">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary bg-surface-tertiary">
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Имя</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Email</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Роль</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Статус</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Последний вход</th>
            <th className="px-4 py-3 text-right font-medium text-text-secondary">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-surface-tertiary" />
                  <div className="h-4 w-24 animate-pulse rounded bg-surface-tertiary" />
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-36 animate-pulse rounded bg-surface-tertiary" />
              </td>
              <td className="px-4 py-3">
                <div className="h-5 w-20 animate-pulse rounded-full bg-surface-tertiary" />
              </td>
              <td className="px-4 py-3">
                <div className="h-5 w-16 animate-pulse rounded-full bg-surface-tertiary" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-28 animate-pulse rounded bg-surface-tertiary" />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="h-7 w-24 animate-pulse rounded bg-surface-tertiary ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Create User Modal ───────────────────────────────────────────────────────

function CreateUserModal({ open, onClose, onSubmit, isPending }: { open: boolean; onClose: () => void; onSubmit: (data: any) => void; isPending: boolean }) {
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'CLIENT', company: '', phone: '' });

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border border-border-primary bg-surface-secondary p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Добавить пользователя</h3>
          <div className="space-y-3">
            <input placeholder="Имя *" value={form.name} onChange={(e) => setForm(p => ({...p, name: e.target.value}))} className="w-full rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary" />
            <input placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm(p => ({...p, email: e.target.value}))} className="w-full rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary" />
            <input placeholder="Пароль *" type="password" value={form.password} onChange={(e) => setForm(p => ({...p, password: e.target.value}))} className="w-full rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary" />
            <select value={form.role} onChange={(e) => setForm(p => ({...p, role: e.target.value}))} className="w-full rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary">
              <option value="CLIENT">Клиент</option>
              <option value="MANAGER">Менеджер</option>
              <option value="ADMIN">Администратор</option>
            </select>
            <input placeholder="Компания" value={form.company} onChange={(e) => setForm(p => ({...p, company: e.target.value}))} className="w-full rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary" />
            <input placeholder="Телефон" value={form.phone} onChange={(e) => setForm(p => ({...p, phone: e.target.value}))} className="w-full rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary" />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Отмена</button>
            <button onClick={() => onSubmit(form)} disabled={isPending || !form.email || !form.password || !form.name} className="px-4 py-2 text-sm font-medium text-white bg-accent-primary rounded-md hover:bg-accent-primary/90 disabled:opacity-50">
              {isPending ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Delete User Modal ───────────────────────────────────────────────────────

function DeleteUserModal({ user, onClose, onConfirm, isPending }: { user: UserItem | null; onClose: () => void; onConfirm: () => void; isPending: boolean }) {
  if (!user) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border border-border-primary bg-surface-secondary p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Удалить пользователя?</h3>
          <p className="text-sm text-text-secondary mb-4">
            Вы уверены что хотите удалить <strong>{user.name}</strong> ({user.email})? Это действие необратимо.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Отмена</button>
            <button onClick={onConfirm} disabled={isPending} className="px-4 py-2 text-sm font-medium text-white bg-status-error rounded-md hover:bg-status-error/90 disabled:opacity-50">
              {isPending ? 'Удаление...' : 'Удалить'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
