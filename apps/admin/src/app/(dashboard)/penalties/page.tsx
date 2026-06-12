import type { Metadata } from 'next';
import { AllPenaltiesContent } from '@/components/admin/all-penalties-content';

export const metadata: Metadata = { title: 'Penalties' };

export default function PenaltiesPage() {
  return <AllPenaltiesContent />;
}
