'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button, Input } from '@kiroportal/ui';
import { apiClient, ApiClientError } from '@/lib/api-client';

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.id as string;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({
    name: '', sku: '', brand: '', condition: 'NEW', price: '', stockStatus: 'IN_STOCK',
    stock: '0', cpuFamily: '', cpuModel: '', cpuCores: '', cpuThreads: '',
    cpuFreqMhz: '', cpuSocket: '', cpuCount: '1', ramGb: '', ramType: '',
    ramFreqMhz: '', ramSlotsUsed: '', ramSlotsTotal: '', diskType: '', diskGb: '',
    diskBays: '', diskHotswap: false, formFactor: '', unitCount: '', psuWatt: '', description: '',
  });
  const [productId, setProductId] = useState<string | null>(null);

  // Fetch product by slug via public API, fallback to searching by ID
  const { data: product, isLoading } = useQuery({
    queryKey: ['product-edit', slug],
    queryFn: async () => {
      // Try by slug first
      try {
        const result = await apiClient<Record<string, unknown>>(`/products/${slug}`);
        if (result) return result;
      } catch {
        // Not found by slug, try fetching all and finding by ID
      }
      // Fallback: search in admin products by ID
      try {
        const res = await apiClient<{ items: Record<string, unknown>[] }>(`/admin/products?limit=100`);
        const found = res.items?.find((p: any) => p.id === slug || p.slug === slug);
        if (found) return found;
      } catch {}
      return null;
    },
    enabled: !!slug,
  });

  useEffect(() => {
    if (product) {
      setProductId(product.id as string);
      setForm({
        name: (product.name as string) || '',
        sku: (product.sku as string) || '',
        brand: (product.brand as string) || '',
        condition: (product.condition as string) || 'NEW',
        price: String(product.price || ''),
        stockStatus: (product.stockStatus as string) || 'IN_STOCK',
        stock: String(product.stock || 0),
        cpuFamily: (product.cpuFamily as string) || '',
        cpuModel: (product.cpuModel as string) || '',
        cpuCores: product.cpuCores ? String(product.cpuCores) : '',
        cpuThreads: product.cpuThreads ? String(product.cpuThreads) : '',
        cpuFreqMhz: product.cpuFreqMhz ? String(product.cpuFreqMhz) : '',
        cpuSocket: (product.cpuSocket as string) || '',
        cpuCount: String(product.cpuCount || 1),
        ramGb: product.ramGb ? String(product.ramGb) : '',
        ramType: (product.ramType as string) || '',
        ramFreqMhz: product.ramFreqMhz ? String(product.ramFreqMhz) : '',
        ramSlotsUsed: product.ramSlotsUsed ? String(product.ramSlotsUsed) : '',
        ramSlotsTotal: product.ramSlotsTotal ? String(product.ramSlotsTotal) : '',
        diskType: (product.diskType as string) || '',
        diskGb: product.diskGb ? String(product.diskGb) : '',
        diskBays: product.diskBays ? String(product.diskBays) : '',
        diskHotswap: (product.diskHotswap as boolean) || false,
        formFactor: (product.formFactor as string) || '',
        unitCount: product.unitCount ? String(product.unitCount) : '',
        psuWatt: product.psuWatt ? String(product.psuWatt) : '',
        description: (product.description as string) || '',
      });
    }
  }, [product]);

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return;
    setError(null);
    setSaving(true);

    try {
      const body: Record<string, unknown> = {};
      if (form.name) body.name = form.name;
      if (form.brand) body.brand = form.brand;
      if (form.condition) body.condition = form.condition;
      if (form.price) body.price = parseFloat(form.price as string);
      if (form.stockStatus) body.stockStatus = form.stockStatus;
      body.stock = parseInt(form.stock as string) || 0;
      if (form.cpuFamily) body.cpuFamily = form.cpuFamily;
      if (form.cpuModel) body.cpuModel = form.cpuModel;
      if (form.cpuCores) body.cpuCores = parseInt(form.cpuCores as string);
      if (form.cpuThreads) body.cpuThreads = parseInt(form.cpuThreads as string);
      if (form.cpuFreqMhz) body.cpuFreqMhz = parseInt(form.cpuFreqMhz as string);
      if (form.cpuSocket) body.cpuSocket = form.cpuSocket;
      if (form.cpuCount) body.cpuCount = parseInt(form.cpuCount as string);
      if (form.ramGb) body.ramGb = parseInt(form.ramGb as string);
      if (form.ramType) body.ramType = form.ramType;
      if (form.ramFreqMhz) body.ramFreqMhz = parseInt(form.ramFreqMhz as string);
      if (form.ramSlotsUsed) body.ramSlotsUsed = parseInt(form.ramSlotsUsed as string);
      if (form.ramSlotsTotal) body.ramSlotsTotal = parseInt(form.ramSlotsTotal as string);
      if (form.diskType) body.diskType = form.diskType;
      if (form.diskGb) body.diskGb = parseInt(form.diskGb as string);
      if (form.diskBays) body.diskBays = parseInt(form.diskBays as string);
      body.diskHotswap = form.diskHotswap;
      if (form.formFactor) body.formFactor = form.formFactor;
      if (form.unitCount) body.unitCount = parseInt(form.unitCount as string);
      if (form.psuWatt) body.psuWatt = parseInt(form.psuWatt as string);
      if (form.description) body.description = form.description;

      await apiClient(`/admin/products/${productId}`, { method: 'PATCH', body });
      router.push('/admin/products');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Не удалось сохранить');
      }
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary">Товар не найден</p>
        <Link href="/admin/products" className="mt-4 inline-block text-accent-primary hover:underline">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/products">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-text-primary">Редактировать: {product.name as string}</h2>
      </div>

      {error && (
        <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="rounded-lg border border-border-primary bg-surface-secondary p-6">
          <h3 className="text-base font-semibold text-text-primary mb-4">Основная информация</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Название" value={form.name as string} onChange={(e) => updateField('name', e.target.value)} />
            <Input label="SKU" value={form.sku as string} onChange={(e) => updateField('sku', e.target.value)} disabled />
            <Input label="Бренд" value={form.brand as string} onChange={(e) => updateField('brand', e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">Состояние</label>
              <select value={form.condition as string} onChange={(e) => updateField('condition', e.target.value)} className="rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary">
                <option value="NEW">Новый</option>
                <option value="USED">Б/У</option>
                <option value="REFURBISHED">Восстановленный</option>
              </select>
            </div>
            <Input label="Цена" type="number" step="0.01" value={form.price as string} onChange={(e) => updateField('price', e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">Наличие</label>
              <select value={form.stockStatus as string} onChange={(e) => updateField('stockStatus', e.target.value)} className="rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary">
                <option value="IN_STOCK">В наличии</option>
                <option value="LOW_STOCK">Мало</option>
                <option value="OUT_OF_STOCK">Нет</option>
                <option value="PRE_ORDER">Под заказ</option>
              </select>
            </div>
            <Input label="Кол-во на складе" type="number" value={form.stock as string} onChange={(e) => updateField('stock', e.target.value)} />
          </div>
        </section>

        <section className="rounded-lg border border-border-primary bg-surface-secondary p-6">
          <h3 className="text-base font-semibold text-text-primary mb-4">Процессор</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Семейство" value={form.cpuFamily as string} onChange={(e) => updateField('cpuFamily', e.target.value)} />
            <Input label="Модель" value={form.cpuModel as string} onChange={(e) => updateField('cpuModel', e.target.value)} />
            <Input label="Ядра" type="number" value={form.cpuCores as string} onChange={(e) => updateField('cpuCores', e.target.value)} />
            <Input label="Потоки" type="number" value={form.cpuThreads as string} onChange={(e) => updateField('cpuThreads', e.target.value)} />
            <Input label="Частота (МГц)" type="number" value={form.cpuFreqMhz as string} onChange={(e) => updateField('cpuFreqMhz', e.target.value)} />
            <Input label="Сокет" value={form.cpuSocket as string} onChange={(e) => updateField('cpuSocket', e.target.value)} />
            <Input label="Кол-во CPU" type="number" value={form.cpuCount as string} onChange={(e) => updateField('cpuCount', e.target.value)} />
          </div>
        </section>

        <section className="rounded-lg border border-border-primary bg-surface-secondary p-6">
          <h3 className="text-base font-semibold text-text-primary mb-4">Память</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Объём (ГБ)" type="number" value={form.ramGb as string} onChange={(e) => updateField('ramGb', e.target.value)} />
            <Input label="Тип" value={form.ramType as string} onChange={(e) => updateField('ramType', e.target.value)} />
            <Input label="Частота (МГц)" type="number" value={form.ramFreqMhz as string} onChange={(e) => updateField('ramFreqMhz', e.target.value)} />
            <Input label="Слотов занято" type="number" value={form.ramSlotsUsed as string} onChange={(e) => updateField('ramSlotsUsed', e.target.value)} />
            <Input label="Слотов всего" type="number" value={form.ramSlotsTotal as string} onChange={(e) => updateField('ramSlotsTotal', e.target.value)} />
          </div>
        </section>

        <section className="rounded-lg border border-border-primary bg-surface-secondary p-6">
          <h3 className="text-base font-semibold text-text-primary mb-4">Хранилище</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Тип" value={form.diskType as string} onChange={(e) => updateField('diskType', e.target.value)} />
            <Input label="Объём (ГБ)" type="number" value={form.diskGb as string} onChange={(e) => updateField('diskGb', e.target.value)} />
            <Input label="Отсеков" type="number" value={form.diskBays as string} onChange={(e) => updateField('diskBays', e.target.value)} />
            <label className="flex items-center gap-2 cursor-pointer sm:col-span-3">
              <input type="checkbox" checked={form.diskHotswap as boolean} onChange={(e) => updateField('diskHotswap', e.target.checked)} className="h-4 w-4 rounded border-border-primary" />
              <span className="text-sm text-text-primary">Горячая замена (Hot-Swap)</span>
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-border-primary bg-surface-secondary p-6">
          <h3 className="text-base font-semibold text-text-primary mb-4">Форм-фактор</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Тип" value={form.formFactor as string} onChange={(e) => updateField('formFactor', e.target.value)} />
            <Input label="Юниты (U)" type="number" value={form.unitCount as string} onChange={(e) => updateField('unitCount', e.target.value)} />
            <Input label="БП (Вт)" type="number" value={form.psuWatt as string} onChange={(e) => updateField('psuWatt', e.target.value)} />
          </div>
        </section>

        <section className="rounded-lg border border-border-primary bg-surface-secondary p-6">
          <h3 className="text-base font-semibold text-text-primary mb-4">Описание</h3>
          <textarea
            value={form.description as string}
            onChange={(e) => updateField('description', e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary resize-y"
          />
        </section>

        <div className="flex justify-end gap-3 border-t border-border-primary pt-6">
          <Link href="/admin/products">
            <Button variant="secondary">Отмена</Button>
          </Link>
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </div>
  );
}
