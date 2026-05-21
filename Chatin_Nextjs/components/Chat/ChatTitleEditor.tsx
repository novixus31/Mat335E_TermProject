'use client';

import React, { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';

// Helper function to get chat display info
function getChatDisplayInfo(chat: { customTitle: string | null; phoneNumber: string; contactName: string | null }) {
  // Priority: customTitle (with @) + phone OR phone + contactName
  if (chat.customTitle) {
    return {
      primary: `@${chat.customTitle}`,
      secondary: chat.phoneNumber
    };
  }

  return {
    primary: chat.phoneNumber,
    secondary: chat.contactName
  };
}

interface Chat {
  id: string;
  phoneNumber: string;
  contactName: string | null;
  customTitle: string | null;
}

interface ChatTitleEditorProps {
  chat: Chat;
  accountId: string;
  accessToken: string;
  onTitleUpdate: (chatId: string, newTitle: string | null) => void;
}

export default function ChatTitleEditor({ chat, accountId, accessToken, onTitleUpdate }: ChatTitleEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(chat.customTitle || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (isLoading) return;

    const trimmedTitle = title.trim();

    // If title is same as before (both empty or both same value), just cancel
    if (trimmedTitle === (chat.customTitle || '')) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

      let response;

      // RESTful approach: DELETE to remove, PUT to set/update
      if (trimmedTitle === '') {
        // Use DELETE endpoint to remove custom title
        response = await fetch(
          `${backendUrl}/api/chats/${accountId}/${chat.id}/title`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
      } else {
        // Use PUT endpoint to set/update custom title
        response = await fetch(
          `${backendUrl}/api/chats/${accountId}/${chat.id}/title`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ customTitle: trimmedTitle })
          }
        );
      }

      const data = await response.json();

      if (data.success) {
        onTitleUpdate(chat.id, trimmedTitle || null);
        setIsEditing(false);
        toast.success(trimmedTitle ? 'Chat title updated successfully' : 'Chat title removed successfully');
      } else {
        console.error('Failed to update title:', data.message);
        toast.error(data.message || 'Failed to update title. Please try again.');
      }
    } catch (error) {
      console.error('Error updating title:', error);
      toast.error('An error occurred while updating the title.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setTitle(chat.customTitle || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleBlur = () => {
    // Save when clicking outside
    if (!isLoading) {
      handleSave();
    }
  };

  const displayInfo = getChatDisplayInfo(chat);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <span className="text-gray-700 font-medium">@</span>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 50))}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          maxLength={50}
          disabled={isLoading}
          className="flex-1 font-semibold text-gray-900 bg-white border-2 border-indigo-500 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Enter custom title..."
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 flex-1 group/title"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-baseline gap-2 flex-1 min-w-0">
        <span className="font-semibold text-gray-900 truncate text-base">
          {displayInfo.primary}
        </span>
        {displayInfo.secondary && (
          <span className="text-gray-500 text-sm truncate">
            {displayInfo.secondary}
          </span>
        )}
      </div>
      {isHovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="opacity-0 group-hover/title:opacity-100 transition-opacity px-2 py-1 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-md"
          title="Edit chat title"
        >
          Edit Title
        </button>
      )}
    </div>
  );
}

// Export helper function for reuse
export { getChatDisplayInfo };
