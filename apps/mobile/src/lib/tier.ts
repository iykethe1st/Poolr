export type Tier = 'NEW' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export const TIER_CONFIG: Record<Tier, { label: string; color: string; bg: string; emoji: string }> = {
  NEW:      { label: 'New',      color: '#64748b', bg: '#f1f5f9', emoji: '○' },
  BRONZE:   { label: 'Bronze',   color: '#92400e', bg: '#fef3c7', emoji: '🥉' },
  SILVER:   { label: 'Silver',   color: '#475569', bg: '#e2e8f0', emoji: '🥈' },
  GOLD:     { label: 'Gold',     color: '#78350f', bg: '#fef9c3', emoji: '🥇' },
  PLATINUM: { label: 'Platinum', color: '#3730a3', bg: '#eef2ff', emoji: '💎' },
};

export function tierConfig(tier: string | undefined) {
  return TIER_CONFIG[(tier as Tier) ?? 'NEW'] ?? TIER_CONFIG.NEW;
}
