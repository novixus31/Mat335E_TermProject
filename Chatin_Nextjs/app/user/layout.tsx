'use client';

import React, { Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { MessageSquare } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSocket } from '@/lib/socket';
import { AccountSidebar } from '@/components/Layout';

function UserLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { isConnected } = useSocket();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewMode = searchParams.get('view');

  const navItems = [
    {
      name: 'All Chats',
      href: '/user/chats?view=all',
      icon: MessageSquare,
      active: pathname === '/user/chats' && viewMode === 'all',
      description: 'All conversations'
    }
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <AccountSidebar
        role="user"
        navItems={navItems}
        session={session}
        isConnected={isConnected}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-100">Loading...</div>}>
      <UserLayoutContent>{children}</UserLayoutContent>
    </Suspense>
  );
}
