'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Smartphone, Building2, Power, PowerOff, Pencil, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Account {
  id: string;
  name: string;
  accountType: string;
  qrStatus: 'connected' | 'scanning' | 'disconnected';
  isActive: boolean;
  companyId: {
    _id: string;
    name: string;
  };
  companyName: string;
  createdAt: string;
  lastUsed?: string;
  userId?: {
    _id: string;
    userEmail: string;
    role: string;
  };
  userEmail?: string;
}

interface Company {
  id: string;
  companyName: string;
}

export default function SuperAdminAccountsPage() {
  const { data: session } = useSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch all accounts
  useEffect(() => {
    async function fetchAccounts() {
      if (!session?.user?.accessToken) return;

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/accounts?scope=all`, {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`
          }
        });

        const data = await response.json();
        if (data.success) {
          setAccounts(data.accounts);
        }
      } catch (error) {
        console.error('Error fetching accounts:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAccounts();
  }, [session]);

  // Fetch all companies for filter
  useEffect(() => {
    async function fetchCompanies() {
      if (!session?.user?.accessToken) return;

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/companies`, {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`
          }
        });

        const data = await response.json();
        if (data.success) {
          setCompanies(data.companies);
        }
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    }

    fetchCompanies();
  }, [session]);

  // Toggle account status
  const toggleAccountStatus = async (accountId: string, currentStatus: boolean) => {
    if (!session?.user?.accessToken) return;

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/accounts/${accountId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.user.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });

      const data = await response.json();
      if (data.success) {
        setAccounts(accounts.map(acc =>
          acc.id === accountId ? { ...acc, isActive: !currentStatus } : acc
        ));
        toast.success('Account status updated successfully');
      } else {
        toast.error(data.message || 'Failed to update account status');
      }
    } catch (error) {
      console.error('Error updating account status:', error);
      toast.error('Failed to update account status');
    }
  };

  // Start editing account name
  const startEditing = (account: Account) => {
    setEditingAccountId(account.id);
    setEditedName(account.name);
  };

  // Save edited account name
  const saveAccountName = async (accountId: string) => {
    if (!editedName.trim() || !session?.user?.accessToken) return;

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.user.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: editedName })
      });

      const data = await response.json();
      if (data.success) {
        setAccounts(accounts.map(acc => acc.id === accountId ? { ...acc, name: editedName } : acc));
        setEditingAccountId(null);
        toast.success('Account name updated successfully');
      } else {
        toast.error(data.message || 'Failed to update account name');
      }
    } catch (error) {
      console.error('Error updating account name:', error);
      toast.error('Failed to update account name');
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingAccountId(null);
    setEditedName('');
  };

  // Filter accounts
  const filteredAccounts = accounts.filter(account => {
    const matchesCompany = filterCompany === 'all' || account.companyId._id === filterCompany;
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && account.isActive) ||
      (filterStatus === 'inactive' && !account.isActive);
    return matchesCompany && matchesStatus;
  });

  const getStatusColor = (qrStatus: string) => {
    switch (qrStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'scanning':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (qrStatus: string) => {
    switch (qrStatus) {
      case 'connected':
        return 'Connected';
      case 'scanning':
        return 'Scanning';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading accounts...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Account Management</h1>
            <p className="text-gray-600 mt-1">Manage all WhatsApp accounts across all companies</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Companies</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>{company.companyName}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Account
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Connection Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Active Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAccounts.map((account) => (
              <tr key={account.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingAccountId === account.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveAccountName(account.id);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        className="flex-1 px-3 py-2 text-sm font-medium border-2 border-indigo-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 bg-white shadow-sm min-w-[200px]"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center">
                        <Smartphone className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{account.name}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">{account.accountType}</div>
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                    <div className="text-sm text-gray-900">{account.companyName || 'N/A'}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${getStatusColor(account.qrStatus)}`}></span>
                    <span className="text-sm text-gray-900">{getStatusText(account.qrStatus)}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => toggleAccountStatus(account.id, account.isActive)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      account.isActive
                        ? 'bg-green-100 text-green-700 hover:bg-green-200 hover:shadow-sm'
                        : 'bg-red-100 text-red-700 hover:bg-red-200 hover:shadow-sm'
                    }`}
                  >
                    {account.isActive ? (
                      <>
                        <Power className="w-3.5 h-3.5" />
                        Active
                      </>
                    ) : (
                      <>
                        <PowerOff className="w-3.5 h-3.5" />
                        Inactive
                      </>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(account.createdAt).toLocaleDateString('tr-TR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {editingAccountId === account.id ? (
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => saveAccountName(account.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Save"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Cancel"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(account)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Edit name"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAccounts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No accounts found. {filterCompany !== 'all' || filterStatus !== 'all' ? 'Try adjusting your filters.' : 'No accounts exist yet.'}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Accounts</p>
              <p className="text-3xl font-bold text-gray-900">{accounts.length}</p>
            </div>
            <Smartphone className="w-12 h-12 text-indigo-600 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Accounts</p>
              <p className="text-3xl font-bold text-green-600">
                {accounts.filter(acc => acc.isActive).length}
              </p>
            </div>
            <Power className="w-12 h-12 text-green-600 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Connected Accounts</p>
              <p className="text-3xl font-bold text-blue-600">
                {accounts.filter(acc => acc.qrStatus === 'connected').length}
              </p>
            </div>
            <Smartphone className="w-12 h-12 text-blue-600 opacity-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
