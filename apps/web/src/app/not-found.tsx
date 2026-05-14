import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
        <FileQuestion className="h-8 w-8 text-amber-500" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-text-primary">Страница не найдена</h1>
        <p className="text-text-secondary max-w-md">
          Запрашиваемая страница не существует или была перемещена.
        </p>
      </div>

      <Link
        href="/"
        className="rounded-lg bg-accent-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-primary/90"
      >
        На главную
      </Link>
    </div>
  );
}
