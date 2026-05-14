'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Product } from '@kiroportal/types';

interface SpecificationsTableProps {
  product: Product;
}

interface SpecSection {
  title: string;
  specs: { label: string; value: string | number | boolean | undefined | null }[];
}

function formatBoolean(value: boolean): string {
  return value ? 'Да' : 'Нет';
}

function buildSpecSections(product: Product): SpecSection[] {
  const sections: SpecSection[] = [
    {
      title: 'Процессор',
      specs: [
        { label: 'Семейство', value: product.cpuFamily },
        { label: 'Модель', value: product.cpuModel },
        { label: 'Количество процессоров', value: product.cpuCount },
        { label: 'Ядра', value: product.cpuCores },
        { label: 'Потоки', value: product.cpuThreads },
        { label: 'Частота', value: `${product.cpuFrequency} ГГц` },
        { label: 'Частота Boost', value: product.cpuBoostFrequency ? `${product.cpuBoostFrequency} ГГц` : null },
        { label: 'Сокет', value: product.cpuSocket },
      ],
    },
    {
      title: 'Память',
      specs: [
        { label: 'Объём', value: `${product.ramGb} ГБ` },
        { label: 'Тип', value: product.ramType },
        { label: 'Частота', value: `${product.ramFrequency} МГц` },
        { label: 'Слоты (занято / всего)', value: `${product.ramSlotsUsed} / ${product.ramSlots}` },
      ],
    },
    {
      title: 'Хранилище',
      specs: [
        { label: 'Тип', value: product.storageType },
        { label: 'Объём', value: `${product.storageSizeGb} ГБ` },
        { label: 'Количество дисков', value: product.storageCount },
        { label: 'Hot-Swap', value: formatBoolean(product.hotSwap) },
      ],
    },
    {
      title: 'Форм-фактор',
      specs: [
        { label: 'Тип', value: product.formFactor },
        { label: 'Юниты', value: `${product.units}U` },
        { label: 'Блок питания', value: `${product.psuWattage} Вт` },
        { label: 'Резервный БП', value: formatBoolean(product.psuRedundant) },
      ],
    },
  ];

  // Custom fields from JSONB
  const customFields = product.customFields;
  if (customFields && typeof customFields === 'object' && Object.keys(customFields).length > 0) {
    const customSpecs: { label: string; value: string | number | boolean | undefined | null }[] = [];

    for (const [key, value] of Object.entries(customFields)) {
      if (value === null || value === undefined) continue;

      // Handle structured custom fields (with label/value) or simple key-value
      if (typeof value === 'object' && value !== null && 'label' in value && 'value' in value) {
        const field = value as { label: string; value: unknown };
        customSpecs.push({
          label: field.label,
          value: typeof field.value === 'boolean' ? formatBoolean(field.value) : String(field.value),
        });
      } else {
        customSpecs.push({
          label: key,
          value: typeof value === 'boolean' ? formatBoolean(value) : String(value),
        });
      }
    }

    if (customSpecs.length > 0) {
      sections.push({
        title: 'Дополнительно',
        specs: customSpecs,
      });
    }
  }

  return sections;
}

export function SpecificationsTable({ product }: SpecificationsTableProps) {
  const sections = buildSpecSections(product);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set(sections.map((_, i) => i)),
  );

  function toggleSection(index: number) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <section className="rounded-lg border border-border-primary bg-surface-secondary">
      <h2 className="border-b border-border-primary px-6 py-4 text-lg font-semibold text-text-primary">
        Характеристики
      </h2>

      <div className="divide-y divide-border-primary">
        {sections.map((section, sectionIndex) => {
          const isExpanded = expandedSections.has(sectionIndex);

          return (
            <div key={section.title}>
              {/* Section header */}
              <button
                onClick={() => toggleSection(sectionIndex)}
                className="flex w-full items-center justify-between px-6 py-3 text-left transition-colors hover:bg-surface-tertiary"
                aria-expanded={isExpanded}
              >
                <span className="text-sm font-semibold text-text-primary">{section.title}</span>
                <ChevronDown
                  className={[
                    'h-4 w-4 text-text-tertiary transition-transform duration-200',
                    isExpanded ? 'rotate-180' : '',
                  ].join(' ')}
                />
              </button>

              {/* Section content */}
              {isExpanded && (
                <div className="px-6 pb-4">
                  <dl className="divide-y divide-border-primary/50">
                    {section.specs
                      .filter((spec) => spec.value !== null && spec.value !== undefined)
                      .map((spec) => (
                        <div
                          key={spec.label}
                          className="flex items-center justify-between gap-4 py-2.5"
                        >
                          <dt className="text-sm text-text-secondary">{spec.label}</dt>
                          <dd className="text-sm font-medium text-text-primary text-right">
                            {String(spec.value)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
