import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

export interface WebSocketMessage {
  type: "order_update" | "device_status" | "payment_status" | "gesture_event" | "connection" | "registered" | "pong";
  data: any;
  timestamp: number;
}

interface UseWebSocketOptions {
  url?: string;
  userId?: number;
  deviceId?: number;
  merchantId?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onOrderUpdate?: (data: any) => void;
  onPaymentStatus?: (data: any) => void;
  onDeviceStatus?: (data: any) => void;
  onGestureEvent?: (data: any) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = `ws://${window.location.host}/ws`,
    userId,
    deviceId,
    merchantId,
    onMessage,
    onOrderUpdate,
    onPaymentStatus,
    onDeviceStatus,
    onGestureEvent,
    autoReconnect = true,
    reconnectInterval = 3000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("[WebSocket] Connected");
        setIsConnected(true);
        
        // Register client
        if (userId || deviceId || merchantId) {
          ws.send(
            JSON.stringify({
              type: "register",
              userId,
              deviceId,
              merchantId,
            })
          );
        }

        // Start heartbeat
        const heartbeatInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);

        ws.addEventListener("close", () => {
          clearInterval(heartbeatInterval);
        });
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          // Call general message handler
          if (onMessage) {
            onMessage(message);
          }

          // Call specific handlers
          switch (message.type) {
            case "order_update":
              if (onOrderUpdate) {
                onOrderUpdate(message.data);
              }
              break;
            case "payment_status":
              if (onPaymentStatus) {
                onPaymentStatus(message.data);
              }
              // Show toast notification
              if (message.data.status === "success") {
                toast.success("Payment successful!");
              } else if (message.data.status === "failed") {
                toast.error("Payment failed");
              }
              break;
            case "device_status":
              if (onDeviceStatus) {
                onDeviceStatus(message.data);
              }
              break;
            case "gesture_event":
              if (onGestureEvent) {
                onGestureEvent(message.data);
              }
              break;
            case "connection":
              console.log("[WebSocket]", message.data.message);
              break;
            case "registered":
              console.log("[WebSocket] Client registered");
              break;
            case "pong":
              // Heartbeat response
              break;
          }
        } catch (error) {
          console.error("[WebSocket] Failed to parse message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
      };

      ws.onclose = () => {
        console.log("[WebSocket] Disconnected");
        setIsConnected(false);
        wsRef.current = null;

        // Auto reconnect
        if (autoReconnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[WebSocket] Attempting to reconnect...");
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("[WebSocket] Connection error:", error);
    }
  }, [url, userId, deviceId, merchantId, onMessage, onOrderUpdate, onPaymentStatus, onDeviceStatus, onGestureEvent, autoReconnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("[WebSocket] Cannot send message: not connected");
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
  };
}
