'use client';

import React from 'react';
import { formatMessageTime } from '@/lib/utils';
import { Reply } from 'lucide-react';

interface Reaction {
  participant: string;
  emoji: string | null;
  fromMe: boolean;
  timestamp: string;
}

interface MessageBubbleProps {
  fromMe: boolean;
  timestamp: string;
  isEdited?: boolean;
  quotedMessageText?: string;
  quotedMessageFromMe?: boolean;
  reactions: Reaction[];
  children: React.ReactNode;
}

export default function MessageBubble({
  fromMe,
  timestamp,
  isEdited,
  quotedMessageText,
  quotedMessageFromMe,
  reactions,
  children
}: MessageBubbleProps) {
  // Get unique emojis and total count
  const validReactions = reactions.filter(r => r.emoji);
  const uniqueEmojis = Array.from(new Set(validReactions.map(r => r.emoji)));
  const totalCount = validReactions.length;
  return (
    <div className={`flex ${fromMe ? 'justify-end' : 'justify-start'} relative`}>
      <div
        className={`max-w-md px-3 py-1.5 rounded-lg relative ${
          fromMe
            ? 'bg-indigo-500 text-white'
            : 'bg-white text-gray-900 border border-gray-200'
        } ${reactions.length > 0 ? 'mb-3' : ''}`}
      >
        <div className="relative">
          {/* Quoted Message Preview */}
          {quotedMessageText && (
            <div
              className={`mb-2 pl-3 py-1.5 pr-2 border-l-4 rounded-sm ${
                fromMe
                  ? 'bg-indigo-600/30 border-indigo-200'
                  : 'bg-gray-100 border-gray-400'
              }`}
            >
              <div className="flex items-start gap-1.5">
                {/* Icon: Sadece karşılıklı alıntılarda göster (biri diğerinin mesajını alıntılarsa) */}
                {quotedMessageFromMe !== undefined && quotedMessageFromMe !== fromMe && (
                  <Reply className={`w-3 h-3 mt-0.5 flex-shrink-0 ${
                    fromMe ? 'text-indigo-200' : 'text-gray-500'
                  }`} />
                )}
                <p
                  className={`text-xs italic line-clamp-2 ${
                    fromMe ? 'text-indigo-100' : 'text-gray-600'
                  }`}
                  title={quotedMessageText}
                >
                  {quotedMessageText}
                </p>
              </div>
            </div>
          )}

          {children}

          {/* Timestamp and Edited Badge */}
          <span className={`absolute bottom-0 right-0 text-[10px] leading-none flex items-center gap-1 ${
            fromMe ? 'text-indigo-100' : 'text-gray-500'
          }`}>
            {isEdited && (
              <span className="italic opacity-75">Düzenlendi</span>
            )}
            {formatMessageTime(timestamp)}
          </span>
        </div>
      </div>

      {/* Reactions Display - All in ONE badge with total count at the end */}
      {uniqueEmojis.length > 0 && (
        <div className={`absolute -bottom-[6px] ${fromMe ? 'right-2' : 'left-2'}`}>
          <div
            className="flex items-center justify-center gap-0.5
              min-w-[28px] h-[20px] px-1.5
              bg-white border-2 border-gray-300
              rounded-full shadow-sm
              text-sm leading-none"
          >
            {/* Show each unique emoji once */}
            {uniqueEmojis.map((emoji) => (
              <span key={emoji}>{emoji}</span>
            ))}

            {/* Show total count at the end if more than 1 */}
            {totalCount > 1 && (
              <span className="text-[10px] text-gray-600 font-medium ml-0.5">
                {totalCount}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
