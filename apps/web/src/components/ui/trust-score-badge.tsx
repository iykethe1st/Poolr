import { cn } from '@/lib/utils';

type Tier = 'New' | 'Trusted' | 'Reliable' | 'Elite';
type UserStatusLive = 'FROZEN' | 'BANNED' | string;

const TIER_STYLE: Record<Tier, { bg: string; text: string; emoji: string }> = {
  New:      { bg: 'bg-slate-100 dark:bg-slate-800',  text: 'text-slate-600 dark:text-slate-300', emoji: '○' },
  Trusted:  { bg: 'bg-amber-100 dark:bg-amber-950/50', text: 'text-amber-800 dark:text-amber-400', emoji: '⭐' },
  Reliable: { bg: 'bg-blue-100 dark:bg-blue-950/50',  text: 'text-blue-700 dark:text-blue-400',   emoji: '🌟' },
  Elite:    { bg: 'bg-yellow-100 dark:bg-yellow-950/50', text: 'text-yellow-800 dark:text-yellow-400', emoji: '👑' },
};

interface TrustScoreBadgeProps {
  tier: string;
  userStatus?: UserStatusLive;
  className?: string;
  showEmoji?: boolean;
}

export function TrustScoreBadge({ tier, userStatus, className, showEmoji = true }: TrustScoreBadgeProps) {
  // Live account status takes visual precedence over tier
  if (userStatus === 'FROZEN') {
    return (
      <span className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
        'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
        className,
      )}>
        🧊 Frozen
      </span>
    );
  }
  if (userStatus === 'BANNED') {
    return (
      <span className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
        'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
        className,
      )}>
        🚫 Banned
      </span>
    );
  }

  const normalised = (tier?.charAt(0).toUpperCase() + tier?.slice(1).toLowerCase()) as Tier;
  const style = TIER_STYLE[normalised] ?? TIER_STYLE.New;

  if (normalised === 'New') return null;

  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
      style.bg, style.text,
      className,
    )}>
      {showEmoji && style.emoji} {normalised}
    </span>
  );
}
