'use client';

import React, { useState } from 'react';
import { CircleSlash2 } from 'lucide-react';

interface DeletedMessageContentProps {
  fromMe: boolean;
  deletedAt?: string;
  children: React.ReactNode; // Actual message content (TextContent or MediaContent)
}

export default function DeletedMessageContent({ fromMe, deletedAt, children }: DeletedMessageContentProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  const formatDeletedTime = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      className="cursor-pointer hover:opacity-80 transition-opacity"
      onClick={() => setIsRevealed(!isRevealed)}
    >
      {isRevealed ? (
        // Show actual message content with icon
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">
            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
              <CircleSlash2 className="w-3 h-3 text-amber-600" />
            </div>
          </div>
          <div className="flex-1">
            {children}
          </div>
        </div>
      ) : (
        // Show placeholder - exactly like ViewOnce
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">
            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
              <CircleSlash2 className="w-3 h-3 text-amber-600" />
            </div>
          </div>
          <div className="flex-1">
            <p className={`text-xs leading-relaxed italic ${fromMe ? 'text-white' : 'text-gray-700'}`}>
              Bu mesaj silindi. ChatIn kullandığınız için görüntüleyebilirsiniz.
              {deletedAt && ` Silme zamanı: ${formatDeletedTime(deletedAt)}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
