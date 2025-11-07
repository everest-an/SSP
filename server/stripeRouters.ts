import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { stripe } from "./stripe";
import { ENV } from "./_core/env";
import { getAllProducts, getProductById } from "./products";
import { TRPCError } from "@trpc/server";

/**
 * Stripe-related tRPC procedures
 */
export const stripeRouters = router({
  /**
   * Get all available products/plans
   */
  getProducts: protectedProcedure.query(() => {
    return getAllProducts();
  }),

  /**
   * Create a Stripe Checkout Session
   */
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        productId: z.string(),
        merchantId: z.number(),
        deviceId: z.number().optional(),
        successUrl: z.string().optional(),
        cancelUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const product = getProductById(input.productId);

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found",
        });
      }

      // Use request origin for redirect URLs
      const origin = ctx.req.headers.origin || `http://localhost:3000`;
      const successUrl = input.successUrl || `${origin}/orders?success=true`;
      const cancelUrl = input.cancelUrl || `${origin}/orders?cancelled=true`;

      // Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        mode: product.type === "subscription" ? "subscription" : "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price: product.priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: ctx.user.email || undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email || "",
          customer_name: ctx.user.name || "",
          merchant_id: input.merchantId.toString(),
          ...(input.deviceId && { device_id: input.deviceId.toString() }),
          product_id: product.id,
        },
        allow_promotion_codes: true,
      });

      return {
        sessionId: session.id,
        url: session.url,
      };
    }),

  /**
   * Get Stripe publishable key for frontend
   */
  getPublishableKey: protectedProcedure.query(() => {
    return {
      publishableKey: ENV.stripePublishableKey,
    };
  }),

  /**
   * Create a custom payment session for direct product purchases
   */
  createProductCheckout: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            productId: z.number(),
            productName: z.string(),
            quantity: z.number().min(1),
            unitPrice: z.number().min(0), // in cents
          })
        ),
        merchantId: z.number(),
        deviceId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Calculate total
      const totalAmount = input.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      );

      // Create Stripe line items
      const lineItems = input.items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.productName,
          },
          unit_amount: item.unitPrice,
        },
        quantity: item.quantity,
      }));

      const origin = ctx.req.headers.origin || `http://localhost:3000`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: lineItems,
        success_url: `${origin}/orders?success=true`,
        cancel_url: `${origin}/orders?cancelled=true`,
        customer_email: ctx.user.email || undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email || "",
          customer_name: ctx.user.name || "",
          merchant_id: input.merchantId.toString(),
          ...(input.deviceId && { device_id: input.deviceId.toString() }),
          items: JSON.stringify(input.items),
        },
        allow_promotion_codes: true,
      });

      return {
        sessionId: session.id,
        url: session.url,
      };
    }),
});
