/**
 * KYC (Know Your Customer) Verification Router
 * 
 * Handles merchant identity verification and compliance
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import { 
  kycVerifications, 
  kycDocuments,
  merchants,
  users 
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// KYC verification status enum
const KYCStatus = z.enum(['pending', 'approved', 'rejected', 'expired']);

// Document type enum
const DocumentType = z.enum([
  'passport',
  'drivers_license',
  'national_id',
  'business_license',
  'tax_certificate',
  'bank_statement',
  'utility_bill',
  'other'
]);

export const kycRouter = router({
  /**
   * Submit KYC verification request
   */
  submitKYCVerification: protectedProcedure
    .input(z.object({
      merchantId: z.number(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      dateOfBirth: z.string(), // ISO date string
      nationality: z.string().min(2).max(2), // ISO country code
      address: z.string().min(1),
      city: z.string().min(1),
      postalCode: z.string().min(1),
      country: z.string().min(2).max(2),
      idNumber: z.string().optional(),
      taxId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify merchant ownership
      const merchant = await db.query.merchants.findFirst({
        where: eq(merchants.id, input.merchantId),
      });

      if (!merchant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Merchant not found',
        });
      }

      if (merchant.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to submit KYC for this merchant',
        });
      }

      // Check if there's already a pending or approved verification
      const existingVerification = await db.query.kycVerifications.findFirst({
        where: and(
          eq(kycVerifications.merchantId, input.merchantId),
          eq(kycVerifications.status, 'pending')
        ),
      });

      if (existingVerification) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'A KYC verification is already pending for this merchant',
        });
      }

      // Create KYC verification record
      const [verification] = await db.insert(kycVerifications).values({
        merchantId: input.merchantId,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: new Date(input.dateOfBirth),
        nationality: input.nationality,
        address: input.address,
        city: input.city,
        postalCode: input.postalCode,
        country: input.country,
        idNumber: input.idNumber,
        taxId: input.taxId,
        status: 'pending',
        submittedAt: new Date(),
      }).returning();

      // TODO: Integrate with third-party KYC provider (e.g., Stripe Identity, Onfido, Jumio)
      console.log(`[KYC] Verification submitted for merchant ${input.merchantId}`);

      return verification;
    }),

  /**
   * Upload KYC document
   */
  uploadKYCDocument: protectedProcedure
    .input(z.object({
      verificationId: z.number(),
      documentType: DocumentType,
      documentUrl: z.string().url(),
      documentNumber: z.string().optional(),
      expiryDate: z.string().optional(), // ISO date string
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify verification exists and user has permission
      const verification = await db.query.kycVerifications.findFirst({
        where: eq(kycVerifications.id, input.verificationId),
        with: {
          merchant: true,
        },
      });

      if (!verification) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'KYC verification not found',
        });
      }

      if (verification.merchant.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to upload documents for this verification',
        });
      }

      // Create document record
      const [document] = await db.insert(kycDocuments).values({
        verificationId: input.verificationId,
        documentType: input.documentType,
        documentUrl: input.documentUrl,
        documentNumber: input.documentNumber,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        uploadedAt: new Date(),
      }).returning();

      console.log(`[KYC] Document uploaded for verification ${input.verificationId}`);

      return document;
    }),

  /**
   * Get KYC verification status
   */
  getKYCVerification: protectedProcedure
    .input(z.object({
      merchantId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify merchant ownership
      const merchant = await db.query.merchants.findFirst({
        where: eq(merchants.id, input.merchantId),
      });

      if (!merchant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Merchant not found',
        });
      }

      if (merchant.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this KYC verification',
        });
      }

      // Get latest verification
      const verification = await db.query.kycVerifications.findFirst({
        where: eq(kycVerifications.merchantId, input.merchantId),
        orderBy: [desc(kycVerifications.submittedAt)],
        with: {
          documents: true,
        },
      });

      return verification;
    }),

  /**
   * Get all KYC verifications (Admin only)
   */
  getAllKYCVerifications: protectedProcedure
    .input(z.object({
      status: KYCStatus.optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }

      const conditions = input.status
        ? [eq(kycVerifications.status, input.status)]
        : [];

      const verifications = await db.query.kycVerifications.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(kycVerifications.submittedAt)],
        limit: input.limit,
        offset: input.offset,
        with: {
          merchant: {
            with: {
              user: {
                columns: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          documents: true,
        },
      });

      return verifications;
    }),

  /**
   * Approve KYC verification (Admin only)
   */
  approveKYCVerification: protectedProcedure
    .input(z.object({
      verificationId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }

      const verification = await db.query.kycVerifications.findFirst({
        where: eq(kycVerifications.id, input.verificationId),
        with: {
          merchant: {
            with: {
              user: true,
            },
          },
        },
      });

      if (!verification) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'KYC verification not found',
        });
      }

      // Update verification status
      await db.update(kycVerifications)
        .set({
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          reviewNotes: input.notes,
        })
        .where(eq(kycVerifications.id, input.verificationId));

      // Update merchant verification status
      await db.update(merchants)
        .set({
          kycVerified: true,
          kycVerifiedAt: new Date(),
        })
        .where(eq(merchants.id, verification.merchantId));

      // TODO: Send approval email
      console.log(`[KYC] Verification approved for merchant ${verification.merchantId}`);

      return { success: true };
    }),

  /**
   * Reject KYC verification (Admin only)
   */
  rejectKYCVerification: protectedProcedure
    .input(z.object({
      verificationId: z.number(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }

      const verification = await db.query.kycVerifications.findFirst({
        where: eq(kycVerifications.id, input.verificationId),
        with: {
          merchant: {
            with: {
              user: true,
            },
          },
        },
      });

      if (!verification) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'KYC verification not found',
        });
      }

      // Update verification status
      await db.update(kycVerifications)
        .set({
          status: 'rejected',
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          reviewNotes: input.reason,
        })
        .where(eq(kycVerifications.id, input.verificationId));

      // Update merchant verification status
      await db.update(merchants)
        .set({
          kycVerified: false,
        })
        .where(eq(merchants.id, verification.merchantId));

      // TODO: Send rejection email
      console.log(`[KYC] Verification rejected for merchant ${verification.merchantId}`);

      return { success: true };
    }),

  /**
   * Get KYC statistics (Admin only)
   */
  getKYCStatistics: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }

      const allVerifications = await db.query.kycVerifications.findMany();

      const stats = {
        total: allVerifications.length,
        pending: allVerifications.filter(v => v.status === 'pending').length,
        approved: allVerifications.filter(v => v.status === 'approved').length,
        rejected: allVerifications.filter(v => v.status === 'rejected').length,
        expired: allVerifications.filter(v => v.status === 'expired').length,
      };

      return stats;
    }),
});
