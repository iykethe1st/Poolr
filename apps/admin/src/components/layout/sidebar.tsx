'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const NAV = [
  { href: '/overview', icon: LayoutDashboard, label: 'Overview', exact: true },
  { href: '/groups', icon: Users, label: 'Groups' },
  { href: '/penalties', icon: AlertTriangle, label: 'Penalties' },
  { href: '/payouts', icon: ArrowUpRight, label: 'Payouts' },
];

function NavLink({
  href,
  icon: Icon,
  label,
  collapsed,
  exact,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  collapsed: boolean;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const link = (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r bg-sidebar transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b px-4',
          collapsed && 'justify-center px-2',
        )}
      >
        {collapsed ? (
          <Image src="/favicon.png" alt="Poolr" width={28} height={28} />
        ) : (
          <div className="flex items-center gap-2">
            <Image src="/favicon.png" alt="Poolr" width={32} height={32} />
            <span className="text-lg font-bold tracking-tight">
              Poolr <span className="text-xs font-normal text-muted-foreground">Admin</span>
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map((item) => (
          <NavLink key={item.href} {...item} collapsed={collapsed} />
        ))}
      </nav>

      <Separator />

      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'w-full text-sidebar-foreground hover:bg-sidebar-accent',
            collapsed ? 'justify-center px-2' : 'justify-start gap-3',
          )}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <>
              <ChevronLeft className="size-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
