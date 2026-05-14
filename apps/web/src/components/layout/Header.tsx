'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Server,
  ShoppingCart,
  Sun,
  Moon,
  Menu,
  X,
  User,
  LogOut,
  FileText,
} from 'lucide-react';
import { useTheme } from '@kiroportal/ui';
import { useAuthStore } from '@/stores/auth';

const navLinks = [
  { href: '/catalog', label: 'Каталог' },
  { href: '/configurator', label: 'Конфигуратор' },
  { href: '/support', label: 'Поддержка' },
];

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartCount] = useState(0); // Will be connected to cart store/API later
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch for theme-dependent UI
  useEffect(() => {
    setMounted(true);
  }, []);

  // Track scroll for sticky header backdrop blur
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClick = () => setUserMenuOpen(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [userMenuOpen]);

  return (
    <header
      className={[
        'sticky top-0 z-50 w-full border-b border-border-primary transition-all duration-200',
        scrolled
          ? 'bg-surface-primary/80 backdrop-blur-md'
          : 'bg-surface-primary',
      ].join(' ')}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-text-primary hover:text-accent-primary transition-colors"
        >
          <Server className="h-6 w-6 text-accent-primary" />
          <span className="text-lg font-semibold">ServerHub</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="relative flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors duration-200"
            aria-label={mounted ? (theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему') : 'Переключить тему'}
          >
            {mounted ? (
              theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5 opacity-0" />
            )}
          </button>

          {/* Cart icon */}
          <Link
            href="/cart"
            className="relative flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors"
            aria-label="Корзина"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent-primary text-[10px] font-bold text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          {/* User menu / Login button */}
          {user ? (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen(!userMenuOpen);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 transition-colors"
                aria-label="Меню пользователя"
              >
                <User className="h-4 w-4" />
              </button>

              {/* Dropdown menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md border border-border-primary bg-surface-secondary shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b border-border-primary">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-text-secondary truncate">
                      {user.email}
                    </p>
                  </div>
                  <Link
                    href="/orders"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <FileText className="h-4 w-4" />
                    Заявки
                  </Link>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    Кабинет
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setUserMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-status-error hover:bg-surface-tertiary transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Выйти
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center rounded-md bg-accent-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-primary/90 transition-colors"
            >
              Войти
            </Link>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors md:hidden"
            aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile slide-in drawer */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 top-16 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed top-16 right-0 z-50 h-[calc(100dvh-4rem)] w-64 border-l border-border-primary bg-surface-secondary shadow-xl md:hidden animate-in slide-in-from-right duration-200">
            <nav className="flex flex-col p-4 gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {!user && (
                <Link
                  href="/login"
                  className="mt-4 flex items-center justify-center rounded-md bg-accent-primary px-3 py-2 text-sm font-medium text-white hover:bg-accent-primary/90 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Войти
                </Link>
              )}
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
