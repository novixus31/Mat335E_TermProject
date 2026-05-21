'use client';

import React from 'react';

interface TextContentProps {
  text: string;
  fromMe: boolean;
  isEdited?: boolean;
}

export default function TextContent({ text, fromMe, isEdited }: TextContentProps) {
  return (
    <p className={`text-sm leading-relaxed min-h-[20px] ${isEdited ? 'pr-28' : 'pr-14'}`}>
      {text}
    </p>
  );
}
