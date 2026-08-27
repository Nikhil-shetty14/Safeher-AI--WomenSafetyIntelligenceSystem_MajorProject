import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

const DEFAULT_SOCKET_HOST = "http://10.165.16.100:8000";

const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  DEFAULT_SOCKET_HOST;

console.log("SafeHer socket host:", SOCKET_URL);

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  sendLocation: (lat: number, lng: number, accuracy?: number) => void;
  emitSOS: (location: any, severity?: string) => void;
  dangerAlerts: any[];
  broadcasts: any[];
  clearBroadcast: (id: string) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [dangerAlerts, setDangerAlerts] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 20000,
    });

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("register_user", { user_id: user.id, role: user.role });
    });

    socket.on("disconnect", () => setIsConnected(false));

    socket.on("connect_error", (err) => {
      console.warn("Socket connect_error:", err);
    });

    socket.on("danger_alert", (alert) => {
      setDangerAlerts((prev) => [alert, ...prev]);
    });

    socket.on("emergency_broadcast", (broadcast) => {
      setBroadcasts((prev) => {
        // Prevent duplicates
        if (prev.find(b => b._id === broadcast._id)) return prev;
        return [broadcast, ...prev];
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, user?.id]);

  const sendLocation = (lat: number, lng: number, accuracy?: number) => {
    socketRef.current?.emit("location_update", {
      user_id: user?.id,
      latitude: lat,
      longitude: lng,
      accuracy,
    });
  };

  const emitSOS = (location: any, severity = "high") => {
    socketRef.current?.emit("sos_triggered", {
      user_id: user?.id,
      location,
      severity,
    });
  };

  const clearBroadcast = (id: string) => {
    setBroadcasts(prev => prev.filter(b => b._id !== id));
  };

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        sendLocation,
        emitSOS,
        dangerAlerts,
        broadcasts,
        clearBroadcast,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
};
