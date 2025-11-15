/**
 * WebSocket Service for Real-time Communication
 * 
 * This module provides WebSocket server functionality for real-time
 * bidirectional communication between clients (devices, users, merchants)
 * and the server.
 * 
 * Features:
 * - Client connection management
 * - Message broadcasting
 * - Targeted messaging (by user, device, or merchant)
 * - Order and payment status notifications
 * - Heartbeat/ping-pong mechanism
 * 
 * @module server/websocket
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

/**
 * WebSocket message types
 */
export type WebSocketMessageType = 
  | 'order_update'      // Order status changed
  | 'device_status'     // Device online/offline status
  | 'payment_status'    // Payment success/failure
  | 'gesture_event'     // Gesture detected
  | 'connection'        // Connection established
  | 'registered'        // Client registered
  | 'ping'              // Heartbeat request
  | 'pong';             // Heartbeat response

/**
 * Standard WebSocket message format
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
  timestamp: number;
}

/**
 * Client connection information
 * Stores metadata about each connected WebSocket client
 */
export interface ClientConnection {
  ws: WebSocket;           // WebSocket instance
  userId?: number;         // User ID (if authenticated)
  deviceId?: number;       // Device ID (for POS devices)
  merchantId?: number;     // Merchant ID (for merchant dashboard)
  connectedAt: number;     // Connection timestamp
}

/**
 * WebSocket Service Class
 * 
 * Manages WebSocket server lifecycle, client connections,
 * and message distribution.
 */
class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientConnection> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server
   * 
   * Attaches WebSocket server to existing HTTP server and sets up
   * event handlers for connection, message, and error events.
   * 
   * @param server - HTTP server instance
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      // Verify origin in production
      verifyClient: (info: any) => {
        // TODO: Add origin verification for production
        return true;
      }
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      const clientIp = req.socket.remoteAddress;
      
      console.log(`[WebSocket] Client connected: ${clientId} from ${clientIp}`);

      // Store client connection
      this.clients.set(clientId, { 
        ws, 
        connectedAt: Date.now() 
      });

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
          this.sendError(clientId, 'Invalid message format');
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        const client = this.clients.get(clientId);
        const duration = client ? Date.now() - client.connectedAt : 0;
        console.log(`[WebSocket] Client disconnected: ${clientId} (connected for ${Math.round(duration / 1000)}s)`);
        this.clients.delete(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`[WebSocket] Client error (${clientId}):`, error);
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection',
        data: { 
          clientId, 
          message: 'Connected to SSP WebSocket server',
          serverTime: Date.now()
        },
        timestamp: Date.now(),
      });
    });

    // Start heartbeat mechanism
    this.startHeartbeat();

    console.log('[WebSocket] Server initialized on path /ws');
  }

  /**
   * Generate unique client ID
   * 
   * Creates a unique identifier for each client connection
   * using timestamp and random string.
   * 
   * @returns Unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle incoming client message
   * 
   * Processes messages from clients and performs appropriate actions
   * based on message type.
   * 
   * @param clientId - Client identifier
   * @param message - Parsed message object
   */
  private handleClientMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Handle client registration
    if (message.type === 'register') {
      // Store client metadata
      if (message.userId) client.userId = message.userId;
      if (message.deviceId) client.deviceId = message.deviceId;
      if (message.merchantId) client.merchantId = message.merchantId;
      
      console.log(`[WebSocket] Client registered:`, {
        clientId,
        userId: client.userId,
        deviceId: client.deviceId,
        merchantId: client.merchantId,
      });

      this.sendToClient(clientId, {
        type: 'registered',
        data: { 
          success: true,
          userId: client.userId,
          deviceId: client.deviceId,
          merchantId: client.merchantId
        },
        timestamp: Date.now(),
      });
      return;
    }

    // Handle ping/pong heartbeat
    if (message.type === 'ping') {
      this.sendToClient(clientId, {
        type: 'pong',
        data: { serverTime: Date.now() },
        timestamp: Date.now(),
      });
      return;
    }

    // Log unhandled message types
    console.log(`[WebSocket] Unhandled message type: ${message.type}`, message);
  }

  /**
   * Send message to specific client
   * 
   * @param clientId - Client identifier
   * @param message - Message to send
   */
  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[WebSocket] Failed to send message to ${clientId}:`, error);
    }
  }

  /**
   * Send error message to client
   * 
   * @param clientId - Client identifier
   * @param errorMessage - Error description
   */
  private sendError(clientId: string, errorMessage: string): void {
    this.sendToClient(clientId, {
      type: 'connection',
      data: { error: errorMessage },
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast message to all connected clients
   * 
   * @param message - Message to broadcast
   */
  broadcast(message: WebSocketMessage): void {
    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, message);
        sentCount++;
      }
    });
    console.log(`[WebSocket] Broadcast to ${sentCount} clients`);
  }

  /**
   * Send message to specific user
   * 
   * Sends message to all connections associated with a user ID.
   * Useful for notifying users across multiple devices.
   * 
   * @param userId - User identifier
   * @param message - Message to send
   */
  sendToUser(userId: number, message: WebSocketMessage): void {
    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, message);
        sentCount++;
      }
    });
    if (sentCount > 0) {
      console.log(`[WebSocket] Sent to user ${userId} (${sentCount} connections)`);
    }
  }

  /**
   * Send message to specific device
   * 
   * Sends message to all connections associated with a device ID.
   * Useful for device-specific notifications.
   * 
   * @param deviceId - Device identifier
   * @param message - Message to send
   */
  sendToDevice(deviceId: number, message: WebSocketMessage): void {
    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      if (client.deviceId === deviceId && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, message);
        sentCount++;
      }
    });
    if (sentCount > 0) {
      console.log(`[WebSocket] Sent to device ${deviceId} (${sentCount} connections)`);
    }
  }

  /**
   * Send message to merchant
   * 
   * Sends message to all connections associated with a merchant ID.
   * Useful for merchant dashboard updates.
   * 
   * @param merchantId - Merchant identifier
   * @param message - Message to send
   */
  sendToMerchant(merchantId: number, message: WebSocketMessage): void {
    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      if (client.merchantId === merchantId && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, message);
        sentCount++;
      }
    });
    if (sentCount > 0) {
      console.log(`[WebSocket] Sent to merchant ${merchantId} (${sentCount} connections)`);
    }
  }

  /**
   * Notify order update
   * 
   * Sends order status update to relevant parties (merchant and user).
   * 
   * @param orderId - Order identifier
   * @param orderData - Order data to send
   * @param merchantId - Optional merchant ID
   * @param userId - Optional user ID
   */
  notifyOrderUpdate(
    orderId: number, 
    orderData: any, 
    merchantId?: number, 
    userId?: number
  ): void {
    const message: WebSocketMessage = {
      type: 'order_update',
      data: {
        orderId,
        ...orderData,
      },
      timestamp: Date.now(),
    };

    if (merchantId) {
      this.sendToMerchant(merchantId, message);
    }
    if (userId) {
      this.sendToUser(userId, message);
    }
  }

  /**
   * Notify device status change
   * 
   * Sends device status update to merchant dashboard.
   * 
   * @param deviceId - Device identifier
   * @param status - Device status (online/offline/error)
   * @param merchantId - Optional merchant ID
   */
  notifyDeviceStatus(
    deviceId: number, 
    status: string, 
    merchantId?: number
  ): void {
    const message: WebSocketMessage = {
      type: 'device_status',
      data: {
        deviceId,
        status,
      },
      timestamp: Date.now(),
    };

    if (merchantId) {
      this.sendToMerchant(merchantId, message);
    }
  }

  /**
   * Notify payment status
   * 
   * Sends payment result notification to user and merchant.
   * 
   * @param orderId - Order identifier
   * @param status - Payment status (success/failed/pending)
   * @param userId - Optional user ID
   * @param merchantId - Optional merchant ID
   */
  notifyPaymentStatus(
    orderId: number, 
    status: string, 
    userId?: number, 
    merchantId?: number
  ): void {
    const message: WebSocketMessage = {
      type: 'payment_status',
      data: {
        orderId,
        status,
      },
      timestamp: Date.now(),
    };

    if (userId) {
      this.sendToUser(userId, message);
    }
    if (merchantId) {
      this.sendToMerchant(merchantId, message);
    }
  }

  /**
   * Notify gesture event
   * 
   * Sends gesture detection event to device.
   * 
   * @param deviceId - Device identifier
   * @param gestureData - Gesture data
   */
  notifyGestureEvent(deviceId: number, gestureData: any): void {
    const message: WebSocketMessage = {
      type: 'gesture_event',
      data: {
        deviceId,
        ...gestureData,
      },
      timestamp: Date.now(),
    };

    this.sendToDevice(deviceId, message);
  }

  /**
   * Start heartbeat mechanism
   * 
   * Periodically checks connection health and removes stale connections.
   */
  private startHeartbeat(): void {
    // Check every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      let closedCount = 0;

      this.clients.forEach((client, clientId) => {
        // Close connections that are not in OPEN state
        if (client.ws.readyState !== WebSocket.OPEN) {
          this.clients.delete(clientId);
          closedCount++;
        }
      });

      if (closedCount > 0) {
        console.log(`[WebSocket] Cleaned up ${closedCount} stale connections`);
      }
    }, 30000);
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get connected clients count
   * 
   * @returns Number of connected clients
   */
  getClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients statistics by type
   * 
   * @returns Object with counts of users, devices, and merchants
   */
  getClientsByType(): { users: number; devices: number; merchants: number; total: number } {
    let users = 0;
    let devices = 0;
    let merchants = 0;

    this.clients.forEach((client) => {
      if (client.userId) users++;
      if (client.deviceId) devices++;
      if (client.merchantId) merchants++;
    });

    return { users, devices, merchants, total: this.clients.size };
  }

  /**
   * Shutdown WebSocket server
   * 
   * Gracefully closes all connections and stops the server.
   */
  shutdown(): void {
    console.log('[WebSocket] Shutting down server...');
    
    this.stopHeartbeat();

    // Close all client connections
    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1000, 'Server shutting down');
      }
    });

    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close(() => {
        console.log('[WebSocket] Server closed');
      });
    }
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
