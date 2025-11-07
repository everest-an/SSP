/**
 * Real-time Order Creation Router
 * 
 * This module handles the real-time order creation flow triggered by
 * gesture recognition on devices. It integrates face recognition,
 * wallet management, and automatic payment processing.
 * 
 * Flow:
 * 1. Gesture detected on device
 * 2. Face verified for user identification
 * 3. Wallet balance checked
 * 4. Order created
 * 5. Payment processed (custodial or non-custodial wallet)
 * 6. Stock updated
 * 7. Real-time notification sent via WebSocket
 * 
 * @module server/realtimeOrderRouters
 */

import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createOrder,
  createOrderItem,
  createTransaction,
  updateOrder,
  getDeviceById,
  getProductById,
  updateProduct,
  getOrderById,
} from "./db";
import {
  getFaceRecognitionByUserId,
  getDefaultWalletByUserId,
  createWalletTransaction,
  updateWalletBalance,
  getWalletById,
} from "./faceAndWalletDb";
import { wsService } from "./websocket";
import { paymentMethodRouter } from "./paymentMethodRouters";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";

/**
 * Order item input schema
 */
const OrderItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(100), // Max 100 items per product
});

/**
 * Real-time order creation input schema
 */
const CreateRealtimeOrderSchema = z.object({
  deviceId: z.number().int().positive(),
  userId: z.number().int().positive(),
  merchantId: z.number().int().positive(),
  items: z.array(OrderItemSchema).min(1).max(50), // Max 50 different products
  gestureConfidence: z.number().min(0).max(100).optional(),
});

/**
 * Cancel order input schema
 */
const CancelOrderSchema = z.object({
  orderId: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

/**
 * Real-time Order Router
 * 
 * Provides APIs for creating and managing real-time orders
 * with automatic payment processing.
 */
export const realtimeOrderRouter = router({
  /**
   * Create real-time order with automatic payment
   * 
   * This endpoint handles the complete order creation and payment flow:
   * 1. Validates device, user, and products
   * 2. Checks wallet balance and payment limits
   * 3. Creates order and order items
   * 4. Processes payment (custodial or non-custodial)
   * 5. Updates stock
   * 6. Sends WebSocket notifications
   * 
   * @throws {TRPCError} NOT_FOUND - Device, product, or wallet not found
   * @throws {TRPCError} PRECONDITION_FAILED - Device offline, insufficient balance, etc.
   * @throws {TRPCError} INTERNAL_SERVER_ERROR - Payment processing failed
   */
  createRealtimeOrder: publicProcedure
    .input(CreateRealtimeOrderSchema)
    .mutation(async ({ input }) => {
      const { deviceId, userId, merchantId, items, gestureConfidence } = input;

      try {
        // ===== Step 1: Validate Device =====
        console.log(`[RealtimeOrder] Creating order for user ${userId} on device ${deviceId}`);
        
        const device = await getDeviceById(deviceId);
        if (!device) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Device not found",
          });
        }

        if (device.status !== "online") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Device is ${device.status}. Only online devices can process orders.`,
          });
        }

        // ===== Step 2: Validate Face Recognition =====
        const faceRecognition = await getFaceRecognitionByUserId(userId);
        if (!faceRecognition || !faceRecognition.isActive) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Face recognition not enabled or inactive for this user",
          });
        }

        // ===== Step 3: Get User's Wallet =====
        const wallet = await getDefaultWalletByUserId(userId);
        if (!wallet) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No wallet found for user. Please create a wallet first.",
          });
        }

        if (wallet.status !== "active") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Wallet is ${wallet.status}. Only active wallets can be used for payment.`,
          });
        }

        // ===== Step 4: Calculate Order Total and Validate Products =====
        let totalAmount = 0;
        const orderItemsData = [];
        const productUpdates: Array<{ id: number; newStock: number }> = [];

        for (const item of items) {
          const product = await getProductById(item.productId);
          
          if (!product) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Product with ID ${item.productId} not found`,
            });
          }

          if (product.status !== "active") {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: `Product "${product.name}" is not available for purchase`,
            });
          }

          if (product.stock < item.quantity) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`,
            });
          }

          const itemTotal = product.price * item.quantity;
          totalAmount += itemTotal;

          orderItemsData.push({
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unitPrice: product.price,
            totalPrice: itemTotal,
            currency: product.currency,
          });

          productUpdates.push({
            id: product.id,
            newStock: product.stock - item.quantity,
          });
        }

        // ===== Step 5: Validate Payment Limits =====
        if (totalAmount > faceRecognition.maxPaymentAmount) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Order amount ($${(totalAmount / 100).toFixed(2)}) exceeds maximum payment limit ($${(faceRecognition.maxPaymentAmount / 100).toFixed(2)})`,
          });
        }

        // ===== Step 6: Validate Wallet Balance (for custodial wallets) =====
        if (wallet.walletType === "custodial" && wallet.balance < totalAmount) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Insufficient wallet balance. Balance: $${(wallet.balance / 100).toFixed(2)}, Required: $${(totalAmount / 100).toFixed(2)}`,
          });
        }

        // ===== Step 7: Create Order =====
        const orderNumber = `ORD-${nanoid(10)}`;
        console.log(`[RealtimeOrder] Creating order ${orderNumber} with total $${(totalAmount / 100).toFixed(2)}`);
        
        const order = await createOrder({
          merchantId,
          deviceId,
          customerId: userId,
          orderNumber,
          totalAmount,
          currency: wallet.currency,
          status: "processing",
          paymentMethod: wallet.walletType === "custodial" ? "wallet" : "crypto_wallet",
          paymentStatus: "pending",
        });

        // ===== Step 8: Create Order Items =====
        for (const itemData of orderItemsData) {
          await createOrderItem({
            orderId: order.id,
            ...itemData,
          });
        }

        // ===== Step 9: Process Payment =====
        let paymentSuccess = false;
        let paymentError: string | null = null;
        let transactionId = `TXN-${nanoid(12)}`;

        try {
          // Try to use payment method first (card or MetaMask)
          console.log(`[RealtimeOrder] Attempting payment with default payment method for order ${orderNumber}`);
          
          try {
            const paymentResult = await paymentMethodRouter.createCaller({} as any).processPayment({
              userId,
              amount: totalAmount,
              currency: wallet.currency,
              orderId: order.id,
              description: `Order ${orderNumber}`,
            });

            if (paymentResult.success) {
              if (paymentResult.pending) {
                // MetaMask payment - pending blockchain confirmation
                paymentSuccess = false;
                paymentError = paymentResult.message || "Payment pending blockchain confirmation";
                console.log(`[RealtimeOrder] Payment pending for order ${orderNumber}`);
              } else {
                // Card payment - successful
                paymentSuccess = true;
                console.log(`[RealtimeOrder] Card payment successful for order ${orderNumber}`);
              }
            }
          } catch (paymentMethodError: any) {
            // No payment method or payment method failed, fall back to wallet
            console.log(`[RealtimeOrder] Payment method failed, falling back to wallet: ${paymentMethodError.message}`);
            
            if (wallet.walletType === "custodial") {
              // ===== Custodial Wallet Payment (Fiat) =====
              console.log(`[RealtimeOrder] Processing custodial wallet payment for order ${orderNumber}`);
              
              // Deduct from wallet balance
              await updateWalletBalance(wallet.id, wallet.balance - totalAmount);

              // Create wallet transaction record
              await createWalletTransaction({
                walletId: wallet.id,
                type: "payment",
                amount: -totalAmount, // Negative for deduction
                currency: wallet.currency,
                status: "completed",
                relatedOrderId: order.id,
                description: `Payment for order ${orderNumber}`,
              });

              paymentSuccess = true;
              console.log(`[RealtimeOrder] Custodial payment successful for order ${orderNumber}`);

            } else {
              // ===== Non-Custodial Wallet Payment (Crypto) =====
              console.log(`[RealtimeOrder] Processing non-custodial wallet payment for order ${orderNumber}`);
              
              // Create wallet transaction record with pending status
              await createWalletTransaction({
                walletId: wallet.id,
                type: "payment",
                amount: -totalAmount,
                currency: wallet.currency,
                status: "pending",
                relatedOrderId: order.id,
                description: `Crypto payment for order ${orderNumber} (pending blockchain confirmation)`,
              });

              paymentSuccess = false;
              paymentError = "Non-custodial wallet payment requires blockchain confirmation. Order is pending.";
              console.log(`[RealtimeOrder] Non-custodial payment pending for order ${orderNumber}`);
            }
          }
        } catch (error: any) {
          paymentError = error.message || "Payment processing failed";
          console.error(`[RealtimeOrder] Payment failed for order ${orderNumber}:`, error);
        }

        // ===== Step 10: Update Order Status =====
        if (paymentSuccess) {
          // Payment successful - complete the order
          await updateOrder(order.id, {
            status: "completed",
            paymentStatus: "captured",
            completedAt: new Date(),
          });

          // Update product stock
          for (const update of productUpdates) {
            await updateProduct(update.id, {
              stock: update.newStock,
            });
          }

          // Create successful transaction record
          await createTransaction({
            orderId: order.id,
            transactionId,
            paymentGateway: "wallet",
            amount: totalAmount,
            currency: wallet.currency,
            status: "success",
            paymentMethod: wallet.walletType,
            metadata: JSON.stringify({
              walletId: wallet.id,
              gestureConfidence,
              deviceId,
              timestamp: Date.now(),
            }),
          });

          // Send WebSocket notifications
          wsService.notifyOrderUpdate(
            order.id,
            {
              status: "completed",
              paymentStatus: "captured",
              totalAmount,
              orderNumber,
              items: orderItemsData,
            },
            merchantId,
            userId
          );

          wsService.notifyPaymentStatus(order.id, "success", userId, merchantId);

          console.log(`[RealtimeOrder] Order ${orderNumber} completed successfully`);

          return {
            success: true,
            order: {
              id: order.id,
              orderNumber: order.orderNumber,
              totalAmount: order.totalAmount,
              status: order.status,
              paymentStatus: order.paymentStatus,
              items: orderItemsData,
            },
          };

        } else {
          // Payment failed or pending
          await updateOrder(order.id, {
            status: wallet.walletType === "non_custodial" ? "pending" : "failed",
            paymentStatus: wallet.walletType === "non_custodial" ? "pending" : "failed",
          });

          // Create failed/pending transaction record
          await createTransaction({
            orderId: order.id,
            transactionId,
            paymentGateway: "wallet",
            amount: totalAmount,
            currency: wallet.currency,
            status: wallet.walletType === "non_custodial" ? "pending" : "failed",
            paymentMethod: wallet.walletType,
            errorMessage: paymentError || undefined,
            metadata: JSON.stringify({
              walletId: wallet.id,
              gestureConfidence,
              deviceId,
              timestamp: Date.now(),
            }),
          });

          // Send WebSocket notifications
          wsService.notifyOrderUpdate(
            order.id,
            {
              status: wallet.walletType === "non_custodial" ? "pending" : "failed",
              paymentStatus: wallet.walletType === "non_custodial" ? "pending" : "failed",
              totalAmount,
              orderNumber,
              error: paymentError,
            },
            merchantId,
            userId
          );

          wsService.notifyPaymentStatus(
            order.id, 
            wallet.walletType === "non_custodial" ? "pending" : "failed", 
            userId, 
            merchantId
          );

          if (wallet.walletType === "custodial") {
            console.error(`[RealtimeOrder] Order ${orderNumber} failed:`, paymentError);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: paymentError || "Payment processing failed",
            });
          } else {
            console.log(`[RealtimeOrder] Order ${orderNumber} pending blockchain confirmation`);
            return {
              success: true,
              pending: true,
              order: {
                id: order.id,
                orderNumber: order.orderNumber,
                totalAmount: order.totalAmount,
                status: "pending",
                paymentStatus: "pending",
                items: orderItemsData,
                message: "Order created. Awaiting blockchain confirmation.",
              },
            };
          }
        }
      } catch (error: any) {
        // Send error notification via WebSocket
        console.error(`[RealtimeOrder] Error creating order:`, error);
        
        wsService.sendToUser(userId, {
          type: "order_update",
          data: {
            error: error.message || "Order creation failed",
            status: "failed",
          },
          timestamp: Date.now(),
        });

        throw error;
      }
    }),

  /**
   * Cancel pending order
   * 
   * Used when gesture is cancelled, timeout occurs, or user manually cancels.
   * Only pending orders can be cancelled.
   * 
   * @throws {TRPCError} NOT_FOUND - Order not found
   * @throws {TRPCError} BAD_REQUEST - Order cannot be cancelled
   */
  cancelPendingOrder: publicProcedure
    .input(CancelOrderSchema)
    .mutation(async ({ input }) => {
      const { orderId, reason } = input;

      console.log(`[RealtimeOrder] Cancelling order ${orderId}: ${reason || 'No reason provided'}`);

      // Get order details
      const order = await getOrderById(orderId);
      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Only allow cancellation of pending orders
      if (order.status !== "pending" && order.status !== "processing") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot cancel order with status "${order.status}". Only pending or processing orders can be cancelled.`,
        });
      }

      // Update order status
      await updateOrder(orderId, {
        status: "cancelled",
        paymentStatus: "failed",
      });

      // Notify via WebSocket
      wsService.notifyOrderUpdate(
        orderId,
        {
          status: "cancelled",
          reason: reason || "Order cancelled",
        },
        order.merchantId,
        order.customerId || undefined
      );

      console.log(`[RealtimeOrder] Order ${orderId} cancelled successfully`);

      return { 
        success: true,
        message: "Order cancelled successfully"
      };
    }),

  /**
   * Get order status
   * 
   * Retrieves current status of an order.
   * 
   * @throws {TRPCError} NOT_FOUND - Order not found
   */
  getOrderStatus: publicProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const order = await getOrderById(input.orderId);
      
      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        currency: order.currency,
        createdAt: order.createdAt,
        completedAt: order.completedAt,
      };
    }),
});
