'use client';

import React, { Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { LayoutDashboard, FolderKanban, MessageSquare, Users } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSocket } from '@/lib/socket';
import { AccountSidebar } from '@/components/Layout';

function ManagerLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { isConnected } = useSocket();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navItems = [
    {
      name: 'Dashboard',
      href: '/manager',
      icon: LayoutDashboard,
      active: pathname === '/manager',
      description: 'Overview & stats'
    },
    {
      name: 'Users',
      href: '/manager/users',
      icon: Users,
      active: pathname === '/manager/users',
      description: 'Manage users'
    },
    {
      name: 'Accounts',
      href: '/manager/accounts',
      icon: FolderKanban,
      active: pathname === '/manager/accounts',
      description: 'Manage accounts'
    },
    {
      name: 'All Chats',
      href: '/manager/chats?view=all',
      icon: MessageSquare,
      active: pathname === '/manager/chats' && searchParams.get('view') === 'all',
      description: 'All conversations'
    }
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <AccountSidebar
        role="manager"
        navItems={navItems}
        session={session}
        isConnected={isConnected}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-100">Loading...</div>}>
      <ManagerLayoutContent>{children}</ManagerLayoutContent>
    </Suspense>
  );
}
