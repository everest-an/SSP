/**
 * Enhanced Payment Methods Router
 * 
 * Comprehensive payment method management with Stripe integration
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import { paymentMethods, paymentTransactions, users } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { stripe } from "../stripe";

export const enhancedPaymentRouter = router({
  /**
   * Add a new payment method (Stripe)
   */
  addStripePaymentMethod: protectedProcedure
    .input(z.object({
      paymentMethodId: z.string(), // Stripe payment method ID
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
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
          await db.update(users)
            .set({ stripeCustomerId })
            .where(eq(users.id, ctx.user.id));
        }

        // Attach payment method to customer
        await stripe.paymentMethods.attach(input.paymentMethodId, {
          customer: stripeCustomerId,
        });

        // Set as default if requested
        if (input.isDefault) {
          await stripe.customers.update(stripeCustomerId, {
            invoice_settings: {
              default_payment_method: input.paymentMethodId,
            },
          });

          // Unset other default payment methods
          await db.update(paymentMethods)
            .set({ isDefault: false })
            .where(and(
              eq(paymentMethods.userId, ctx.user.id),
              eq(paymentMethods.methodType, 'stripe')
            ));
        }

        // Get payment method details
        const paymentMethod = await stripe.paymentMethods.retrieve(input.paymentMethodId);

        // Store in database
        const [savedMethod] = await db.insert(paymentMethods).values({
          userId: ctx.user.id,
          methodType: 'stripe',
          methodData: JSON.stringify({
            paymentMethodId: input.paymentMethodId,
            type: paymentMethod.type,
            card: paymentMethod.card ? {
              brand: paymentMethod.card.brand,
              last4: paymentMethod.card.last4,
              expMonth: paymentMethod.card.exp_month,
              expYear: paymentMethod.card.exp_year,
            } : null,
          }),
          isDefault: input.isDefault,
        }).returning();

        return savedMethod;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to add payment method: ${error.message}`,
        });
      }
    }),

  /**
   * Get all payment methods for current user
   */
  getMyPaymentMethods: protectedProcedure
    .query(async ({ ctx }) => {
      const methods = await db.query.paymentMethods.findMany({
        where: eq(paymentMethods.userId, ctx.user.id),
        orderBy: [desc(paymentMethods.createdAt)],
      });

      return methods.map(method => ({
        ...method,
        methodData: method.methodData ? JSON.parse(method.methodData) : null,
      }));
    }),

  /**
   * Remove a payment method
   */
  removePaymentMethod: protectedProcedure
    .input(z.object({
      paymentMethodId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const method = await db.query.paymentMethods.findFirst({
        where: eq(paymentMethods.id, input.paymentMethodId),
      });

      if (!method) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payment method not found',
        });
      }

      if (method.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to remove this payment method',
        });
      }

      // Detach from Stripe if it's a Stripe payment method
      if (method.methodType === 'stripe' && method.methodData) {
        try {
          const data = JSON.parse(method.methodData);
          if (data.paymentMethodId) {
            await stripe.paymentMethods.detach(data.paymentMethodId);
          }
        } catch (error) {
          console.error('Failed to detach payment method from Stripe:', error);
        }
      }

      // Delete from database
      await db.delete(paymentMethods)
        .where(eq(paymentMethods.id, input.paymentMethodId));

      return { success: true };
    }),

  /**
   * Set default payment method
   */
  setDefaultPaymentMethod: protectedProcedure
    .input(z.object({
      paymentMethodId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const method = await db.query.paymentMethods.findFirst({
        where: eq(paymentMethods.id, input.paymentMethodId),
      });

      if (!method) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payment method not found',
        });
      }

      if (method.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to modify this payment method',
        });
      }

      // Unset all default payment methods
      await db.update(paymentMethods)
        .set({ isDefault: false })
        .where(eq(paymentMethods.userId, ctx.user.id));

      // Set new default
      await db.update(paymentMethods)
        .set({ isDefault: true })
        .where(eq(paymentMethods.id, input.paymentMethodId));

      // Update Stripe customer default payment method if applicable
      if (method.methodType === 'stripe' && ctx.user.stripeCustomerId && method.methodData) {
        try {
          const data = JSON.parse(method.methodData);
          if (data.paymentMethodId) {
            await stripe.customers.update(ctx.user.stripeCustomerId, {
              invoice_settings: {
                default_payment_method: data.paymentMethodId,
              },
            });
          }
        } catch (error) {
          console.error('Failed to update Stripe default payment method:', error);
        }
      }

      return { success: true };
    }),

  /**
   * Create a payment intent for direct charges
   */
  createPaymentIntent: protectedProcedure
    .input(z.object({
      amount: z.number().min(50), // Minimum $0.50
      currency: z.string().default('usd'),
      paymentMethodId: z.number().optional(),
      description: z.string().optional(),
      metadata: z.record(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
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

          await db.update(users)
            .set({ stripeCustomerId })
            .where(eq(users.id, ctx.user.id));
        }

        // Get payment method if specified
        let stripePaymentMethodId: string | undefined;
        if (input.paymentMethodId) {
          const method = await db.query.paymentMethods.findFirst({
            where: eq(paymentMethods.id, input.paymentMethodId),
          });

          if (method && method.methodData) {
            const data = JSON.parse(method.methodData);
            stripePaymentMethodId = data.paymentMethodId;
          }
        }

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: input.amount,
          currency: input.currency,
          customer: stripeCustomerId,
          payment_method: stripePaymentMethodId,
          description: input.description,
          metadata: {
            userId: ctx.user.id.toString(),
            ...input.metadata,
          },
          automatic_payment_methods: stripePaymentMethodId ? undefined : {
            enabled: true,
          },
        });

        return {
          clientSecret: paymentIntent
.client_secret,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create payment intent: ${error.message}`,
        });
      }
    }),

  /**
   * Confirm a payment intent
   */
  confirmPaymentIntent: protectedProcedure
    .input(z.object({
      paymentIntentId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const paymentIntent = await stripe.paymentIntents.confirm(input.paymentIntentId);

        return {
          status: paymentIntent.status,
          paymentIntentId: paymentIntent.id,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to confirm payment: ${error.message}`,
        });
      }
    }),

  /**
   * Get payment transaction history
   */
  getPaymentHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const transactions = await db.query.paymentTransactions.findMany({
        where: eq(paymentTransactions.userId, ctx.user.id),
        orderBy: [desc(paymentTransactions.createdAt)],
        limit: input.limit,
        offset: input.offset,
        with: {
          order: {
            with: {
              merchant: true,
            },
          },
        },
      });

      return transactions;
    }),

  /**
   * Get Stripe setup intent for adding payment method
   */
  createSetupIntent: protectedProcedure
    .mutation(async ({ ctx }) => {
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

          await db.update(users)
            .set({ stripeCustomerId })
            .where(eq(users.id, ctx.user.id));
        }

        // Create setup intent
        const setupIntent = await stripe.setupIntents.create({
          customer: stripeCustomerId,
          payment_method_types: ['card'],
        });

        return {
          clientSecret: setupIntent.client_secret,
          setupIntentId: setupIntent.id,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create setup intent: ${error.message}`,
        });
      }
    }),

  /**
   * Get payment method statistics
   */
  getPaymentMethodStats: protectedProcedure
    .query(async ({ ctx }) => {
      const methods = await db.query.paymentMethods.findMany({
        where: eq(paymentMethods.userId, ctx.user.id),
      });

      const stats = {
        total: methods.length,
        stripe: methods.filter(m => m.methodType === 'stripe').length,
        wallet: methods.filter(m => m.methodType === 'wallet').length,
        metamask: methods.filter(m => m.methodType === 'metamask').length,
        hasDefault: methods.some(m => m.isDefault),
      };

      return stats;
    }),
});
