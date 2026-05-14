'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button, Input } from '@kiroportal/ui';
import { apiClient, ApiClientError } from '@/lib/api-client';

export default function NewProductPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    sku: '',
    brand: 'Dell',
    condition: 'NEW',
    price: '',
    stockStatus: 'IN_STOCK',
    stock: '0',
    cpuFamily: '',
    cpuModel: '',
    cpuCores: '',
    cpuThreads: '',
    cpuFreqMhz: '',
    cpuSocket: '',
    cpuCount: '1',
    ramGb: '',
    ramType: 'DDR4 ECC',
    ramFreqMhz: '',
    ramSlotsUsed: '',
    ramSlotsTotal: '',
    diskType: 'SSD',
    diskGb: '',
    diskBays: '',
    diskHotswap: false,
    formFactor: 'Rack',
    unitCount: '2',
    psuWatt: '',
    description: '',
  });

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        name: form.name,
        sku: form.sku || `SRV-${Date.now()}`,
        brand: form.brand,
        condition: form.condition,
        price: parseFloat(form.price),
        stockStatus: form.stockStatus,
        stock: parseInt(form.stock) || 0,
      };

      if (form.cpuFamily) body.cpuFamily = form.cpuFamily;
      if (form.cpuModel) body.cpuModel = form.cpuModel;
      if (form.cpuCores) body.cpuCores = parseInt(form.cpuCores);
      if (form.cpuThreads) body.cpuThreads = parseInt(form.cpuThreads);
      if (form.cpuFreqMhz) body.cpuFreqMhz = parseInt(form.cpuFreqMhz);
      if (form.cpuSocket) body.cpuSocket = form.cpuSocket;
      if (form.cpuCount) body.cpuCount = parseInt(form.cpuCount);
      if (form.ramGb) body.ramGb = parseInt(form.ramGb);
      if (form.ramType) body.ramType = form.ramType;
      if (form.ramFreqMhz) body.ramFreqMhz = parseInt(form.ramFreqMhz);
      if (form.ramSlotsUsed) body.ramSlotsUsed = parseInt(form.ramSlotsUsed);
      if (form.ramSlotsTotal) body.ramSlotsTotal = parseInt(form.ramSlotsTotal);
      if (form.diskType) body.diskType = form.diskType;
      if (form.diskGb) body.diskGb = parseInt(form.diskGb);
      if (form.diskBays) body.diskBays = parseInt(form.diskBays);
      body.diskHotswap = form.diskHotswap;
      if (form.formFactor) body.formFactor = form.formFactor;
      if (form.unitCount) body.unitCount = parseInt(form.unitCount);
      if (form.psuWatt) body.psuWatt = parseInt(form.psuWatt);
      if (form.description) body.description = form.description;

      await apiClient('/admin/products', { method: 'POST', body });
      router.push('/admin/products');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Не удалось создать товар');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/products">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-text-primary">Добавить сервер</h2>
      </div>

      {error && (
        <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <Section title="Основная информация">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Название *" value={form.name} onChange={(e) => updateField('name', e.target.value)} required />
            <Input label="Артикул (SKU)" value={form.sku} onChange={(e) => updateField('sku', e.target.value)} placeholder="Авто-генерация" />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">Бренд *</label>
              <select value={form.brand} onChange={(e) => updateField('brand', e.target.value)} className="rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary">
                <option value="Dell">Dell</option>
                <option value="HP">HP</option>
                <option value="Supermicro">Supermicro</option>
                <option value="Lenovo">Lenovo</option>
                <option value="Cisco">Cisco</option>
                <option value="Fujitsu">Fujitsu</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">Состояние *</label>
              <select value={form.condition} onChange={(e) => updateField('condition', e.target.value)} className="rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary">
                <option value="NEW">Новый</option>
                <option value="USED">Б/У</option>
                <option value="REFURBISHED">Восстановленный</option>
              </select>
            </div>
            <Input label="Цена (₸) *" type="number" value={form.price} onChange={(e) => updateField('price', e.target.value)} required />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">Наличие</label>
              <select value={form.stockStatus} onChange={(e) => updateField('stockStatus', e.target.value)} className="rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary">
                <option value="IN_STOCK">В наличии</option>
                <option value="LOW_STOCK">Мало</option>
                <option value="OUT_OF_STOCK">Нет в наличии</option>
                <option value="PRE_ORDER">Под заказ</option>
              </select>
            </div>
          </div>
        </Section>

        {/* CPU */}
        <Section title="Процессор">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Семейство" value={form.cpuFamily} onChange={(e) => updateField('cpuFamily', e.target.value)} placeholder="Xeon Gold" />
            <Input label="Модель" value={form.cpuModel} onChange={(e) => updateField('cpuModel', e.target.value)} placeholder="5318Y" />
            <Input label="Ядра" type="number" value={form.cpuCores} onChange={(e) => updateField('cpuCores', e.target.value)} placeholder="16" />
            <Input label="Потоки" type="number" value={form.cpuThreads} onChange={(e) => updateField('cpuThreads', e.target.value)} placeholder="32" />
            <Input label="Частота (МГц)" type="number" value={form.cpuFreqMhz} onChange={(e) => updateField('cpuFreqMhz', e.target.value)} placeholder="2100" />
            <Input label="Сокет" value={form.cpuSocket} onChange={(e) => updateField('cpuSocket', e.target.value)} placeholder="LGA 4189" />
            <Input label="Кол-во CPU" type="number" value={form.cpuCount} onChange={(e) => updateField('cpuCount', e.target.value)} />
          </div>
        </Section>

        {/* RAM */}
        <Section title="Оперативная память">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Объём (ГБ)" type="number" value={form.ramGb} onChange={(e) => updateField('ramGb', e.target.value)} placeholder="128" />
            <Input label="Тип" value={form.ramType} onChange={(e) => updateField('ramType', e.target.value)} />
            <Input label="Частота (МГц)" type="number" value={form.ramFreqMhz} onChange={(e) => updateField('ramFreqMhz', e.target.value)} placeholder="3200" />
            <Input label="Слотов занято" type="number" value={form.ramSlotsUsed} onChange={(e) => updateField('ramSlotsUsed', e.target.value)} />
            <Input label="Слотов всего" type="number" value={form.ramSlotsTotal} onChange={(e) => updateField('ramSlotsTotal', e.target.value)} />
          </div>
        </Section>

        {/* Storage */}
        <Section title="Хранилище">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">Тип</label>
              <select value={form.diskType} onChange={(e) => updateField('diskType', e.target.value)} className="rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary">
                <option value="SSD">SSD</option>
                <option value="NVMe">NVMe</option>
                <option value="HDD">HDD</option>
                <option value="SAS">SAS</option>
              </select>
            </div>
            <Input label="Объём (ГБ)" type="number" value={form.diskGb} onChange={(e) => updateField('diskGb', e.target.value)} placeholder="960" />
            <Input label="Отсеков" type="number" value={form.diskBays} onChange={(e) => updateField('diskBays', e.target.value)} placeholder="8" />
            <label className="flex items-center gap-2 cursor-pointer sm:col-span-3">
              <input type="checkbox" checked={form.diskHotswap} onChange={(e) => updateField('diskHotswap', e.target.checked)} className="h-4 w-4 rounded border-border-primary" />
              <span className="text-sm text-text-primary">Горячая замена (Hot-Swap)</span>
            </label>
          </div>
        </Section>

        {/* Form Factor */}
        <Section title="Форм-фактор">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">Тип</label>
              <select value={form.formFactor} onChange={(e) => updateField('formFactor', e.target.value)} className="rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary">
                <option value="Rack">Rack</option>
                <option value="Tower">Tower</option>
                <option value="Blade">Blade</option>
              </select>
            </div>
            <Input label="Юниты (U)" type="number" value={form.unitCount} onChange={(e) => updateField('unitCount', e.target.value)} />
            <Input label="БП (Вт)" type="number" value={form.psuWatt} onChange={(e) => updateField('psuWatt', e.target.value)} placeholder="750" />
          </div>
        </Section>

        {/* Description */}
        <Section title="Описание">
          <textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={4}
            placeholder="Описание сервера..."
            className="w-full rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary resize-y"
          />
        </Section>

        {/* Submit */}
        <div className="flex justify-end gap-3 border-t border-border-primary pt-6">
          <Link href="/admin/products">
            <Button variant="secondary">Отмена</Button>
          </Link>
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Сохранение...' : 'Создать сервер'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border-primary bg-surface-secondary p-6">
      <h3 className="text-base font-semibold text-text-primary mb-4">{title}</h3>
      {children}
    </section>
  );
}
