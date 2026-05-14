'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Ticket,
  Users,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
} from 'lucide-react';
import { useTheme } from '@kiroportal/ui';
import { useAuthStore } from '@/stores/auth';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: '/admin', label: 'Дашборд', icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: '/admin/products', label: 'Товары', icon: <Package className="h-5 w-5" /> },
  { href: '/admin/orders', label: 'Заявки', icon: <ShoppingCart className="h-5 w-5" /> },
  { href: '/admin/tickets', label: 'Тикеты', icon: <Ticket className="h-5 w-5" /> },
  { href: '/admin/users', label: 'Пользователи', icon: <Users className="h-5 w-5" />, adminOnly: true },
  { href: '/admin/settings', label: 'Настройки', icon: <Settings className="h-5 w-5" />, adminOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth guard: redirect to /login if not MANAGER or ADMIN
  useEffect(() => {
    if (!mounted) return;
    if (!user || (user.role !== 'MANAGER' && user.role !== 'ADMIN')) {
      router.replace('/login');
    }
  }, [user, mounted, router]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Don't render until mounted and authorized
  if (!mounted || !user || (user.role !== 'MANAGER' && user.role !== 'ADMIN')) {
    return (
      <div className="flex h-dvh items-center justify-center bg-surface-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN';

  const filteredNavItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin,
  );

  function isActive(href: string): boolean {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-surface-primary">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border-primary bg-surface-secondary transition-transform duration-200 md:static md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Sidebar header */}
        <div className="flex h-16 items-center justify-between border-b border-border-primary px-4">
          <Link href="/admin" className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-accent-primary" />
            <span className="text-base font-semibold text-text-primary">Админ-панель</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors md:hidden"
            aria-label="Закрыть меню"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {filteredNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={[
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-accent-primary/10 text-accent-primary'
                      : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
                  ].join(' ')}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-border-primary p-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            На сайт
          </Link>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-border-primary bg-surface-secondary px-4 md:px-6">
          {/* Left: hamburger + title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors md:hidden"
              aria-label="Открыть меню"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-text-primary hidden sm:block">
              Панель управления
            </h1>
          </div>

          {/* Right: theme toggle + user info + logout */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors"
              aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="hidden sm:flex items-center gap-2 rounded-md px-2 py-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary text-xs font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-text-primary leading-tight">
                  {user.name}
                </span>
                <span className="text-[10px] text-text-secondary leading-tight">
                  {user.role === 'ADMIN' ? 'Администратор' : 'Менеджер'}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-status-error transition-colors"
              aria-label="Выйти"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
