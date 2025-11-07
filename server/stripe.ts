import express from "express";
import Stripe from "stripe";
import { ENV } from "./_core/env";
import { getProductByPriceId } from "./products";
import { createTransaction, createOrder, createOrderItem, updateOrder } from "./db";

const stripe = new Stripe(ENV.stripeSecretKey, {
  apiVersion: "2025-10-29.clover",
});

export const stripeRouter = express.Router();

/**
 * Stripe webhook endpoint
 * IMPORTANT: This must be registered BEFORE express.json() middleware
 * with express.raw({ type: 'application/json' })
 */
stripeRouter.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      console.error("[Stripe] No signature found");
      return res.status(400).send("No signature");
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        ENV.stripeWebhookSecret
      );
    } catch (err: any) {
      console.error(`[Stripe] Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`[Stripe] Received event: ${event.type}`);

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutSessionCompleted(session);
          break;
        }

        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`[Stripe] PaymentIntent succeeded: ${paymentIntent.id}`);
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`[Stripe] PaymentIntent failed: ${paymentIntent.id}`);
          break;
        }

        default:
          console.log(`[Stripe] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error(`[Stripe] Error processing webhook: ${error.message}`);
      res.status(500).send(`Webhook processing error: ${error.message}`);
    }
  }
);

/**
 * Handle completed checkout session
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log(`[Stripe] Processing checkout session: ${session.id}`);

  const userId = session.metadata?.user_id;
  const merchantId = session.metadata?.merchant_id;
  const deviceId = session.metadata?.device_id;

  if (!userId || !merchantId) {
    console.error("[Stripe] Missing user_id or merchant_id in session metadata");
    return;
  }

  // Retrieve line items
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    expand: ["data.price.product"],
  });

  // Create order
  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  
  const order = await createOrder({
    merchantId: parseInt(merchantId),
    ...(deviceId && { deviceId: parseInt(deviceId) }),
    customerId: parseInt(userId),
    orderNumber,
    totalAmount: session.amount_total || 0,
    currency: session.currency?.toUpperCase() || "USD",
    status: "completed",
    paymentStatus: "captured",
    paymentMethod: session.payment_method_types?.[0] || "card",
  });

  // Create order items
  for (const item of lineItems.data) {
    const product = item.price?.product as Stripe.Product;
    await createOrderItem({
      orderId: order.id,
      productId: 0, // Stripe product, not in our catalog
      productName: product?.name || item.description || "Unknown Product",
      quantity: item.quantity || 1,
      unitPrice: item.price?.unit_amount || 0,
      totalPrice: (item.price?.unit_amount || 0) * (item.quantity || 1),
    });
  }

  // Create transaction record
  await createTransaction({
    orderId: order.id,
    transactionId: session.payment_intent as string || session.id,
    paymentGateway: "Stripe",
    amount: session.amount_total || 0,
    currency: session.currency?.toUpperCase() || "USD",
    status: "success",
    paymentMethod: session.payment_method_types?.[0] || "card",
  });

  // Update order to completed
  await updateOrder(order.id, {
    status: "completed",
    paymentStatus: "captured",
    completedAt: new Date(),
  });

  console.log(`[Stripe] Order ${orderNumber} created successfully`);
}

export { stripe };
