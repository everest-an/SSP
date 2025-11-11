/**
 * User Privacy Service
 * Handles user privacy settings, consent management, and data deletion
 * 
 * Sprint 4: User Privacy Controls
 */

import { db } from '../../db';
import {
  users,
  userPrivacySettings,
  consentHistory,
  dataDeletionRequests,
  faceProfiles,
  paymentMethods,
} from '../../../drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { AuditLogger } from '../../middleware/auditLogger';
import crypto from 'crypto';

export interface ConsentUpdate {
  consentType: string;
  consentGiven: boolean;
  consentVersion?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PrivacySettingsUpdate {
  faceAuthEnabled?: boolean;
  faceDataConsent?: boolean;
  dataSharingConsent?: boolean;
  marketingConsent?: boolean;
  allowFaceForPayment?: boolean;
  requireSecondFactor?: boolean;
  dataRetentionPreference?: 'minimal' | 'standard' | 'extended';
}

/**
 * User Privacy Service
 * Manages user privacy preferences and data rights
 */
export class UserPrivacyService {
  /**
   * Initialize privacy settings for a new user
   */
  static async initializePrivacySettings(userId: number): Promise<void> {
    try {
      await db.insert(userPrivacySettings).values({
        userId,
        faceAuthEnabled: true,
        faceDataConsent: false,
        dataSharingConsent: false,
        marketingConsent: false,
        allowFaceForPayment: true,
        requireSecondFactor: false,
        dataRetentionPreference: 'standard',
      });

      console.log(`[Privacy] Initialized privacy settings for user ${userId}`);
    } catch (error) {
      console.error('[Privacy] Error initializing privacy settings:', error);
      throw error;
    }
  }

  /**
   * Get user's privacy settings
   */
  static async getPrivacySettings(userId: number): Promise<any> {
    try {
      const [settings] = await db
        .select()
        .from(userPrivacySettings)
        .where(eq(userPrivacySettings.userId, userId))
        .limit(1);

      if (!settings) {
        // Initialize if not exists
        await this.initializePrivacySettings(userId);
        return await this.getPrivacySettings(userId);
      }

      return settings;
    } catch (error) {
      console.error('[Privacy] Error getting privacy settings:', error);
      throw error;
    }
  }

  /**
   * Update user's privacy settings
   */
  static async updatePrivacySettings(
    userId: number,
    updates: PrivacySettingsUpdate,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    try {
      // Get current settings
      const current = await this.getPrivacySettings(userId);

      // Track consent changes
      const consentChanges: ConsentUpdate[] = [];

      if (updates.faceDataConsent !== undefined && updates.faceDataConsent !== current.faceDataConsent) {
        consentChanges.push({
          consentType: 'face_data',
          consentGiven: updates.faceDataConsent,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        });

        // If consent is revoked, flag for data deletion
        if (!updates.faceDataConsent && current.faceDataConsent) {
          await this.requestDataDeletion(userId, 'face_data', 'Consent revoked');
        }
      }

      if (updates.dataSharingConsent !== undefined && updates.dataSharingConsent !== current.dataSharingConsent) {
        consentChanges.push({
          consentType: 'data_sharing',
          consentGiven: updates.dataSharingConsent,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        });
      }

      if (updates.marketingConsent !== undefined && updates.marketingConsent !== current.marketingConsent) {
        consentChanges.push({
          consentType: 'marketing',
          consentGiven: updates.marketingConsent,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        });
      }

      // Update settings
      const updateData: any = { ...updates };
      if (updates.faceDataConsent) {
        updateData.faceDataConsentAt = new Date();
      }
      updateData.lastPrivacyReview = new Date();

      await db
        .update(userPrivacySettings)
        .set(updateData)
        .where(eq(userPrivacySettings.userId, userId));

      // Record consent changes
      for (const change of consentChanges) {
        await this.recordConsent(userId, change);
      }

      // Log to audit
      await AuditLogger.logAccountEvent({
        userId,
        action: 'privacy_settings_updated',
        success: true,
        detail: {
          updates,
          consent_changes: consentChanges.map(c => c.consentType),
        },
      });

      console.log(`[Privacy] Updated privacy settings for user ${userId}`);
    } catch (error) {
      console.error('[Privacy] Error updating privacy settings:', error);
      throw error;
    }
  }

  /**
   * Record consent change in history
   */
  static async recordConsent(
    userId: number,
    consent: ConsentUpdate
  ): Promise<void> {
    try {
      await db.insert(consentHistory).values({
        userId,
        consentType: consent.consentType,
        consentGiven: consent.consentGiven,
        consentVersion: consent.consentVersion || 'v1.0',
        ipAddress: consent.ipAddress,
        userAgent: consent.userAgent,
      });

      console.log(`[Privacy] Recorded consent: ${consent.consentType} = ${consent.consentGiven} for user ${userId}`);
    } catch (error) {
      console.error('[Privacy] Error recording consent:', error);
      throw error;
    }
  }

  /**
   * Get consent history for a user
   */
  static async getConsentHistory(userId: number): Promise<any[]> {
    try {
      const history = await db
        .select()
        .from(consentHistory)
        .where(eq(consentHistory.userId, userId))
        .orderBy(sql`${consentHistory.createdAt} DESC`)
        .limit(100);

      return history;
    } catch (error) {
      console.error('[Privacy] Error getting consent history:', error);
      throw error;
    }
  }

  /**
   * Request data deletion
   */
  static async requestDataDeletion(
    userId: number,
    requestType: 'face_data' | 'payment_data' | 'all_data' | 'account_closure',
    notes?: string
  ): Promise<string> {
    try {
      // Generate confirmation token
      const confirmationToken = crypto.randomBytes(32).toString('hex');

      const [request] = await db.insert(dataDeletionRequests).values({
        userId,
        requestType,
        status: 'pending',
        userConfirmationToken: confirmationToken,
        notes,
      });

      // Log to audit
      await AuditLogger.logAccountEvent({
        userId,
        action: 'data_deletion_requested',
        success: true,
        detail: {
          request_type: requestType,
          request_id: request.insertId,
        },
      });

      console.log(`[Privacy] Data deletion requested for user ${userId}: ${requestType}`);

      return confirmationToken;
    } catch (error) {
      console.error('[Privacy] Error requesting data deletion:', error);
      throw error;
    }
  }

  /**
   * Confirm data deletion request
   */
  static async confirmDataDeletion(
    userId: number,
    confirmationToken: string
  ): Promise<void> {
    try {
      // Find the pending request
      const [request] = await db
        .select()
        .from(dataDeletionRequests)
        .where(
          and(
            eq(dataDeletionRequests.userId, userId),
            eq(dataDeletionRequests.userConfirmationToken, confirmationToken),
            eq(dataDeletionRequests.status, 'pending')
          )
        )
        .limit(1);

      if (!request) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid or expired confirmation token',
        });
      }

      // Update request status
      await db
        .update(dataDeletionRequests)
        .set({
          status: 'processing',
          confirmedAt: new Date(),
        })
        .where(eq(dataDeletionRequests.id, request.id));

      // Process deletion based on type
      await this.processDataDeletion(userId, request.requestType);

      // Mark as completed
      await db
        .update(dataDeletionRequests)
        .set({
          status: 'completed',
          processedAt: new Date(),
        })
        .where(eq(dataDeletionRequests.id, request.id));

      console.log(`[Privacy] Data deletion confirmed and processed for user ${userId}`);
    } catch (error) {
      console.error('[Privacy] Error confirming data deletion:', error);
      throw error;
    }
  }

  /**
   * Process data deletion
   */
  private static async processDataDeletion(
    userId: number,
    requestType: string
  ): Promise<void> {
    try {
      switch (requestType) {
        case 'face_data':
          // Delete face profiles
          await db.delete(faceProfiles).where(eq(faceProfiles.userId, userId));
          // TODO: Also delete from FAISS index
          console.log(`[Privacy] Deleted face data for user ${userId}`);
          break;

        case 'payment_data':
          // Delete payment methods
          await db.delete(paymentMethods).where(eq(paymentMethods.userId, userId));
          console.log(`[Privacy] Deleted payment data for user ${userId}`);
          break;

        case 'all_data':
          // Delete all user data except account
          await db.delete(faceProfiles).where(eq(faceProfiles.userId, userId));
          await db.delete(paymentMethods).where(eq(paymentMethods.userId, userId));
          console.log(`[Privacy] Deleted all data for user ${userId}`);
          break;

        case 'account_closure':
          // Delete entire account (cascade will handle related data)
          await db.delete(users).where(eq(users.id, userId));
          console.log(`[Privacy] Deleted account for user ${userId}`);
          break;
      }

      // Log to audit
      await AuditLogger.logAccountEvent({
        userId,
        action: 'data_deleted',
        success: true,
        detail: {
          deletion_type: requestType,
        },
      });
    } catch (error) {
      console.error('[Privacy] Error processing data deletion:', error);
      throw error;
    }
  }

  /**
   * Get user's data deletion requests
   */
  static async getDeletionRequests(userId: number): Promise<any[]> {
    try {
      const requests = await db
        .select()
        .from(dataDeletionRequests)
        .where(eq(dataDeletionRequests.userId, userId))
        .orderBy(sql`${dataDeletionRequests.requestedAt} DESC`);

      return requests;
    } catch (error) {
      console.error('[Privacy] Error getting deletion requests:', error);
      throw error;
    }
  }

  /**
   * Export user data (GDPR/CCPA compliance)
   */
  static async exportUserData(userId: number): Promise<any> {
    try {
      // Get user info
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      // Get privacy settings
      const privacy = await this.getPrivacySettings(userId);

      // Get consent history
      const consents = await this.getConsentHistory(userId);

      // Get face profiles (metadata only, not actual embeddings)
      const faces = await db
        .select({
          id: faceProfiles.id,
          enrollmentQuality: faceProfiles.enrollmentQuality,
          modelVersion: faceProfiles.modelVersion,
          createdAt: faceProfiles.createdAt,
          lastUsedAt: faceProfiles.lastUsedAt,
        })
        .from(faceProfiles)
        .where(eq(faceProfiles.userId, userId));

      // Get payment methods (tokenized only)
      const payments = await db
        .select({
          id: paymentMethods.id,
          type: paymentMethods.type,
          last4: paymentMethods.last4,
          brand: paymentMethods.brand,
          isDefault: paymentMethods.isDefault,
          createdAt: paymentMethods.createdAt,
        })
        .from(paymentMethods)
        .where(eq(paymentMethods.userId, userId));

      const exportData = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
        },
        privacy_settings: privacy,
        consent_history: consents,
        face_profiles: faces,
        payment_methods: payments,
        exported_at: new Date().toISOString(),
      };

      // Log export
      await AuditLogger.logAccountEvent({
        userId,
        action: 'data_exported',
        success: true,
        detail: {
          export_size: JSON.stringify(exportData).length,
        },
      });

      return exportData;
    } catch (error) {
      console.error('[Privacy] Error exporting user data:', error);
      throw error;
    }
  }

  /**
   * Get privacy dashboard data
   */
  static async getPrivacyDashboard(userId: number): Promise<any> {
    try {
      const settings = await this.getPrivacySettings(userId);

      const [faceCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(faceProfiles)
        .where(eq(faceProfiles.userId, userId));

      const [paymentCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(paymentMethods)
        .where(eq(paymentMethods.userId, userId));

      const [pendingDeletions] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(dataDeletionRequests)
        .where(
          and(
            eq(dataDeletionRequests.userId, userId),
            eq(dataDeletionRequests.status, 'pending')
          )
        );

      const recentConsents = await db
        .select()
        .from(consentHistory)
        .where(eq(consentHistory.userId, userId))
        .orderBy(sql`${consentHistory.createdAt} DESC`)
        .limit(10);

      return {
        userId,
        settings,
        dataStats: {
          faceProfilesCount: faceCount.count,
          paymentMethodsCount: paymentCount.count,
          pendingDeletionRequests: pendingDeletions.count,
        },
        recentConsents,
        complianceStatus: this.calculateComplianceStatus(settings),
      };
    } catch (error) {
      console.error('[Privacy] Error getting privacy dashboard:', error);
      throw error;
    }
  }

  /**
   * Calculate compliance status
   */
  private static calculateComplianceStatus(settings: any): string {
    if (!settings.lastPrivacyReview) {
      return 'never_reviewed';
    }

    const daysSinceReview = Math.floor(
      (Date.now() - new Date(settings.lastPrivacyReview).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceReview > 365) {
      return 'review_needed';
    }

    return 'compliant';
  }
}
