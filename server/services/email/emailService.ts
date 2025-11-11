/**
 * Email Service
 * Handles email sending via SMTP or email service providers
 * 
 * Sprint 3.5: Email Integration
 */

import { db } from '../../db';
import { emailNotifications } from '../../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import nodemailer from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    name: string;
    address: string;
  };
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

/**
 * Email Service
 * Sends emails and manages email queue
 */
export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  /**
   * Initialize email transporter
   */
  static initialize(config?: EmailConfig): void {
    const emailConfig = config || {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
      from: {
        name: process.env.EMAIL_FROM_NAME || 'SSP',
        address: process.env.EMAIL_FROM_ADDRESS || 'noreply@ssp.click',
      },
    };

    this.transporter = nodemailer.createTransporter({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: emailConfig.auth,
    });

    console.log('[EmailService] ✅ Email transporter initialized');
  }

  /**
   * Send an email
   */
  static async sendEmail(params: SendEmailParams): Promise<boolean> {
    if (!this.transporter) {
      console.warn('[EmailService] Transporter not initialized, initializing with defaults...');
      this.initialize();
    }

    if (!this.transporter) {
      console.error('[EmailService] Failed to initialize transporter');
      return false;
    }

    try {
      const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@ssp.click';
      const fromName = process.env.EMAIL_FROM_NAME || 'SSP';

      const mailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
        attachments: params.attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[EmailService] ✅ Email sent to ${params.to}: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error('[EmailService] ❌ Error sending email:', error);
      return false;
    }
  }

  /**
   * Process email queue (send pending emails)
   */
  static async processEmailQueue(limit: number = 50): Promise<number> {
    try {
      // Get pending emails
      const pendingEmails = await db
        .select()
        .from(emailNotifications)
        .where(eq(emailNotifications.status, 'pending'))
        .limit(limit);

      if (pendingEmails.length === 0) {
        console.log('[EmailService] No pending emails');
        return 0;
      }

      console.log(`[EmailService] Processing ${pendingEmails.length} pending emails...`);

      let sentCount = 0;

      for (const email of pendingEmails) {
        const success = await this.sendEmail({
          to: email.recipientEmail,
          subject: email.subject,
          html: email.bodyHtml || undefined,
          text: email.bodyText || undefined,
        });

        if (success) {
          // Mark as sent
          await db
            .update(emailNotifications)
            .set({
              status: 'sent',
              sentAt: new Date(),
            })
            .where(eq(emailNotifications.id, email.id));
          
          sentCount++;
        } else {
          // Mark as failed
          await db
            .update(emailNotifications)
            .set({
              status: 'failed',
              failureReason: 'SMTP send failed',
            })
            .where(eq(emailNotifications.id, email.id));
        }

        // Add delay to avoid rate limiting (100ms between emails)
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`[EmailService] ✅ Sent ${sentCount}/${pendingEmails.length} emails`);
      return sentCount;
    } catch (error) {
      console.error('[EmailService] ❌ Error processing email queue:', error);
      return 0;
    }
  }

  /**
   * Send test email
   */
  static async sendTestEmail(to: string): Promise<boolean> {
    return await this.sendEmail({
      to,
      subject: 'SSP Email Service Test',
      html: `
        <h1>Email Service Test</h1>
        <p>This is a test email from SSP.</p>
        <p>If you received this, the email service is working correctly!</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
      text: `
        Email Service Test
        
        This is a test email from SSP.
        If you received this, the email service is working correctly!
        
        Timestamp: ${new Date().toISOString()}
      `,
    });
  }

  /**
   * Retry failed emails
   */
  static async retryFailedEmails(maxRetries: number = 3): Promise<number> {
    try {
      // Get failed emails that haven't exceeded max retries
      const failedEmails = await db
        .select()
        .from(emailNotifications)
        .where(
          and(
            eq(emailNotifications.status, 'failed'),
            // Add retry count check here if you add a retryCount field
          )
        )
        .limit(20);

      if (failedEmails.length === 0) {
        return 0;
      }

      console.log(`[EmailService] Retrying ${failedEmails.length} failed emails...`);

      let retriedCount = 0;

      for (const email of failedEmails) {
        // Reset to pending for retry
        await db
          .update(emailNotifications)
          .set({
            status: 'pending',
            failureReason: null,
          })
          .where(eq(emailNotifications.id, email.id));
        
        retriedCount++;
      }

      // Process the queue
      await this.processEmailQueue(failedEmails.length);

      return retriedCount;
    } catch (error) {
      console.error('[EmailService] Error retrying failed emails:', error);
      return 0;
    }
  }
}

// Auto-initialize on module load
if (process.env.SMTP_HOST) {
  EmailService.initialize();
}
