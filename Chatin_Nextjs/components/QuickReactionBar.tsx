'use client';

import React from 'react';

interface QuickReactionBarProps {
  onReactionSelect: (emoji: string) => void;
  onClose: () => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function QuickReactionBar({ onReactionSelect, onClose }: QuickReactionBarProps) {
  return (
    <div
      className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-50
        flex gap-1 px-2 py-1.5
        bg-white border border-gray-200 rounded-full shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {QUICK_REACTIONS.map(emoji => (
        <button
          key={emoji}
          onClick={() => {
            onReactionSelect(emoji);
            onClose();
          }}
          className="w-8 h-8 flex items-center justify-center
            text-xl hover:bg-gray-100 rounded-full transition-colors"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
