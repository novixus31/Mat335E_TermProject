"use client";

import { SessionProvider } from "next-auth/react";
import { SocketProvider } from "@/lib/socket";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <SocketProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </SocketProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
