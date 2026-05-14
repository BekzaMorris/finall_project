'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe,
  Database,
  Layers,
  Brain,
  HardDrive,
  Settings,
  ChevronLeft,
  ChevronRight,
  Server,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

/* ─── Types ─── */

interface ConfiguratorState {
  workloadType: string | null;
  cpu: {
    family: string | null;
    cores: string | null;
    count: string | null;
  };
  ram: {
    size: string | null;
    type: string | null;
  };
  storage: {
    type: string | null;
    size: string | null;
    raid: string | null;
  };
}

interface MatchResult {
  totalMatches: number;
}

/* ─── Constants ─── */

const WORKLOAD_TYPES = [
  { id: 'web_hosting', label: 'Веб-сервер', icon: Globe },
  { id: 'database', label: 'База данных', icon: Database },
  { id: 'virtualization', label: 'Виртуализация', icon: Layers },
  { id: 'ai_ml', label: 'AI/ML', icon: Brain },
  { id: 'file_storage', label: 'Хранилище', icon: HardDrive },
  { id: 'general', label: 'Своё', icon: Settings },
];

const CPU_FAMILIES = ['Intel Xeon E', 'Xeon Gold', 'Xeon Platinum', 'AMD EPYC'];
const CPU_CORES = ['4', '8', '12', '16', '24', '32', '64+'];
const CPU_COUNTS = ['1', '2', '4'];

const RAM_SIZES = ['16', '32', '64', '128', '256', '512+'];
const RAM_TYPES = ['DDR4', 'DDR4 ECC', 'DDR5'];

const STORAGE_TYPES = ['SSD', 'NVMe', 'HDD', 'SAS'];
const STORAGE_SIZES = ['240ГБ', '480ГБ', '960ГБ', '2ТБ', '4ТБ+'];
const RAID_OPTIONS = ['Нет', 'RAID 1', 'RAID 5', 'RAID 10'];

const STEPS = [
  { number: 1, label: 'Нагрузка' },
  { number: 2, label: 'Процессор' },
  { number: 3, label: 'Память' },
  { number: 4, label: 'Хранилище' },
];

/* ─── Main Component ─── */

export default function ConfiguratorPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<ConfiguratorState>({
    workloadType: null,
    cpu: { family: null, cores: null, count: null },
    ram: { size: null, type: null },
    storage: { type: null, size: null, raid: null },
  });

  // Fetch match count from API
  const fetchMatchCount = useCallback(async (state: ConfiguratorState, step: number) => {
    setIsLoading(true);
    try {
      const body: Record<string, unknown> = { step };
      if (state.workloadType) body.workloadType = state.workloadType;
      if (step >= 2 && (state.cpu.family || state.cpu.cores || state.cpu.count)) {
        body.cpu = {
          ...(state.cpu.family && { family: state.cpu.family }),
          ...(state.cpu.cores && { cores: state.cpu.cores }),
          ...(state.cpu.count && { count: state.cpu.count }),
        };
      }
      if (step >= 3 && (state.ram.size || state.ram.type)) {
        body.ram = {
          ...(state.ram.size && { size: state.ram.size }),
          ...(state.ram.type && { type: state.ram.type }),
        };
      }
      if (step >= 4 && (state.storage.type || state.storage.size || state.storage.raid)) {
        body.storage = {
          ...(state.storage.type && { type: state.storage.type }),
          ...(state.storage.size && { size: state.storage.size }),
          ...(state.storage.raid && { raid: state.storage.raid }),
        };
      }

      const result = await apiClient<MatchResult>('/configurator/match', {
        method: 'POST',
        body,
      });
      setMatchCount(result.totalMatches);
    } catch {
      // Silently handle errors - show last known count
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch match count when config changes
  useEffect(() => {
    if (config.workloadType) {
      fetchMatchCount(config, currentStep);
    }
  }, [config, currentStep, fetchMatchCount]);

  const handleWorkloadSelect = (workloadId: string) => {
    setConfig((prev) => ({ ...prev, workloadType: workloadId }));
    setCurrentStep(2);
  };

  const handleCpuChange = (field: keyof ConfiguratorState['cpu'], value: string) => {
    setConfig((prev) => ({
      ...prev,
      cpu: {
        ...prev.cpu,
        [field]: prev.cpu[field] === value ? null : value,
      },
    }));
  };

  const handleRamChange = (field: keyof ConfiguratorState['ram'], value: string) => {
    setConfig((prev) => ({
      ...prev,
      ram: {
        ...prev.ram,
        [field]: prev.ram[field] === value ? null : value,
      },
    }));
  };

  const handleStorageChange = (field: keyof ConfiguratorState['storage'], value: string) => {
    setConfig((prev) => ({
      ...prev,
      storage: {
        ...prev.storage,
        [field]: prev.storage[field] === value ? null : value,
      },
    }));
  };

  const handleShowResults = () => {
    const params = new URLSearchParams();
    if (config.cpu.family) params.set('cpuFamily', config.cpu.family);
    if (config.cpu.cores) params.set('cpuCores', config.cpu.cores);
    if (config.cpu.count) params.set('cpuCount', config.cpu.count);
    if (config.ram.size) params.set('ramGb', config.ram.size.replace('+', ''));
    if (config.ram.type) params.set('ramType', config.ram.type);
    if (config.storage.type) params.set('storageType', config.storage.type);
    router.push(`/catalog?${params.toString()}`);
  };

  const goBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const goForward = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Конфигуратор сервера</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Подберите сервер под вашу задачу за 4 шага
        </p>
      </div>

      {/* Progress bar */}
      <ProgressBar currentStep={currentStep} />

      {/* Main content area */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Step content */}
        <div className="flex-1 min-w-0">
          {currentStep === 1 && (
            <StepWorkload
              selected={config.workloadType}
              onSelect={handleWorkloadSelect}
            />
          )}
          {currentStep === 2 && (
            <StepCPU
              config={config.cpu}
              onChange={handleCpuChange}
            />
          )}
          {currentStep === 3 && (
            <StepRAM
              config={config.ram}
              onChange={handleRamChange}
            />
          )}
          {currentStep === 4 && (
            <StepStorage
              config={config.storage}
              onChange={handleStorageChange}
            />
          )}

          {/* Navigation buttons */}
          {currentStep > 1 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border-primary">
              <button
                onClick={goBack}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Назад
              </button>
              {currentStep < 4 && (
                <button
                  onClick={goForward}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent-primary hover:bg-accent-primary/90 rounded-md transition-colors"
                >
                  Далее
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <ConfigSidebar
          config={config}
          matchCount={matchCount}
          isLoading={isLoading}
          currentStep={currentStep}
          onShowResults={handleShowResults}
        />
      </div>
    </div>
  );
}


/* ─── Progress Bar ─── */

function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, index) => (
        <div key={step.number} className="flex items-center flex-1">
          <div className="flex items-center gap-2 flex-1">
            <div
              className={[
                'flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all duration-200',
                currentStep === step.number
                  ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/25'
                  : currentStep > step.number
                    ? 'bg-accent-primary/20 text-accent-primary'
                    : 'bg-surface-tertiary text-text-tertiary',
              ].join(' ')}
            >
              {step.number}
            </div>
            <span
              className={[
                'text-sm font-medium hidden sm:inline transition-colors',
                currentStep === step.number
                  ? 'text-text-primary'
                  : currentStep > step.number
                    ? 'text-accent-primary'
                    : 'text-text-tertiary',
              ].join(' ')}
            >
              {step.label}
            </span>
          </div>
          {index < STEPS.length - 1 && (
            <div
              className={[
                'h-0.5 flex-1 mx-2 rounded-full transition-colors',
                currentStep > step.number ? 'bg-accent-primary' : 'bg-border-primary',
              ].join(' ')}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Step 1: Workload Type ─── */

function StepWorkload({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary mb-2">Выберите тип нагрузки</h2>
      <p className="text-sm text-text-secondary mb-6">
        Это поможет подобрать оптимальную конфигурацию
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {WORKLOAD_TYPES.map((workload) => {
          const Icon = workload.icon;
          const isSelected = selected === workload.id;
          return (
            <button
              key={workload.id}
              onClick={() => onSelect(workload.id)}
              className={[
                'flex flex-col items-center gap-3 p-6 rounded-lg border transition-all duration-200',
                'hover:border-accent-primary/50 hover:shadow-lg hover:shadow-accent-primary/5',
                isSelected
                  ? 'border-accent-primary bg-accent-primary/10 shadow-lg shadow-accent-primary/10'
                  : 'border-border-primary bg-surface-secondary',
              ].join(' ')}
            >
              <div
                className={[
                  'flex items-center justify-center w-12 h-12 rounded-lg transition-colors',
                  isSelected
                    ? 'bg-accent-primary text-white'
                    : 'bg-surface-tertiary text-text-secondary',
                ].join(' ')}
              >
                <Icon className="h-6 w-6" />
              </div>
              <span
                className={[
                  'text-sm font-medium transition-colors',
                  isSelected ? 'text-accent-primary' : 'text-text-primary',
                ].join(' ')}
              >
                {workload.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Step 2: CPU Configuration ─── */

function StepCPU({
  config,
  onChange,
}: {
  config: ConfiguratorState['cpu'];
  onChange: (field: keyof ConfiguratorState['cpu'], value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Настройте процессор</h2>
        <p className="text-sm text-text-secondary mb-6">
          Выберите параметры CPU для вашего сервера
        </p>
      </div>

      <ChipGroup
        label="Семейство"
        options={CPU_FAMILIES}
        selected={config.family}
        onSelect={(value) => onChange('family', value)}
      />

      <ChipGroup
        label="Количество ядер"
        options={CPU_CORES}
        selected={config.cores}
        onSelect={(value) => onChange('cores', value)}
      />

      <ChipGroup
        label="Количество процессоров"
        options={CPU_COUNTS}
        selected={config.count}
        onSelect={(value) => onChange('count', value)}
      />
    </div>
  );
}

/* ─── Step 3: RAM Configuration ─── */

function StepRAM({
  config,
  onChange,
}: {
  config: ConfiguratorState['ram'];
  onChange: (field: keyof ConfiguratorState['ram'], value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Настройте память</h2>
        <p className="text-sm text-text-secondary mb-6">
          Выберите объём и тип оперативной памяти
        </p>
      </div>

      <ChipGroup
        label="Объём (ГБ)"
        options={RAM_SIZES}
        selected={config.size}
        onSelect={(value) => onChange('size', value)}
      />

      <ChipGroup
        label="Тип памяти"
        options={RAM_TYPES}
        selected={config.type}
        onSelect={(value) => onChange('type', value)}
      />
    </div>
  );
}

/* ─── Step 4: Storage Configuration ─── */

function StepStorage({
  config,
  onChange,
}: {
  config: ConfiguratorState['storage'];
  onChange: (field: keyof ConfiguratorState['storage'], value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Настройте хранилище</h2>
        <p className="text-sm text-text-secondary mb-6">
          Выберите тип и объём дисковой подсистемы
        </p>
      </div>

      <ChipGroup
        label="Тип накопителя"
        options={STORAGE_TYPES}
        selected={config.type}
        onSelect={(value) => onChange('type', value)}
      />

      <ChipGroup
        label="Объём"
        options={STORAGE_SIZES}
        selected={config.size}
        onSelect={(value) => onChange('size', value)}
      />

      <ChipGroup
        label="RAID"
        options={RAID_OPTIONS}
        selected={config.raid}
        onSelect={(value) => onChange('raid', value)}
      />
    </div>
  );
}


/* ─── Chip Group Component ─── */

function ChipGroup({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = selected === option;
          return (
            <button
              key={option}
              onClick={() => onSelect(option)}
              className={[
                'px-4 py-2 rounded-md text-sm font-medium transition-all duration-150',
                'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary',
                isActive
                  ? 'bg-accent-primary text-white border-accent-primary shadow-md shadow-accent-primary/20'
                  : 'bg-surface-secondary text-text-secondary border-border-primary hover:border-accent-primary/50 hover:text-text-primary',
              ].join(' ')}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Configuration Sidebar ─── */

function ConfigSidebar({
  config,
  matchCount,
  isLoading,
  currentStep,
  onShowResults,
}: {
  config: ConfiguratorState;
  matchCount: number | null;
  isLoading: boolean;
  currentStep: number;
  onShowResults: () => void;
}) {
  const workloadLabel = WORKLOAD_TYPES.find((w) => w.id === config.workloadType)?.label;

  return (
    <aside className="lg:w-80 shrink-0">
      <div className="lg:sticky lg:top-8 rounded-lg border border-border-primary bg-surface-secondary p-6 flex flex-col gap-5">
        {/* Header */}
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          Ваша конфигурация
        </h3>

        {/* Selected values */}
        <div className="flex flex-col gap-3 text-sm">
          {/* Workload */}
          <SidebarRow
            label="Нагрузка"
            value={workloadLabel}
            active={currentStep >= 1 && !!config.workloadType}
          />

          {/* CPU */}
          {currentStep >= 2 && (
            <SidebarRow
              label="Процессор"
              value={formatCpuSummary(config.cpu)}
              active={!!(config.cpu.family || config.cpu.cores || config.cpu.count)}
            />
          )}

          {/* RAM */}
          {currentStep >= 3 && (
            <SidebarRow
              label="Память"
              value={formatRamSummary(config.ram)}
              active={!!(config.ram.size || config.ram.type)}
            />
          )}

          {/* Storage */}
          {currentStep >= 4 && (
            <SidebarRow
              label="Хранилище"
              value={formatStorageSummary(config.storage)}
              active={!!(config.storage.type || config.storage.size || config.storage.raid)}
            />
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border-primary" />

        {/* Match count */}
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-accent-primary" />
          ) : (
            <Server className="h-4 w-4 text-accent-primary" />
          )}
          <span className="text-sm font-medium text-text-primary">
            {matchCount !== null ? (
              <>
                Найдено:{' '}
                <span className="text-accent-primary font-bold">{matchCount}</span> серверов
              </>
            ) : (
              <span className="text-text-tertiary">Выберите нагрузку</span>
            )}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onShowResults}
            disabled={matchCount === null || matchCount === 0}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-accent-primary hover:bg-accent-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            Показать результаты
          </button>
          <button
            onClick={() => {
              // Quote form modal will be implemented in task 21.2
              window.dispatchEvent(new CustomEvent('open-quote-modal', { detail: config }));
            }}
            disabled={!config.workloadType}
            className="w-full px-4 py-2.5 text-sm font-medium text-text-primary bg-surface-tertiary border border-border-primary hover:border-accent-primary/50 rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            Отправить заявку
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ─── Sidebar Row ─── */

function SidebarRow({
  label,
  value,
  active,
}: {
  label: string;
  value: string | undefined | null;
  active: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-text-secondary">{label}</span>
      <span
        className={[
          'text-right font-medium',
          active ? 'text-text-primary' : 'text-text-tertiary',
        ].join(' ')}
      >
        {value || '—'}
      </span>
    </div>
  );
}

/* ─── Helpers ─── */

function formatCpuSummary(cpu: ConfiguratorState['cpu']): string | null {
  const parts: string[] = [];
  if (cpu.family) parts.push(cpu.family);
  if (cpu.cores) parts.push(`${cpu.cores} ядер`);
  if (cpu.count) parts.push(`×${cpu.count}`);
  return parts.length > 0 ? parts.join(', ') : null;
}

function formatRamSummary(ram: ConfiguratorState['ram']): string | null {
  const parts: string[] = [];
  if (ram.size) parts.push(`${ram.size} ГБ`);
  if (ram.type) parts.push(ram.type);
  return parts.length > 0 ? parts.join(', ') : null;
}

function formatStorageSummary(storage: ConfiguratorState['storage']): string | null {
  const parts: string[] = [];
  if (storage.type) parts.push(storage.type);
  if (storage.size) parts.push(storage.size);
  if (storage.raid && storage.raid !== 'Нет') parts.push(storage.raid);
  return parts.length > 0 ? parts.join(', ') : null;
}
