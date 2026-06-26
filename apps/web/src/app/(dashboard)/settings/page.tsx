import { PageShell } from '@/components/layout/page-shell';
import { SettingsContent } from '@/components/settings/settings-content';

import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Settings — Poolr' };

export default function SettingsPage() {
  return (
    <PageShell>
      <SettingsContent />
    </PageShell>
  );
}
