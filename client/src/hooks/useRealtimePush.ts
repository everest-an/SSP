/**
 * useRealtimePush Hook
 * 
 * Manages WebSocket connection for real-time updates:
 * - Order status updates
 * - Payment confirmations
 * - Device events
 * - User notifications
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export enum EventType {
  ORDER_CREATED = 'order:created',
  ORDER_UPDATED = 'order:updated',
  ORDER_COMPLETED = 'order:completed',
  ORDER_FAILED = 'order:failed',
  ORDER_CANCELLED = 'order:cancelled',
  PAYMENT_PENDING = 'payment:pending',
  PAYMENT_SUCCESS = 'payment:success',
  PAYMENT_FAILED = 'payment:failed',
  DEVICE_ONLINE = 'device:online',
  DEVICE_OFFLINE = 'device:offline',
  DEVICE_ERROR = 'device:error',
  USER_NOTIFICATION = 'user:notification',
  FACE_VERIFIED = 'face:verified',
  FACE_FAILED = 'face:failed',
}

export interface RealtimeEvent {
  type: EventType;
  id: string;
  timestamp: number;
  data: Record<string, any>;
  userId?: number;
  deviceId?: number;
  orderId?: number;
}

export interface UseRealtimePushOptions {
  userId?: number;
  deviceId?: number;
  merchantId?: number;
  autoConnect?: boolean;
  events?: EventType[];
}

export function useRealtimePush(options: UseRealtimePushOptions = {}) {
  const {
    userId,
    deviceId,
    merchantId,
    autoConnect = true,
    events = [],
  } = options;

  const [connected, setConnected] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventListenersRef = useRef<Map<EventType, Set<(event: RealtimeEvent) => void>>>(
    new Map()
  );

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('[RealtimePush] Connected');
        
        // Authenticate
        ws.send(JSON.stringify({
          type: 'auth',
          userId,
          deviceId,
          merchantId,
        }));
        
        // Subscribe to events
        if (events.length > 0) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            events,
          }));
        }
        
        setConnected(true);
        setError(null);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'connected') {
            setConnectionId(message.connectionId);
          } else if (message.type === 'auth_success') {
            console.log('[RealtimePush] Authenticated');
          } else if (message.type === 'subscribed') {
            console.log('[RealtimePush] Subscribed to events:', message.events);
          } else if (message.type === 'history') {
            // Handle history
            console.log('[RealtimePush] Received history:', message.events);
          } else if (message.type === 'error') {
            console.error('[RealtimePush] Server error:', message.message);
            setError(message.message);
          } else {
            // Regular event
            const realtimeEvent = message as RealtimeEvent;
            setLastEvent(realtimeEvent);
            
            // Call registered listeners
            const listeners = eventListenersRef.current.get(realtimeEvent.type);
            if (listeners) {
              listeners.forEach(listener => listener(realtimeEvent));
            }
          }
        } catch (error) {
          console.error('[RealtimePush] Message parse error:', error);
        }
      };
      
      ws.onerror = (event) => {
        console.error('[RealtimePush] WebSocket error:', event);
        setError('Connection error');
      };
      
      ws.onclose = () => {
        console.log('[RealtimePush] Disconnected');
        setConnected(false);
        wsRef.current = null;
        
        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[RealtimePush] Attempting to reconnect...');
          connect();
        }, 5000);
      };
      
      wsRef.current = ws;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Connection failed';
      console.error('[RealtimePush] Connection error:', error);
      setError(errorMsg);
    }
  }, [userId, deviceId, merchantId, events]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
  }, []);

  // Subscribe to event type
  const on = useCallback((eventType: EventType, listener: (event: RealtimeEvent) => void) => {
    if (!eventListenersRef.current.has(eventType)) {
      eventListenersRef.current.set(eventType, new Set());
    }
    
    const listeners = eventListenersRef.current.get(eventType)!;
    listeners.add(listener);
    
    // If already connected, subscribe to this event
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        events: [eventType],
      }));
    }
    
    // Return unsubscribe function
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Unsubscribe from event type
  const off = useCallback((eventType: EventType) => {
    eventListenersRef.current.delete(eventType);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        events: [eventType],
      }));
    }
  }, []);

  // Get event history
  const getHistory = useCallback((eventType: EventType) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'get_history',
        eventType,
      }));
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connected,
    connectionId,
    lastEvent,
    error,
    connect,
    disconnect,
    on,
    off,
    getHistory,
  };
}
