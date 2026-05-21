'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Users, Smartphone, Activity, MessageSquare, ArrowRight, TrendingUp, AlertCircle } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalAccounts: number;
  connectedAccounts: number;
  disconnectedAccounts: number;
  connectionRate: number;
  totalChats: number;
  totalMessages: number;
  todayMessages: number;
  admins: number;
  managers: number;
  regularUsers: number;
}

interface HealthData {
  disconnectedAccounts: number;
  accountsNeedingAttention: number;
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalAccounts: 0,
    connectedAccounts: 0,
    disconnectedAccounts: 0,
    connectionRate: 0,
    totalChats: 0,
    totalMessages: 0,
    todayMessages: 0,
    admins: 0,
    managers: 0,
    regularUsers: 0
  });
  const [health, setHealth] = useState<HealthData>({
    disconnectedAccounts: 0,
    accountsNeedingAttention: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!session?.user?.accessToken) return;

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

        // Fetch overview stats
        const overviewResponse = await fetch(`${backendUrl}/api/dashboard/admin/overview`, {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`
          }
        });

        const overviewData = await overviewResponse.json();
        if (overviewData.success && overviewData.statistics) {
          const { statistics } = overviewData;
          setStats({
            totalUsers: statistics.users.total,
            totalAccounts: statistics.accounts.total,
            connectedAccounts: statistics.accounts.connected,
            disconnectedAccounts: statistics.accounts.disconnected,
            connectionRate: statistics.accounts.connectionRate,
            totalChats: statistics.messaging.totalChats,
            totalMessages: statistics.messaging.totalMessages,
            todayMessages: statistics.messaging.todayMessages,
            admins: statistics.users.admins,
            managers: statistics.users.managers || 0,
            regularUsers: statistics.users.regularUsers
          });
        }

        // Fetch health data
        const healthResponse = await fetch(`${backendUrl}/api/dashboard/admin/health`, {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`
          }
        });

        const healthData = await healthResponse.json();
        if (healthData.success && healthData.health) {
          setHealth({
            disconnectedAccounts: healthData.health.disconnectedAccounts,
            accountsNeedingAttention: healthData.health.accountsNeedingAttention
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
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
      title: 'Total Users',
      value: stats.totalUsers,
      subtitle: `${stats.admins} admins, ${stats.managers} managers, ${stats.regularUsers} users`,
      icon: Users,
      color: 'blue',
      link: '/admin/users'
    },
    {
      title: 'Total Accounts',
      value: stats.totalAccounts,
      subtitle: `${stats.connectedAccounts} connected`,
      icon: Smartphone,
      color: 'purple',
      link: '/admin/accounts'
    },
    {
      title: 'Connection Rate',
      value: `${stats.connectionRate}%`,
      subtitle: `${stats.disconnectedAccounts} disconnected`,
      icon: Activity,
      color: stats.connectionRate >= 80 ? 'green' : stats.connectionRate >= 50 ? 'orange' : 'red',
      link: '/admin/accounts'
    },
    {
      title: 'Total Chats',
      value: stats.totalChats,
      subtitle: 'Active conversations',
      icon: MessageSquare,
      color: 'indigo',
      link: '/admin/accounts'
    },
    {
      title: 'Total Messages',
      value: stats.totalMessages,
      subtitle: `${stats.todayMessages} today`,
      icon: MessageSquare,
      color: 'emerald',
      link: '/admin/accounts'
    },
    {
      title: 'Today Messages',
      value: stats.todayMessages,
      subtitle: 'Messages sent today',
      icon: TrendingUp,
      color: 'cyan',
      link: '/admin/accounts'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; icon: string }> = {
      blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-600' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-600' },
      green: { bg: 'bg-green-50', text: 'text-green-600', icon: 'text-green-600' },
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-600' },
      indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'text-indigo-600' },
      orange: { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'text-orange-600' },
      cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', icon: 'text-cyan-600' },
      red: { bg: 'bg-red-50', text: 'text-red-600', icon: 'text-red-600' }
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">Welcome back, {session?.user?.email}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          const colors = getColorClasses(card.color);
          return (
            <Link
              key={card.title}
              href={card.link}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-all hover:border-gray-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-gray-600 mb-1">{card.title}</p>
                  <p className={`text-2xl font-bold ${colors.text} mb-1`}>{card.value}</p>
                  {card.subtitle && (
                    <p className="text-xs text-gray-500">{card.subtitle}</p>
                  )}
                </div>
                <div className={`${colors.bg} p-3 rounded-lg`}>
                  <Icon className={`w-6 h-6 ${colors.icon}`} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/admin/users"
          className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-all hover:border-blue-300 group"
        >
          <div className="flex items-center justify-between mb-3">
            <Users className="w-6 h-6 text-blue-600" />
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Manage Users</h3>
          <p className="text-xs text-gray-600">Add, edit, and manage company users</p>
        </Link>

        <Link
          href="/admin/accounts"
          className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-all hover:border-purple-300 group"
        >
          <div className="flex items-center justify-between mb-3">
            <Smartphone className="w-6 h-6 text-purple-600" />
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Manage Accounts</h3>
          <p className="text-xs text-gray-600">View and assign WhatsApp accounts</p>
        </Link>

        <Link
          href="/admin/accounts"
          className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-all hover:border-green-300 group"
        >
          <div className="flex items-center justify-between mb-3">
            <Activity className="w-6 h-6 text-green-600" />
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Add New Account</h3>
          <p className="text-xs text-gray-600">Create new WhatsApp account connection</p>
        </Link>
      </div>

      {/* System Health */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`rounded-lg border p-4 ${
          stats.connectionRate >= 80
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
            : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${
              stats.connectionRate >= 80 ? 'bg-green-500' : 'bg-yellow-500'
            }`}>
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Connection Status</h3>
              <p className="text-xs text-gray-600">
                {stats.connectedAccounts} of {stats.totalAccounts} accounts connected ({stats.connectionRate}%)
              </p>
            </div>
          </div>
        </div>

        {health.accountsNeedingAttention > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200 p-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-500 p-2 rounded-full">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Needs Attention</h3>
                <p className="text-xs text-gray-600">
                  {health.accountsNeedingAttention} accounts need attention
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
