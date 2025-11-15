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
