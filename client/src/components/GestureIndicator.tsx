/**
 * Gesture Indicator Component
 * Provides visual feedback for gesture recognition
 */

import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, Hand, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface GestureIndicatorProps {
  detected: boolean;
  confidence: number;
  type?: "thumbs_up" | "pick_up";
  className?: string;
}

export function GestureIndicator({
  detected,
  confidence,
  type = "thumbs_up",
  className,
}: GestureIndicatorProps) {
  const Icon = type === "thumbs_up" ? ThumbsUp : Hand;
  const confidencePercent = Math.round(confidence);

  return (
    <motion.div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all",
        detected
          ? "bg-green-500/20 border-green-500 text-green-700 dark:text-green-400"
          : "bg-yellow-500/20 border-yellow-500 text-yellow-700 dark:text-yellow-400",
        className
      )}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="relative">
        <Icon className="h-6 w-6" />
        <AnimatePresence>
          {detected && (
            <motion.div
              className="absolute -top-1 -right-1"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <CheckCircle className="h-4 w-4 text-green-600 fill-green-100" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">
            {type === "thumbs_up" ? "Thumbs Up" : "Pick Up"} Gesture
          </span>
          <span className="text-xs font-semibold">{confidencePercent}%</span>
        </div>
        
        {/* Confidence Bar */}
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full transition-colors",
              detected ? "bg-green-500" : "bg-yellow-500"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${confidencePercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Payment State Machine Indicator
 * Shows the current state in the payment flow
 */

export type PaymentState = "S0_waiting" | "S1_approaching" | "S2_picked" | "S3_checkout" | "S4_completed";

interface StateMachineIndicatorProps {
  currentState: PaymentState;
  className?: string;
}

const stateInfo: Record<PaymentState, { label: string; color: string; icon: string }> = {
  S0_waiting: { label: "Waiting", color: "gray", icon: "⏳" },
  S1_approaching: { label: "Approaching", color: "blue", icon: "👋" },
  S2_picked: { label: "Picked Up", color: "yellow", icon: "✋" },
  S3_checkout: { label: "Checking Out", color: "orange", icon: "🛒" },
  S4_completed: { label: "Completed", color: "green", icon: "✅" },
};

export function StateMachineIndicator({ currentState, className }: StateMachineIndicatorProps) {
  const states: PaymentState[] = ["S0_waiting", "S1_approaching", "S2_picked", "S3_checkout", "S4_completed"];
  const currentIndex = states.indexOf(currentState);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-sm font-medium text-muted-foreground">Payment Flow</div>
      
      <div className="flex items-center gap-2">
        {states.map((state, index) => {
          const info = stateInfo[state];
          const isActive = state === currentState;
          const isPast = index < currentIndex;
          const isFuture = index > currentIndex;

          return (
            <div key={state} className="flex items-center flex-1">
              <motion.div
                className={cn(
                  "flex flex-col items-center gap-1 flex-1",
                  isActive && "scale-110"
                )}
                animate={{
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                {/* State Circle */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold border-2 transition-all",
                    isActive && info.color === "gray" && "bg-gray-100 border-gray-400 text-gray-700",
                    isActive && info.color === "blue" && "bg-blue-100 border-blue-500 text-blue-700",
                    isActive && info.color === "yellow" && "bg-yellow-100 border-yellow-500 text-yellow-700",
                    isActive && info.color === "orange" && "bg-orange-100 border-orange-500 text-orange-700",
                    isActive && info.color === "green" && "bg-green-100 border-green-500 text-green-700",
                    isPast && "bg-green-100 border-green-400 text-green-600",
                    isFuture && "bg-gray-100 border-gray-300 text-gray-400"
                  )}
                >
                  {info.icon}
                </div>

                {/* State Label */}
                <div
                  className={cn(
                    "text-xs text-center font-medium transition-colors",
                    isActive && "text-foreground",
                    isPast && "text-green-600",
                    isFuture && "text-muted-foreground"
                  )}
                >
                  {info.label}
                </div>
              </motion.div>

              {/* Connector Line */}
              {index < states.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 transition-colors",
                    isPast ? "bg-green-400" : "bg-gray-300"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Hand Tracking Overlay
 * Shows hand landmarks on video feed
 */

interface HandTrackingOverlayProps {
  landmarks?: Array<{ x: number; y: number; z: number }>;
  width: number;
  height: number;
  detected: boolean;
}

export function HandTrackingOverlay({
  landmarks,
  width,
  height,
  detected,
}: HandTrackingOverlayProps) {
  if (!landmarks || landmarks.length === 0) return null;

  // Hand landmark connections (MediaPipe hand model)
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // Index
    [0, 9], [9, 10], [10, 11], [11, 12], // Middle
    [0, 13], [13, 14], [14, 15], [15, 16], // Ring
    [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [5, 9], [9, 13], [13, 17], // Palm
  ];

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      width={width}
      height={height}
      style={{ zIndex: 10 }}
    >
      {/* Draw connections */}
      {connections.map(([start, end], index) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        if (!startPoint || !endPoint) return null;

        return (
          <line
            key={`connection-${index}`}
            x1={startPoint.x * width}
            y1={startPoint.y * height}
            x2={endPoint.x * width}
            y2={endPoint.y * height}
            stroke={detected ? "#22c55e" : "#eab308"}
            strokeWidth="2"
            opacity="0.8"
          />
        );
      })}

      {/* Draw landmarks */}
      {landmarks.map((landmark, index) => (
        <circle
          key={`landmark-${index}`}
          cx={landmark.x * width}
          cy={landmark.y * height}
          r={index === 0 || index === 4 || index === 8 || index === 12 || index === 16 || index === 20 ? 6 : 4}
          fill={detected ? "#22c55e" : "#eab308"}
          opacity="0.9"
        />
      ))}
    </svg>
  );
}
