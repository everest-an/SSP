/**
 * Cron Jobs Scheduler
 * Schedules periodic tasks like daily summaries and email sending
 * 
 * Sprint 3.5: Scheduled Tasks
 */

import cron from 'node-cron';
import { DailyTransactionSummaryService } from '../payment/dailyTransactionSummary';
import { EmailService } from '../email/emailService';
import { runPeriodicSecurityScan } from '../monitoring/securityMonitor';

/**
 * Cron Jobs Manager
 * Manages all scheduled tasks
 */
export class CronJobsManager {
  private static jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize all cron jobs
   */
  static initialize(): void {
    console.log('[CronJobs] Initializing scheduled tasks...');

    // 1. Daily Transaction Summary (runs at 1:00 AM every day)
    this.scheduleJob(
      'daily-transaction-summary',
      '0 1 * * *', // 1:00 AM daily
      async () => {
        console.log('[CronJobs] Running daily transaction summary...');
        try {
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const count = await DailyTransactionSummaryService.processDailySummaries(yesterday);
          console.log(`[CronJobs] ✅ Processed ${count} daily summaries`);
        } catch (error) {
          console.error('[CronJobs] ❌ Error in daily summary job:', error);
        }
      }
    );

    // 2. Email Queue Processor (runs every 5 minutes)
    this.scheduleJob(
      'email-queue-processor',
      '*/5 * * * *', // Every 5 minutes
      async () => {
        console.log('[CronJobs] Processing email queue...');
        try {
          const sent = await EmailService.processEmailQueue(50);
          if (sent > 0) {
            console.log(`[CronJobs] ✅ Sent ${sent} emails`);
          }
        } catch (error) {
          console.error('[CronJobs] ❌ Error in email queue job:', error);
        }
      }
    );

    // 3. Security Scan (runs every hour)
    this.scheduleJob(
      'security-scan',
      '0 * * * *', // Every hour at minute 0
      async () => {
        console.log('[CronJobs] Running security scan...');
        try {
          await runPeriodicSecurityScan();
          console.log('[CronJobs] ✅ Security scan complete');
        } catch (error) {
          console.error('[CronJobs] ❌ Error in security scan job:', error);
        }
      }
    );

    // 4. Retry Failed Emails (runs at 3:00 AM daily)
    this.scheduleJob(
      'retry-failed-emails',
      '0 3 * * *', // 3:00 AM daily
      async () => {
        console.log('[CronJobs] Retrying failed emails...');
        try {
          const retried = await EmailService.retryFailedEmails();
          if (retried > 0) {
            console.log(`[CronJobs] ✅ Retried ${retried} failed emails`);
          }
        } catch (error) {
          console.error('[CronJobs] ❌ Error in retry emails job:', error);
        }
      }
    );

    console.log('[CronJobs] ✅ All scheduled tasks initialized');
    this.listJobs();
  }

  /**
   * Schedule a new cron job
   */
  static scheduleJob(
    name: string,
    schedule: string,
    task: () => void | Promise<void>
  ): void {
    // Stop existing job if any
    if (this.jobs.has(name)) {
      this.jobs.get(name)?.stop();
    }

    // Schedule new job
    const job = cron.schedule(schedule, task, {
      scheduled: true,
      timezone: 'America/New_York', // Adjust to your timezone
    });

    this.jobs.set(name, job);
    console.log(`[CronJobs] Scheduled: ${name} (${schedule})`);
  }

  /**
   * Stop a cron job
   */
  static stopJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      console.log(`[CronJobs] Stopped: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Stop all cron jobs
   */
  static stopAll(): void {
    console.log('[CronJobs] Stopping all scheduled tasks...');
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`[CronJobs] Stopped: ${name}`);
    }
    this.jobs.clear();
    console.log('[CronJobs] ✅ All tasks stopped');
  }

  /**
   * List all active cron jobs
   */
  static listJobs(): void {
    console.log('[CronJobs] Active jobs:');
    for (const [name, job] of this.jobs) {
      console.log(`  - ${name}`);
    }
  }

  /**
   * Run a job immediately (for testing)
   */
  static async runJobNow(name: string): Promise<void> {
    console.log(`[CronJobs] Running job immediately: ${name}`);
    
    switch (name) {
      case 'daily-transaction-summary':
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await DailyTransactionSummaryService.processDailySummaries(yesterday);
        break;
      
      case 'email-queue-processor':
        await EmailService.processEmailQueue(50);
        break;
      
      case 'security-scan':
        await runPeriodicSecurityScan();
        break;
      
      case 'retry-failed-emails':
        await EmailService.retryFailedEmails();
        break;
      
      default:
        console.error(`[CronJobs] Unknown job: ${name}`);
    }
  }
}

// Auto-initialize on module load (only in production)
if (process.env.NODE_ENV === 'production') {
  CronJobsManager.initialize();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[CronJobs] SIGTERM received, stopping all jobs...');
  CronJobsManager.stopAll();
});

process.on('SIGINT', () => {
  console.log('[CronJobs] SIGINT received, stopping all jobs...');
  CronJobsManager.stopAll();
  process.exit(0);
});
