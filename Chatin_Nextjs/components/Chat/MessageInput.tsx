'use client';

import React, { useRef } from 'react';
import { Send, Paperclip, X, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface MessageInputProps {
  messageText: string;
  setMessageText: (text: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  viewOnce: boolean;
  setViewOnce: (value: boolean) => void;
  loading: boolean;
  onSendMessage: () => void;
  onSendMediaMessage: (file: File) => void;
  onOpenViewOnceModal?: () => void;
  messageInputRef?: React.RefObject<HTMLInputElement | null>;
}

export default function MessageInput({
  messageText,
  setMessageText,
  selectedFile,
  setSelectedFile,
  viewOnce,
  setViewOnce,
  loading,
  onSendMessage,
  onSendMediaMessage,
  onOpenViewOnceModal,
  messageInputRef
}: MessageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      if (selectedFile) {
        // If viewOnce is enabled, open modal instead of sending directly
        if (viewOnce && onOpenViewOnceModal) {
          onOpenViewOnceModal();
        } else {
          onSendMediaMessage(selectedFile);
        }
      } else if (messageText.trim()) {
        onSendMessage();
      }
    }
  };

  const handleSend = () => {
    if (selectedFile) {
      // If viewOnce is enabled, open modal instead of sending directly
      if (viewOnce && onOpenViewOnceModal) {
        onOpenViewOnceModal();
      } else {
        onSendMediaMessage(selectedFile);
      }
    } else if (messageText.trim()) {
      onSendMessage();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 16MB for WhatsApp)
      if (file.size > 16 * 1024 * 1024) {
        toast.error('File size must be less than 16MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  return (
    <div className="bg-white p-4 border-t border-gray-200">
      {/* File Preview */}
      {selectedFile && (
        <div className="mb-3 space-y-2">
          <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedFile.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Preview"
                  className="w-12 h-12 object-cover rounded"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                  <Paperclip className="w-6 h-6 text-gray-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* View Once Toggle */}
          <label className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-gray-50 rounded-lg transition-colors">
            <input
              type="checkbox"
              checked={viewOnce}
              onChange={(e) => setViewOnce(e.target.checked)}
              className="w-4 h-4 cursor-pointer accent-indigo-500"
            />
            <span className="text-sm text-gray-700 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-gray-600" />
              Bir Kez Görüntüle (View Once)
            </span>
          </label>
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-center gap-2">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Paperclip Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="p-2 text-gray-500 hover:text-indigo-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Text Input */}
        <input
          ref={messageInputRef}
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedFile ? "Add a caption (optional)..." : "Type a message..."}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          disabled={loading}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={loading || (!messageText.trim() && !selectedFile)}
          className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          Send
        </button>
      </div>
    </div>
  );
}
