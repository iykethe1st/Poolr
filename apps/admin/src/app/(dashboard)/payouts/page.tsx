import type { Metadata } from 'next';
import { AllPayoutsContent } from '@/components/admin/all-payouts-content';

export const metadata: Metadata = { title: 'Payouts' };

export default function PayoutsPage() {
  return <AllPayoutsContent />;
}
