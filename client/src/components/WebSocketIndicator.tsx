/**
 * WebSocket Connection Indicator
 * Shows real-time WebSocket connection status
 */

import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, Activity, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WebSocketIndicatorProps {
  isConnected: boolean;
  lastMessageTime?: number;
  reconnectAttempts?: number;
  onReconnect?: () => void;
  className?: string;
  showDetails?: boolean;
}

export function WebSocketIndicator({
  isConnected,
  lastMessageTime,
  reconnectAttempts = 0,
  onReconnect,
  className,
  showDetails = true,
}: WebSocketIndicatorProps) {
  const timeSinceLastMessage = lastMessageTime
    ? Date.now() - lastMessageTime
    : null;

  const getConnectionQuality = () => {
    if (!isConnected) return "disconnected";
    if (!timeSinceLastMessage) return "good";
    if (timeSinceLastMessage < 5000) return "good";
    if (timeSinceLastMessage < 15000) return "fair";
    return "poor";
  };

  const quality = getConnectionQuality();

  const statusConfig = {
    good: {
      icon: Wifi,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      borderColor: "border-green-500",
      label: "Connected",
      description: "Real-time updates active",
    },
    fair: {
      icon: Activity,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
      borderColor: "border-yellow-500",
      label: "Slow Connection",
      description: "Updates may be delayed",
    },
    poor: {
      icon: AlertCircle,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      borderColor: "border-orange-500",
      label: "Poor Connection",
      description: "Connection unstable",
    },
    disconnected: {
      icon: WifiOff,
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900/30",
      borderColor: "border-red-500",
      label: "Disconnected",
      description: reconnectAttempts > 0 
        ? `Reconnecting... (attempt ${reconnectAttempts})`
        : "No real-time updates",
    },
  };

  const config = statusConfig[quality];
  const Icon = config.icon;

  if (!showDetails) {
    // Simple badge version
    return (
      <Badge
        variant="outline"
        className={cn(
          "flex items-center gap-1.5 px-2 py-1",
          config.borderColor,
          config.bgColor,
          className
        )}
      >
        <motion.div
          animate={{
            scale: isConnected ? [1, 1.2, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: isConnected ? Infinity : 0,
            repeatType: "loop",
          }}
        >
          <Icon className={cn("h-3 w-3", config.color)} />
        </motion.div>
        <span className={cn("text-xs font-medium", config.color)}>
          {config.label}
        </span>
      </Badge>
    );
  }

  // Detailed popover version
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "flex items-center gap-2 px-3 py-1.5",
            config.borderColor,
            config.bgColor,
            className
          )}
        >
          <motion.div
            animate={{
              scale: isConnected ? [1, 1.2, 1] : 1,
              rotate: isConnected ? 0 : [0, -10, 10, -10, 0],
            }}
            transition={{
              scale: {
                duration: 2,
                repeat: isConnected ? Infinity : 0,
                repeatType: "loop",
              },
              rotate: {
                duration: 0.5,
                repeat: !isConnected ? Infinity : 0,
                repeatDelay: 2,
              },
            }}
          >
            <Icon className={cn("h-4 w-4", config.color)} />
          </motion.div>
          <span className={cn("text-sm font-medium", config.color)}>
            {config.label}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-1">WebSocket Connection</h4>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className={cn("font-medium", config.color)}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            {lastMessageTime && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last message:</span>
                <span className="font-medium">
                  {formatTimeSince(timeSinceLastMessage!)}
                </span>
              </div>
            )}

            {reconnectAttempts > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reconnect attempts:</span>
                <span className="font-medium">{reconnectAttempts}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-muted-foreground">Connection quality:</span>
              <span className={cn("font-medium", config.color)}>
                {quality.charAt(0).toUpperCase() + quality.slice(1)}
              </span>
            </div>
          </div>

          {!isConnected && onReconnect && (
            <Button onClick={onReconnect} className="w-full" size="sm">
              Reconnect Now
            </Button>
          )}

          <div className="pt-2 border-t text-xs text-muted-foreground">
            <p>
              Real-time updates for orders, payments, and device status are delivered
              through this WebSocket connection.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Format time since last message
 */
function formatTimeSince(ms: number): string {
  if (ms < 1000) return "just now";
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  return `${Math.floor(ms / 3600000)}h ago`;
}

/**
 * Connection Quality Bar
 * Visual representation of connection quality
 */
interface ConnectionQualityBarProps {
  quality: "good" | "fair" | "poor" | "disconnected";
  className?: string;
}

export function ConnectionQualityBar({ quality, className }: ConnectionQualityBarProps) {
  const bars = 4;
  const activeBars = {
    good: 4,
    fair: 3,
    poor: 2,
    disconnected: 0,
  }[quality];

  const barColor = {
    good: "bg-green-500",
    fair: "bg-yellow-500",
    poor: "bg-orange-500",
    disconnected: "bg-gray-300",
  }[quality];

  return (
    <div className={cn("flex items-end gap-0.5", className)}>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "w-1 rounded-sm transition-colors",
            i < activeBars ? barColor : "bg-gray-300 dark:bg-gray-700"
          )}
          style={{ height: `${(i + 1) * 4}px` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.1 }}
        />
      ))}
    </div>
  );
}
