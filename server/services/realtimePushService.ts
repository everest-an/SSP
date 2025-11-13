/**
 * Real-time Push Service
 * 
 * Handles WebSocket connections and real-time notifications for:
 * - Order status updates
 * - Payment confirmations
 * - Device events
 * - User notifications
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { nanoid } from 'nanoid';

/**
 * Event types
 */
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

/**
 * Real-time event
 */
export interface RealtimeEvent {
  type: EventType;
  id: string;
  timestamp: number;
  data: Record<string, any>;
  userId?: number;
  deviceId?: number;
  orderId?: number;
}

/**
 * WebSocket connection info
 */
interface ConnectionInfo {
  id: string;
  ws: WebSocket;
  userId?: number;
  deviceId?: number;
  merchantId?: number;
  subscribedEvents: Set<EventType>;
  isAlive: boolean;
}

/**
 * Real-time Push Service
 */
export class RealtimePushService {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, ConnectionInfo> = new Map();
  private eventHistory: Map<string, RealtimeEvent[]> = new Map();
  private maxHistorySize = 100;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleNewConnection(ws);
    });
    
    // Start heartbeat
    this.startHeartbeat();
    
    console.log('[RealtimePush] WebSocket server initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleNewConnection(ws: WebSocket): void {
    const connectionId = nanoid();
    const connectionInfo: ConnectionInfo = {
      id: connectionId,
      ws,
      subscribedEvents: new Set(),
      isAlive: true,
    };
    
    this.connections.set(connectionId, connectionInfo);
    
    console.log(`[RealtimePush] New connection: ${connectionId}`);
    
    // Handle messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(connectionId, message);
      } catch (error) {
        console.error('[RealtimePush] Message parse error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    });
    
    // Handle pong (heartbeat response)
    ws.on('pong', () => {
      const conn = this.connections.get(connectionId);
      if (conn) {
        conn.isAlive = true;
      }
    });
    
    // Handle close
    ws.on('close', () => {
      this.connections.delete(connectionId);
      console.log(`[RealtimePush] Connection closed: ${connectionId}`);
    });
    
    // Handle error
    ws.on('error', (error) => {
      console.error(`[RealtimePush] Connection error: ${connectionId}`, error);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      connectionId,
      timestamp: Date.now(),
    }));
  }

  /**
   * Handle incoming message
   */
  private handleMessage(connectionId: string, message: any): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;
    
    const { type, userId, deviceId, merchantId, events } = message;
    
    switch (type) {
      case 'auth':
        // Authenticate connection
        conn.userId = userId;
        conn.deviceId = deviceId;
        conn.merchantId = merchantId;
        conn.ws.send(JSON.stringify({
          type: 'auth_success',
          connectionId,
        }));
        break;
        
      case 'subscribe':
        // Subscribe to events
        if (Array.isArray(events)) {
          events.forEach((event: string) => {
            conn.subscribedEvents.add(event as EventType);
          });
        }
        conn.ws.send(JSON.stringify({
          type: 'subscribed',
          events: Array.from(conn.subscribedEvents),
        }));
        break;
        
      case 'unsubscribe':
        // Unsubscribe from events
        if (Array.isArray(events)) {
          events.forEach((event: string) => {
            conn.subscribedEvents.delete(event as EventType);
          });
        }
        break;
        
      case 'get_history':
        // Get event history
        const eventType = message.eventType as EventType;
        const history = this.eventHistory.get(eventType) || [];
        conn.ws.send(JSON.stringify({
          type: 'history',
          eventType,
          events: history,
        }));
        break;
        
      default:
        console.warn(`[RealtimePush] Unknown message type: ${type}`);
    }
  }

  /**
   * Broadcast event to subscribed connections
   */
  broadcast(event: RealtimeEvent): void {
    const eventData = JSON.stringify(event);
    
    // Store in history
    if (!this.eventHistory.has(event.type)) {
      this.eventHistory.set(event.type, []);
    }
    const history = this.eventHistory.get(event.type)!;
    history.push(event);
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
    
    // Send to subscribed connections
    for (const [, conn] of this.connections) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        // Check if connection should receive this event
        if (this.shouldReceiveEvent(conn, event)) {
          conn.ws.send(eventData);
        }
      }
    }
  }

  /**
   * Send event to specific user
   */
  sendToUser(userId: number, event: RealtimeEvent): void {
    for (const [, conn] of this.connections) {
      if (conn.userId === userId && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify(event));
      }
    }
  }

  /**
   * Send event to specific device
   */
  sendToDevice(deviceId: number, event: RealtimeEvent): void {
    for (const [, conn] of this.connections) {
      if (conn.deviceId === deviceId && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify(event));
      }
    }
  }

  /**
   * Send event to specific merchant
   */
  sendToMerchant(merchantId: number, event: RealtimeEvent): void {
    for (const [, conn] of this.connections) {
      if (conn.merchantId === merchantId && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify(event));
      }
    }
  }

  /**
   * Check if connection should receive event
   */
  private shouldReceiveEvent(conn: ConnectionInfo, event: RealtimeEvent): boolean {
    // Check if subscribed to this event type
    if (!conn.subscribedEvents.has(event.type)) {
      return false;
    }
    
    // Check if event is relevant to connection
    if (event.userId && conn.userId !== event.userId) {
      return false;
    }
    
    if (event.deviceId && conn.deviceId !== event.deviceId) {
      return false;
    }
    
    return true;
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [connectionId, conn] of this.connections) {
        if (!conn.isAlive) {
          console.log(`[RealtimePush] Terminating dead connection: ${connectionId}`);
          conn.ws.terminate();
          this.connections.delete(connectionId);
        } else {
          conn.isAlive = false;
          conn.ws.ping();
        }
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get connections by merchant
   */
  getConnectionsByMerchant(merchantId: number): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(
      conn => conn.merchantId === merchantId
    );
  }

  /**
   * Get connections by user
   */
  getConnectionsByUser(userId: number): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(
      conn => conn.userId === userId
    );
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.stopHeartbeat();
    
    for (const [, conn] of this.connections) {
      conn.ws.close();
    }
    
    this.connections.clear();
    this.eventHistory.clear();
    
    if (this.wss) {
      this.wss.close();
    }
    
    console.log('[RealtimePush] Service cleaned up');
  }
}

/**
 * Create event helper
 */
export function createEvent(
  type: EventType,
  data: Record<string, any>,
  userId?: number,
  deviceId?: number,
  orderId?: number
): RealtimeEvent {
  return {
    type,
    id: nanoid(),
    timestamp: Date.now(),
    data,
    userId,
    deviceId,
    orderId,
  };
}

// Export singleton instance
export const realtimePushService = new RealtimePushService();
