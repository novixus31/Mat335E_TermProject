import React, { Suspense } from 'react';
import { ChatContainer } from '@/components/Chat';

export default function ChatsPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-gray-500">Loading...</div>}>
      <ChatContainer />
    </Suspense>
  );
}
