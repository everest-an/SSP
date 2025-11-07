import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export interface WebSocketMessage {
  type: 'order_update' | 'device_status' | 'payment_status' | 'gesture_event';
  data: any;
  timestamp: number;
}

export interface ClientConnection {
  ws: WebSocket;
  userId?: number;
  deviceId?: number;
  merchantId?: number;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientConnection> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      console.log(`[WebSocket] Client connected: ${clientId}`);

      this.clients.set(clientId, { ws });

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        console.log(`[WebSocket] Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`[WebSocket] Client error (${clientId}):`, error);
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection',
        data: { clientId, message: 'Connected to SSP WebSocket server' },
        timestamp: Date.now(),
      });
    });

    console.log('[WebSocket] Server initialized');
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleClientMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Handle authentication/registration
    if (message.type === 'register') {
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
        data: { success: true },
        timestamp: Date.now(),
      });
    }

    // Handle ping/pong
    if (message.type === 'ping') {
      this.sendToClient(clientId, {
        type: 'pong',
        data: {},
        timestamp: Date.now(),
      });
    }
  }

  private sendToClient(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[WebSocket] Failed to send message to ${clientId}:`, error);
    }
  }

  // Broadcast to all clients
  broadcast(message: WebSocketMessage) {
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, message);
    });
  }

  // Send to specific user
  sendToUser(userId: number, message: WebSocketMessage) {
    this.clients.forEach((client, clientId) => {
      if (client.userId === userId) {
        this.sendToClient(clientId, message);
      }
    });
  }

  // Send to specific device
  sendToDevice(deviceId: number, message: WebSocketMessage) {
    this.clients.forEach((client, clientId) => {
      if (client.deviceId === deviceId) {
        this.sendToClient(clientId, message);
      }
    });
  }

  // Send to merchant (all devices and users)
  sendToMerchant(merchantId: number, message: WebSocketMessage) {
    this.clients.forEach((client, clientId) => {
      if (client.merchantId === merchantId) {
        this.sendToClient(clientId, message);
      }
    });
  }

  // Notify order update
  notifyOrderUpdate(orderId: number, orderData: any, merchantId?: number, userId?: number) {
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

  // Notify device status change
  notifyDeviceStatus(deviceId: number, status: string, merchantId?: number) {
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

  // Notify payment status
  notifyPaymentStatus(orderId: number, status: string, userId?: number, merchantId?: number) {
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

  // Notify gesture event
  notifyGestureEvent(deviceId: number, gestureData: any) {
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

  // Get connected clients count
  getClientsCount(): number {
    return this.clients.size;
  }

  // Get clients by type
  getClientsByType(): { users: number; devices: number; merchants: number } {
    let users = 0;
    let devices = 0;
    let merchants = 0;

    this.clients.forEach((client) => {
      if (client.userId) users++;
      if (client.deviceId) devices++;
      if (client.merchantId) merchants++;
    });

    return { users, devices, merchants };
  }
}

export const wsService = new WebSocketService();
