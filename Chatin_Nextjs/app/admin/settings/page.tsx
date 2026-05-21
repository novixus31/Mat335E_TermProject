'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '@/lib/socket';
import { useSession } from 'next-auth/react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Account {
  id: string;
  name: string;
  accountType: string;
  qrStatus: 'connected' | 'scanning' | 'disconnected';
  companyOrder?: number;
}

export default function SettingsPage() {
  const { socket } = useSocket();
  const { data: session } = useSession();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const isAccountConnectedRef = useRef(false);
  const isInitializedRef = useRef(false);

  // Socket.IO event listeners
  useEffect(() => {
    if (!socket) return;

    // QR talebi alındı
    socket.on('qr_request_received', () => {
      console.log('✅ QR request received by server');
    });

    // QR kod güncellendi
    socket.on('qr_update', (data: { qrDataUrl?: string } | string) => {
      console.log('📱 QR Code received:', data);
      setQrCode(typeof data === 'string' ? data : data.qrDataUrl || null);
    });

    // QR hatası
    socket.on('qr_error', (error: { message?: string }) => {
      console.error('❌ QR Error:', error);
      toast.error(`QR Error: ${error.message || 'Unknown error'}`);
    });

    // Bağlantı başarılı
    socket.on('connection_success', (data: { phoneNumber?: string }) => {
      console.log('✅ WhatsApp connected:', data);
      setQrCode(null);
      isAccountConnectedRef.current = true;
      toast.success(`WhatsApp connected successfully!\nPhone: ${data.phoneNumber}`);
    });

    // Bağlantı kapandı
    socket.on('connection_closed', (data: Record<string, unknown>) => {
      console.log('❌ WhatsApp connection closed:', data);
      setQrCode(null);
    });

    // WhatsApp durduruldu
    socket.on('whatsapp_stopped', (data: Record<string, unknown>) => {
      console.log('🛑 WhatsApp stopped:', data);
      setQrCode(null);
    });

    return () => {
      socket.off('qr_request_received');
      socket.off('qr_update');
      socket.off('qr_error');
      socket.off('connection_success');
      socket.off('connection_closed');
      socket.off('whatsapp_stopped');
    };
  }, [socket]);

  // Account creation - only runs once on mount
  useEffect(() => {
    async function initializeAccount() {
      if (!session?.user?.accessToken || !socket || isInitializedRef.current) return;

      isInitializedRef.current = true;

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

        // Yeni account oluştur
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

          // QR üretimi için socket event gönder
          console.log('📱 Requesting QR code...');
          socket.emit('request_qr', {
            accountId,
            token: session.user.accessToken
          });
        } else {
          console.error('❌ Failed to create account:', createData.message);
        }
      } catch (error) {
        console.error('❌ Error initializing account:', error);
      }
    }

    initializeAccount();
  }, [session, socket]);

  // Cleanup on unmount - separate effect
  useEffect(() => {
    return () => {
      async function cleanup() {
        if (!currentAccountId || !session?.user?.accessToken || !socket) return;

        // IMPORTANT: Do NOT cleanup if account is connected
        if (isAccountConnectedRef.current) {
          console.log('✅ Account is connected, skipping cleanup');
          return;
        }

        try {
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

          console.log('🧹 Cleaning up disconnected account:', currentAccountId);

          // WhatsApp bağlantısını durdur
          socket.emit('stop_whatsapp', {
            accountId: currentAccountId,
            token: session.user.accessToken
          });

          // Disconnected account'ı sil
          const deleteResponse = await fetch(`${backendUrl}/api/accounts/${currentAccountId}/cleanup`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.user.accessToken}`
            }
          });

          const deleteData = await deleteResponse.json();
          if (deleteData.success) {
            console.log('✅ Disconnected account cleaned up successfully');
          }
        } catch (error) {
          console.error('❌ Error during cleanup:', error);
        }
      }

      cleanup();
    };
  }, [currentAccountId, session, socket]);

  const deleteAccount = async (id: string) => {
    if (!confirm('Are you sure you want to remove this account?')) return;

    if (socket && session?.user?.accessToken) {
      // WhatsApp bağlantısını durdur
      socket.emit('stop_whatsapp', {
        accountId: id,
        token: session.user.accessToken
      });
    }

    setAccounts((prev) => prev.filter((acc) => acc.id !== id));
  };

  const switchToAccount = (id: string) => {
    console.log('Switch to account:', id);
    // Buraya routing veya websocket switch işlemi eklenebilir
  };

  const handleNameChange = (id: string, newName: string) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, name: newName } : acc))
    );
    // Backend update çağrısı eklenebilir
  };

  return (
    <div className="flex h-screen bg-[#0b141a] text-[#e9edef] overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          {/* Back Button */}
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 mb-6 text-[#8696a0] hover:text-[#e9edef] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>

          {/* QR Code Display - Always at top */}
          {qrCode && (
            <div className="mb-6 bg-[#111b21] border border-[#2a3942] rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-center">Scan QR Code</h2>
              <p className="text-sm text-[#8696a0] mb-6 text-center">
                Open WhatsApp on your phone and scan this QR code to connect
              </p>
              <div className="bg-white p-4 rounded-lg flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
              </div>
              <div className="mt-4 text-center text-xs text-[#8696a0]">
                Waiting for scan...
              </div>
            </div>
          )}

          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-1">Account Management</h1>
            <p className="text-sm text-[#8696a0]">
              Manage your connected accounts and platforms
            </p>
          </div>

          {/* Account List */}
          <div className="space-y-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-[#111b21] border border-[#2a3942] rounded-lg p-4 flex flex-col gap-2"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      acc.qrStatus === 'connected'
                        ? 'bg-green-500'
                        : acc.qrStatus === 'scanning'
                        ? 'bg-yellow-400'
                        : 'bg-red-500'
                    }`}
                  />
                  <input
                    className="bg-[#2a3942] border border-[#00a884] px-2 py-1 rounded text-[#e9edef] flex-1"
                    value={acc.name}
                    onChange={(e) => handleNameChange(acc.id, e.target.value)}
                  />
                  <span className="text-xs bg-[#2a3942] text-[#8696a0] px-2 py-0.5 rounded uppercase">
                    {acc.accountType}
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    className="bg-transparent border border-[#2a3942] px-3 py-1 rounded hover:border-[#8696a0] hover:text-[#e9edef] text-sm"
                    onClick={() => switchToAccount(acc.id)}
                  >
                    Switch To
                  </button>
                  <button
                    className="bg-red-600 px-3 py-1 rounded hover:bg-red-700 text-sm"
                    onClick={() => deleteAccount(acc.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
