'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Building2, Users, LogOut, Smartphone, LayoutDashboard } from 'lucide-react';
import { useSocket } from '@/lib/socket';

function SuperAdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { isConnected } = useSocket();
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Dashboard',
      href: '/superadmin',
      icon: LayoutDashboard,
      active: pathname === '/superadmin',
      description: 'Overview & stats'
    },
    {
      name: 'Companies',
      href: '/superadmin/companies',
      icon: Building2,
      active: pathname === '/superadmin/companies',
      description: 'Manage companies'
    },
    {
      name: 'Users',
      href: '/superadmin/users',
      icon: Users,
      active: pathname === '/superadmin/users',
      description: 'Manage users'
    },
    {
      name: 'Accounts',
      href: '/superadmin/accounts',
      icon: Smartphone,
      active: pathname === '/superadmin/accounts',
      description: 'Manage accounts'
    }
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
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
        <div className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
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
                </div>
              </Link>
            );
          })}
        </div>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex items-stretch gap-3 h-12">
            <div className="flex-1 min-w-0 px-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100 flex flex-col justify-center">
              <p className="text-xs font-medium text-indigo-700 uppercase tracking-wide leading-tight">SuperAdmin</p>
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

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-100">Loading...</div>}>
      <SuperAdminLayoutContent>{children}</SuperAdminLayoutContent>
    </Suspense>
  );
}
