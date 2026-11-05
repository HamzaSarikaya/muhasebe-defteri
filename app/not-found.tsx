import Link from 'next/link';

// Fallback for requests outside the locale middleware (for example missing assets).
export default function NotFoundPage() {
  return <html lang="tr" className="dark"><body><main className="error-page">
    <span className="error-code font-money">404</span>
    <h1>Sayfa bulunamadı</h1><p lang="en">Page not found.</p>
    <Link href="/tr" className="inline-flex min-h-11 items-center rounded-md border border-input px-4 py-2">Genel bakışa dön</Link>
  </main></body></html>;
}
