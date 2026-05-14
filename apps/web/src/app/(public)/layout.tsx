import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CompareBar } from '@/components/catalog/CompareBar';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {children}
        </div>
      </main>
      <Footer />
      <CompareBar />
    </div>
  );
}
