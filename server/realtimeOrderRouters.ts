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
} from "./db";
import {
  getFaceRecognitionByUserId,
  getDefaultWalletByUserId,
  createWalletTransaction,
  updateWalletBalance,
} from "./faceAndWalletDb";
import { wsService } from "./websocket";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";

/**
 * Real-time order creation flow
 * Triggered by gesture recognition on device
 */
export const realtimeOrderRouter = router({
  /**
   * Create order with automatic payment
   * Flow: Gesture detected → Face verified → Wallet charged → Order created
   */
  createRealtimeOrder: publicProcedure
    .input(
      z.object({
        deviceId: z.number(),
        userId: z.number(),
        merchantId: z.number(),
        items: z.array(
          z.object({
            productId: z.number(),
            quantity: z.number().int().min(1),
          })
        ),
        gestureConfidence: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { deviceId, userId, merchantId, items, gestureConfidence } = input;

      try {
        // Step 1: Verify device exists and is online
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
            message: "Device is not online",
          });
        }

        // Step 2: Verify user has face recognition enabled
        const faceRecognition = await getFaceRecognitionByUserId(userId);
        if (!faceRecognition || !faceRecognition.isActive) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Face recognition not enabled for this user",
          });
        }

        // Step 3: Get user's default wallet
        const wallet = await getDefaultWalletByUserId(userId);
        if (!wallet) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No wallet found for user",
          });
        }
        if (wallet.status !== "active") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Wallet is not active",
          });
        }

        // Step 4: Calculate order total and validate products
        let totalAmount = 0;
        const orderItemsData = [];

        for (const item of items) {
          const product = await getProductById(item.productId);
          if (!product) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Product ${item.productId} not found`,
            });
          }
          if (product.status !== "active") {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: `Product ${product.name} is not available`,
            });
          }
          if (product.stock < item.quantity) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: `Insufficient stock for ${product.name}`,
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
        }

        // Step 5: Check if amount exceeds max payment limit
        if (totalAmount > faceRecognition.maxPaymentAmount) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Order amount exceeds maximum payment limit of ${faceRecognition.maxPaymentAmount / 100}`,
          });
        }

        // Step 6: Check wallet balance (for custodial wallets)
        if (wallet.walletType === "custodial" && wallet.balance < totalAmount) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Insufficient wallet balance",
          });
        }

        // Step 7: Create order
        const orderNumber = `ORD-${nanoid(10)}`;
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

        // Step 8: Create order items
        for (const itemData of orderItemsData) {
          await createOrderItem({
            orderId: order.id,
            ...itemData,
          });
        }

        // Step 9: Process payment
        let paymentSuccess = false;
        let paymentError = null;

        try {
          if (wallet.walletType === "custodial") {
            // Deduct from custodial wallet
            await updateWalletBalance(wallet.id, wallet.balance - totalAmount);

            // Create wallet transaction
            await createWalletTransaction({
              walletId: wallet.id,
              type: "payment",
              amount: totalAmount,
              currency: wallet.currency,
              status: "completed",
              relatedOrderId: order.id,
              description: `Payment for order ${orderNumber}`,
            });

            paymentSuccess = true;
          } else {
            // For non-custodial wallets, we would integrate with blockchain here
            // For now, we'll mark it as pending and require manual confirmation
            paymentSuccess = false;
            paymentError = "Non-custodial wallet payment requires blockchain confirmation";
          }
        } catch (error: any) {
          paymentError = error.message || "Payment failed";
        }

        // Step 10: Update order status based on payment result
        if (paymentSuccess) {
          await updateOrder(order.id, {
            status: "completed",
            paymentStatus: "captured",
            completedAt: new Date(),
          });

          // Update product stock
          for (const item of items) {
            const product = await getProductById(item.productId);
            if (product) {
              await updateProduct(item.productId, {
                stock: product.stock - item.quantity,
              });
            }
          }

          // Create transaction record
          await createTransaction({
            orderId: order.id,
            transactionId: `TXN-${nanoid(12)}`,
            paymentGateway: "wallet",
            amount: totalAmount,
            currency: wallet.currency,
            status: "success",
            paymentMethod: wallet.walletType,
            metadata: JSON.stringify({
              walletId: wallet.id,
              gestureConfidence,
              deviceId,
            }),
          });

          // Notify via WebSocket
          wsService.notifyOrderUpdate(
            order.id,
            {
              status: "completed",
              paymentStatus: "captured",
              totalAmount,
              orderNumber,
            },
            merchantId,
            userId
          );

          wsService.notifyPaymentStatus(order.id, "success", userId, merchantId);
        } else {
          await updateOrder(order.id, {
            status: "failed",
            paymentStatus: "failed",
          });

          await createTransaction({
            orderId: order.id,
            transactionId: `TXN-${nanoid(12)}`,
            paymentGateway: "wallet",
            amount: totalAmount,
            currency: wallet.currency,
            status: "failed",
            paymentMethod: wallet.walletType,
            errorMessage: paymentError || undefined,
            metadata: JSON.stringify({
              walletId: wallet.id,
              gestureConfidence,
              deviceId,
            }),
          });

          // Notify via WebSocket
          wsService.notifyOrderUpdate(
            order.id,
            {
              status: "failed",
              paymentStatus: "failed",
              totalAmount,
              orderNumber,
              error: paymentError,
            },
            merchantId,
            userId
          );

          wsService.notifyPaymentStatus(order.id, "failed", userId, merchantId);

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: paymentError || "Payment processing failed",
          });
        }

        return {
          success: true,
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
            status: order.status,
            paymentStatus: order.paymentStatus,
          },
        };
      } catch (error: any) {
        // Notify error via WebSocket
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
   * Used when gesture is cancelled or timeout occurs
   */
  cancelPendingOrder: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { orderId, reason } = input;

      await updateOrder(orderId, {
        status: "cancelled",
        paymentStatus: "failed",
      });

      // Notify via WebSocket
      const order = await getOrderById(orderId);
      if (order) {
        wsService.notifyOrderUpdate(
          orderId,
          {
            status: "cancelled",
            reason: reason || "Order cancelled",
          },
          order.merchantId,
          order.customerId || undefined
        );
      }

      return { success: true };
    }),
});

// Helper function to get order by ID (if not already exported from db.ts)
async function getOrderById(orderId: number) {
  const { getOrderById: getOrder } = await import("./db");
  return getOrder(orderId);
}
