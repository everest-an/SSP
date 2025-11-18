import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Email configuration from environment variables
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@ssp.click';

let transporter: Transporter | null = null;

// Initialize email transporter
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465, // true for 465, false for other ports
      auth: EMAIL_USER && EMAIL_PASS ? {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      } : undefined,
    });
  }
  return transporter;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    // If email is not configured, log to console instead
    if (!EMAIL_USER || !EMAIL_PASS) {
      console.log('Email not configured. Would send email:', {
        to: options.to,
        subject: options.subject,
        preview: options.text?.substring(0, 100) || options.html.substring(0, 100),
      });
      return true;
    }

    const transporter = getTransporter();
    
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.log(`Email sent successfully to ${options.to}`);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

// Welcome email template
export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to SSP!</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>Welcome to <strong>Smart Store Payment</strong> - the future of retail payments!</p>
      <p>Your account has been successfully created. You can now:</p>
      <ul>
        <li>Make secure payments with face recognition</li>
        <li>Use gesture-based payment controls</li>
        <li>Track your payment history</li>
        <li>Manage your digital wallet</li>
      </ul>
      <p style="text-align: center;">
        <a href="https://ssp.click/dashboard" class="button">Go to Dashboard</a>
      </p>
      <p>If you have any questions, feel free to contact our support team.</p>
      <p>Best regards,<br>The SSP Team</p>
    </div>
    <div class="footer">
      <p>© 2025 Smart Store Payment. All rights reserved.</p>
      <p>This email was sent to ${email}</p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: 'Welcome to Smart Store Payment!',
    html,
    text: `Hi ${name}, Welcome to Smart Store Payment! Your account has been successfully created.`,
  });
}

// Password reset email template
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  expiresIn: string
): Promise<boolean> {
  const resetUrl = `https://ssp.click/reset-password?token=${resetToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .warning { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hi,</p>
      <p>We received a request to reset your password for your SSP account.</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; background: white; padding: 10px; border-radius: 5px;">${resetUrl}</p>
      <div class="warning">
        <p><strong>⚠️ Security Notice:</strong></p>
        <ul>
          <li>This link will expire in ${expiresIn}</li>
          <li>If you didn't request this, please ignore this email</li>
          <li>Never share this link with anyone</li>
        </ul>
      </div>
      <p>Best regards,<br>The SSP Team</p>
    </div>
    <div class="footer">
      <p>© 2025 Smart Store Payment. All rights reserved.</p>
      <p>This email was sent to ${email}</p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: 'Password Reset Request - SSP',
    html,
    text: `Reset your password: ${resetUrl}. This link expires in ${expiresIn}.`,
  });
}

// Login alert email template
export async function sendLoginAlertEmail(
  email: string,
  name: string,
  loginDetails: {
    time: Date;
    ip: string;
    location: string;
    device: string;
  }
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-box { background: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 New Login Detected</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>We detected a new login to your SSP account:</p>
      <div class="info-box">
        <div class="info-row">
          <strong>Time:</strong>
          <span>${loginDetails.time.toLocaleString()}</span>
        </div>
        <div class="info-row">
          <strong>IP Address:</strong>
          <span>${loginDetails.ip}</span>
        </div>
        <div class="info-row">
          <strong>Location:</strong>
          <span>${loginDetails.location}</span>
        </div>
        <div class="info-row">
          <strong>Device:</strong>
          <span>${loginDetails.device}</span>
        </div>
      </div>
      <p>If this was you, no action is needed.</p>
      <p><strong>If this wasn't you:</strong></p>
      <ul>
        <li>Change your password immediately</li>
        <li>Review your login history</li>
        <li>Enable two-factor authentication</li>
      </ul>
      <p style="text-align: center;">
        <a href="https://ssp.click/login-history" class="button">Review Login History</a>
      </p>
      <p>Best regards,<br>The SSP Security Team</p>
    </div>
    <div class="footer">
      <p>© 2025 Smart Store Payment. All rights reserved.</p>
      <p>This email was sent to ${email}</p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: '🔔 New Login to Your SSP Account',
    html,
    text: `New login detected at ${loginDetails.time.toLocaleString()} from ${loginDetails.ip} (${loginDetails.location}).`,
  });
}

// Payment receipt email template
export async function sendPaymentReceiptEmail(
  email: string,
  name: string,
  paymentDetails: {
    orderId: number;
    amount: number;
    merchant: string;
    date: Date;
    paymentMethod: string;
  }
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #16a34a; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .receipt { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
    .amount { font-size: 32px; font-weight: bold; color: #16a34a; text-align: center; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Payment Successful</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>Your payment has been processed successfully!</p>
      <div class="receipt">
        <div class="amount">$${paymentDetails.amount.toFixed(2)}</div>
        <div class="info-row">
          <strong>Order ID:</strong>
          <span>#${paymentDetails.orderId}</span>
        </div>
        <div class="info-row">
          <strong>Merchant:</strong>
          <span>${paymentDetails.merchant}</span>
        </div>
        <div class="info-row">
          <strong>Date:</strong>
          <span>${paymentDetails.date.toLocaleString()}</span>
        </div>
        <div class="info-row">
          <strong>Payment Method:</strong>
          <span>${paymentDetails.paymentMethod}</span>
        </div>
      </div>
      <p>You can view your full payment history in your dashboard.</p>
      <p>Thank you for using Smart Store Payment!</p>
      <p>Best regards,<br>The SSP Team</p>
    </div>
    <div class="footer">
      <p>© 2025 Smart Store Payment. All rights reserved.</p>
      <p>This email was sent to ${email}</p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: `Payment Receipt - Order #${paymentDetails.orderId}`,
    html,
    text: `Payment of $${paymentDetails.amount.toFixed(2)} to ${paymentDetails.merchant} was successful. Order #${paymentDetails.orderId}`,
  });
}

/**
 * Send merchant application notification to admins
 */
export async function sendMerchantApplicationNotification(
  merchantId: number,
  businessName: string
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@ssp.click';
  
  await sendEmail({
    to: adminEmail,
    subject: 'New Merchant Application - Action Required',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Merchant Application</h2>
        <p>A new merchant application has been submitted and requires your review:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Business Name:</strong> ${businessName}</p>
          <p><strong>Merchant ID:</strong> ${merchantId}</p>
        </div>
        <p>Please log in to the admin dashboard to review and approve/reject this application.</p>
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/admin/merchants" 
           style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
          Review Application
        </a>
      </div>
    `,
    text: `New merchant application from ${businessName} (ID: ${merchantId}). Please review in the admin dashboard.`,
  });
}

/**
 * Send merchant approval email
 */
export async function sendMerchantApprovalEmail(
  email: string,
  businessName: string
): Promise<void> {
  await sendEmail({
    to: email,
    subject: '🎉 Your Merchant Application Has Been Approved!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">Congratulations!</h2>
        <p>Your merchant application for <strong>${businessName}</strong> has been approved.</p>
        <div style="background-color: #f0f8f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">You can now:</h3>
          <ul>
            <li>✅ Access the merchant dashboard</li>
            <li>✅ Add products to your catalog</li>
            <li>✅ Manage your POS devices</li>
            <li>✅ View sales analytics and reports</li>
            <li>✅ Configure payment settings</li>
          </ul>
        </div>
        <p>Get started by logging in to your account and switching to merchant mode.</p>
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/merchant/dashboard" 
           style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
          Go to Merchant Dashboard
        </a>
        <p style="margin-top: 30px; color: #666;">Thank you for choosing our platform!</p>
      </div>
    `,
    text: `Congratulations! Your merchant application for ${businessName} has been approved. Log in to access your merchant dashboard.`,
  });
}

/**
 * Send merchant rejection email
 */
export async function sendMerchantRejectionEmail(
  email: string,
  businessName: string,
  reason: string
): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Merchant Application Update',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Merchant Application Status</h2>
        <p>Thank you for your interest in becoming a merchant with us.</p>
        <p>Unfortunately, we are unable to approve your application for <strong>${businessName}</strong> at this time.</p>
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
        </div>
        <p>If you have any questions or would like to reapply in the future, please contact our support team at <a href="mailto:support@ssp.click">support@ssp.click</a>.</p>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The SSP Team</p>
      </div>
    `,
    text: `Your merchant application for ${businessName} was not approved. Reason: ${reason}. Contact support@ssp.click for more information.`,
  });
}

/**
 * Send merchant suspension notification
 */
export async function sendMerchantSuspensionEmail(
  email: string,
  businessName: string,
  reason: string
): Promise<void> {
  await sendEmail({
    to: email,
    subject: '⚠️ Important: Your Merchant Account Has Been Suspended',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Account Suspension Notice</h2>
        <p>Your merchant account for <strong>${businessName}</strong> has been suspended.</p>
        <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #d32f2f;">
          <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
        </div>
        <h3>During the suspension period:</h3>
        <ul>
          <li>❌ Your products will not be visible to customers</li>
          <li>❌ You will not be able to process new transactions</li>
          <li>❌ Your merchant dashboard access is limited</li>
        </ul>
        <p>If you believe this is an error or would like to appeal this decision, please contact our support team immediately at <a href="mailto:support@ssp.click">support@ssp.click</a>.</p>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The SSP Team</p>
      </div>
    `,
    text: `Your merchant account for ${businessName} has been suspended. Reason: ${reason}. Contact support@ssp.click to appeal.`,
  });
}
