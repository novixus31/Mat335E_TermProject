"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect if user is authenticated (admin or user) and has accessToken
    if (session?.user?.accessToken) {
      const socketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:9092";

      console.log("🔌 Connecting to Socket.IO at:", socketUrl);

      const socketInstance = io(socketUrl, {
        auth: {
          token: session.user.accessToken,
        },
        transports: ["websocket", "polling"],
      });

      // Debug: Listen to ALL socket events
      socketInstance.onAny((eventName, ...args) => {
        console.log(`🔔 [SOCKET] Event "${eventName}" received:`, args);
        if (args[0]?.accountUnreadCount !== undefined) {
          console.log('✅ [SOCKET] accountUnreadCount found:', args[0].accountUnreadCount);
        }
        if (args[0]?.chatUnreadCount !== undefined) {
          console.log('✅ [SOCKET] chatUnreadCount found:', args[0].chatUnreadCount);
        }
      });

      socketInstance.on("connect", () => {
        console.log("✅ Socket.IO connected:", socketInstance.id);
        setIsConnected(true);

        // Debug: Make socket globally accessible for testing
        if (typeof window !== 'undefined') {
          (window as typeof window & { socket: Socket }).socket = socketInstance;
          console.log("🔍 Socket available at window.socket for debugging");
        }

        // Authenticate based on role
        if (session.user.role === "admin" || session.user.role === "manager") {
          console.log(`🔐 Sending admin_connect event with token (role: ${session.user.role})`);
          socketInstance.emit("admin_connect", { token: session.user.accessToken });
        } else {
          console.log("🔐 Sending user_connect event with token");
          socketInstance.emit("user_connect", { token: session.user.accessToken });
        }
      });

      socketInstance.on("disconnect", () => {
        console.log("❌ Socket.IO disconnected");
        setIsConnected(false);
      });

      socketInstance.on("connect_error", (error) => {
        console.error("🔴 Socket.IO connection error:", error);
      });

      setSocket(socketInstance);

      return () => {
        console.log("🔌 Disconnecting Socket.IO");
        socketInstance.disconnect();
      };
    }
  }, [session]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
