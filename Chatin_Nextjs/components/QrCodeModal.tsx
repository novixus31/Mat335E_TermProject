'use client';

import React from 'react';
import { QrCode, X } from 'lucide-react';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCode: string | null;
  isCreating: boolean;
}

export default function QrCodeModal({ isOpen, onClose, qrCode, isCreating }: QrCodeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">Scan QR Code</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Open WhatsApp on your phone and scan this QR code to connect
        </p>

        {qrCode ? (
          <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="QR Code" className="w-64 h-64" />
          </div>
        ) : (
          <div className="bg-gray-50 p-12 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-3"></div>
              <p className="text-sm text-gray-600">
                {isCreating ? 'Creating account...' : 'Generating QR code...'}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 text-center text-xs text-gray-500">
          Waiting for scan...
        </div>
      </div>
    </div>
  );
}
