import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';

export type Tier = 'NEW' | 'TRUSTED' | 'RELIABLE' | 'ELITE';

export const TIER_CONFIG: Record<Tier, {
  label: string;
  color: string;
  bg: string;
  icon: ComponentProps<typeof Feather>['name'];
}> = {
  NEW:      { label: 'New',      color: '#64748b', bg: '#f1f5f9', icon: 'user' },
  TRUSTED:  { label: 'Trusted',  color: '#92400e', bg: '#fef3c7', icon: 'star' },
  RELIABLE: { label: 'Reliable', color: '#475569', bg: '#dbeafe', icon: 'shield' },
  ELITE:    { label: 'Elite',    color: '#78350f', bg: '#fef9c3', icon: 'award' },
};

export function tierConfig(tier: string | undefined) {
  return TIER_CONFIG[(tier?.toUpperCase() as Tier) ?? 'NEW'] ?? TIER_CONFIG.NEW;
}
