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

pnpm install
License
This project is licensed under the MIT License - see the LICENSE file for details.
Contact
Project Homepage: https://github.com/everest-an/SSP
Issue Tracker: https://github.com/everest-an/SSP/issues
Demo Address: https://ssppayweb-c5dj9eyx.manus.space/
Note: This project is currently under active development, and some features may not be fully implemented. Please perform thorough testing before production use
