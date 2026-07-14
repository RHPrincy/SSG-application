'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Settings, LogOut, Zap } from 'lucide-react';
import { clearToken } from '@/lib/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/settings', label: 'Paramètres', Icon: Settings },
];

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearToken();
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <Zap className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            Prerender<span className="text-accent">.</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-elevated text-ink' : 'text-muted hover:text-ink hover:bg-elevated/60',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
