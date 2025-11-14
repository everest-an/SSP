/**
 * Notification Center Component
 * Displays real-time notifications from WebSocket
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCircle, XCircle, AlertCircle, Package, CreditCard, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { WebSocketMessage } from "@/hooks/useWebSocket";

interface Notification {
  id: string;
  type: "order" | "payment" | "device" | "gesture" | "system";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  severity: "info" | "success" | "warning" | "error";
  data?: any;
}

interface NotificationCenterProps {
  messages: WebSocketMessage[];
  maxNotifications?: number;
  className?: string;
}

export function NotificationCenter({
  messages,
  maxNotifications = 50,
  className,
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Convert WebSocket messages to notifications
  useEffect(() => {
    if (messages.length === 0) return;

    const latestMessage = messages[messages.length - 1];
    const notification = convertMessageToNotification(latestMessage);

    if (notification) {
      setNotifications((prev) => {
        const updated = [notification, ...prev];
        return updated.slice(0, maxNotifications);
      });
    }
  }, [messages, maxNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn("relative", className)}
        >
          <Bell className="h-4 w-4" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.div
                className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold">Notifications</h3>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "All caught up!"}
            </p>
          </div>
          {notifications.length > 0 && (
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-xs"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Bell className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground text-center">
                No notifications yet
              </p>
              <p className="text-xs text-muted-foreground text-center mt-1">
                You'll see real-time updates here
              </p>
            </div>
          ) : (
            <div className="divide-y">
              <AnimatePresence>
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={markAsRead}
                    onDelete={deleteNotification}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Individual Notification Item
 */
interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotificationItem({ notification, onRead, onDelete }: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.type) {
      case "order":
        return Package;
      case "payment":
        return CreditCard;
      case "device":
        return AlertCircle;
      default:
        return Bell;
    }
  };

  const getIconColor = () => {
    switch (notification.severity) {
      case "success":
        return "text-green-600";
      case "error":
        return "text-red-600";
      case "warning":
        return "text-yellow-600";
      default:
        return "text-blue-600";
    }
  };

  const Icon = getIcon();

  return (
    <motion.div
      className={cn(
        "p-4 hover:bg-accent/50 transition-colors cursor-pointer",
        !notification.read && "bg-accent/30"
      )}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      onClick={() => onRead(notification.id)}
    >
      <div className="flex gap-3">
        <div className={cn("mt-0.5", getIconColor())}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-sm font-medium">{notification.title}</h4>
            {!notification.read && (
              <Badge variant="default" className="h-2 w-2 p-0 rounded-full" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">{notification.message}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(notification.timestamp)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notification.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Convert WebSocket message to notification
 */
function convertMessageToNotification(message: WebSocketMessage): Notification | null {
  const id = `${message.type}_${message.timestamp}_${Math.random()}`;

  switch (message.type) {
    case "order_update":
      return {
        id,
        type: "order",
        title: "Order Update",
        message: `Order #${message.data.orderId} status: ${message.data.status}`,
        timestamp: message.timestamp,
        read: false,
        severity: message.data.status === "completed" ? "success" : "info",
        data: message.data,
      };

    case "payment_status":
      return {
        id,
        type: "payment",
        title: message.data.status === "success" ? "Payment Successful" : "Payment Failed",
        message:
          message.data.status === "success"
            ? `Payment for order #${message.data.orderId} completed`
            : `Payment for order #${message.data.orderId} failed`,
        timestamp: message.timestamp,
        read: false,
        severity: message.data.status === "success" ? "success" : "error",
        data: message.data,
      };

    case "device_status":
      return {
        id,
        type: "device",
        title: "Device Status",
        message: `Device #${message.data.deviceId} is ${message.data.status}`,
        timestamp: message.timestamp,
        read: false,
        severity: message.data.status === "online" ? "success" : "warning",
        data: message.data,
      };

    case "gesture_event":
      return {
        id,
        type: "gesture",
        title: "Gesture Detected",
        message: `Gesture detected on device #${message.data.deviceId}`,
        timestamp: message.timestamp,
        read: false,
        severity: "info",
        data: message.data,
      };

    default:
      return null;
  }
}

/**
 * Format timestamp to relative time
 */
function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}
