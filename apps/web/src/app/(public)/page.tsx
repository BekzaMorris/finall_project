import type { Metadata } from 'next';
import Link from 'next/link';
import { Server, Cpu, MemoryStick, HardDrive, Shield, Truck, Headphones, ArrowRight, Layers, Monitor } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Главная',
  description: 'Server Sales Portal — каталог новых и б/у серверов, конфигуратор, управление заказами и поддержка',
};

const stats = [
  { value: '1,200+', label: 'серверов в каталоге' },
  { value: '12', label: 'брендов' },
  { value: '6', label: 'городов доставки' },
  { value: '24/7', label: 'поддержка' },
];

const categories = [
  { href: '/catalog?formFactor=Rack', label: 'Rack', description: '1U — 4U', icon: Server },
  { href: '/catalog?formFactor=Tower', label: 'Tower', description: 'Напольные', icon: Monitor },
  { href: '/catalog?formFactor=Blade', label: 'Blade', description: 'Модульные', icon: Layers },
  { href: '/catalog?condition=USED', label: 'Б/У', description: 'Скидки до 60%', icon: ArrowRight },
  { href: '/catalog?condition=NEW', label: 'Новые', description: '2024-2025', icon: Shield },
];

const features = [
  {
    icon: Truck,
    title: 'Быстрая доставка',
    description: 'Отправка в день заказа. Доставка по всему Казахстану за 2-5 дней.',
  },
  {
    icon: Shield,
    title: 'Гарантия до 3 лет',
    description: 'Официальная гарантия производителя на новые серверы. 90 дней на б/у.',
  },
  {
    icon: Headphones,
    title: 'Техподдержка 24/7',
    description: 'Помощь с настройкой, диагностикой и заменой комплектующих.',
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl border border-border-primary bg-gradient-to-br from-surface-secondary via-surface-primary to-surface-tertiary px-6 py-16 sm:px-12 sm:py-24">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 right-10 h-64 w-64 rounded-full bg-accent-primary blur-3xl" />
          <div className="absolute bottom-10 left-10 h-48 w-48 rounded-full bg-accent-secondary blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
            Серверы для{' '}
            <span className="bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
              любых задач
            </span>
          </h1>
          <p className="mt-4 text-lg text-text-secondary sm:text-xl">
            Новые и б/у серверы Dell, HP, Supermicro, Lenovo. Подберём конфигурацию под вашу нагрузку.
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/configurator"
              className="inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-primary/25 transition-all hover:bg-accent-primary/90 hover:shadow-xl hover:shadow-accent-primary/30"
            >
              <Cpu className="h-5 w-5" />
              Подобрать сервер
            </Link>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 rounded-lg border border-border-primary bg-surface-secondary px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-accent-primary/50 hover:bg-surface-tertiary"
            >
              Смотреть каталог
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center gap-1 rounded-lg border border-border-primary bg-surface-secondary p-6 text-center transition-colors hover:border-accent-primary/30"
          >
            <span className="text-2xl font-bold text-accent-primary sm:text-3xl">
              {stat.value}
            </span>
            <span className="text-xs text-text-secondary sm:text-sm">
              {stat.label}
            </span>
          </div>
        ))}
      </section>

      {/* Categories */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-text-primary">Категории</h2>
          <Link
            href="/catalog"
            className="text-sm font-medium text-accent-primary hover:text-accent-primary/80 transition-colors"
          >
            Все серверы →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.label}
                href={cat.href}
                className="group flex flex-col items-center gap-3 rounded-lg border border-border-primary bg-surface-secondary p-6 text-center transition-all hover:border-accent-primary/50 hover:shadow-lg hover:shadow-accent-primary/5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-tertiary text-text-secondary transition-colors group-hover:bg-accent-primary/10 group-hover:text-accent-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{cat.label}</p>
                  <p className="text-xs text-text-tertiary">{cat.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Configurator Preview */}
      <section className="overflow-hidden rounded-2xl border border-border-primary bg-surface-secondary">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left: text */}
          <div className="flex flex-col justify-center p-8 sm:p-12">
            <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-primary/10 px-3 py-1 text-xs font-medium text-accent-primary">
              <Cpu className="h-3.5 w-3.5" />
              Конфигуратор
            </span>
            <h2 className="text-2xl font-bold text-text-primary sm:text-3xl">
              Соберите сервер за 4 шага
            </h2>
            <p className="mt-3 text-text-secondary">
              Выберите тип нагрузки, процессор, память и хранилище — мы подберём подходящие серверы из каталога или соберём под заказ.
            </p>
            <div className="mt-6">
              <Link
                href="/configurator"
                className="inline-flex items-center gap-2 rounded-lg bg-accent-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-primary/90"
              >
                Открыть конфигуратор
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Right: visual */}
          <div className="flex items-center justify-center bg-surface-tertiary p-8 sm:p-12">
            <div className="w-full max-w-xs space-y-4">
              {/* Step indicators */}
              <div className="flex items-center gap-2">
                {['Нагрузка', 'CPU', 'RAM', 'Диски'].map((step, i) => (
                  <div key={step} className="flex items-center gap-2 flex-1">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-accent-primary text-white' : 'bg-surface-secondary text-text-tertiary border border-border-primary'}`}>
                      {i + 1}
                    </div>
                    {i < 3 && <div className="h-0.5 flex-1 rounded bg-border-primary" />}
                  </div>
                ))}
              </div>

              {/* Mock config card */}
              <div className="rounded-lg border border-border-primary bg-surface-secondary p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">CPU</span>
                  <span className="font-medium text-text-primary">Xeon Gold, 16 ядер</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">RAM</span>
                  <span className="font-medium text-text-primary">128 ГБ DDR4 ECC</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Диски</span>
                  <span className="font-medium text-text-primary">2× 960 ГБ NVMe</span>
                </div>
                <div className="border-t border-border-primary pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Найдено:</span>
                    <span className="text-sm font-bold text-accent-primary">12 серверов</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Servers (placeholder) */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-text-primary">Популярные серверы</h2>
          <Link
            href="/catalog?sort=popular"
            className="text-sm font-medium text-accent-primary hover:text-accent-primary/80 transition-colors"
          >
            Все популярные →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: 'Dell PowerEdge R750', cpu: '2× Xeon Gold 5318Y', ram: '256 ГБ', price: '₸ 4,250,000', condition: 'Новый' },
            { name: 'HP ProLiant DL380 Gen10+', cpu: '2× Xeon Gold 6330', ram: '512 ГБ', price: '₸ 3,890,000', condition: 'Новый' },
            { name: 'Supermicro 1029U', cpu: '2× Xeon Platinum 8380', ram: '512 ГБ', price: '₸ 6,500,000', condition: 'Новый' },
            { name: 'Dell R640 (б/у)', cpu: '2× Xeon Gold 5218', ram: '96 ГБ', price: '₸ 825,000', condition: 'Б/У' },
          ].map((server) => (
            <Link
              key={server.name}
              href="/catalog"
              className="group flex flex-col gap-3 rounded-lg border border-border-primary bg-surface-secondary p-5 transition-all hover:border-accent-primary/50 hover:shadow-lg hover:shadow-accent-primary/5"
            >
              {/* Placeholder image */}
              <div className="flex h-32 items-center justify-center rounded-md bg-surface-tertiary">
                <Server className="h-12 w-12 text-text-tertiary opacity-30 transition-transform group-hover:scale-110" />
              </div>

              <div className="flex-1">
                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${server.condition === 'Новый' ? 'bg-status-success/10 text-status-success' : 'bg-status-warning/10 text-status-warning'}`}>
                  {server.condition}
                </span>
                <h3 className="mt-1.5 text-sm font-medium text-text-primary line-clamp-2 group-hover:text-accent-primary transition-colors">
                  {server.name}
                </h3>
                <div className="mt-2 space-y-1 text-xs text-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="h-3 w-3" />
                    <span>{server.cpu}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MemoryStick className="h-3 w-3" />
                    <span>{server.ram}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border-primary pt-3">
                <span className="text-lg font-bold text-text-primary">{server.price}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Why Us */}
      <section>
        <h2 className="mb-6 text-center text-2xl font-bold text-text-primary">Почему выбирают нас</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="flex flex-col items-center gap-4 rounded-lg border border-border-primary bg-surface-secondary p-8 text-center transition-colors hover:border-accent-primary/30"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="text-base font-semibold text-text-primary">{feature.title}</h3>
                <p className="text-sm text-text-secondary">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="rounded-2xl border border-accent-primary/20 bg-gradient-to-r from-accent-primary/5 to-accent-secondary/5 p-8 text-center sm:p-12">
        <h2 className="text-2xl font-bold text-text-primary sm:text-3xl">
          Нужна помощь с выбором?
        </h2>
        <p className="mt-3 text-text-secondary">
          Наши специалисты помогут подобрать оптимальную конфигурацию под ваши задачи
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/support"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-primary/90"
          >
            <Headphones className="h-4 w-4" />
            Связаться с нами
          </Link>
          <a
            href="tel:+78001234567"
            className="inline-flex items-center gap-2 rounded-lg border border-border-primary px-6 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary"
          >
            +7 (800) 123-45-67
          </a>
        </div>
      </section>
    </div>
  );
}
