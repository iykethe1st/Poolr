import type { Metadata } from 'next';
import { OverviewContent } from '@/components/admin/overview-content';

export const metadata: Metadata = { title: 'Overview' };

export default function OverviewPage() {
  return <OverviewContent />;
}
