'use client';

import { Settings, Globe, Mail, Palette } from 'lucide-react';
import { Button, Input } from '@kiroportal/ui';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Настройки</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Управление параметрами портала
        </p>
      </div>

      {/* General Settings */}
      <section className="rounded-lg border border-border-primary bg-surface-secondary p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-accent-primary" />
          <h3 className="text-base font-semibold text-text-primary">Общие</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Название сайта" defaultValue="ServerHub" />
          <Input label="Телефон" defaultValue="+7 (800) 123-45-67" />
          <Input label="Email" defaultValue="info@serverhub.ru" />
          <Input label="Адрес" defaultValue="г. Астана, ул. Примерная, 1" />
        </div>
      </section>

      {/* SMTP Settings */}
      <section className="rounded-lg border border-border-primary bg-surface-secondary p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5 text-accent-primary" />
          <h3 className="text-base font-semibold text-text-primary">SMTP (Email)</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="SMTP Host" defaultValue="smtp.example.com" />
          <Input label="SMTP Port" defaultValue="587" />
          <Input label="SMTP User" defaultValue="" placeholder="user@example.com" />
          <Input label="SMTP Password" type="password" defaultValue="" placeholder="••••••••" />
          <Input label="From Email" defaultValue="noreply@serverhub.ru" />
        </div>
      </section>

      {/* SEO */}
      <section className="rounded-lg border border-border-primary bg-surface-secondary p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5 text-accent-primary" />
          <h3 className="text-base font-semibold text-text-primary">SEO</h3>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <Input label="Meta Title (главная)" defaultValue="ServerHub — серверы для бизнеса" />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">Meta Description (главная)</label>
            <textarea
              defaultValue="Каталог новых и б/у серверов. Конфигуратор, доставка, гарантия."
              rows={3}
              className="w-full rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary resize-none"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button className="gap-2">
          <Settings className="h-4 w-4" />
          Сохранить настройки
        </Button>
      </div>
    </div>
  );
}
