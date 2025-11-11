/**
 * Daily Transaction Summary Service
 * Generates and sends daily transaction summary emails to users
 * 
 * Sprint 3.5: Daily Transaction Summary Emails
 */

import { db } from '../../db';
import { 
  users,
  paymentMethods,
  paymentTransactions,
  dailyTransactionSummaries,
  emailNotifications
} from '../../../drizzle/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export interface TransactionSummary {
  userId: number;
  userEmail: string;
  userName: string | null;
  summaryDate: Date;
  transactions: {
    total: number;
    successful: number;
    failed: number;
    refunded: number;
  };
  amounts: {
    total: number;
    successful: number;
    refunded: number;
  };
  transactionList: Array<{
    id: number;
    amount: number;
    currency: string;
    status: string;
    description: string | null;
    createdAt: Date;
  }>;
}

/**
 * Daily Transaction Summary Service
 * Aggregates daily transactions and prepares email reports
 */
export class DailyTransactionSummaryService {
  /**
   * Generate transaction summary for a specific user and date
   */
  static async generateSummary(userId: number, date: Date): Promise<TransactionSummary | null> {
    try {
      // Get user info
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        console.error(`[DailySummary] User ${userId} not found`);
        return null;
      }

      // Get date range (start and end of day)
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all transactions for the day
      const transactions = await db
        .select({
          id: paymentTransactions.id,
          amount: paymentTransactions.amount,
          currency: paymentTransactions.currency,
          status: paymentTransactions.status,
          description: paymentTransactions.description,
          createdAt: paymentTransactions.createdAt,
        })
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.userId, userId),
            gte(paymentTransactions.createdAt, startOfDay),
            lte(paymentTransactions.createdAt, endOfDay)
          )
        )
        .orderBy(paymentTransactions.createdAt);

      // If no transactions, return null
      if (transactions.length === 0) {
        return null;
      }

      // Calculate statistics
      const stats = {
        total: transactions.length,
        successful: transactions.filter(t => t.status === 'succeeded').length,
        failed: transactions.filter(t => t.status === 'failed').length,
        refunded: transactions.filter(t => t.status === 'refunded').length,
      };

      const amounts = {
        total: transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0),
        successful: transactions
          .filter(t => t.status === 'succeeded')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0),
        refunded: transactions
          .filter(t => t.status === 'refunded')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0),
      };

      return {
        userId,
        userEmail: user.email,
        userName: user.name,
        summaryDate: date,
        transactions: stats,
        amounts,
        transactionList: transactions.map(t => ({
          id: t.id,
          amount: parseFloat(t.amount),
          currency: t.currency || 'USD',
          status: t.status,
          description: t.description,
          createdAt: t.createdAt!,
        })),
      };
    } catch (error) {
      console.error('[DailySummary] Error generating summary:', error);
      return null;
    }
  }

  /**
   * Save summary to database
   */
  static async saveSummary(summary: TransactionSummary): Promise<void> {
    try {
      const summaryDate = new Date(summary.summaryDate);
      summaryDate.setHours(0, 0, 0, 0);

      await db
        .insert(dailyTransactionSummaries)
        .values({
          userId: summary.userId,
          summaryDate: summaryDate.toISOString().split('T')[0] as any,
          transactionCount: summary.transactions.total,
          totalAmount: summary.amounts.total.toString(),
          successfulCount: summary.transactions.successful,
          failedCount: summary.transactions.failed,
          refundedCount: summary.transactions.refunded,
          emailSent: false,
        })
        .onDuplicateKeyUpdate({
          set: {
            transactionCount: summary.transactions.total,
            totalAmount: summary.amounts.total.toString(),
            successfulCount: summary.transactions.successful,
            failedCount: summary.transactions.failed,
            refundedCount: summary.transactions.refunded,
          },
        });
    } catch (error) {
      console.error('[DailySummary] Error saving summary:', error);
    }
  }

  /**
   * Generate HTML email body for transaction summary
   */
  static generateEmailHTML(summary: TransactionSummary): string {
    const { summaryDate, transactions, amounts, transactionList } = summary;
    const dateStr = summaryDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0 0; opacity: 0.9; }
    .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .summary-item { background: white; padding: 15px; border-radius: 6px; text-align: center; }
    .summary-item .label { font-size: 12px; color: #666; text-transform: uppercase; }
    .summary-item .value { font-size: 24px; font-weight: bold; color: #667eea; margin-top: 5px; }
    .transactions { margin-top: 30px; }
    .transaction { background: white; padding: 15px; margin-bottom: 10px; border-radius: 6px; border-left: 4px solid #667eea; }
    .transaction.failed { border-left-color: #dc3545; }
    .transaction.refunded { border-left-color: #ffc107; }
    .transaction-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
    .transaction-amount { font-size: 18px; font-weight: bold; }
    .transaction-status { padding: 4px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase; }
    .status-succeeded { background: #d4edda; color: #155724; }
    .status-failed { background: #f8d7da; color: #721c24; }
    .status-refunded { background: #fff3cd; color: #856404; }
    .transaction-description { color: #666; font-size: 14px; }
    .transaction-time { color: #999; font-size: 12px; }
    .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
    .footer a { color: #667eea; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Daily Transaction Summary</h1>
      <p>${dateStr}</p>
    </div>
    
    <div class="summary">
      <div class="summary-grid">
        <div class="summary-item">
          <div class="label">Total Transactions</div>
          <div class="value">${transactions.total}</div>
        </div>
        <div class="summary-item">
          <div class="label">Total Amount</div>
          <div class="value">$${amounts.total.toFixed(2)}</div>
        </div>
        <div class="summary-item">
          <div class="label">Successful</div>
          <div class="value" style="color: #28a745;">${transactions.successful}</div>
        </div>
        <div class="summary-item">
          <div class="label">Failed</div>
          <div class="value" style="color: #dc3545;">${transactions.failed}</div>
        </div>
      </div>
    </div>
    
    <div class="transactions">
      <h2>Transaction Details</h2>
      ${transactionList.map(t => `
        <div class="transaction ${t.status}">
          <div class="transaction-header">
            <span class="transaction-amount">$${t.amount.toFixed(2)} ${t.currency}</span>
            <span class="transaction-status status-${t.status}">${t.status}</span>
          </div>
          ${t.description ? `<div class="transaction-description">${t.description}</div>` : ''}
          <div class="transaction-time">${new Date(t.createdAt).toLocaleString()}</div>
        </div>
      `).join('')}
    </div>
    
    <div class="footer">
      <p>This is an automated summary of your daily transactions.</p>
      <p>If you have any questions, please <a href="mailto:support@ssp.click">contact support</a>.</p>
      <p>&copy; ${new Date().getFullYear()} SSP. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text email body for transaction summary
   */
  static generateEmailText(summary: TransactionSummary): string {
    const { summaryDate, transactions, amounts, transactionList } = summary;
    const dateStr = summaryDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let text = `DAILY TRANSACTION SUMMARY\n`;
    text += `${dateStr}\n\n`;
    text += `SUMMARY\n`;
    text += `-------\n`;
    text += `Total Transactions: ${transactions.total}\n`;
    text += `Total Amount: $${amounts.total.toFixed(2)}\n`;
    text += `Successful: ${transactions.successful}\n`;
    text += `Failed: ${transactions.failed}\n`;
    text += `Refunded: ${transactions.refunded}\n\n`;
    text += `TRANSACTION DETAILS\n`;
    text += `-------------------\n\n`;

    transactionList.forEach(t => {
      text += `$${t.amount.toFixed(2)} ${t.currency} - ${t.status.toUpperCase()}\n`;
      if (t.description) {
        text += `  ${t.description}\n`;
      }
      text += `  ${new Date(t.createdAt).toLocaleString()}\n\n`;
    });

    text += `---\n`;
    text += `This is an automated summary of your daily transactions.\n`;
    text += `If you have any questions, please contact support@ssp.click.\n`;

    return text;
  }

  /**
   * Process daily summaries for all users (to be run by cron job)
   */
  static async processDailySummaries(date?: Date): Promise<number> {
    const summaryDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
    summaryDate.setHours(0, 0, 0, 0);

    console.log(`[DailySummary] Processing summaries for ${summaryDate.toISOString().split('T')[0]}`);

    try {
      // Get all users who have transactions on this date AND have sendDailySummary enabled
      const startOfDay = new Date(summaryDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(summaryDate);
      endOfDay.setHours(23, 59, 59, 999);

      const usersWithTransactions = await db
        .selectDistinct({ userId: paymentTransactions.userId })
        .from(paymentTransactions)
        .innerJoin(paymentMethods, eq(paymentTransactions.paymentMethodId, paymentMethods.id))
        .where(
          and(
            gte(paymentTransactions.createdAt, startOfDay),
            lte(paymentTransactions.createdAt, endOfDay),
            sql`${paymentMethods}.send_daily_summary = TRUE`
          )
        );

      let processedCount = 0;

      for (const { userId } of usersWithTransactions) {
        const summary = await this.generateSummary(userId, summaryDate);
        
        if (summary) {
          await this.saveSummary(summary);
          await this.queueEmail(summary);
          processedCount++;
        }
      }

      console.log(`[DailySummary] ✅ Processed ${processedCount} summaries`);
      return processedCount;
    } catch (error) {
      console.error('[DailySummary] ❌ Error processing summaries:', error);
      return 0;
    }
  }

  /**
   * Queue email notification for a summary
   */
  static async queueEmail(summary: TransactionSummary): Promise<void> {
    try {
      const subject = `Daily Transaction Summary - ${summary.summaryDate.toLocaleDateString()}`;
      const bodyHtml = this.generateEmailHTML(summary);
      const bodyText = this.generateEmailText(summary);

      await db.insert(emailNotifications).values({
        userId: summary.userId,
        emailType: 'daily_summary',
        recipientEmail: summary.userEmail,
        subject,
        bodyHtml,
        bodyText,
        status: 'pending',
        metadata: {
          summaryDate: summary.summaryDate.toISOString().split('T')[0],
          transactionIds: summary.transactionList.map(t => t.id),
        },
      });

      console.log(`[DailySummary] Email queued for user ${summary.userId}`);
    } catch (error) {
      console.error('[DailySummary] Error queuing email:', error);
    }
  }
}
