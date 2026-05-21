'use client';

import React, { useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import MediaViewer from '@/components/MediaViewer';

interface ViewOnceProps {
  fromMe: boolean;
  mediaUrl?: string;
  messageType?: string;
  text?: string;
}

export default function ViewOnce({ fromMe, mediaUrl, messageType, text }: ViewOnceProps) {
  const [showModal, setShowModal] = useState(false);

  // mediaUrl VAR ise: Yeşil unlock (ChatIn'den gönderilmiş - görüntülenebilir)
  const isUnlocked = !!mediaUrl;

  return (
    <>
      <div
        className={`flex items-center gap-2 ${isUnlocked ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
        onClick={isUnlocked ? () => setShowModal(true) : undefined}
      >
        <div className="flex-shrink-0">
          <div className={`w-5 h-5 rounded-full ${isUnlocked ? 'bg-green-100' : 'bg-amber-100'} flex items-center justify-center`}>
            {isUnlocked ? (
              <LockOpen className="w-3 h-3 text-green-600" />
            ) : (
              <Lock className="w-3 h-3 text-amber-600" />
            )}
          </div>
        </div>
        <div className="flex-1">
          <p className={`text-xs leading-relaxed italic ${fromMe ? 'text-white' : 'text-gray-700'}`}>
            {isUnlocked ? (
              "Bir kez görüntülenebilir mesaj gönderdiniz. ChatIn üzerinden yollandığı için görüntüleyebilirsiniz."
            ) : (
              fromMe
                ? "Bir kez görüntülenebilir mesaj gönderdiniz. Bu mesajı sadece mobil cihazınızda görüntüleyebilirsiniz."
                : "Bir kez görüntülenebilir mesaj aldınız. Bu mesajı sadece mobil cihazınızda görüntüleyebilirsiniz."
            )}
          </p>
        </div>
      </div>

      {/* MediaViewer - sadece unlocked için */}
      {isUnlocked && (
        <MediaViewer
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          mode="view"
          mediaItems={[{
            id: 'view-once',
            mediaUrl: mediaUrl!,
            messageType: messageType || 'image',
            caption: text,
            timestamp: new Date().toISOString(),
            fromMe: fromMe
          }]}
          initialIndex={0}
          senderName="View Once"
        />
      )}
    </>
  );
}
