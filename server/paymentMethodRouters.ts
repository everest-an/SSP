/**
 * Payment Method Management Router
 * 
 * This module handles payment method management including:
 * - Credit/debit card management via Stripe
 * - MetaMask wallet connection
 * - Payment method selection and defaults
 * - Automatic payment processing
 * 
 * @module server/paymentMethodRouters
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { users, paymentMethods } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

const stripe = ENV.stripeSecretKey ? new Stripe(ENV.stripeSecretKey, {
  apiVersion: "2025-10-29.clover",
}) : null;

/**
 * Payment method types
 */
export enum PaymentMethodType {
  CARD = "card",
  METAMASK = "metamask",
  CUSTODIAL_WALLET = "custodial_wallet",
}

/**
 * Payment Method Router
 * 
 * Provides APIs for managing user payment methods
 */
export const paymentMethodRouter = router({
  /**
   * List all payment methods for current user
   * 
   * Returns all saved payment methods including cards and wallets.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });
    }

    const methods = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, ctx.user.id))
      .orderBy(desc(paymentMethods.isDefault), desc(paymentMethods.createdAt));

    return methods.map((method) => ({
      id: method.id,
      type: method.type,
      isDefault: method.isDefault === 1,
      // Card details
      cardBrand: method.cardBrand,
      cardLast4: method.cardLast4,
      cardExpMonth: method.cardExpMonth,
      cardExpYear: method.cardExpYear,
      // Wallet details
      walletAddress: method.walletAddress,
      walletType: method.walletType,
      // Stripe details
      stripePaymentMethodId: method.stripePaymentMethodId,
      stripeCustomerId: method.stripeCustomerId,
      createdAt: method.createdAt,
    }));
  }),

  /**
   * Add credit/debit card via Stripe
   * 
   * Creates a Stripe payment method and attaches it to the customer.
   * 
   * @param paymentMethodId - Stripe payment method ID from client
   * @param setAsDefault - Whether to set as default payment method
   */
  addCard: protectedProcedure
    .input(
      z.object({
        paymentMethodId: z.string(),
        setAsDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      try {
        // Get or create Stripe customer
        let stripeCustomerId = ctx.user.stripeCustomerId;

        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            email: ctx.user.email || undefined,
            name: ctx.user.name || undefined,
            metadata: {
              userId: ctx.user.id.toString(),
            },
          });

          stripeCustomerId = customer.id;

          // Update user with Stripe customer ID
          await db
            .update(users)
            .set({ stripeCustomerId })
            .where(eq(users.id, ctx.user.id));
        }

        // Attach payment method to customer
        await stripe.paymentMethods.attach(input.paymentMethodId, {
          customer: stripeCustomerId,
        });

        // Get payment method details
        const paymentMethod = await stripe.paymentMethods.retrieve(
          input.paymentMethodId
        );

        if (paymentMethod.type !== "card" || !paymentMethod.card) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid payment method type. Only cards are supported.",
          });
        }

        // If setting as default, unset other defaults
        if (input.setAsDefault) {
          await db
            .update(paymentMethods)
            .set({ isDefault: 0 })
            .where(eq(paymentMethods.userId, ctx.user.id));

          // Set as default in Stripe
          await stripe.customers.update(stripeCustomerId, {
            invoice_settings: {
              default_payment_method: input.paymentMethodId,
            },
          });
        }

        // Save to database
        const [method] = await db
          .insert(paymentMethods)
          .values({
            userId: ctx.user.id,
            type: PaymentMethodType.CARD,
            stripePaymentMethodId: input.paymentMethodId,
            stripeCustomerId,
            cardBrand: paymentMethod.card.brand,
            cardLast4: paymentMethod.card.last4,
            cardExpMonth: paymentMethod.card.exp_month,
            cardExpYear: paymentMethod.card.exp_year,
            isDefault: input.setAsDefault ? 1 : 0,
          })
          .$returningId();

        console.log(
          `[PaymentMethod] Card added for user ${ctx.user.id}: ${paymentMethod.card.brand} ****${paymentMethod.card.last4}`
        );

        return {
          id: method.id,
          type: PaymentMethodType.CARD,
          cardBrand: paymentMethod.card.brand,
          cardLast4: paymentMethod.card.last4,
          isDefault: input.setAsDefault,
        };
      } catch (error: any) {
        console.error("[PaymentMethod] Failed to add card:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to add card",
        });
      }
    }),

  /**
   * Add MetaMask wallet
   * 
   * Saves MetaMask wallet address as a payment method.
   * 
   * @param walletAddress - Ethereum wallet address
   * @param setAsDefault - Whether to set as default payment method
   */
  addMetaMaskWallet: protectedProcedure
    .input(
      z.object({
        walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
        setAsDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      // Check if wallet already exists
      const existing = await db
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.userId, ctx.user.id),
            eq(paymentMethods.walletAddress, input.walletAddress)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This wallet is already added",
        });
      }

      // If setting as default, unset other defaults
      if (input.setAsDefault) {
        await db
          .update(paymentMethods)
          .set({ isDefault: 0 })
          .where(eq(paymentMethods.userId, ctx.user.id));
      }

      // Save to database
      const [method] = await db
        .insert(paymentMethods)
        .values({
          userId: ctx.user.id,
          type: PaymentMethodType.METAMASK,
          walletAddress: input.walletAddress,
          walletType: "non_custodial",
          isDefault: input.setAsDefault ? 1 : 0,
        })
        .$returningId();

      console.log(
        `[PaymentMethod] MetaMask wallet added for user ${ctx.user.id}: ${input.walletAddress}`
      );

      return {
        id: method.id,
        type: PaymentMethodType.METAMASK,
        walletAddress: input.walletAddress,
        isDefault: input.setAsDefault,
      };
    }),

  /**
   * Set default payment method
   * 
   * @param paymentMethodId - Payment method ID to set as default
   */
  setDefault: protectedProcedure
    .input(z.object({ paymentMethodId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      // Verify payment method belongs to user
      const [method] = await db
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.id, input.paymentMethodId),
            eq(paymentMethods.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!method) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment method not found",
        });
      }

      // Unset all defaults
      await db
        .update(paymentMethods)
        .set({ isDefault: 0 })
        .where(eq(paymentMethods.userId, ctx.user.id));

      // Set new default
      await db
        .update(paymentMethods)
        .set({ isDefault: 1 })
        .where(eq(paymentMethods.id, input.paymentMethodId));

      // If it's a Stripe card, update Stripe
      if (method.type === PaymentMethodType.CARD && method.stripeCustomerId && method.stripePaymentMethodId) {
        await stripe.customers.update(method.stripeCustomerId, {
          invoice_settings: {
            default_payment_method: method.stripePaymentMethodId,
          },
        });
      }

      console.log(
        `[PaymentMethod] Default payment method set for user ${ctx.user.id}: ${input.paymentMethodId}`
      );

      return { success: true };
    }),

  /**
   * Remove payment method
   * 
   * @param paymentMethodId - Payment method ID to remove
   */
  remove: protectedProcedure
    .input(z.object({ paymentMethodId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      // Verify payment method belongs to user
      const [method] = await db
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.id, input.paymentMethodId),
            eq(paymentMethods.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!method) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment method not found",
        });
      }

      // Detach from Stripe if it's a card
      if (method.type === PaymentMethodType.CARD && method.stripePaymentMethodId) {
        try {
          await stripe.paymentMethods.detach(method.stripePaymentMethodId);
        } catch (error) {
          console.error("[PaymentMethod] Failed to detach from Stripe:", error);
          // Continue with database deletion even if Stripe fails
        }
      }

      // Delete from database
      await db
        .delete(paymentMethods)
        .where(eq(paymentMethods.id, input.paymentMethodId));

      console.log(
        `[PaymentMethod] Payment method removed for user ${ctx.user.id}: ${input.paymentMethodId}`
      );

      return { success: true };
    }),

  /**
   * Get default payment method
   * 
   * Returns the user's default payment method.
   */
  getDefault: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });
    }

    const [method] = await db
      .select()
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.userId, ctx.user.id),
          eq(paymentMethods.isDefault, 1)
        )
      )
      .limit(1);

    if (!method) {
      return null;
    }

    return {
      id: method.id,
      type: method.type,
      isDefault: true,
      cardBrand: method.cardBrand,
      cardLast4: method.cardLast4,
      walletAddress: method.walletAddress,
      walletType: method.walletType,
    };
  }),

  /**
   * Process payment with default method
   * 
   * Used internally by order creation to charge the default payment method.
   * 
   * @param amount - Amount in cents
   * @param currency - Currency code (USD, etc.)
   * @param orderId - Order ID for reference
   */
  processPayment: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        amount: z.number().positive(),
        currency: z.string().default("USD"),
        orderId: z.number(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      // Get default payment method
      const [method] = await db
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.userId, input.userId),
            eq(paymentMethods.isDefault, 1)
          )
        )
        .limit(1);

      if (!method) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No default payment method found. Please add a payment method first.",
        });
      }

      // Process based on payment method type
      if (method.type === PaymentMethodType.CARD) {
        return await this.processCardPayment(method, input);
      } else if (method.type === PaymentMethodType.METAMASK) {
        return await this.processMetaMaskPayment(method, input);
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unsupported payment method type: ${method.type}`,
        });
      }
    }),

  /**
   * Process card payment via Stripe
   * 
   * @private
   */
  async processCardPayment(method: any, input: any) {
    if (!method.stripePaymentMethodId || !method.stripeCustomerId) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid card payment method configuration",
      });
    }

    try {
      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        customer: method.stripeCustomerId,
        payment_method: method.stripePaymentMethodId,
        off_session: true, // Automatic payment
        confirm: true, // Automatically confirm
        description: input.description || `Order #${input.orderId}`,
        metadata: {
          orderId: input.orderId.toString(),
          userId: input.userId.toString(),
        },
      });

      if (paymentIntent.status === "succeeded") {
        console.log(
          `[PaymentMethod] Card payment successful: ${paymentIntent.id}`
        );

        return {
          success: true,
          paymentIntentId: paymentIntent.id,
          status: "succeeded",
          amount: paymentIntent.amount,
        };
      } else {
        throw new TRPCError({
          code: "PAYMENT_REQUIRED",
          message: `Payment ${paymentIntent.status}. Please try again or use a different payment method.`,
        });
      }
    } catch (error: any) {
      console.error("[PaymentMethod] Card payment failed:", error);
      throw new TRPCError({
        code: "PAYMENT_REQUIRED",
        message: error.message || "Card payment failed",
      });
    }
  },

  /**
   * Process MetaMask payment
   * 
   * Note: This returns pending status as blockchain confirmation is required.
   * The actual transaction must be initiated from the client side.
   * 
   * @private
   */
  async processMetaMaskPayment(method: any, input: any) {
    // MetaMask payments require client-side transaction signing
    // Return pending status and let client handle the transaction
    console.log(
      `[PaymentMethod] MetaMask payment initiated for order ${input.orderId}`
    );

    return {
      success: true,
      pending: true,
      status: "pending_blockchain_confirmation",
      walletAddress: method.walletAddress,
      amount: input.amount,
      message: "Please confirm the transaction in MetaMask",
    };
  },
});
