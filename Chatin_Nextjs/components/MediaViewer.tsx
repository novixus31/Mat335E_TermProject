'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Send, Lock, CircleSlash2 } from 'lucide-react';
import { formatMessageTime } from '@/lib/utils';

interface MediaItem {
  id: string;
  mediaUrl: string;
  messageType: string;
  caption?: string;
  timestamp: string;
  fromMe: boolean;
  isDeleted?: boolean;
}

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  // View mode props
  mediaItems?: MediaItem[];
  initialIndex?: number;
  senderName?: string;
  // Send mode props
  mode?: 'view' | 'send';
  sendFile?: File | null;
  initialCaption?: string;
  onSend?: (caption: string) => void;
}

export default function MediaViewer({
  isOpen,
  onClose,
  mediaItems = [],
  initialIndex = 0,
  senderName = '',
  mode = 'view',
  sendFile = null,
  initialCaption = '',
  onSend
}: MediaViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [caption, setCaption] = useState('');

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Set caption from initialCaption when modal opens in send mode
  useEffect(() => {
    if (isOpen && mode === 'send') {
      setCaption(initialCaption);
    }
  }, [isOpen, mode, initialCaption]);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (mode === 'view' && e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (mode === 'view' && e.key === 'ArrowRight') {
        handleNext();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, currentIndex, mode]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : mediaItems.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < mediaItems.length - 1 ? prev + 1 : 0));
  };

  const handleSend = () => {
    if (onSend) {
      onSend(caption);
      onClose();
    }
  };

  if (!isOpen) return null;
  if (mode === 'view' && mediaItems.length === 0) return null;
  if (mode === 'send' && !sendFile) return null;

  // Determine media URL and type based on mode
  const mediaUrl = mode === 'send' ? URL.createObjectURL(sendFile!) : mediaItems[currentIndex].mediaUrl;
  const messageType = mode === 'send'
    ? (sendFile!.type.startsWith('image/') ? 'image' : sendFile!.type.startsWith('video/') ? 'video' : 'document')
    : mediaItems[currentIndex].messageType;
  const currentItem = mode === 'view' ? mediaItems[currentIndex] : null;

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col"
      onClick={mode === 'view' ? onClose : undefined}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent z-10">
        <div className="flex items-start justify-between">
          {/* Sender Info or Title */}
          {mode === 'view' ? (
            <div className="text-white">
              <div className="flex items-center gap-2">
                <div>
                  <p className="font-semibold text-lg">
                    {currentItem!.fromMe ? 'Siz' : senderName}
                  </p>
                  <p className="text-sm text-gray-300">
                    {formatMessageTime(currentItem!.timestamp)}
                  </p>
                </div>
                {/* Deleted Message Badge */}
                {currentItem?.isDeleted && (
                  <div className="flex items-center gap-1.5 bg-amber-500/90 px-3 py-1.5 rounded-full">
                    <CircleSlash2 className="w-4 h-4 text-white" />
                    <span className="text-sm font-medium text-white">Silindi</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-white flex items-center gap-2">
              <Lock className="w-5 h-5" />
              <p className="font-semibold text-lg">Bir Kez Görüntülenebilir Mesaj</p>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="flex-1 flex items-center justify-center p-16"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Previous Button - Only in view mode */}
        {mode === 'view' && mediaItems.length > 1 && (
          <button
            onClick={handlePrevious}
            className="absolute left-4 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>
        )}

        {/* Media Display */}
        <div className="flex items-center justify-center">
          {messageType === 'image' ? (
            <img
              src={mediaUrl}
              alt="Media"
              className="max-w-[calc(100vw-8rem)] max-h-[calc(100vh-8rem)] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : messageType === 'video' ? (
            <video
              src={mediaUrl}
              controls
              className="max-w-[calc(100vw-8rem)] max-h-[calc(100vh-8rem)] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : null}
        </div>

        {/* Next Button - Only in view mode */}
        {mode === 'view' && mediaItems.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        )}
      </div>

      {/* View Mode: Caption */}
      {mode === 'view' && currentItem?.caption && (
        <div className="absolute bottom-24 right-4 max-w-md bg-black/70 text-white p-3 rounded-lg">
          <p className="text-sm">{currentItem.caption}</p>
        </div>
      )}

      {/* View Mode: Thumbnail Gallery */}
      {mode === 'view' && mediaItems.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-12">
          <div className="flex gap-2 overflow-x-auto justify-center py-2 ">
            {mediaItems.map((item, index) => (
              <button
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  index === currentIndex
                    ? 'border-white scale-110'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                {item.messageType === 'image' ? (
                  <img
                    src={item.mediaUrl}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="relative w-full h-full">
                    <video
                      src={item.mediaUrl}
                      className="w-full h-full object-cover"
                      preload="metadata"
                    />
                    {/* Play icon overlay for video thumbnails */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="w-3 h-3 text-gray-800 ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Send Mode: Caption Input & Action Buttons */}
      {mode === 'send' && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Caption Input */}
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption (optional)..."
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
