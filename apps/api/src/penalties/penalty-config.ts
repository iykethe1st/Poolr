export interface PenaltyConfig {
  type: 'flat' | 'percentage';
  amount: number;
  gracePeriodHours: number;
}

export const DEFAULT_PENALTY_CONFIG: PenaltyConfig = {
  type: 'percentage',
  amount: 5,
  gracePeriodHours: 24,
};

export function parsePenaltyConfig(raw: unknown): PenaltyConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return DEFAULT_PENALTY_CONFIG;
  }
  const c = raw as Record<string, unknown>;
  return {
    type: c['type'] === 'flat' ? 'flat' : 'percentage',
    amount: typeof c['amount'] === 'number' ? c['amount'] : DEFAULT_PENALTY_CONFIG.amount,
    gracePeriodHours:
      typeof c['gracePeriodHours'] === 'number'
        ? c['gracePeriodHours']
        : DEFAULT_PENALTY_CONFIG.gracePeriodHours,
  };
}

export function calculatePenaltyAmount(
  config: PenaltyConfig,
  contributionAmountNgn: number,
): number {
  if (config.type === 'flat') return config.amount;
  return contributionAmountNgn * (config.amount / 100);
}
