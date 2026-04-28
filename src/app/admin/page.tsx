import { Suspense } from 'react';
import AdminPageClient from './PageClient';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-text-tertiary">Loading admin panel...</div>}>
      <AdminPageClient />
    </Suspense>
  );
}
