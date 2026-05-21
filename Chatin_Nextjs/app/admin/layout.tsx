'use client';

import React, { Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { LayoutDashboard, FolderKanban, MessageSquare, Users } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSocket } from '@/lib/socket';
import { AccountSidebar } from '@/components/Layout';

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { isConnected } = useSocket();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navItems = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
      active: pathname === '/admin',
      description: 'Overview & stats'
    },
    {
      name: 'Users',
      href: '/admin/users',
      icon: Users,
      active: pathname === '/admin/users',
      description: 'Manage users'
    },
    {
      name: 'Accounts',
      href: '/admin/accounts',
      icon: FolderKanban,
      active: pathname === '/admin/accounts',
      description: 'Manage accounts'
    },
    {
      name: 'All Chats',
      href: '/admin/chats?view=all',
      icon: MessageSquare,
      active: pathname === '/admin/chats' && searchParams.get('view') === 'all',
      description: 'All conversations'
    }
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <AccountSidebar
        role="admin"
        navItems={navItems}
        session={session}
        isConnected={isConnected}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-100">Loading...</div>}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
