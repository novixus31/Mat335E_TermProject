'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogOut, FolderKanban, LucideIcon } from 'lucide-react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useSocket } from '@/lib/socket';
import { signOut } from 'next-auth/react';

interface Account {
  id: string;
  name: string;
  accountType: string;
  qrStatus: 'connected' | 'scanning' | 'disconnected';
  isActive: boolean;
  order?: number; // For user accounts
  companyOrder?: number; // For admin/manager accounts
  unreadCount?: number;
}

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  active: boolean;
  description: string;
  badge?: number;
}

interface AccountSidebarProps {
  role: 'user' | 'admin' | 'manager';
  navItems: NavItem[];
  session: {
    user?: {
      email?: string | null;
      accessToken?: string;
    };
  } | null;
  isConnected: boolean;
}

export default function AccountSidebar({ role, navItems, session, isConnected }: AccountSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { socket } = useSocket();
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Fetch accounts based on role
  useEffect(() => {
    async function fetchAccounts() {
      if (!session?.user?.accessToken) return;

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

        // Different endpoints for different roles
        const endpoint = role === 'user'
          ? `${backendUrl}/api/user-accounts`
          : `${backendUrl}/api/accounts?scope=company`;

        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`
          }
        });

        const data = await response.json();
        if (data.success) {
          console.log(`📥 [${role.toUpperCase()} LAYOUT] Initial accounts fetched:`, data.accounts);
          setAccounts(data.accounts);
        }
      } catch (error) {
        console.error('Error fetching accounts:', error);
      }
    }

    fetchAccounts();
  }, [session, role]);

  // Listen for custom account unread count updates from page (all roles)
  useEffect(() => {
    const handleAccountUnreadUpdate = (event: CustomEvent<{ accountId: string; accountUnreadCount: number }>) => {
      console.log(`📥 [${role.toUpperCase()} LAYOUT] Received account-unread-update event:`, event.detail);

      setAccounts(prev => {
        const updated = prev.map(acc =>
          acc.id === event.detail.accountId
            ? { ...acc, unreadCount: event.detail.accountUnreadCount }
            : acc
        );
        console.log(`📊 [${role.toUpperCase()} LAYOUT] Updated accounts:`, updated);
        return updated;
      });
    };

    window.addEventListener('account-unread-update', handleAccountUnreadUpdate as EventListener);

    return () => {
      window.removeEventListener('account-unread-update', handleAccountUnreadUpdate as EventListener);
    };
  }, [role]);

  // Listen for chat read events to update unread counts (all roles)
  useEffect(() => {
    if (!socket) {
      console.log(`⚠️ [${role.toUpperCase()} LAYOUT] Socket is null, cannot listen to events`);
      return;
    }

    console.log(`✅ [${role.toUpperCase()} LAYOUT] Socket connected, setting up listeners:`, socket.id);

    // When a chat is marked as read, update the account's unread count
    const handleChatRead = (data: {
      accountId: string;
      chatId: string;
      unreadCount?: number;
      accountUnreadCount?: number;
    }) => {
      console.log(`📖 [${role.toUpperCase()} LAYOUT] Chat read event received:`, {
        accountId: data.accountId,
        chatId: data.chatId,
        unreadCount: data.unreadCount,
        accountUnreadCount: data.accountUnreadCount,
        fullData: data
      });

      // Use accountUnreadCount if available, otherwise fallback to unreadCount
      const newUnreadCount = data.accountUnreadCount ?? data.unreadCount;

      if (newUnreadCount !== undefined) {
        setAccounts(prev => {
          const updated = prev.map(acc =>
            acc.id === data.accountId
              ? { ...acc, unreadCount: newUnreadCount }
              : acc
          );
          console.log(`📊 [${role.toUpperCase()} LAYOUT] Updated accounts after read:`, updated);
          return updated;
        });
      } else {
        console.log(`⚠️ [${role.toUpperCase()} LAYOUT] No unread count in chat_read event`);
      }
    };

    socket.on('chat_read', handleChatRead);

    return () => {
      socket.off('chat_read', handleChatRead);
    };
  }, [socket, role]);

  // Calculate total unread count (all roles)
  const totalUnreadCount = accounts.reduce((sum, acc) => sum + (acc.unreadCount || 0), 0);

  // Update navItems with badge if needed
  const updatedNavItems = navItems.map(item => ({
    ...item,
    badge: item.name === 'All Chats' && totalUnreadCount > 0 ? totalUnreadCount : item.badge
  }));

  // Get chat route based on role
  const getChatRoute = (accountId: string) => {
    const routes = {
      user: `/user/chats?account=${accountId}`,
      admin: `/admin/chats?account=${accountId}`,
      manager: `/manager/chats?account=${accountId}`
    };
    return routes[role];
  };

  // Check if account is active
  const isAccountActive = (accountId: string) => {
    const chatRoutes = {
      user: '/user/chats',
      admin: '/admin/chats',
      manager: '/manager/chats'
    };
    return pathname === chatRoutes[role] && !searchParams.get('view') && searchParams.get('account') === accountId;
  };

  // Get role display name
  const roleDisplayName = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <aside className="w-80 bg-gradient-to-b from-slate-50 to-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">ChatIn</h2>
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
              title={isConnected ? 'Connected' : 'Disconnected'}
            />
          </div>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="p-4 space-y-2">
        {updatedNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block group relative overflow-hidden rounded-xl transition-all duration-200 ${
                item.active
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200'
                  : 'bg-white hover:bg-gray-50 border border-gray-200 hover:border-indigo-200 hover:shadow-md'
              }`}
            >
              <div className="p-4 flex items-center gap-3">
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  item.active
                    ? 'bg-white/20'
                    : 'bg-gradient-to-br from-indigo-50 to-blue-50 group-hover:from-indigo-100 group-hover:to-blue-100'
                }`}>
                  <Icon className={`w-5 h-5 ${
                    item.active ? 'text-white' : 'text-indigo-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${
                    item.active ? 'text-white' : 'text-gray-900'
                  }`}>
                    {item.name}
                  </p>
                  <p className={`text-xs truncate ${
                    item.active ? 'text-indigo-100' : 'text-gray-500'
                  }`}>
                    {item.description}
                  </p>
                </div>
                {item.badge && item.badge > 0 && (
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium min-w-[20px] text-center ${
                    item.active
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-500 text-white'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Account List */}
      <div className="flex-1 overflow-hidden flex flex-col px-4 pb-4">
        <div className="flex items-center justify-between px-3 py-2 mb-2">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            {role === 'user' ? 'My Accounts' : 'Quick Access'}
          </h3>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {accounts.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
          {accounts.map((acc) => {
            const isActive = isAccountActive(acc.id);
            return (
              <div
                key={acc.id}
                onClick={() => {
                  router.push(getChatRoute(acc.id));
                }}
                className={`group p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-50 border-l-2 border-indigo-500 shadow-sm'
                    : 'bg-white hover:bg-gray-50 border border-gray-100 hover:border-indigo-100 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      acc.qrStatus === 'connected'
                        ? 'bg-green-500'
                        : acc.qrStatus === 'scanning'
                        ? 'bg-yellow-400'
                        : 'bg-red-500'
                    }`}
                    title={acc.qrStatus === 'connected' ? 'Connected' : acc.qrStatus === 'scanning' ? 'Scanning' : 'Disconnected'}
                    />
                    {acc.qrStatus === 'connected' && (
                      <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      isActive ? 'text-indigo-900' : 'text-gray-900'
                    }`}>
                      {acc.name}
                    </p>
                  </div>
                  {acc.unreadCount !== undefined && acc.unreadCount > 0 && (
                    <span className="ml-auto bg-indigo-500 text-white text-xs rounded-full px-2 py-0.5 font-medium min-w-[20px] text-center">
                      {acc.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {accounts.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <FolderKanban className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500">
                {role === 'user' ? 'No accounts assigned' : 'No accounts found'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-stretch gap-3 h-12">
          <div className="flex-1 min-w-0 px-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100 flex flex-col justify-center">
            <p className="text-xs font-medium text-indigo-700 uppercase tracking-wide leading-tight">{roleDisplayName}</p>
            <p className="text-xs text-gray-600 truncate mt-0.5 leading-tight">{session?.user?.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex-shrink-0 group flex items-center justify-center w-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            title="Logout"
          >
            <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform duration-200" />
          </button>
        </div>
      </div>
    </aside>
  );
}
