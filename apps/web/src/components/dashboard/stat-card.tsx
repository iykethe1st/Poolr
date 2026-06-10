import { type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  loading?: boolean;
}

export function StatCard({ label, value, subtext, icon: Icon, iconClassName, loading }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        {loading ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        )}
        {Icon && !loading && (
          <span className={cn('flex size-8 items-center justify-center rounded-lg bg-muted', iconClassName)}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      {loading ? (
        <>
          <Skeleton className="mb-2 h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </>
      ) : (
        <>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtext && (
            <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
          )}
        </>
      )}
    </div>
  );
}
