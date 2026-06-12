'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { clearToken } from '@/lib/auth';
import { useCurrentAdmin } from '@/hooks/use-admin';
import { getInitials } from '@/lib/utils';

export function Navbar() {
  const router = useRouter();
  const { data: user } = useCurrentAdmin();

  function handleSignOut() {
    clearToken();
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 backdrop-blur-sm px-4 md:px-6">
      <div className="flex items-center gap-2">
        <Shield className="size-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Admin Console</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {user ? getInitials(user.fullName) : '?'}
            </span>
            <span className="hidden text-sm md:block">{user?.fullName ?? 'Admin'}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
