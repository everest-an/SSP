import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  createMerchant,
  getMerchantById,
  getMerchantsByUserId,
  getAllMerchants,
  updateMerchant,
  createProduct,
  getProductById,
  getProductsByMerchantId,
  updateProduct,
  deleteProduct,
  createDevice,
  getDeviceById,
  getDevicesByMerchantId,
  updateDevice,
  updateDeviceHeartbeat,
  createOrder,
  getOrderById,
  getOrdersByMerchantId,
  updateOrder,
  createOrderItem,
  getOrderItemsByOrderId,
  createTransaction,
  getTransactionsByOrderId,
  updateTransaction,
  createDetectionEvent,
  getDetectionEventsByDeviceId,
  getDashboardStats,
  createAuditLog,
} from "./db";
import { TRPCError } from "@trpc/server";
import { stripeRouters } from "./stripeRouters";
import { faceRecognitionRouter, walletRouter, gestureRouter, deviceProductRouter } from "./faceAndWalletRouters";
import { adminRouter } from "./adminRouters";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

// Merchant or admin procedure
const merchantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'merchant' && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Merchant or admin access required' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  stripe: stripeRouters,
  faceRecognition: faceRecognitionRouter,
  wallet: walletRouter,
  gesture: gestureRouter,
  deviceProduct: deviceProductRouter,
  admin: adminRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Merchant Management
  merchants: router({
    create: protectedProcedure
      .input(z.object({
        businessName: z.string().min(1),
        businessType: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const merchant = await createMerchant({
          userId: ctx.user.id,
          ...input,
        });

        await createAuditLog({
          userId: ctx.user.id,
          action: "create_merchant",
          entityType: "merchant",
          entityId: merchant.id,
          changes: JSON.stringify(input),
        });

        return merchant;
      }),

    getById: merchantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const merchant = await getMerchantById(input.id);
        if (!merchant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Merchant not found' });
        }
        return merchant;
      }),

    getMyMerchants: protectedProcedure
      .query(async ({ ctx }) => {
        return getMerchantsByUserId(ctx.user.id);
      }),

    getAll: adminProcedure
      .query(async () => {
        return getAllMerchants();
      }),

    update: merchantProcedure
      .input(z.object({
        id: z.number(),
        businessName: z.string().min(1).optional(),
        businessType: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        status: z.enum(["active", "inactive", "suspended"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateMerchant(id, data);

        await createAuditLog({
          userId: ctx.user.id,
          action: "update_merchant",
          entityType: "merchant",
          entityId: id,
          changes: JSON.stringify(data),
        });

        return { success: true };
      }),
  }),

  // Product Management
  products: router({
    create: merchantProcedure
      .input(z.object({
        merchantId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        sku: z.string().optional(),
        barcode: z.string().optional(),
        category: z.string().optional(),
        price: z.number().int().min(0),
        currency: z.string().default("USD"),
        imageUrl: z.string().optional(),
        stock: z.number().int().min(0).default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const product = await createProduct(input);

        await createAuditLog({
          userId: ctx.user.id,
          action: "create_product",
          entityType: "product",
          entityId: product.id,
          changes: JSON.stringify(input),
        });

        return product;
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await getProductById(input.id);
        if (!product) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });
        }
        return product;
      }),

    getByMerchant: publicProcedure
      .input(z.object({ merchantId: z.number() }))
      .query(async ({ input }) => {
        return getProductsByMerchantId(input.merchantId);
      }),

    update: merchantProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        sku: z.string().optional(),
        barcode: z.string().optional(),
        category: z.string().optional(),
        price: z.number().int().min(0).optional(),
        imageUrl: z.string().optional(),
        stock: z.number().int().min(0).optional(),
        status: z.enum(["active", "inactive", "out_of_stock"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateProduct(id, data);

        await createAuditLog({
          userId: ctx.user.id,
          action: "update_product",
          entityType: "product",
          entityId: id,
          changes: JSON.stringify(data),
        });

        return { success: true };
      }),

    delete: merchantProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteProduct(input.id);

        await createAuditLog({
          userId: ctx.user.id,
          action: "delete_product",
          entityType: "product",
          entityId: input.id,
        });

        return { success: true };
      }),
  }),

  // Device Management
  devices: router({
    register: merchantProcedure
      .input(z.object({
        merchantId: z.number(),
        deviceName: z.string().min(1),
        deviceType: z.enum(["ipad", "android_tablet", "pos_terminal"]),
        deviceId: z.string().min(1),
        location: z.string().optional(),
        firmwareVersion: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const device = await createDevice(input);

        await createAuditLog({
          userId: ctx.user.id,
          action: "register_device",
          entityType: "device",
          entityId: device.id,
          changes: JSON.stringify(input),
        });

        return device;
      }),

    getById: merchantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const device = await getDeviceById(input.id);
        if (!device) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' });
        }
        return device;
      }),

    getByMerchant: merchantProcedure
      .input(z.object({ merchantId: z.number() }))
      .query(async ({ input }) => {
        return getDevicesByMerchantId(input.merchantId);
      }),

    update: merchantProcedure
      .input(z.object({
        id: z.number(),
        deviceName: z.string().min(1).optional(),
        location: z.string().optional(),
        status: z.enum(["online", "offline", "maintenance"]).optional(),
        firmwareVersion: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateDevice(id, data);

        await createAuditLog({
          userId: ctx.user.id,
          action: "update_device",
          entityType: "device",
          entityId: id,
          changes: JSON.stringify(data),
        });

        return { success: true };
      }),

    heartbeat: publicProcedure
      .input(z.object({ deviceId: z.string() }))
      .mutation(async ({ input }) => {
        await updateDeviceHeartbeat(input.deviceId);
        return { success: true };
      }),
  }),

  // Order Management
  orders: router({
    create: publicProcedure
      .input(z.object({
        merchantId: z.number(),
        deviceId: z.number(),
        customerId: z.number().optional(),
        orderNumber: z.string(),
        totalAmount: z.number().int().min(0),
        currency: z.string().default("USD"),
        items: z.array(z.object({
          productId: z.number(),
          productName: z.string(),
          quantity: z.number().int().min(1),
          unitPrice: z.number().int().min(0),
          totalPrice: z.number().int().min(0),
        })),
      }))
      .mutation(async ({ input }) => {
        const { items, ...orderData } = input;
        
        // Create order
        const order = await createOrder(orderData);

        // Create order items
        for (const item of items) {
          await createOrderItem({
            orderId: order.id,
            ...item,
          });
        }

        return order;
      }),

    getById: merchantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await getOrderById(input.id);
        if (!order) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
        }

        const items = await getOrderItemsByOrderId(order.id);
        const transactions = await getTransactionsByOrderId(order.id);

        return {
          ...order,
          items,
          transactions,
        };
      }),

    getByMerchant: merchantProcedure
      .input(z.object({
        merchantId: z.number(),
        limit: z.number().default(100),
      }))
      .query(async ({ input }) => {
        return getOrdersByMerchantId(input.merchantId, input.limit);
      }),

    updateStatus: merchantProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "processing", "completed", "failed", "refunded", "cancelled"]),
        paymentStatus: z.enum(["pending", "authorized", "captured", "failed", "refunded"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        
        if (data.status === "completed" && !data.paymentStatus) {
          data.paymentStatus = "captured";
        }

        await updateOrder(id, {
          ...data,
          completedAt: data.status === "completed" ? new Date() : undefined,
        });

        await createAuditLog({
          userId: ctx.user.id,
          action: "update_order_status",
          entityType: "order",
          entityId: id,
          changes: JSON.stringify(data),
        });

        return { success: true };
      }),
  }),

  // Transaction Management
  transactions: router({
    create: publicProcedure
      .input(z.object({
        orderId: z.number(),
        transactionId: z.string(),
        paymentGateway: z.string(),
        amount: z.number().int().min(0),
        currency: z.string().default("USD"),
        status: z.enum(["pending", "success", "failed", "refunded"]).default("pending"),
        paymentMethod: z.string().optional(),
        errorMessage: z.string().optional(),
        metadata: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return createTransaction(input);
      }),

    updateStatus: merchantProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "success", "failed", "refunded"]),
        errorMessage: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateTransaction(id, data);

        await createAuditLog({
          userId: ctx.user.id,
          action: "update_transaction_status",
          entityType: "transaction",
          entityId: id,
          changes: JSON.stringify(data),
        });

        return { success: true };
      }),
  }),

  // Detection Events
  detectionEvents: router({
    create: publicProcedure
      .input(z.object({
        deviceId: z.number(),
        orderId: z.number().optional(),
        eventType: z.enum([
          "hand_detected",
          "item_approached",
          "item_picked",
          "item_put_back",
          "checkout_triggered"
        ]),
        productId: z.number().optional(),
        confidence: z.number().int().min(0).max(100).optional(),
        metadata: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return createDetectionEvent(input);
      }),

    getByDevice: merchantProcedure
      .input(z.object({
        deviceId: z.number(),
        limit: z.number().default(100),
      }))
      .query(async ({ input }) => {
        return getDetectionEventsByDeviceId(input.deviceId, input.limit);
      }),
  }),

  // Dashboard Analytics
  dashboard: router({
    getStats: merchantProcedure
      .input(z.object({ merchantId: z.number() }))
      .query(async ({ input }) => {
        return getDashboardStats(input.merchantId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
