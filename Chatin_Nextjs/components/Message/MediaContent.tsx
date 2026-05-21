'use client';

import React, { useState } from 'react';
import { FileText, Download, Image as ImageIcon, Music, Play } from 'lucide-react';
import ViewOnceContent from './ViewOnceContent';

interface MediaContentProps {
  mediaUrl: string;
  messageType: string;
  caption?: string;
  text?: string;
  fromMe: boolean;
  isViewOnce?: boolean;
  onMediaClick?: () => void; // Callback to open modal
  duration?: number; // Video duration in seconds
}

export default function MediaContent({ mediaUrl, messageType, caption, text, fromMe, isViewOnce, onMediaClick, duration }: MediaContentProps) {
  const [imageError, setImageError] = useState(false);

  // Format duration for display (e.g., "1:23" or "12:34")
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // View Once messages
  if (isViewOnce) {
    return (
      <ViewOnceContent
        fromMe={fromMe}
        mediaUrl={mediaUrl}
        messageType={messageType}
        text={text}
      />
    );
  }

  // Image rendering
  if (messageType === 'image') {
    return (
      <div className="pb-4 space-y-2">
        {imageError ? (
          <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
            <ImageIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">Image not available</span>
          </div>
        ) : (
          <img
            src={mediaUrl}
            alt={caption || 'Image'}
            className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onError={() => setImageError(true)}
            onClick={onMediaClick}
          />
        )}
        {caption && (
          <p className="text-sm">{caption}</p>
        )}
      </div>
    );
  }

  // Video rendering
  if (messageType === 'video') {
    return (
      <div className="pb-4 space-y-2">
        <div
          className="relative max-w-xs rounded-lg overflow-hidden cursor-pointer group"
          onClick={onMediaClick}
        >
          {/* Video preview (first frame) */}
          <video
            src={mediaUrl}
            className="w-full rounded-lg"
            style={{ maxHeight: '300px', objectFit: 'cover' }}
            preload="metadata"
          >
            Your browser does not support video playback.
          </video>

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center group-hover:bg-white transition-colors">
              <Play className="w-6 h-6 text-gray-800 ml-0.5" fill="currentColor" />
            </div>
          </div>

          {/* Duration badge - bottom right */}
          {duration && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-white text-xs font-medium">
              {formatDuration(duration)}
            </div>
          )}
        </div>
        {caption && (
          <p className="text-sm">{caption}</p>
        )}
      </div>
    );
  }

  // Audio rendering
  if (messageType === 'audio') {
    return (
      <div className="pb-4 space-y-2">
        <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
          <Music className="w-5 h-5 text-indigo-500" />
          <audio src={mediaUrl} controls className="flex-1">
            Your browser does not support audio playback.
          </audio>
        </div>
        {caption && (
          <p className="text-sm">{caption}</p>
        )}
      </div>
    );
  }

  // Document rendering
  if (messageType === 'document') {
    const fileName = text || 'Document';
    return (
      <div className="pb-4 space-y-2">
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
            fromMe
              ? 'bg-indigo-600 hover:bg-indigo-700'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <FileText className={`w-5 h-5 ${fromMe ? 'text-white' : 'text-gray-600'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${fromMe ? 'text-white' : 'text-gray-900'}`}>
              {fileName}
            </p>
            <p className={`text-xs ${fromMe ? 'text-indigo-100' : 'text-gray-500'}`}>
              Click to download
            </p>
          </div>
          <Download className={`w-4 h-4 ${fromMe ? 'text-white' : 'text-gray-600'}`} />
        </a>
        {caption && (
          <p className="text-sm">{caption}</p>
        )}
      </div>
    );
  }

  // Sticker rendering (similar to image)
  if (messageType === 'sticker') {
    return (
      <div className="pb-4 space-y-2">
        {imageError ? (
          <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
            <ImageIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">Sticker not available</span>
          </div>
        ) : (
          <img
            src={mediaUrl}
            alt="Sticker"
            className="w-32 h-32 object-contain cursor-pointer hover:opacity-90 transition-opacity"
            onError={() => setImageError(true)}
            onClick={() => window.open(mediaUrl, '_blank')}
          />
        )}
      </div>
    );
  }

  // Fallback for unknown media types
  return (
    <div className="pb-4 space-y-2">
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
          fromMe
            ? 'bg-indigo-600 hover:bg-indigo-700'
            : 'bg-gray-100 hover:bg-gray-200'
        }`}
      >
        <FileText className={`w-5 h-5 ${fromMe ? 'text-white' : 'text-gray-600'}`} />
        <span className={`text-sm ${fromMe ? 'text-white' : 'text-gray-900'}`}>
          {text || 'Media file'}
        </span>
        <Download className={`w-4 h-4 ${fromMe ? 'text-white' : 'text-gray-600'}`} />
      </a>
      {caption && (
        <p className="text-sm">{caption}</p>
      )}
    </div>
  );
}
