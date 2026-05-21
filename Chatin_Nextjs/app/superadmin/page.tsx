'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Building2, Users, Smartphone, Power, Activity, ArrowRight } from 'lucide-react';

interface DashboardStats {
  totalCompanies: number;
  totalUsers: number;
  totalAccounts: number;
  activeAccounts: number;
  connectedAccounts: number;
  totalAdmins: number;
  recentCompanies: Array<{
    _id: string;
    companyName: string;
    createdAt: string;
  }>;
}

export default function SuperAdminDashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    totalCompanies: 0,
    totalUsers: 0,
    totalAccounts: 0,
    activeAccounts: 0,
    connectedAccounts: 0,
    totalAdmins: 0,
    recentCompanies: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardStats() {
      if (!session?.user?.accessToken) return;

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/dashboard/overview`, {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`
          }
        });

        const data = await response.json();
        console.log('Dashboard API Response:', data);
        if (data.success && data.statistics) {
          // Map backend response to frontend format
          const mappedStats: DashboardStats = {
            totalCompanies: data.statistics.companies.total,
            totalUsers: data.statistics.users.total,
            totalAccounts: data.statistics.accounts.total,
            activeAccounts: data.statistics.companies.active, // Backend doesn't have activeAccounts, using active companies as fallback
            connectedAccounts: data.statistics.accounts.connected,
            totalAdmins: data.statistics.users.admins,
            recentCompanies: data.statistics.topCompanies || []
          };
          setStats(mappedStats);
        } else {
          // Fallback to empty stats if API doesn't return data yet
          console.warn('Dashboard API did not return expected data structure');
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardStats();
  }, [session]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Companies',
      value: stats.totalCompanies,
      icon: Building2,
      color: 'indigo',
      link: '/superadmin/companies'
    },
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'blue',
      link: '/superadmin/users'
    },
    {
      title: 'Total Accounts',
      value: stats.totalAccounts,
      icon: Smartphone,
      color: 'purple',
      link: '/superadmin/accounts'
    },
    {
      title: 'Active Accounts',
      value: stats.activeAccounts,
      icon: Power,
      color: 'green',
      link: '/superadmin/accounts'
    },
    {
      title: 'Connected Accounts',
      value: stats.connectedAccounts,
      icon: Activity,
      color: 'emerald',
      link: '/superadmin/accounts'
    },
    {
      title: 'Admin Users',
      value: stats.totalAdmins,
      icon: Users,
      color: 'orange',
      link: '/superadmin/users'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; icon: string }> = {
      indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'text-indigo-600' },
      blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-600' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-600' },
      green: { bg: 'bg-green-50', text: 'text-green-600', icon: 'text-green-600' },
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-600' },
      orange: { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'text-orange-600' }
    };
    return colors[color] || colors.indigo;
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {session?.user?.email}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          const colors = getColorClasses(card.color);
          return (
            <Link
              key={card.title}
              href={card.link}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-all hover:border-gray-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{card.title}</p>
                  <p className={`text-3xl font-bold ${colors.text}`}>{card.value}</p>
                </div>
                <div className={`${colors.bg} p-4 rounded-lg`}>
                  <Icon className={`w-8 h-8 ${colors.icon}`} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link
          href="/superadmin/companies"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-all hover:border-indigo-300 group"
        >
          <div className="flex items-center justify-between mb-4">
            <Building2 className="w-8 h-8 text-indigo-600" />
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage Companies</h3>
          <p className="text-sm text-gray-600">Create, edit, and delete companies</p>
        </Link>

        <Link
          href="/superadmin/users"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-all hover:border-blue-300 group"
        >
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 text-blue-600" />
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage Users</h3>
          <p className="text-sm text-gray-600">Add users, change roles, and assign to companies</p>
        </Link>

        <Link
          href="/superadmin/accounts"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-all hover:border-purple-300 group"
        >
          <div className="flex items-center justify-between mb-4">
            <Smartphone className="w-8 h-8 text-purple-600" />
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage Accounts</h3>
          <p className="text-sm text-gray-600">Control account status and monitor connections</p>
        </Link>
      </div>

      {/* Recent Companies */}
      {stats.recentCompanies.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Recent Companies</h2>
            <Link
              href="/superadmin/companies"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {stats.recentCompanies.map((company) => (
              <div
                key={company._id}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-50 p-2 rounded-lg">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{company.companyName}</p>
                    <p className="text-xs text-gray-500">
                      Created {new Date(company.createdAt).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </div>
                <Link
                  href="/superadmin/companies"
                  className="text-indigo-600 hover:text-indigo-700"
                >
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Health Indicator */}
      <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 p-6">
        <div className="flex items-center gap-3">
          <div className="bg-green-500 p-2 rounded-full">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">System Status</h3>
            <p className="text-sm text-gray-600">
              All systems operational • {stats.connectedAccounts} of {stats.activeAccounts} active accounts connected
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
