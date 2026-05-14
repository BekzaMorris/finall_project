import Link from 'next/link';
import { Server } from 'lucide-react';

const footerLinks = [
  { href: '/catalog', label: 'Каталог' },
  { href: '/configurator', label: 'Конфигуратор' },
  { href: '/support', label: 'Поддержка' },
  { href: '/about', label: 'О нас' },
];

export function Footer() {
  return (
    <footer className="border-t border-border-primary bg-surface-secondary">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Logo and description */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 text-text-primary">
              <Server className="h-6 w-6 text-accent-primary" />
              <span className="text-lg font-semibold">ServerHub</span>
            </Link>
            <p className="text-sm text-text-secondary max-w-xs">
              Продажа новых и б/у серверов для бизнеса. Конфигуратор, поддержка и быстрая доставка.
            </p>
          </div>

          {/* Navigation links */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              Навигация
            </h3>
            <ul className="space-y-2">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact info */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              Контакты
            </h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li>
                <a
                  href="tel:+78001234567"
                  className="hover:text-text-primary transition-colors"
                >
                  +7 (800) 123-45-67
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@serverhub.ru"
                  className="hover:text-text-primary transition-colors"
                >
                  info@serverhub.ru
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 border-t border-border-primary pt-8">
          <p className="text-center text-xs text-text-tertiary">
            © {new Date().getFullYear()} ServerHub. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  );
}
