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

const DEFAULT_SOCKET_HOST =
  Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://127.0.0.1:8000";

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
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [dangerAlerts, setDangerAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
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

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        sendLocation,
        emitSOS,
        dangerAlerts,
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
