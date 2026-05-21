'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSocket } from '@/lib/socket';
import { Search, Plus } from 'lucide-react';
import { toast } from 'sonner';
import QrCodeModal from '@/components/QrCodeModal';
import SortableAccountRow from '../../admin/accounts/SortableAccountRow';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface Account {
  id: string;
  name: string;
  accountType: string;
  qrStatus: string;
  isActive: boolean;
  userId: {
    _id: string;
    userEmail: string;
    role: string;
  } | string;
  companyId: string;
  createdAt: string;
  companyOrder?: number;
}

interface User {
  id: string;
  userEmail: string;
  role: string;
}

export default function ManagerAccountsPage() {
  const { data: session } = useSession();
  const { socket } = useSocket();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [assigningAccount, setAssigningAccount] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const isAccountConnectedRef = useRef(false);

  // Drag & Drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch company accounts
  const fetchAccounts = useCallback(async () => {
    if (!session?.user?.accessToken) return;

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/accounts?scope=company`, {
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
    }
  }, [session?.user?.accessToken]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Socket.IO event listeners for QR code
  useEffect(() => {
    if (!socket) return;

    socket.on('qr_update', (data: { qrDataUrl?: string } | string) => {
      console.log('📱 QR Code received:', data);
      setQrCode(typeof data === 'string' ? data : data.qrDataUrl || null);
    });

    socket.on('qr_error', (error: { message?: string }) => {
      console.error('❌ QR Error:', error);
      toast.error(`QR Error: ${error.message || 'Unknown error'}`);
      setIsCreatingAccount(false);
    });

    socket.on('connection_success', (data: { phoneNumber?: string }) => {
      console.log('✅ WhatsApp connected:', data);
      setQrCode(null);
      setShowQrModal(false);
      isAccountConnectedRef.current = true;
      setIsCreatingAccount(false);
      toast.success(`WhatsApp connected successfully!\nPhone: ${data.phoneNumber}`);
      // Refresh accounts list
      fetchAccounts();
    });

    socket.on('connection_closed', (data: Record<string, unknown>) => {
      console.log('❌ WhatsApp connection closed:', data);
      setQrCode(null);
    });

    return () => {
      socket.off('qr_update');
      socket.off('qr_error');
      socket.off('connection_success');
      socket.off('connection_closed');
    };
  }, [socket, fetchAccounts]);

  // Fetch company users
  useEffect(() => {
    async function fetchUsers() {
      if (!session?.user?.accessToken) return;

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/users`, {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`
          }
        });

        const data = await response.json();
        if (data.success) {
          setUsers(data.users);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    }

    fetchUsers();
  }, [session]);

  const assignAccount = async (accountId: string, userId: string) => {
    if (!session?.user?.accessToken) return;

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/accounts/${accountId}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.user.accessToken}`
        },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();
      if (data.success) {
        // Update local state
        setAccounts(prev => prev.map(acc =>
          acc.id === accountId ? { ...acc, userId: data.account.userId } : acc
        ));
        setAssigningAccount(null);
      }
    } catch (error) {
      console.error('Error assigning account:', error);
    }
  };

  const startEditingName = (accountId: string, currentName: string) => {
    setEditingAccount(accountId);
    setEditingName(currentName);
  };

  const cancelEditingName = () => {
    setEditingAccount(null);
    setEditingName('');
  };

  const saveAccountName = async (accountId: string) => {
    if (!session?.user?.accessToken || !editingName.trim()) return;

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.user.accessToken}`
        },
        body: JSON.stringify({ name: editingName })
      });

      const data = await response.json();
      if (data.success) {
        // Update local state
        setAccounts(prev => prev.map(acc =>
          acc.id === accountId ? { ...acc, name: editingName } : acc
        ));
        setEditingAccount(null);
        setEditingName('');
      }
    } catch (error) {
      console.error('Error updating account name:', error);
    }
  };

  const createNewAccount = async () => {
    if (!session?.user?.accessToken || !socket || isCreatingAccount) return;

    setIsCreatingAccount(true);
    isAccountConnectedRef.current = false;
    setQrCode(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

      console.log('🔨 Creating new account...');
      const createResponse = await fetch(`${backendUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.user.accessToken}`
        },
        body: JSON.stringify({
          name: `WhatsApp Account ${Date.now()}`,
          accountType: 'whatsapp'
        })
      });

      const createData = await createResponse.json();

      if (createData.success && createData.account) {
        const accountId = createData.account.id;
        console.log('✅ Account created:', accountId);
        setCurrentAccountId(accountId);
        setShowQrModal(true);

        // Request QR code via socket
        console.log('📱 Requesting QR code...');
        socket.emit('request_qr', {
          accountId,
          token: session.user.accessToken
        });
      } else {
        console.error('❌ Failed to create account:', createData.message);
        setIsCreatingAccount(false);
        toast.error('Failed to create account');
      }
    } catch (error) {
      console.error('❌ Error creating account:', error);
      setIsCreatingAccount(false);
      toast.error('Error creating account');
    }
  };

  const closeQrModal = async () => {
    if (!currentAccountId || !session?.user?.accessToken || !socket) {
      setShowQrModal(false);
      return;
    }

    // Only cleanup if account is not connected
    if (!isAccountConnectedRef.current) {
      console.log('🧹 Cleaning up disconnected account:', currentAccountId);

      // Stop WhatsApp connection
      socket.emit('stop_whatsapp', {
        accountId: currentAccountId,
        token: session.user.accessToken
      });

      // Delete disconnected account
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        await fetch(`${backendUrl}/api/accounts/${currentAccountId}/cleanup`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`
          }
        });
        console.log('✅ Disconnected account cleaned up');
      } catch (error) {
        console.error('❌ Error during cleanup:', error);
      }
    }

    setShowQrModal(false);
    setQrCode(null);
    setCurrentAccountId(null);
    setIsCreatingAccount(false);
  };

  const toggleAccountStatus = async (accountId: string, currentStatus: boolean) => {
    if (!session?.user?.accessToken) return;

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/accounts/${accountId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.user.accessToken}`
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });

      const data = await response.json();
      if (data.success) {
        setAccounts(prev => prev.map(acc =>
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

  const deleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
      return;
    }

    if (!session?.user?.accessToken) return;

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

      // Stop WhatsApp connection first
      if (socket) {
        socket.emit('stop_whatsapp', {
          accountId,
          token: session.user.accessToken
        });
      }

      // Delete account
      const response = await fetch(`${backendUrl}/api/accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.user.accessToken}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setAccounts(prev => prev.filter(acc => acc.id !== accountId));
        toast.success('Account deleted successfully');
      } else {
        toast.error(data.message || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    }
  };

  // Handle drag end - reorder accounts
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !session?.user?.accessToken) return;

    const oldIndex = filteredAccounts.findIndex((acc) => acc.id === active.id);
    const newIndex = filteredAccounts.findIndex((acc) => acc.id === over.id);

    if (oldIndex === newIndex) return;

    // Optimistic UI update
    const reorderedAccounts = arrayMove(filteredAccounts, oldIndex, newIndex);

    // Update companyOrder values to be sequential (1, 2, 3, ...)
    const updatedAccounts = reorderedAccounts.map((acc, index) => ({
      ...acc,
      companyOrder: index + 1
    }));

    // Update local state
    setAccounts(prev => {
      const newAccounts = [...prev];
      updatedAccounts.forEach(updated => {
        const idx = newAccounts.findIndex(a => a.id === updated.id);
        if (idx !== -1) {
          newAccounts[idx] = updated;
        }
      });
      return newAccounts;
    });

    // Send updates to backend
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

      // Update all affected accounts
      await Promise.all(
        updatedAccounts.map(acc =>
          fetch(`${backendUrl}/api/accounts/${acc.id}/company-order`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.user.accessToken}`
            },
            body: JSON.stringify({ companyOrder: acc.companyOrder })
          })
        )
      );

      console.log('✅ Account order updated successfully');
    } catch (error) {
      console.error('❌ Error updating account order:', error);
      toast.error('Failed to update account order');
      // Revert on error
      fetchAccounts();
    }
  };

  const filteredAccounts = accounts
    .filter(acc => acc.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (a.companyOrder || 0) - (b.companyOrder || 0));

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

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Accounts</h1>
            <p className="text-sm text-gray-600 mt-1">Manage and assign WhatsApp accounts to users</p>
          </div>
          <button
            onClick={createNewAccount}
            disabled={isCreatingAccount}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            {isCreatingAccount ? 'Creating...' : 'Add New Account'}
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search accounts by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Info Note */}
        <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700 font-medium">Note: Accounts can only be assigned to users with &apos;User&apos; role</p>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-lg border border-gray-200 flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto flex-1">
          <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="min-w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Connection Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '280px', width: '280px' }}>
                  Assigned To
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '150px', width: '150px' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <SortableContext
              items={filteredAccounts.map((acc) => acc.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAccounts.map((account, index) => (
                  <SortableAccountRow
                    key={account.id}
                    account={account}
                    index={index}
                    editingAccount={editingAccount}
                    editingName={editingName}
                    assigningAccount={assigningAccount}
                    users={users}
                    onStartEdit={startEditingName}
                    onSaveName={saveAccountName}
                    onCancelEdit={cancelEditingName}
                    onToggleStatus={toggleAccountStatus}
                    onDelete={deleteAccount}
                    onAssign={assignAccount}
                    onToggleAssigning={setAssigningAccount}
                    setEditingName={setEditingName}
                    getStatusColor={getStatusColor}
                    getStatusText={getStatusText}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
        </div>

        {filteredAccounts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No accounts found. {searchTerm ? 'Try adjusting your search.' : 'Click Add New Account button to create one.'}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      <QrCodeModal
        isOpen={showQrModal}
        onClose={closeQrModal}
        qrCode={qrCode}
        isCreating={isCreatingAccount}
      />
    </div>
  );
}
