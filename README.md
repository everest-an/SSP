# SSP Project - Secure and Scalable Platform

## Project Introduction

SSP (Smart Store Payment) is an innovative smart retail payment system that utilizes computer vision and biometric technology to enable a truly contactless shopping experience. Users simply pick up items, and the system automatically identifies their face and confirms payment via gesture, eliminating the need for phones or wallets.

## Core Features

### Payment Experience
- 🎭 **Facial Recognition Payment** - Identify users and complete payments via facial features.
- 👋 **Gesture Confirmation** - Use gestures (pick up/put down/thumbs up) to confirm purchase intent.
- 💳 **Multiple Payment Methods** - Supports Stripe, custodial/non-custodial wallets, and MetaMask.
- ⚡ **Real-time Order Processing** - WebSocket for real-time order status updates.

### Merchant Management
- 🏪 **Merchant Management System** - Full functionality for managing merchants, products, and devices.
- 📦 **Device Product Configuration** - Flexible configuration of sellable products per device.
- 📊 **Data Analytics Dashboard** - Real-time sales data, order statistics, and revenue analysis.
- 💰 **Wallet Management** - Custodial/non-custodial wallets, balance charts, and transaction history.

### Security and Monitoring
- 🔐 **Multi-Layer Security** - Multi-level access control, audit logs, and payment limits.
- 🚨 **Anomaly Alerting** - 10 preset rules to monitor suspicious transactions (amount, location, biometrics, behavior, environment).
- 🔒 **Multi-Level Handling** - Notification/Warning/Lockout, with critical issues requiring app unlock.
- 📱 **Real-time Notification Center** - WebSocket for real-time, categorized notifications.

## Technology Stack

### Backend
- **Framework**: Express.js + tRPC
- **Database**: MySQL + Drizzle ORM
- **Authentication**: JWT (jose)
- **Payment**: Stripe
- **AI/ML**: MediaPipe (Facial Recognition, Gesture Recognition)
- **Storage**: AWS S3

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **UI Components**: Radix UI + shadcn/ui
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Charts**: Recharts

## Quick Start

### Prerequisites

- Node.js 22+
- MySQL 8.0+
- pnpm 10+

### Installation
## Development Status (Based on Code Analysis)

This section outlines the current progress of the project features, derived from an analysis of the repository's file structure and content.

### ✅ Completed Features (UI Pages and API Routes Exist)
- **Authentication & User Management:** Dedicated pages and routes for Client Login, Registration, Forgot/Reset Password, User Profile, and Two-Factor Settings.
- **Merchant & Product Management:** Pages and API routes for Merchant Creation, Settings, Product Listing, Order Listing, and Order Detail viewing.
- **Biometric & Payment Setup:** Pages and API routes for Face Enrollment, Face Login, Liveness Test, Payment Methods, Wallets, and Payment History.
- **Admin & Monitoring:** Pages and API routes for Dashboard, Analytics, Alert Rules, and Admin Review Panel.
- **Core API Infrastructure:** Core API routes (`routers.ts`), database setup (`db.ts`), and dedicated routers for payment methods, products, and admin functions are present.

### 🚧 In-Progress Features (Files Exist, but Functionality is Complex)
- **Real-time Features:** The presence of `websocket.ts` and `realtimeOrderRouters.ts` suggests the **WebSocket Real-time Push** and **Real-time Order Processing** are actively being implemented.
- **Gesture Payment Frontend:** The `GesturePaymentDemo.tsx` and `DevicePayment.tsx` pages are present, indicating the **Gesture Payment Frontend Interface** is under development.
- **Device Configuration:** The `DeviceProductConfig.tsx` page exists, suggesting the **Device Product Configuration Page** is being built.
- **Anomaly Alerting:** The `AnomalyAlerts.tsx` and `AlertRules.tsx` pages exist, indicating the **Anomaly Alerting** feature is in progress.

### 📋 To Be Developed (Planned Features - Minimal Code Footprint)
- **Advanced Data Analytics:** While `Analytics.tsx` exists, advanced features like in-depth reporting and complex data visualization are likely future enhancements.
- **Multi-Factor Authentication (MFA):** While `TwoFactorSettings.tsx` exists, the full implementation of various MFA methods may still be pending.
- **Mobile Adaptation:** No specific mobile-first structure is immediately apparent, suggesting **Mobile Adaptation** is a future task.
- **Internationalization Support (i18n):** No dedicated i18n files or configuration were found, indicating this is a **Planned Feature**.

... 

```bash
pnpm install
```

### Environment Configuration

Create a `.env` file and configure the following environment variables:

```env
# Database Configuration
DATABASE_URL=mysql://user:password@localhost:3306/ssp

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...
S3_REGION=us-east-1

# JWT Secret
JWT_SECRET=your-secret-key

# Admin OpenID
OWNER_OPEN_ID=your-admin-openid
```

### Database Migration

```bash
pnpm run db:push
```

### Development Mode

```bash
pnpm run dev
```

Access at http://localhost:5000

### Production Build

```bash
pnpm run build
pnpm run start
```

## Deployment on Vercel

The project is deployed on Vercel. Key deployment settings are configured as follows:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Framework Preset** | Blitz.js (Legacy) | Automatically detected. |
| **Root Directory** | `client` | The frontend application is located in this subdirectory. |
| **Build Command** | `pnpm install && pnpm run build` | Standard build command for the project. |
| **Output Directory** | *Default (Not Overridden)* | Vercel will use the default output directory for Blitz.js (Legacy) to ensure correct routing and file serving. |

## Development Status (Based on Code Analysis)

This section outlines the current progress of the project features, derived from an analysis of the repository's file structure and content.

### ✅ Completed Features (UI Pages and API Routes Exist)
- **Authentication & User Management:** Dedicated pages and routes for Client Login, Registration, Forgot/Reset Password, User Profile, and Two-Factor Settings.
- **Merchant & Product Management:** Pages and API routes for Merchant Creation, Settings, Product Listing, Order Listing, and Order Detail viewing.
- **Biometric & Payment Setup:** Pages and API routes for Face Enrollment, Face Login, Liveness Test, Payment Methods, Wallets, and Payment History.
- **Admin & Monitoring:** Pages and API routes for Dashboard, Analytics, Alert Rules, and Admin Review Panel.
- **Core API Infrastructure:** Core API routes (`routers.ts`), database setup (`db.ts`), and dedicated routers for payment methods, products, and admin functions are present.

### 🚧 In-Progress Features (Files Exist, but Functionality is Complex)
- **Real-time Features:** The presence of `websocket.ts` and `realtimeOrderRouters.ts` suggests the **WebSocket Real-time Push** and **Real-time Order Processing** are actively being implemented.
- **Gesture Payment Frontend:** The `GesturePaymentDemo.tsx` and `DevicePayment.tsx` pages are present, indicating the **Gesture Payment Frontend Interface** is under development.
- **Device Configuration:** The `DeviceProductConfig.tsx` page exists, suggesting the **Device Product Configuration Page** is being built.
- **Anomaly Alerting:** The `AnomalyAlerts.tsx` and `AlertRules.tsx` pages exist, indicating the **Anomaly Alerting** feature is in progress.

### 📋 To Be Developed (Planned Features - Minimal Code Footprint)
- **Advanced Data Analytics:** While `Analytics.tsx` exists, advanced features like in-depth reporting and complex data visualization are likely future enhancements.
- **Multi-Factor Authentication (MFA):** While `TwoFactorSettings.tsx` exists, the full implementation of various MFA methods may still be pending.
- **Mobile Adaptation:** No specific mobile-first structure is immediately apparent, suggesting **Mobile Adaptation** is a future task.
- **Internationalization Support (i18n):** No dedicated i18n files or configuration were found, indicating this is a **Planned Feature**.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

- Project Homepage: https://github.com/everest-an/SSP
- Issue Tracker: https://github.com/everest-an/SSP/issues
- Demo Address: https://ssppayweb-c5dj9eyx.manus.space/

---

**Note**: This project is currently under active development. Please perform thorough testing before production use.
