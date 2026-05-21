"use client";

import "./globals.css";
import Providers from "./provider";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <DebugSession />
          {children}
        </Providers>
      </body>
    </html>
  );
}

function DebugSession() {
  const { data: session, status } = useSession();

  useEffect(() => {
    console.log("📦 Session Status:", status);
    console.log("👤 Session Data:", session);
  }, [session, status]);

  return null;
}
