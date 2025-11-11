import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createFaceRecognition,
  getFaceRecognitionByUserId,
  updateFaceRecognition,
  deactivateFaceRecognition,
  createWallet,
  getWalletsByUserId,
  getWalletById,
  getDefaultWalletByUserId,
  updateWallet,
  updateWalletBalance,
  createWalletTransaction,
  getWalletTransactions,
  updateWalletTransaction,
  createGestureEvent,
  getGestureEventsByDevice,
  getRecentGestureEvents,
  addProductToDevice,
  getDeviceProducts,
  removeProductFromDevice,
  isProductAvailableOnDevice,
} from "./faceAndWalletDb";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { ENV } from "./_core/env";

const stripe = new Stripe(ENV.stripeSecretKey, {
  apiVersion: "2025-10-29.clover",
});

/**
 * Calculate cosine similarity between two vectors
 * Used for face recognition matching
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

export const faceRecognitionRouter = router({
  // Register face recognition for a user
  register: protectedProcedure
    .input(
      z.object({
        faceEmbedding: z.array(z.number()),
        stripeCustomerId: z.string().optional(),
        paymentMethodId: z.string().optional(),
        maxPaymentAmount: z.number().default(5000), // Default $50
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user already has face recognition
      const existing = await getFaceRecognitionByUserId(ctx.user.id);
      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Face recognition already registered for this user",
        });
      }

      // Create Stripe customer if not provided
      let stripeCustomerId = input.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: ctx.user.email || undefined,
          name: ctx.user.name || undefined,
          metadata: {
            userId: ctx.user.id.toString(),
          },
        });
        stripeCustomerId = customer.id;
      }

      const faceRec = await createFaceRecognition({
        userId: ctx.user.id,
        faceEmbedding: JSON.stringify(input.faceEmbedding),
        stripeCustomerId,
        paymentMethodId: input.paymentMethodId,
        maxPaymentAmount: input.maxPaymentAmount,
        isActive: 1,
      });

      return faceRec;
    }),

  // Get face recognition data
  get: protectedProcedure.query(async ({ ctx }) => {
    const faceRec = await getFaceRecognitionByUserId(ctx.user.id);
    if (!faceRec) {
      return null;
    }

    return {
      ...faceRec,
      faceEmbedding: JSON.parse(faceRec.faceEmbedding),
    };
  }),

  // Update face recognition
  update: protectedProcedure
    .input(
      z.object({
        faceEmbedding: z.array(z.number()).optional(),
        paymentMethodId: z.string().optional(),
        maxPaymentAmount: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const faceRec = await getFaceRecognitionByUserId(ctx.user.id);
      if (!faceRec) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Face recognition not found",
        });
      }

      const updateData: any = {};
      if (input.faceEmbedding) {
        updateData.faceEmbedding = JSON.stringify(input.faceEmbedding);
      }
      if (input.paymentMethodId !== undefined) {
        updateData.paymentMethodId = input.paymentMethodId;
      }
      if (input.maxPaymentAmount !== undefined) {
        updateData.maxPaymentAmount = input.maxPaymentAmount;
      }

      await updateFaceRecognition(faceRec.id, updateData);
      return { success: true };
    }),

  // Deactivate face recognition
  deactivate: protectedProcedure.mutation(async ({ ctx }) => {
    await deactivateFaceRecognition(ctx.user.id);
    return { success: true };
  }),

  // Verify face and get user info (for device use)
  verify: publicProcedure
    .input(
      z.object({
        faceEmbedding: z.array(z.number()),
        threshold: z.number().default(0.6),
      })
    )
    .mutation(async ({ input }) => {
      // Get all active face recognitions
      const { getDb } = await import("./db");
      const { faceRecognition, users } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const allFaceRecs = await db
        .select()
        .from(faceRecognition)
        .where(eq(faceRecognition.isActive, 1));

      // Find best match using cosine similarity
      let bestMatch = null;
      let bestSimilarity = 0;

      for (const faceRec of allFaceRecs) {
        const storedEmbedding = JSON.parse(faceRec.faceEmbedding);
        const similarity = cosineSimilarity(input.faceEmbedding, storedEmbedding);

        if (similarity > bestSimilarity && similarity >= input.threshold) {
          bestSimilarity = similarity;
          bestMatch = faceRec;
        }
      }

      if (!bestMatch) {
        return {
          verified: false,
          user: null,
          wallet: null,
          faceEmbedding: input.faceEmbedding,
          similarity: 0,
        };
      }

      // Get user info
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, bestMatch.userId))
        .limit(1);

      if (!user || user.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Get default wallet
      const { getDefaultWalletByUserId } = await import("./faceAndWalletDb");
      const wallet = await getDefaultWalletByUserId(bestMatch.userId);

      // Update last used timestamp
      await updateFaceRecognition(bestMatch.id, {
        lastUsedAt: new Date(),
      });

      return {
        verified: true,
        user: user[0],
        wallet: wallet || null,
        faceEmbedding: input.faceEmbedding,
        similarity: bestSimilarity,
      };
    }),
});

export const walletRouter = router({
  // Create a new wallet
  create: protectedProcedure
    .input(
      z.object({
        walletType: z.enum(["custodial", "non_custodial"]),
        walletAddress: z.string().optional(),
        currency: z.string().default("USD"),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // If setting as default, unset other default wallets
      if (input.isDefault) {
        const existingWallets = await getWalletsByUserId(ctx.user.id);
        for (const wallet of existingWallets) {
          if (wallet.isDefault) {
            await updateWallet(wallet.id, { isDefault: 0 });
          }
        }
      }

      const wallet = await createWallet({
        userId: ctx.user.id,
        walletType: input.walletType,
        walletAddress: input.walletAddress,
        currency: input.currency,
        isDefault: input.isDefault ? 1 : 0,
        balance: 0,
        status: "active",
      });

      return wallet;
    }),

  // Get all wallets for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    return getWalletsByUserId(ctx.user.id);
  }),

  // Get default wallet
  getDefault: protectedProcedure.query(async ({ ctx }) => {
    return getDefaultWalletByUserId(ctx.user.id);
  }),

  // Get wallet by ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const wallet = await getWalletById(input.id);
      if (!wallet || wallet.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Wallet not found",
        });
      }
      return wallet;
    }),

  // Deposit to wallet
  deposit: protectedProcedure
    .input(
      z.object({
        walletId: z.number(),
        amount: z.number().positive(),
        paymentMethodId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const wallet = await getWalletById(input.walletId);
      if (!wallet || wallet.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Wallet not found",
        });
      }

      if (wallet.walletType !== "custodial") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only deposit to custodial wallets",
        });
      }

      // Create wallet transaction record
      const transaction = await createWalletTransaction({
        walletId: input.walletId,
        type: "deposit",
        amount: input.amount,
        currency: wallet.currency,
        status: "pending",
        description: "Wallet deposit",
      });

      try {
        // Process payment with Stripe
        const faceRec = await getFaceRecognitionByUserId(ctx.user.id);
        if (!faceRec || !faceRec.stripeCustomerId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Stripe customer not found",
          });
        }

        const paymentIntent = await stripe.paymentIntents.create({
          amount: input.amount,
          currency: wallet.currency.toLowerCase(),
          customer: faceRec.stripeCustomerId,
          payment_method: input.paymentMethodId,
          confirm: true,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never",
          },
        });

        if (paymentIntent.status === "succeeded") {
          // Update wallet balance
          await updateWalletBalance(input.walletId, input.amount);

          // Update transaction status
          await updateWalletTransaction(transaction.id, {
            status: "completed",
            completedAt: new Date(),
          });

          return { success: true, transactionId: transaction.id };
        } else {
          throw new Error("Payment failed");
        }
      } catch (error) {
        // Update transaction status to failed
        await updateWalletTransaction(transaction.id, {
          status: "failed",
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process deposit",
        });
      }
    }),

  // Withdraw from wallet
  withdraw: protectedProcedure
    .input(
      z.object({
        walletId: z.number(),
        amount: z.number().positive(),
        destination: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const wallet = await getWalletById(input.walletId);
      if (!wallet || wallet.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Wallet not found",
        });
      }

      if (wallet.balance < input.amount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient balance",
        });
      }

      // Create withdrawal transaction
      const transaction = await createWalletTransaction({
        walletId: input.walletId,
        type: "withdraw",
        amount: -input.amount,
        currency: wallet.currency,
        status: "pending",
        description: `Withdrawal to ${input.destination}`,
      });

      try {
        // Process withdrawal (implement your withdrawal logic here)
        // For now, just update the balance

        await updateWalletBalance(input.walletId, -input.amount);

        await updateWalletTransaction(transaction.id, {
          status: "completed",
          completedAt: new Date(),
        });

        return { success: true, transactionId: transaction.id };
      } catch (error) {
        await updateWalletTransaction(transaction.id, {
          status: "failed",
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process withdrawal",
        });
      }
    }),

  // Get wallet transactions
  transactions: protectedProcedure
    .input(
      z.object({
        walletId: z.number(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const wallet = await getWalletById(input.walletId);
      if (!wallet || wallet.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Wallet not found",
        });
      }

      return getWalletTransactions(input.walletId, input.limit);
    }),
});

export const gestureRouter = router({
  // Record a gesture event (called by devices)
  record: publicProcedure
    .input(
      z.object({
        deviceId: z.number(),
        userId: z.number().optional(),
        gestureType: z.enum(["pick_up", "put_down", "yes", "no", "hold"]),
        confidence: z.number().min(0).max(100),
        productId: z.number().optional(),
        state: z.enum(["S0_waiting", "S1_approaching", "S2_picked", "S3_checkout", "S4_completed"]),
        metadata: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const event = await createGestureEvent({
        deviceId: input.deviceId,
        userId: input.userId,
        gestureType: input.gestureType,
        confidence: input.confidence,
        productId: input.productId,
        state: input.state,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      });

      return event;
    }),

  // Get gesture events for a device
  getByDevice: protectedProcedure
    .input(
      z.object({
        deviceId: z.number(),
        limit: z.number().default(100),
      })
    )
    .query(async ({ input }) => {
      return getGestureEventsByDevice(input.deviceId, input.limit);
    }),

  // Get recent gesture events
  getRecent: protectedProcedure
    .input(
      z.object({
        deviceId: z.number(),
        minutes: z.number().default(5),
      })
    )
    .query(async ({ input }) => {
      return getRecentGestureEvents(input.deviceId, input.minutes);
    }),
});

export const deviceProductRouter = router({
  // Add product to device
  add: protectedProcedure
    .input(
      z.object({
        deviceId: z.number(),
        productId: z.number(),
        displayOrder: z.number().default(0),
      })
    )
    .mutation(async ({ input }) => {
      const deviceProduct = await addProductToDevice({
        deviceId: input.deviceId,
        productId: input.productId,
        displayOrder: input.displayOrder,
        isActive: 1,
      });

      return deviceProduct;
    }),

  // Get products for a device
  list: publicProcedure
    .input(z.object({ deviceId: z.number() }))
    .query(async ({ input }) => {
      return getDeviceProducts(input.deviceId);
    }),

  // Remove product from device
  remove: protectedProcedure
    .input(
      z.object({
        deviceId: z.number(),
        productId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await removeProductFromDevice(input.deviceId, input.productId);
      return { success: true };
    }),

  // Check if product is available on device
  isAvailable: publicProcedure
    .input(
      z.object({
        deviceId: z.number(),
        productId: z.number(),
      })
    )
    .query(async ({ input }) => {
      return isProductAvailableOnDevice(input.deviceId, input.productId);
    }),
});
