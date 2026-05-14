'use client';

import { Package, ShoppingCart, Ticket, DollarSign } from 'lucide-react';

const kpiCards = [
  {
    title: 'Товары',
    value: '—',
    description: 'Всего в каталоге',
    icon: <Package className="h-5 w-5" />,
    color: 'text-accent-primary',
    bgColor: 'bg-accent-primary/10',
  },
  {
    title: 'Тикеты',
    value: '—',
    description: 'Активные',
    icon: <Ticket className="h-5 w-5" />,
    color: 'text-status-error',
    bgColor: 'bg-status-error/10',
  },
  {
    title: 'Заявки сегодня',
    value: '—',
    description: 'Новые за сегодня',
    icon: <ShoppingCart className="h-5 w-5" />,
    color: 'text-status-warning',
    bgColor: 'bg-status-warning/10',
  },
  {
    title: 'Выручка',
    value: '—',
    description: 'За текущий месяц',
    icon: <DollarSign className="h-5 w-5" />,
    color: 'text-status-success',
    bgColor: 'bg-status-success/10',
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Дашборд</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Обзор ключевых показателей портала
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <div
            key={card.title}
            className="rounded-lg border border-border-primary bg-surface-secondary p-5 transition-colors hover:border-border-secondary"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">
                {card.title}
              </span>
              <div className={`flex h-9 w-9 items-center justify-center rounded-md ${card.bgColor} ${card.color}`}>
                {card.icon}
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-text-primary">
                {card.value}
              </span>
              <p className="mt-1 text-xs text-text-tertiary">
                {card.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border-primary bg-surface-secondary p-5">
          <h3 className="text-sm font-semibold text-text-primary">Последние заявки</h3>
          <div className="mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-primary text-left text-text-tertiary">
                  <th className="pb-2 font-medium">Номер</th>
                  <th className="pb-2 font-medium">Клиент</th>
                  <th className="pb-2 font-medium">Статус</th>
                  <th className="pb-2 font-medium text-right">Сумма</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="pt-4 text-center text-text-tertiary">
                    Данные будут загружены после подключения API
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Open Tickets */}
        <div className="rounded-lg border border-border-primary bg-surface-secondary p-5">
          <h3 className="text-sm font-semibold text-text-primary">Открытые тикеты</h3>
          <div className="mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-primary text-left text-text-tertiary">
                  <th className="pb-2 font-medium">Номер</th>
                  <th className="pb-2 font-medium">Тема</th>
                  <th className="pb-2 font-medium">Приоритет</th>
                  <th className="pb-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="pt-4 text-center text-text-tertiary">
                    Данные будут загружены после подключения API
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
