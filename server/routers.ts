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
import { registerUser, loginWithEmail, loginWithFace } from "./services/authService";
import { createUserSession } from "./services/sessionService";
import { findSimilarFaces } from "./services/faceUniquenessCheck";
import { validateActiveLiveness } from "./services/livenessDetection";
import { getUserFaceEmbeddings } from "./services/faceEmbeddingStorage";
import { generatePasswordResetToken, verifyPasswordResetToken, resetPassword } from "./services/passwordResetService";
import { COOKIE_NAME } from "@shared/const";
import { faceRecognitionRouter, walletRouter, gestureRouter, deviceProductRouter } from "./faceAndWalletRouters";
import { faceAuthRouter } from "./routes/faceAuth";
import { adminRouter } from "./adminRouters";
import { realtimeOrderRouter } from "./realtimeOrderRouters";
import { paymentMethodRouter } from "./paymentMethodRouters";

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
  faceAuth: faceAuthRouter,
  wallet: walletRouter,
  gesture: gestureRouter,
  deviceProduct: deviceProductRouter,
  admin: adminRouter,
  realtimeOrder: realtimeOrderRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // Email/Password Registration
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Register user
        const user = await registerUser({
          email: input.email,
          password: input.password,
          name: input.name,
          phone: input.phone,
        });

        // Create session
        const openId = `email_${user.id}_${Date.now()}`;
        await createUserSession(ctx.res, user.id, openId, ctx.req);

        // Send welcome email (async, don't wait)
        const { sendWelcomeEmail } = await import('./services/emailService');
        sendWelcomeEmail(user.email, user.name || 'User').catch(err => {
          console.error('Failed to send welcome email:', err);
        });

        return {
          success: true,
          user,
        };
      }),

    // Email/Password Login
    loginWithEmail: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
        rememberMe: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Authenticate user
        const user = await loginWithEmail(input.email, input.password);

        // Create session with rememberMe option
        const openId = `email_${user.id}_${Date.now()}`;
        await createUserSession(ctx.res, user.id, openId, ctx.req, input.rememberMe);

        // Record login history
        const { recordLoginAttempt } = await import('./services/loginHistoryService');
        await recordLoginAttempt({
          userId: user.id,
          loginMethod: 'email',
          req: ctx.req,
          status: 'success',
        });

        return {
          success: true,
          user,
        };
      }),

    // Face Recognition Login
    loginWithFace: publicProcedure
      .input(z.object({
        embedding: z.array(z.number()),
        videoFrames: z.array(z.string()).min(5),
        challenges: z.array(z.any()),
        deviceFingerprint: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Step 1: Validate liveness
        const livenessResult = await validateActiveLiveness(input.videoFrames, input.challenges);
        
        if (!livenessResult.passed) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: `Liveness check failed: ${livenessResult.failureReason}`,
          });
        }

        // Step 2: Find matching face in database
        const similarities = await findSimilarFaces(input.embedding, 10);
        
        if (similarities.length === 0) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'No matching face found. Please register first.',
          });
        }

        const bestMatch = similarities[0];
        const VERIFICATION_THRESHOLD = 0.75;

        if (bestMatch.similarity < VERIFICATION_THRESHOLD) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: `Face verification failed: Confidence too low (${(bestMatch.similarity * 100).toFixed(1)}%)`,
          });
        }

        // Step 3: Get user and create session
        const user = await loginWithFace(bestMatch.userId);
        const openId = `face_${user.id}_${Date.now()}`;
        await createUserSession(ctx.res, user.id, openId, ctx.req);

        return {
          success: true,
          user,
          confidence: bestMatch.similarity,
          livenessScore: livenessResult.score,
        };
      }),

    // Request Password Reset
    requestPasswordReset: publicProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        const result = await generatePasswordResetToken(input.email);
        
        // Always return success to prevent email enumeration
        if (result) {
          console.log(`Password reset token: ${result.token}`);
          
          // Send password reset email (async, don't wait)
          const { sendPasswordResetEmail } = await import('./services/emailService');
          sendPasswordResetEmail(input.email, result.token, '1 hour').catch(err => {
            console.error('Failed to send password reset email:', err);
          });
        }
        
        return {
          success: true,
          message: 'If the email exists, a password reset link has been sent.',
        };
      }),

    // Verify Reset Token
    verifyResetToken: publicProcedure
      .input(z.object({
        token: z.string(),
      }))
      .query(async ({ input }) => {
        const userId = await verifyPasswordResetToken(input.token);
        return { valid: userId !== null };
      }),

    // Reset Password
    resetPassword: publicProcedure
      .input(z.object({
        token: z.string(),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input }) => {
        const success = await resetPassword(input.token, input.newPassword);
        
        if (!success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid or expired reset token',
          });
        }
        
        return {
          success: true,
          message: 'Password has been reset successfully',
        };
      }),

    // Get Login History
    getLoginHistory: protectedProcedure
      .input(z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        status: z.enum(['success', 'failed']).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { getLoginHistory } = await import('./services/loginHistoryService');
        return getLoginHistory(ctx.user.id, input);
      }),

    // Get Login Statistics
    getLoginStatistics: protectedProcedure
      .input(z.object({
        days: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { getLoginStatistics } = await import('./services/loginHistoryService');
        return getLoginStatistics(ctx.user.id, input.days);
      }),

    // Detect Suspicious Activity
    detectSuspiciousActivity: protectedProcedure
      .query(async ({ ctx }) => {
        const { detectSuspiciousActivity } = await import('./services/loginHistoryService');
        return detectSuspiciousActivity(ctx.user.id);
      }),

    // Generate 2FA Secret
    generate2FASecret: protectedProcedure
      .mutation(async ({ ctx }) => {
        const { generate2FASecret } = await import('./services/twoFactorAuthService');
        return generate2FASecret(ctx.user.id);
      }),

    // Enable 2FA
    enable2FA: protectedProcedure
      .input(z.object({
        secret: z.string(),
        verificationCode: z.string().length(6),
      }))
      .mutation(async ({ ctx, input }) => {
        const { enable2FA } = await import('./services/twoFactorAuthService');
        const success = await enable2FA(ctx.user.id, input.secret, input.verificationCode);
        
        if (!success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid verification code' });
        }
        
        return { success: true };
      }),

    // Disable 2FA
    disable2FA: protectedProcedure
      .input(z.object({
        password: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify password before disabling 2FA
        const { loginWithEmail } = await import('./services/authService');
        const { users } = await import('@db/schema');
        const { eq } = await import('drizzle-orm');
        
        const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        
        if (!user || !user.email) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }
        
        try {
          await loginWithEmail(user.email, input.password);
        } catch (error) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid password' });
        }
        
        const { disable2FA } = await import('./services/twoFactorAuthService');
        await disable2FA(ctx.user.id);
        
        return { success: true };
      }),

    // Verify 2FA Code
    verify2FACode: protectedProcedure
      .input(z.object({
        code: z.string().length(6),
      }))
      .mutation(async ({ ctx, input }) => {
        const { verify2FACode } = await import('./services/twoFactorAuthService');
        const isValid = await verify2FACode(ctx.user.id, input.code);
        
        return { valid: isValid };
      }),

    // Check 2FA Status
    get2FAStatus: protectedProcedure
      .query(async ({ ctx }) => {
        const { is2FAEnabled } = await import('./services/twoFactorAuthService');
        const enabled = await is2FAEnabled(ctx.user.id);
        
        return { enabled };
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
        walletAddress: z.string().optional(), // Ethereum wallet address for MetaMask payments
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
        deviceId: z.number().optional(),
        customerId: z.number().optional(),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number(),
        })),
        paymentMethod: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { createOrderWithItems } = await import("./services/orderService");
        const order = await createOrderWithItems(input);
        // Notify merchant and device about the new order
        const { wsService } = await import("./websocket");
        wsService.notifyOrderUpdate(order.id, { status: order.status, totalAmount: order.totalAmount }, order.merchantId, order.customerId);
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

    // Get user's orders with pagination
    getUserOrders: protectedProcedure
      .input(z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(async ({ ctx, input }) => {
        const { db } = await import("./db");
        const { orders } = await import("@db/schema");
        const { eq, desc, count } = await import("drizzle-orm");

        // Get total count
        const [{ value: total }] = await db
          .select({ value: count() })
          .from(orders)
          .where(eq(orders.userId, ctx.user.id));

        // Get paginated orders
        const data = await db.query.orders.findMany({
          where: eq(orders.userId, ctx.user.id),
          orderBy: [desc(orders.createdAt)],
          limit: input.limit,
          offset: input.offset,
        });

        return {
          data,
          total,
        };
      }),

    // Export payment history
    exportPaymentHistory: protectedProcedure
      .input(z.object({
        format: z.enum(["csv", "pdf"]),
        filters: z.object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          status: z.string().optional(),
          minAmount: z.number().optional(),
          maxAmount: z.number().optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { exportPaymentHistoryCSV, exportPaymentHistoryPDF } = await import("./services/exportService");

        if (input.format === "csv") {
          const content = await exportPaymentHistoryCSV(ctx.user.id, input.filters || {});
          return {
            content,
            filename: `payment-history-${Date.now()}.csv`,
            mimeType: "text/csv",
          };
        } else {
          const htmlContent = await exportPaymentHistoryPDF(ctx.user.id, input.filters || {});
          // For PDF, we'll return HTML and let the frontend convert it
          return {
            content: htmlContent,
            filename: `payment-history-${Date.now()}.pdf`,
            mimeType: "text/html",
          };
        }
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

  // Payment Methods
  paymentMethod: paymentMethodRouter,
});

export type AppRouter = typeof appRouter;
