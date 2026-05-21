'use client';

import React from 'react';
import { Check, History, Image, Video, Music, FileText, Sticker, CircleSlash2 } from 'lucide-react';
import { formatMessageTime } from '@/lib/utils';
import ChatTitleEditor, { getChatDisplayInfo } from './ChatTitleEditor';

interface Chat {
  id: string;
  phoneNumber: string;
  contactName: string | null;
  customTitle: string | null;
  lastMessageTime: string;
  lastMessageText?: string;
  lastMessageType?: string;
  lastMessageIsViewOnce?: boolean;
  lastMessageFromMe?: boolean;
  lastMessageId?: string;
  lastMessageIsDeleted?: boolean;
  unreadCount: number;
  remoteJid: string;
  accountId?: string;
  accountName?: string;
}

interface ChatListItemProps {
  chat: Chat;
  isSelected: boolean;
  onClick: () => void;
  viewMode?: string | null;
  selectedAccountId?: string | null;
  accessToken?: string;
  onTitleUpdate: (chatId: string, newTitle: string | null) => void;
}

export default function ChatListItem({
  chat,
  isSelected,
  onClick,
  viewMode,
  selectedAccountId,
  accessToken,
  onTitleUpdate
}: ChatListItemProps) {
  // Determine the accountId for this chat (for API calls)
  const chatAccountId = chat.accountId || selectedAccountId;
  const displayInfo = getChatDisplayInfo(chat);

  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-indigo-50' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex-1 min-w-0">
              {accessToken && chatAccountId ? (
                <ChatTitleEditor
                  chat={chat}
                  accountId={chatAccountId}
                  accessToken={accessToken}
                  onTitleUpdate={onTitleUpdate}
                />
              ) : (
                <div className="flex items-baseline gap-2">
                  <p className="font-semibold text-gray-900 truncate text-base">
                    {displayInfo.primary}
                  </p>
                  {displayInfo.secondary && (
                    <span className="text-gray-500 text-sm truncate">
                      {displayInfo.secondary}
                    </span>
                  )}
                </div>
              )}
              {viewMode === 'all' && chat.accountName && (
                <p className="text-xs text-indigo-600 truncate">{chat.accountName}</p>
              )}
            </div>
            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
              {formatMessageTime(chat.lastMessageTime)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 truncate">
              <span className="flex items-center gap-1">
                {/* Double check if message from me */}
                {chat.lastMessageFromMe && (
                  <span className="flex">
                    <Check className="w-3 h-3 text-gray-400" />
                    <Check className="w-3 h-3 text-gray-400 -ml-1.5" />
                  </span>
                )}

                {/* Message content */}
                {chat.lastMessageIsDeleted ? (
                  <>
                    <CircleSlash2 className="w-3 h-3" />
                    <span className="italic">{chat.lastMessageText || 'Bu mesaj silindi'}</span>
                  </>
                ) : chat.lastMessageIsViewOnce ? (
                  <>
                    <History className="w-3 h-3" />
                    <span className="italic">Bir kez görüntülenebilir mesaj</span>
                  </>
                ) : chat.lastMessageType && chat.lastMessageType !== 'text' ? (
                  <>
                    {chat.lastMessageType === 'image' && (
                      <>
                        <Image className="w-3 h-3" />
                        <span>Fotoğraf</span>
                      </>
                    )}
                    {chat.lastMessageType === 'video' && (
                      <>
                        <Video className="w-3 h-3" />
                        <span>Video</span>
                      </>
                    )}
                    {chat.lastMessageType === 'audio' && (
                      <>
                        <Music className="w-3 h-3" />
                        <span>Ses</span>
                      </>
                    )}
                    {chat.lastMessageType === 'document' && (
                      <>
                        <FileText className="w-3 h-3" />
                        <span>Belge</span>
                      </>
                    )}
                    {chat.lastMessageType === 'sticker' && (
                      <>
                        <Sticker className="w-3 h-3" />
                        <span>Çıkartma</span>
                      </>
                    )}
                  </>
                ) : (
                  <span>{chat.lastMessageText || 'No messages'}</span>
                )}
              </span>
            </p>
            {chat.unreadCount > 0 && (
              <span className="ml-2 bg-indigo-500 text-white text-xs rounded-full px-2 py-0.5 flex-shrink-0">
                {chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
