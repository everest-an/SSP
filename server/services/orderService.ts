/**
 * Order Management Service
 * 
 * Handles:
 * - Order creation and validation
 * - Order status tracking
 * - Payment processing
 * - Stock management
 * - Order lifecycle management
 */

import { db } from '../_core/db';
import { orders, orderItems, products, transactions } from '../_core/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Order status types
 */
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded';

/**
 * Order with items
 */
export interface OrderWithItems {
  id: number;
  orderNumber: string;
  merchantId: number;
  deviceId?: number;
  customerId?: number;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  paymentMethod?: string;
  paymentStatus: PaymentStatus;
  items: Array<{
    id: number;
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Order creation input
 */
export interface CreateOrderInput {
  merchantId: number;
  deviceId?: number;
  customerId?: number;
  items: Array<{
    productId: number;
    quantity: number;
  }>;
  paymentMethod?: string;
  metadata?: Record<string, any>;
}

/**
 * Create order with items
 */
export async function createOrderWithItems(
  input: CreateOrderInput
): Promise<OrderWithItems> {
  try {
    const { merchantId, deviceId, customerId, items, paymentMethod } = input;
    
    // Validate items
    if (!items || items.length === 0) {
      throw new Error('Order must contain at least one item');
    }
    
    // Calculate total and validate products
    let totalAmount = 0;
    const validatedItems = [];
    
    for (const item of items) {
      const product = await db.query.products.findFirst({
        where: eq(products.id, item.productId),
      });
      
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      
      if (product.status !== 'active') {
        throw new Error(`Product "${product.name}" is not available`);
      }
      
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for "${product.name}"`);
      }
      
      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;
      
      validatedItems.push({
        ...item,
        productName: product.name,
        unitPrice: product.price,
        totalPrice: itemTotal,
        currency: product.currency,
      });
    }
    
    // Create order
    const orderNumber = `ORD-${nanoid(10)}`;
    const orderResult = await db.insert(orders).values({
      merchantId,
      deviceId,
      customerId,
      orderNumber,
      totalAmount,
      currency: validatedItems[0].currency,
      status: 'pending',
      paymentMethod,
      paymentStatus: 'pending',
    }).returning();
    
    const order = orderResult[0];
    
    // Create order items
    const createdItems = [];
    for (const item of validatedItems) {
      const itemResult = await db.insert(orderItems).values({
        orderId: order.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        currency: item.currency,
      }).returning();
      
      createdItems.push(itemResult[0]);
    }
    
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      merchantId: order.merchantId,
      deviceId: order.deviceId || undefined,
      customerId: order.customerId || undefined,
      totalAmount: order.totalAmount,
      currency: order.currency,
      status: order.status as OrderStatus,
      paymentMethod: order.paymentMethod || undefined,
      paymentStatus: order.paymentStatus as PaymentStatus,
      items: createdItems.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      createdAt: order.createdAt,
      completedAt: order.completedAt || undefined,
    };
  } catch (error) {
    console.error('[OrderService] Failed to create order:', error);
    throw error;
  }
}

/**
 * Get order with items
 */
export async function getOrderWithItems(orderId: number): Promise<OrderWithItems | null> {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });
    
    if (!order) {
      return null;
    }
    
    const items = await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, orderId),
    });
    
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      merchantId: order.merchantId,
      deviceId: order.deviceId || undefined,
      customerId: order.customerId || undefined,
      totalAmount: order.totalAmount,
      currency: order.currency,
      status: order.status as OrderStatus,
      paymentMethod: order.paymentMethod || undefined,
      paymentStatus: order.paymentStatus as PaymentStatus,
      items: items.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      createdAt: order.createdAt,
      completedAt: order.completedAt || undefined,
    };
  } catch (error) {
    console.error('[OrderService] Failed to get order:', error);
    throw error;
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
  paymentStatus?: PaymentStatus
): Promise<OrderWithItems | null> {
  try {
    const updateData: any = { status };
    
    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus;
    }
    
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    await db.update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId));
    
    return getOrderWithItems(orderId);
  } catch (error) {
    console.error('[OrderService] Failed to update order status:', error);
    throw error;
  }
}

/**
 * Process payment and update order
 */
export async function processOrderPayment(
  orderId: number,
  paymentGateway: string,
  transactionId: string,
  success: boolean,
  errorMessage?: string
): Promise<OrderWithItems | null> {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });
    
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    
    // Create transaction record
    await db.insert(transactions).values({
      orderId,
      transactionId,
      paymentGateway,
      amount: order.totalAmount,
      currency: order.currency,
      status: success ? 'success' : 'failed',
      paymentMethod: order.paymentMethod,
      errorMessage,
    });
    
    // Update order status
    if (success) {
      return updateOrderStatus(orderId, 'completed', 'captured');
    } else {
      return updateOrderStatus(orderId, 'failed', 'failed');
    }
  } catch (error) {
    console.error('[OrderService] Failed to process payment:', error);
    throw error;
  }
}

/**
 * Cancel order
 */
export async function cancelOrder(
  orderId: number,
  reason?: string
): Promise<OrderWithItems | null> {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });
    
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    
    // Restore stock
    const items = await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, orderId),
    });
    
    for (const item of items) {
      const product = await db.query.products.findFirst({
        where: eq(products.id, item.productId),
      });
      
      if (product) {
        await db.update(products)
          .set({ stock: product.stock + item.quantity })
          .where(eq(products.id, product.id));
      }
    }
    
    // Update order status
    return updateOrderStatus(orderId, 'cancelled');
  } catch (error) {
    console.error('[OrderService] Failed to cancel order:', error);
    throw error;
  }
}

/**
 * Get orders by merchant
 */
export async function getOrdersByMerchant(
  merchantId: number,
  limit: number = 50,
  offset: number = 0
): Promise<OrderWithItems[]> {
  try {
    const merchantOrders = await db.query.orders.findMany({
      where: eq(orders.merchantId, merchantId),
      limit,
      offset,
    });
    
    const result = [];
    for (const order of merchantOrders) {
      const orderWithItems = await getOrderWithItems(order.id);
      if (orderWithItems) {
        result.push(orderWithItems);
      }
    }
    
    return result;
  } catch (error) {
    console.error('[OrderService] Failed to get merchant orders:', error);
    throw error;
  }
}

/**
 * Get orders by customer
 */
export async function getOrdersByCustomer(
  customerId: number,
  limit: number = 50,
  offset: number = 0
): Promise<OrderWithItems[]> {
  try {
    const customerOrders = await db.query.orders.findMany({
      where: eq(orders.customerId, customerId),
      limit,
      offset,
    });
    
    const result = [];
    for (const order of customerOrders) {
      const orderWithItems = await getOrderWithItems(order.id);
      if (orderWithItems) {
        result.push(orderWithItems);
      }
    }
    
    return result;
  } catch (error) {
    console.error('[OrderService] Failed to get customer orders:', error);
    throw error;
  }
}

/**
 * Get order statistics
 */
export async function getOrderStatistics(merchantId: number): Promise<{
  totalOrders: number;
  completedOrders: number;
  failedOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}> {
  try {
    const allOrders = await db.query.orders.findMany({
      where: eq(orders.merchantId, merchantId),
    });
    
    const completed = allOrders.filter(o => o.status === 'completed');
    const failed = allOrders.filter(o => o.status === 'failed');
    
    const totalRevenue = completed.reduce((sum, o) => sum + o.totalAmount, 0);
    const averageOrderValue = completed.length > 0 ? totalRevenue / completed.length : 0;
    
    return {
      totalOrders: allOrders.length,
      completedOrders: completed.length,
      failedOrders: failed.length,
      totalRevenue,
      averageOrderValue,
    };
  } catch (error) {
    console.error('[OrderService] Failed to get statistics:', error);
    throw error;
  }
}

/**
 * Refund order
 */
export async function refundOrder(
  orderId: number,
  reason?: string
): Promise<OrderWithItems | null> {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });
    
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    
    if (order.status !== 'completed') {
      throw new Error('Only completed orders can be refunded');
    }
    
    // Create refund transaction
    const refundTransactionId = `REFUND-${nanoid(12)}`;
    await db.insert(transactions).values({
      orderId,
      transactionId: refundTransactionId,
      paymentGateway: 'internal',
      amount: order.totalAmount,
      currency: order.currency,
      status: 'refunded',
      paymentMethod: order.paymentMethod,
      errorMessage: reason,
    });
    
    // Update order status
    return updateOrderStatus(orderId, 'refunded', 'refunded');
  } catch (error) {
    console.error('[OrderService] Failed to refund order:', error);
    throw error;
  }
}
