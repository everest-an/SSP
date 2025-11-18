/**
 * YOLO Product Detection Router
 * 
 * Handles product detection using YOLO (You Only Look Once) object detection
 * Automatically builds shopping carts from camera feeds
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import { 
  detectionEvents, 
  products, 
  devices, 
  orderItems,
  orders 
} from "../../drizzle/schema";
import { eq, and, desc, gte } from "drizzle-orm";

// Detection confidence threshold
const CONFIDENCE_THRESHOLD = 0.5;

export const yoloDetectionRouter = router({
  /**
   * Process detection event from device
   */
  processDetectionEvent: protectedProcedure
    .input(z.object({
      deviceId: z.number(),
      detections: z.array(z.object({
        productId: z.number().optional(),
        productName: z.string(),
        confidence: z.number().min(0).max(1),
        boundingBox: z.object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number(),
        }),
        barcode: z.string().optional(),
      })),
      imageUrl: z.string().optional(),
      timestamp: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify device exists and user has access
      const device = await db.query.devices.findFirst({
        where: eq(devices.id, input.deviceId),
        with: {
          merchant: true,
        },
      });

      if (!device) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Device not found',
        });
      }

      if (device.merchant.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this device',
        });
      }

      // Filter detections by confidence threshold
      const validDetections = input.detections.filter(
        d => d.confidence >= CONFIDENCE_THRESHOLD
      );

      // Store detection event
      const [event] = await db.insert(detectionEvents).values({
        deviceId: input.deviceId,
        detectedProducts: JSON.stringify(validDetections),
        imageUrl: input.imageUrl,
        detectionCount: validDetections.length,
        createdAt: input.timestamp ? new Date(input.timestamp) : new Date(),
      }).returning();

      // Match detected products with database
      const matchedProducts = await Promise.all(
        validDetections.map(async (detection) => {
          let product = null;

          // Try to match by product ID
          if (detection.productId) {
            product = await db.query.products.findFirst({
              where: eq(products.id, detection.productId),
            });
          }

          // Try to match by barcode
          if (!product && detection.barcode) {
            product = await db.query.products.findFirst({
              where: and(
                eq(products.barcode, detection.barcode),
                eq(products.merchantId, device.merchantId)
              ),
            });
          }

          // Try to match by name (fuzzy matching could be improved)
          if (!product) {
            const allProducts = await db.query.products.findMany({
              where: eq(products.merchantId, device.merchantId),
            });

            product = allProducts.find(p => 
              p.name.toLowerCase().includes(detection.productName.toLowerCase()) ||
              detection.productName.toLowerCase().includes(p.name.toLowerCase())
            );
          }

          return {
            detection,
            product,
            matched: !!product,
          };
        })
      );

      return {
        eventId: event.id,
        totalDetections: input.detections.length,
        validDetections: validDetections.length,
        matchedProducts: matchedProducts.filter(m => m.matched).length,
        unmatchedProducts: matchedProducts.filter(m => !m.matched).length,
        products: matchedProducts,
      };
    }),

  /**
   * Build cart from detection event
   */
  buildCartFromDetection: protectedProcedure
    .input(z.object({
      eventId: z.number(),
      userId: z.number().optional(), // Optional: specify user for the cart
    }))
    .mutation(async ({ ctx, input }) => {
      // Get detection event
      const event = await db.query.detectionEvents.findFirst({
        where: eq(detectionEvents.id, input.eventId),
        with: {
          device: {
            with: {
              merchant: true,
            },
          },
        },
      });

      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Detection event not found',
        });
      }

      // Parse detected products
      const detections = JSON.parse(event.detectedProducts) as Array<{
        productName: string;
        confidence: number;
        barcode?: string;
      }>;

      // Match products
      const matchedProducts = await Promise.all(
        detections.map(async (detection) => {
          let product = null;

          if (detection.barcode) {
            product = await db.query.products.findFirst({
              where: and(
                eq(products.barcode, detection.barcode),
                eq(products.merchantId, event.device.merchantId)
              ),
            });
          }

          if (!product) {
            const allProducts = await db.query.products.findMany({
              where: eq(products.merchantId, event.device.merchantId),
            });

            product = allProducts.find(p => 
              p.name.toLowerCase().includes(detection.productName.toLowerCase())
            );
          }

          return product;
        })
      );

      const validProducts = matchedProducts.filter(p => p !== null);

      if (validProducts.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No valid products found in detection',
        });
      }

      // Calculate total
      const totalAmount = validProducts.reduce((sum, p) => sum + (p?.price || 0), 0);

      // Create order
      const [order] = await db.insert(orders).values({
        userId: input.userId || ctx.user.id,
        merchantId: event.device.merchantId,
        deviceId: event.deviceId,
        totalAmount,
        status: 'pending',
        paymentMethod: 'pending',
      }).returning();

      // Create order items
      await Promise.all(
        validProducts.map(async (product) => {
          if (product) {
            await db.insert(orderItems).values({
              orderId: order.id,
              productId: product.id,
              quantity: 1,
              unitPrice: product.price,
              totalPrice: product.price,
            });
          }
        })
      );

      return {
        orderId: order.id,
        totalAmount: order.totalAmount,
        itemCount: validProducts.length,
        products: validProducts,
      };
    }),

  /**
   * Get detection events for a device
   */
  getDeviceDetections: protectedProcedure
    .input(z.object({
      deviceId: z.number(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      startDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify device access
      const device = await db.query.devices.findFirst({
        where: eq(devices.id, input.deviceId),
        with: {
          merchant: true,
        },
      });

      if (!device) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Device not found',
        });
      }

      if (device.merchant.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this device',
        });
      }

      const conditions = [eq(detectionEvents.deviceId, input.deviceId)];

      if (input.startDate) {
        conditions.push(gte(detectionEvents.createdAt, new Date(input.startDate)));
      }

      const events = await db.query.detectionEvents.findMany({
        where: and(...conditions),
        orderBy: [desc(detectionEvents.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return events.map(event => ({
        ...event,
        detectedProducts: JSON.parse(event.detectedProducts),
      }));
    }),

  /**
   * Get detection statistics
   */
  getDetectionStats: protectedProcedure
    .input(z.object({
      deviceId: z.number().optional(),
      merchantId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let conditions = [];

      if (input.deviceId) {
        conditions.push(eq(detectionEvents.deviceId, input.deviceId));
      }

      if (input.startDate) {
        conditions.push(gte(detectionEvents.createdAt, new Date(input.startDate)));
      }

      // Get all events
      const events = await db.query.detectionEvents.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          device: true,
        },
      });

      // Filter by merchant if specified
      const filteredEvents = input.merchantId
        ? events.filter(e => e.device.merchantId === input.merchantId)
        : events;

      // Calculate statistics
      const totalDetections = filteredEvents.reduce(
        (sum, event) => sum + event.detectionCount,
        0
      );

      const avgDetectionsPerEvent = filteredEvents.length > 0
        ? totalDetections / filteredEvents.length
        : 0;

      return {
        totalEvents: filteredEvents.length,
        totalDetections,
        avgDetectionsPerEvent: Math.round(avgDetectionsPerEvent * 100) / 100,
        eventsWithDetections: filteredEvents.filter(e => e.detectionCount > 0).length,
      };
    }),

  /**
   * Train custom product model (placeholder)
   */
  trainCustomModel: protectedProcedure
    .input(z.object({
      merchantId: z.number(),
      productIds: z.array(z.number()),
      trainingImages: z.array(z.string()), // URLs to training images
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify merchant ownership
      const merchant = await db.query.merchants.findFirst({
        where: eq(products.id, input.merchantId),
      });

      if (!merchant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Merchant not found',
        });
      }

      // TODO: Implement actual model training
      // This would involve:
      // 1. Collecting training images
      // 2. Preprocessing images
      // 3. Training YOLO model
      // 4. Deploying model to edge devices

      console.log(`[YOLO] Training custom model for merchant ${input.merchantId}`);
      console.log(`[YOLO] Products: ${input.productIds.join(', ')}`);
      console.log(`[YOLO] Training images: ${input.trainingImages.length}`);

      return {
        success: true,
        modelId: `model_${Date.now()}`,
        status: 'training',
        estimatedCompletionTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      };
    }),

  /**
   * Get supported detection models
   */
  getSupportedModels: protectedProcedure
    .query(() => {
      return [
        {
          id: 'yolov8n',
          name: 'YOLOv8 Nano',
          description: 'Fast and lightweight model for edge devices',
          accuracy: 'Medium',
          speed: 'Very Fast',
          recommended: true,
        },
        {
          id: 'yolov8s',
          name: 'YOLOv8 Small',
          description: 'Balanced model for general use',
          accuracy: 'Good',
          speed: 'Fast',
          recommended: false,
        },
        {
          id: 'yolov8m',
          name: 'YOLOv8 Medium',
          description: 'Higher accuracy for complex scenarios',
          accuracy: 'High',
          speed: 'Medium',
          recommended: false,
        },
        {
          id: 'custom',
          name: 'Custom Model',
          description: 'Train a custom model for your specific products',
          accuracy: 'Variable',
          speed: 'Variable',
          recommended: false,
        },
      ];
    }),
});
