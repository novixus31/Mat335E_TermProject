'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useSocket } from '@/lib/socket';
import { initNotificationSound, notifyNewMessage, requestNotificationPermission } from '@/lib/notifications';
import { MessageBubble, TextContent, MediaContent, ViewOnceContent, DeletedMessageContent } from '@/components/Message';
import MediaViewer from '@/components/MediaViewer';
import { ChatList, MessageInput, getChatDisplayInfo } from '@/components/Chat';

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

interface Reaction {
  participant: string;
  emoji: string | null;
  fromMe: boolean;
  timestamp: string;
}

interface Message {
  id: string; // Database _id
  messageId?: string; // WhatsApp message ID
  text: string;
  fromMe: boolean;
  timestamp: string;
  messageType: string;
  mediaUrl?: string;
  caption?: string;
  isViewOnce?: boolean;
  isEdited?: boolean;
  lastEditedAt?: string;
  editHistory?: Array<{
    text?: string;
    caption?: string;
    editedAt: string;
  }>;
  quotedMessageId?: string;
  quotedMessageText?: string;
  quotedMessageFromMe?: boolean;
  reactions: Reaction[];
  isDeleted?: boolean;
  deletedAt?: string;
}

export default function ChatContainer() {
  const { data: session } = useSession();
  const { socket } = useSocket();
  const searchParams = useSearchParams();
  const viewMode = searchParams.get('view'); // 'all' or null
  const accountFromUrl = searchParams.get('account'); // account ID from URL
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(accountFromUrl);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // Chat-based input states (per chat)
  const [chatInputStates, setChatInputStates] = useState<Record<string, {
    messageText: string;
    selectedFile: File | null;
    viewOnce: boolean;
  }>>({});

  // Current chat's input state
  const currentChatId = selectedChat?.id || '';
  const messageText = chatInputStates[currentChatId]?.messageText || '';
  const selectedFile = chatInputStates[currentChatId]?.selectedFile || null;
  const viewOnce = chatInputStates[currentChatId]?.viewOnce || false;

  // Setters for current chat's input state
  const setMessageText = (text: string) => {
    setChatInputStates(prev => ({
      ...prev,
      [currentChatId]: {
        ...prev[currentChatId],
        messageText: text,
        selectedFile: prev[currentChatId]?.selectedFile || null,
        viewOnce: prev[currentChatId]?.viewOnce || false
      }
    }));
  };

  const setSelectedFile = (file: File | null) => {
    setChatInputStates(prev => ({
      ...prev,
      [currentChatId]: {
        messageText: prev[currentChatId]?.messageText || '',
        selectedFile: file,
        viewOnce: prev[currentChatId]?.viewOnce || false
      }
    }));
  };

  const setViewOnce = (value: boolean) => {
    setChatInputStates(prev => ({
      ...prev,
      [currentChatId]: {
        messageText: prev[currentChatId]?.messageText || '',
        selectedFile: prev[currentChatId]?.selectedFile || null,
        viewOnce: value
      }
    }));
  };

  // MediaViewer state (for viewing media)
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  // ViewOnce send modal state
  const [isViewOnceSendModalOpen, setIsViewOnceSendModalOpen] = useState(false);

  // Initialize notification sound and request permission on mount
  useEffect(() => {
    initNotificationSound();
    requestNotificationPermission();
  }, []);

  // Update selectedAccountId when URL changes
  useEffect(() => {
    if (accountFromUrl) {
      setSelectedAccountId(accountFromUrl);
    }
  }, [accountFromUrl]);

  // Fetch chats when account is selected or view mode changes
  useEffect(() => {
    async function fetchChats() {
      if (!session?.user?.accessToken) return;

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

        let url: string;
        if (viewMode === 'all') {
          // Fetch all chats from all accounts
          url = `${backendUrl}/api/chats/all`;
        } else if (selectedAccountId) {
          // Fetch chats for specific account
          url = `${backendUrl}/api/chats/${selectedAccountId}`;
        } else {
          return;
        }

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`
          }
        });

        const data = await response.json();
        if (data.success) {
          setChats(data.chats);
        }
      } catch (error) {
        console.error('Error fetching chats:', error);
      }
    }

    fetchChats();
  }, [session, selectedAccountId, viewMode]);

  // Fetch messages when chat is selected and join chat room
  useEffect(() => {
    async function fetchMessages() {
      if (!session?.user?.accessToken || !selectedChat || !socket) return;

      // Use chat's accountId if in "All Chats" mode, otherwise use selectedAccountId
      const accountIdToUse = selectedChat.accountId || selectedAccountId;
      if (!accountIdToUse) return;

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(
          `${backendUrl}/api/chats/${accountIdToUse}/${selectedChat.id}/messages`,
          {
            headers: {
              'Authorization': `Bearer ${session.user.accessToken}`
            }
          }
        );

        const data = await response.json();
        if (data.success) {
          console.log('📬 [FETCH MESSAGES] Loaded messages:', data.messages.length);
          console.log('📬 [FETCH MESSAGES] First message sample:', data.messages[0]);
          console.log('📬 [FETCH MESSAGES] Has messageId?', data.messages[0]?.messageId);
          setMessages(data.messages);

          // Join chat room via Socket.IO
          socket.emit('join_chat', {
            accountId: accountIdToUse,
            chatId: selectedChat.id,
            token: session.user.accessToken
          });

          // Mark chat as read via Socket.IO
          socket.emit('mark_chat_read', {
            accountId: accountIdToUse,
            chatId: selectedChat.id,
            token: session.user.accessToken
          });

          // Update local chat unread count
          setChats(prev => prev.map(c =>
            c.id === selectedChat.id ? { ...c, unreadCount: 0 } : c
          ));
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    }

    fetchMessages();
  }, [session, selectedAccountId, selectedChat, socket]);

  // Socket.IO event listeners for real-time messages
  useEffect(() => {
    if (!socket) return;

    // Listen for new incoming messages from WhatsApp
    socket.on('new_message', (data: {
      accountId: string;
      chatId: string;
      message: string;
      timestamp: string;
      fromMe: boolean;
      messageId?: string;
      messageType?: string;
      mediaUrl?: string;
      caption?: string;
      isViewOnce?: boolean;
      chatUnreadCount?: number;
      accountUnreadCount?: number;
      quotedMessageId?: string;
      quotedMessageText?: string;
      quotedMessageFromMe?: boolean;
    }) => {
      console.log('📨 [PAGE] New message received:', data);
      console.log('📨 [PAGE] messageId:', data.messageId);
      console.log('📨 [PAGE] accountUnreadCount:', data.accountUnreadCount);
      console.log('📨 [PAGE] chatUnreadCount:', data.chatUnreadCount);

      // Forward accountUnreadCount to layout via custom event
      // BUT: If this message is for the currently ACTIVE chat, subtract its unread count
      // because we're already viewing it (backend counted it before mark_chat_read happened)
      if (data.accountUnreadCount !== undefined && !data.fromMe) {
        const isActiveChat = selectedChat && data.chatId === selectedChat.id;
        let adjustedAccountUnreadCount = data.accountUnreadCount;

        if (isActiveChat && data.chatUnreadCount !== undefined && data.chatUnreadCount > 0) {
          // Backend counted this chat's unread, but we're viewing it, so subtract it
          adjustedAccountUnreadCount = Math.max(0, data.accountUnreadCount - data.chatUnreadCount);
          console.log('⏩ [PAGE] Adjusting account unread:', {
            original: data.accountUnreadCount,
            chatUnread: data.chatUnreadCount,
            adjusted: adjustedAccountUnreadCount
          });
        }

        console.log('📤 [PAGE] Dispatching account-unread-update event');
        window.dispatchEvent(new CustomEvent('account-unread-update', {
          detail: {
            accountId: data.accountId,
            accountUnreadCount: adjustedAccountUnreadCount
          }
        }));
      }

      // Only show notification for incoming messages (not sent by user)
      if (!data.fromMe) {
        // Find the chat to get sender info
        const chat = chats.find(c => c.id === data.chatId);
        const senderName = chat ? getChatDisplayInfo(chat).primary : 'New Message';

        // Show notification with appropriate message text
        const notificationText = data.mediaUrl ? (data.caption || data.message) : data.message;

        notifyNewMessage(senderName, notificationText, () => {
          // When notification is clicked, select that chat
          if (chat) {
            setSelectedChat(chat);
          }
        });
      }

      // Update chat list and sort by lastMessageTime
      setChats(prev => {
        const updated = prev.map(chat =>
          chat.id === data.chatId
            ? {
                ...chat,
                lastMessageText: data.message,
                lastMessageTime: data.timestamp,
                lastMessageFromMe: data.fromMe,
                lastMessageId: data.messageId,
                lastMessageIsDeleted: false, // New message, so not deleted
                // Use chatUnreadCount from backend if available
                unreadCount: selectedChat?.id === data.chatId
                  ? 0
                  : (data.chatUnreadCount ?? chat.unreadCount + 1)
              }
            : chat
        );
        // Sort by lastMessageTime (newest first)
        return updated.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
      });

      // If this message is for the currently selected chat, add it to messages
      if (selectedChat && data.chatId === selectedChat.id) {
        setMessages(prev => [...prev, {
          id: data.messageId || Date.now().toString(),
          messageId: data.messageId, // WhatsApp message ID
          text: data.message,
          fromMe: data.fromMe,
          timestamp: data.timestamp,
          messageType: data.messageType || 'text',
          mediaUrl: data.mediaUrl,
          caption: data.caption,
          isViewOnce: data.isViewOnce,
          quotedMessageId: data.quotedMessageId,
          quotedMessageText: data.quotedMessageText,
          quotedMessageFromMe: data.quotedMessageFromMe,
          reactions: [] // Initialize empty reactions array
        }]);

        // IMPORTANT: Immediately mark as read since we're viewing this chat
        if (!data.fromMe && socket && session?.user?.accessToken) {
          const accountIdToUse = selectedChat.accountId || selectedAccountId;
          if (accountIdToUse) {
            console.log('📖 [PAGE] Auto-marking active chat as read');
            socket.emit('mark_chat_read', {
              accountId: accountIdToUse,
              chatId: selectedChat.id,
              token: session.user.accessToken
            });
          }
        }
      }
    });

    // Listen for sent messages confirmation
    socket.on('message_sent', (data: { chatId: string; text: string; timestamp: string }) => {
      console.log('✅ Message sent confirmation:', data);

      // Message already added optimistically, just confirm it was sent
      if (selectedChat && data.chatId === selectedChat.id) {
        // Update chat list and sort by lastMessageTime
        setChats(prev => {
          const updated = prev.map(chat =>
            chat.id === data.chatId
              ? {
                  ...chat,
                  lastMessageText: data.text,
                  lastMessageTime: data.timestamp,
                  lastMessageFromMe: true
                }
              : chat
          );
          // Sort by lastMessageTime (newest first)
          return updated.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
        });
      }
    });

    // Listen for errors
    socket.on('message_error', (data: { message: string }) => {
      console.error('❌ Message error:', data);
      toast.error(`Error: ${data.message}`);
      setLoading(false);
    });

    // Listen for edited messages
    socket.on('message_edited', (data: {
      chatId: string;
      messageId: string;
      newText?: string;
      newCaption?: string;
      isEdited: boolean;
      lastEditedAt: string;
      editHistory?: Array<{ text?: string; caption?: string; editedAt: string }>;
    }) => {
      console.log('✏️ Message edited:', data);

      // Update chat list if it's the last message
      setChats(prev => prev.map(chat =>
        chat.id === data.chatId
          ? {
              ...chat,
              lastMessageText: data.newText || data.newCaption || chat.lastMessageText
            }
          : chat
      ));

      // Update message in current chat
      if (selectedChat && data.chatId === selectedChat.id) {
        setMessages(prev => prev.map(msg =>
          msg.id === data.messageId
            ? {
                ...msg,
                text: data.newText || msg.text,
                caption: data.newCaption || msg.caption,
                isEdited: data.isEdited,
                lastEditedAt: data.lastEditedAt,
                editHistory: data.editHistory
              }
            : msg
        ));
      }
    });

    // Listen for reaction events
    socket.on('message_reaction', (data: {
      messageId: string; // WhatsApp message ID
      reactionEmoji: string | null;
      participant: string;
      fromMe: boolean;
      timestamp: string;
      accountUnreadCount?: number;
    }) => {
      console.log('👍 Reaction received:', data);
      console.log('👍 Reaction messageId:', data.messageId);
      console.log('👍 Reaction emoji:', data.reactionEmoji);
      console.log('👍 Reaction participant:', data.participant);

      // Update message reactions array (match by WhatsApp messageId)
      if (selectedChat) {
        setMessages(prev => prev.map(msg => {
          if (msg.messageId === data.messageId) {
            const existingIndex = msg.reactions.findIndex(r => r.participant === data.participant);

            if (data.reactionEmoji === null) {
              // Reaction removed
              return {
                ...msg,
                reactions: msg.reactions.filter(r => r.participant !== data.participant)
              };
            } else if (existingIndex >= 0) {
              // Update existing reaction
              const newReactions = [...msg.reactions];
              newReactions[existingIndex] = {
                participant: data.participant,
                emoji: data.reactionEmoji,
                fromMe: data.fromMe,
                timestamp: data.timestamp
              };
              return { ...msg, reactions: newReactions };
            } else {
              // Add new reaction
              return {
                ...msg,
                reactions: [
                  ...msg.reactions,
                  {
                    participant: data.participant,
                    emoji: data.reactionEmoji,
                    fromMe: data.fromMe,
                    timestamp: data.timestamp
                  }
                ]
              };
            }
          }
          return msg;
        }));
      }
    });

    // Listen for deleted messages
    socket.on('message_deleted', (data: {
      accountId: string;
      chatId: string;
      messageId: string; // WhatsApp message ID
      remoteJid: string;
      timestamp: string;
      accountUnreadCount?: number;
      phoneNumber: string;
    }) => {
      console.log('🗑️ Message deletion received:', data);
      console.log('🗑️ Deleted messageId:', data.messageId);

      // Update message in current chat
      if (selectedChat && data.chatId === selectedChat.id) {
        setMessages(prev => prev.map(msg =>
          msg.messageId === data.messageId
            ? {
                ...msg,
                isDeleted: true,
                deletedAt: data.timestamp
              }
            : msg
        ));
      }

      // Update chat list if this was the last message
      setChats(prev => prev.map(chat => {
        // Check if this message was the last message in the chat
        if (chat.id === data.chatId && chat.lastMessageId === data.messageId) {
          return {
            ...chat,
            lastMessageIsDeleted: true
          };
        }
        return chat;
      }));
    });

    return () => {
      socket.off('new_message');
      socket.off('message_sent');
      socket.off('message_error');
      socket.off('message_edited');
      socket.off('message_reaction');
      socket.off('message_deleted');
    };
  }, [socket, selectedChat, chats, selectedAccountId, session]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus message input when chat is selected
  useEffect(() => {
    if (selectedChat && messageInputRef.current) {
      messageInputRef.current.focus();
    }
  }, [selectedChat]);

  const sendMediaMessage = async (file: File, customCaption?: string) => {
    if (!session?.user?.accessToken || !selectedChat) return;

    // Use chat's accountId if in "All Chats" mode, otherwise use selectedAccountId
    const accountIdToUse = selectedChat.accountId || selectedAccountId;
    if (!accountIdToUse) return;

    setLoading(true);

    // Use customCaption if provided (from modal), otherwise use messageText
    const caption = customCaption !== undefined ? customCaption : messageText;

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = async () => {
        const base64Data = reader.result as string;

        // Determine media type
        let mediaType: 'image' | 'video' | 'audio' | 'document';
        if (file.type.startsWith('image/')) {
          mediaType = 'image';
        } else if (file.type.startsWith('video/')) {
          mediaType = 'video';
        } else if (file.type.startsWith('audio/')) {
          mediaType = 'audio';
        } else {
          mediaType = 'document';
        }

        // Optimistically add message to UI
        const tempMessage: Message = {
          id: `temp-${Date.now()}`,
          messageId: undefined, // Will be set when backend confirms
          text: caption || '', // Use caption as text
          fromMe: true,
          timestamp: new Date().toISOString(),
          messageType: mediaType,
          mediaUrl: URL.createObjectURL(file), // Temporary local URL
          caption: caption || undefined,
          isViewOnce: viewOnce,
          reactions: [] // Initialize empty reactions array
        };
        setMessages(prev => [...prev, tempMessage]);

        // Send to backend
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(
          `${backendUrl}/api/chats/${accountIdToUse}/send-media`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.user?.accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              remoteJid: selectedChat.remoteJid,
              mediaType,
              fileName: file.name,
              mimeType: file.type,
              caption: caption || undefined,
              mediaData: base64Data,
              viewOnce: viewOnce
            })
          }
        );

        const data = await response.json();

        if (data.success) {
          // Update the temporary message with actual data
          setMessages(prev => prev.map(msg =>
            msg.id === tempMessage.id
              ? {
                  ...msg,
                  id: data.data.messageId || msg.id,
                  messageId: data.data.messageId,
                  mediaUrl: data.data.mediaUrl,
                  timestamp: data.data.timestamp
                }
              : msg
          ));

          // Update chat list and sort by lastMessageTime
          setChats(prev => {
            const updated = prev.map(chat =>
              chat.id === selectedChat.id
                ? {
                    ...chat,
                    lastMessageText: tempMessage.text, // Caption or empty string
                    lastMessageTime: data.data.timestamp,
                    lastMessageFromMe: true,
                    lastMessageType: mediaType,
                    lastMessageIsViewOnce: viewOnce
                  }
                : chat
            );
            // Sort by lastMessageTime (newest first)
            return updated.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
          });

          toast.success('Media sent successfully');

          // Clear current chat's input state ONLY on success
          setChatInputStates(prev => ({
            ...prev,
            [selectedChat.id]: {
              messageText: '',
              selectedFile: null,
              viewOnce: false
            }
          }));
        } else {
          // Remove failed message
          setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
          toast.error(data.message || 'Failed to send media');
          // DON'T clear input state - user can retry with same file
        }

        setLoading(false);
      };

      reader.onerror = () => {
        toast.error('Failed to read file');
        setLoading(false);
      };
    } catch (error) {
      console.error('Error sending media:', error);
      toast.error('An error occurred while sending media');
      setLoading(false);
    }
  };

  const handleViewOnceSend = (caption: string) => {
    if (selectedFile && selectedChat) {
      sendMediaMessage(selectedFile, caption);
      setIsViewOnceSendModalOpen(false);
      // Note: sendMediaMessage already clears the input state
    }
  };

  const sendMessage = async () => {
    if (!socket || !session?.user?.accessToken || !selectedChat || !messageText.trim()) return;

    // Use chat's accountId if in "All Chats" mode, otherwise use selectedAccountId
    const accountIdToUse = selectedChat.accountId || selectedAccountId;
    if (!accountIdToUse) return;

    const textToSend = messageText;

    // Clear current chat's input state immediately
    setChatInputStates(prev => ({
      ...prev,
      [selectedChat.id]: {
        messageText: '',
        selectedFile: null,
        viewOnce: false
      }
    }));

    setLoading(true);

    // Optimistically add message to UI
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      messageId: undefined, // Will be set when backend confirms
      text: textToSend,
      fromMe: true,
      timestamp: new Date().toISOString(),
      messageType: 'text',
      reactions: [] // Initialize empty reactions array
    };
    setMessages(prev => [...prev, tempMessage]);

    // Send via Socket.IO
    socket.emit('send_message', {
      accountId: accountIdToUse,
      remoteJid: selectedChat.remoteJid,
      text: textToSend,
      token: session.user.accessToken
    });

    setLoading(false);
  };

  const handleTitleUpdate = (chatId: string, newTitle: string | null) => {
    // Optimistically update the chat title in local state
    setChats(prev => prev.map(chat =>
      chat.id === chatId ? { ...chat, customTitle: newTitle } : chat
    ));

    // Update selected chat if it's the one being edited
    if (selectedChat && selectedChat.id === chatId) {
      setSelectedChat(prev => prev ? { ...prev, customTitle: newTitle } : null);
    }
  };

  // Filter media items (only image and video) for MediaViewer
  const mediaItems = messages
    .filter(msg => msg.mediaUrl && (msg.messageType === 'image' || msg.messageType === 'video') && !msg.isViewOnce)
    .map(msg => ({
      id: msg.id,
      mediaUrl: msg.mediaUrl!,
      messageType: msg.messageType,
      caption: msg.caption,
      timestamp: msg.timestamp,
      fromMe: msg.fromMe,
      isDeleted: msg.isDeleted
    }));

  // Callback to open MediaViewer
  const handleMediaClick = (messageId: string) => {
    const index = mediaItems.findIndex(item => item.id === messageId);
    if (index !== -1) {
      setSelectedMediaIndex(index);
      setIsMediaViewerOpen(true);
    }
  };

  return (
    <div className="flex h-full">
      {/* Chat List */}
      <ChatList
        chats={chats}
        selectedChat={selectedChat}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onChatSelect={setSelectedChat}
        viewMode={viewMode}
        selectedAccountId={selectedAccountId}
        accessToken={session?.user?.accessToken}
        onTitleUpdate={handleTitleUpdate}
      />

      {/* Messages Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="bg-white p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">
                  {getChatDisplayInfo(selectedChat).primary}
                </h2>
                {getChatDisplayInfo(selectedChat).secondary && (
                  <span className="text-gray-500 text-sm">
                    · {getChatDisplayInfo(selectedChat).secondary}
                  </span>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  fromMe={msg.fromMe}
                  timestamp={msg.timestamp}
                  isEdited={msg.isEdited}
                  quotedMessageText={msg.quotedMessageText}
                  quotedMessageFromMe={msg.quotedMessageFromMe}
                  reactions={msg.reactions}
                >
                  {/* Deleted Message with toggle reveal */}
                  {msg.isDeleted ? (
                    <DeletedMessageContent
                      fromMe={msg.fromMe}
                      deletedAt={msg.deletedAt}
                    >
                      {/* Show actual content inside DeletedMessageContent */}
                      {msg.mediaUrl && msg.messageType !== 'text' ? (
                        <MediaContent
                          mediaUrl={msg.mediaUrl}
                          messageType={msg.messageType}
                          caption={msg.caption}
                          text={msg.text}
                          fromMe={msg.fromMe}
                          isViewOnce={false}
                          onMediaClick={
                            msg.messageType === 'image' || msg.messageType === 'video'
                              ? () => handleMediaClick(msg.id)
                              : undefined
                          }
                        />
                      ) : (
                        <TextContent
                          text={msg.text}
                          fromMe={msg.fromMe}
                          isEdited={msg.isEdited}
                        />
                      )}
                    </DeletedMessageContent>
                  ) : (
                    /* Regular messages (not deleted) */
                    <>
                      {/* Media with possible View Once */}
                      {msg.mediaUrl && msg.messageType !== 'text' ? (
                        <MediaContent
                          mediaUrl={msg.mediaUrl}
                          messageType={msg.messageType}
                          caption={msg.caption}
                          text={msg.text}
                          fromMe={msg.fromMe}
                          isViewOnce={msg.isViewOnce}
                          onMediaClick={
                            !msg.isViewOnce && (msg.messageType === 'image' || msg.messageType === 'video')
                              ? () => handleMediaClick(msg.id)
                              : undefined
                          }
                        />
                      ) : msg.isViewOnce ? (
                        /* View Once text notification (received via Web - no mediaUrl) */
                        <ViewOnceContent
                          fromMe={msg.fromMe}
                          mediaUrl=""
                          messageType="text"
                          text={msg.text}
                        />
                      ) : (
                        /* Regular text message */
                        <TextContent
                          text={msg.text}
                          fromMe={msg.fromMe}
                          isEdited={msg.isEdited}
                        />
                      )}
                    </>
                  )}
                </MessageBubble>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <MessageInput
              messageText={messageText}
              setMessageText={setMessageText}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              viewOnce={viewOnce}
              setViewOnce={setViewOnce}
              loading={loading}
              onSendMessage={sendMessage}
              onSendMediaMessage={(file) => sendMediaMessage(file)}
              onOpenViewOnceModal={() => setIsViewOnceSendModalOpen(true)}
              messageInputRef={messageInputRef}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a chat to start messaging
          </div>
        )}
      </div>

      {/* MediaViewer Modal - For viewing existing media */}
      {selectedChat && (
        <MediaViewer
          isOpen={isMediaViewerOpen}
          onClose={() => setIsMediaViewerOpen(false)}
          mode="view"
          mediaItems={mediaItems}
          initialIndex={selectedMediaIndex}
          senderName={getChatDisplayInfo(selectedChat).primary}
        />
      )}

      {/* ViewOnce Send Modal - For sending view-once media */}
      <MediaViewer
        isOpen={isViewOnceSendModalOpen}
        onClose={() => setIsViewOnceSendModalOpen(false)}
        mode="send"
        sendFile={selectedFile}
        initialCaption={messageText}
        onSend={handleViewOnceSend}
      />
    </div>
  );
}
