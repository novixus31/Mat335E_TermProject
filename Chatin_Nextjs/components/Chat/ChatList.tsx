'use client';

import React from 'react';
import { Search } from 'lucide-react';
import ChatListItem from './ChatListItem';

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
  unreadCount: number;
  remoteJid: string;
  accountId?: string;
  accountName?: string;
}

interface ChatListProps {
  chats: Chat[];
  selectedChat: Chat | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onChatSelect: (chat: Chat) => void;
  viewMode?: string | null;
  selectedAccountId?: string | null;
  accessToken?: string;
  onTitleUpdate: (chatId: string, newTitle: string | null) => void;
}

export default function ChatList({
  chats,
  selectedChat,
  searchTerm,
  setSearchTerm,
  onChatSelect,
  viewMode,
  selectedAccountId,
  accessToken,
  onTitleUpdate
}: ChatListProps) {
  const filteredChats = chats.filter(chat => {
    const searchLower = searchTerm.toLowerCase();
    return (
      chat.phoneNumber.includes(searchLower) ||
      chat.contactName?.toLowerCase().includes(searchLower) ||
      chat.customTitle?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Chat Items */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isSelected={selectedChat?.id === chat.id}
            onClick={() => onChatSelect(chat)}
            viewMode={viewMode}
            selectedAccountId={selectedAccountId}
            accessToken={accessToken}
            onTitleUpdate={onTitleUpdate}
          />
        ))}
        {filteredChats.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No chats found
          </div>
        )}
      </div>
    </div>
  );
}
