'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Ticket, MessageCircle, Phone, Mail, HelpCircle } from 'lucide-react';
import { Button } from '@kiroportal/ui';

const faqItems = [
  {
    question: 'Как оформить заказ?',
    answer: 'Добавьте серверы в корзину из каталога, перейдите в корзину и нажмите "Оформить заказ". Заполните контактные данные и отправьте заявку. Наш менеджер свяжется с вами для подтверждения.',
  },
  {
    question: 'Какие способы оплаты доступны?',
    answer: 'Мы работаем по безналичному расчёту для юридических лиц и принимаем оплату картой для физических лиц. Подробности уточняйте у менеджера после оформления заявки.',
  },
  {
    question: 'Какая гарантия на б/у серверы?',
    answer: 'На все б/у и восстановленные серверы предоставляется гарантия 90 дней. На новые серверы — гарантия производителя до 3 лет.',
  },
  {
    question: 'Как работает доставка?',
    answer: 'Доставка по Казахстану за 2-5 рабочих дней. Отправка в день заказа при наличии товара на складе. Стоимость доставки рассчитывается индивидуально.',
  },
  {
    question: 'Можно ли вернуть сервер?',
    answer: 'Возврат возможен в течение 14 дней с момента получения, если товар не был в эксплуатации и сохранена оригинальная упаковка.',
  },
];

export default function SupportPage() {
  return (
    <div className="flex flex-col gap-10">
      {/* Breadcrumbs */}
      <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/" className="hover:text-text-primary transition-colors">
          Главная
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-text-primary font-medium">Поддержка</span>
      </nav>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary">Поддержка</h1>
        <p className="mt-2 text-text-secondary">
          Мы готовы помочь. Выберите удобный способ связи или найдите ответ в FAQ.
        </p>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/tickets"
          className="flex flex-col items-center gap-3 rounded-lg border border-border-primary bg-surface-secondary p-8 text-center transition-all hover:border-accent-primary/50 hover:shadow-lg hover:shadow-accent-primary/5"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
            <Ticket className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-text-primary">Создать тикет</h3>
          <p className="text-sm text-text-secondary">
            Опишите проблему — мы ответим в течение 24 часов
          </p>
        </Link>

        <a
          href="tel:+78001234567"
          className="flex flex-col items-center gap-3 rounded-lg border border-border-primary bg-surface-secondary p-8 text-center transition-all hover:border-accent-primary/50 hover:shadow-lg hover:shadow-accent-primary/5"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-status-success/10 text-status-success">
            <Phone className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-text-primary">Позвонить</h3>
          <p className="text-sm text-text-secondary">
            +7 (800) 123-45-67 — ежедневно с 9:00 до 21:00
          </p>
        </a>

        <a
          href="mailto:support@serverhub.ru"
          className="flex flex-col items-center gap-3 rounded-lg border border-border-primary bg-surface-secondary p-8 text-center transition-all hover:border-accent-primary/50 hover:shadow-lg hover:shadow-accent-primary/5"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-status-warning/10 text-status-warning">
            <Mail className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-text-primary">Написать на email</h3>
          <p className="text-sm text-text-secondary">
            support@serverhub.ru — ответим в течение 2 часов
          </p>
        </a>
      </div>

      {/* FAQ */}
      <section>
        <div className="mb-6 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-accent-primary" />
          <h2 className="text-xl font-bold text-text-primary">Часто задаваемые вопросы</h2>
        </div>

        <div className="divide-y divide-border-primary rounded-lg border border-border-primary bg-surface-secondary">
          {faqItems.map((item, index) => (
            <FaqItem key={index} question={item.question} answer={item.answer} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="rounded-lg border border-border-primary bg-surface-secondary p-8 text-center">
        <MessageCircle className="mx-auto h-10 w-10 text-accent-primary mb-3" />
        <h3 className="text-lg font-semibold text-text-primary">Не нашли ответ?</h3>
        <p className="mt-1 text-sm text-text-secondary mb-4">
          Создайте тикет и наша команда поддержки поможет вам
        </p>
        <Link href="/tickets">
          <Button className="gap-2">
            <Ticket className="h-4 w-4" />
            Создать тикет
          </Button>
        </Link>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-surface-tertiary"
      >
        <span className="text-sm font-medium text-text-primary pr-4">{question}</span>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <div className="px-6 pb-4">
          <p className="text-sm text-text-secondary leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}
