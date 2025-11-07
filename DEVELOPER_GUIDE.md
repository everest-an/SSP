# SSP Developer Guide

Welcome to the SSP (Smart Store Payment) development guide. This document provides comprehensive information for developers working on or integrating with the SSP system.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Getting Started](#getting-started)
3. [Project Structure](#project-structure)
4. [Core Concepts](#core-concepts)
5. [API Documentation](#api-documentation)
6. [Development Workflow](#development-workflow)
7. [Testing](#testing)
8. [Deployment](#deployment)
9. [Contributing](#contributing)

---

## Architecture Overview

SSP is a full-stack application built with modern web technologies:

### Tech Stack

**Frontend:**
- React 19 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- tRPC for type-safe API calls
- MediaPipe for AI/ML (face & gesture recognition)

**Backend:**
- Node.js with Express
- tRPC for API layer
- MySQL with Drizzle ORM
- WebSocket for real-time communication
- Stripe for payment processing

**Infrastructure:**
- Docker for containerization
- GitHub Actions for CI/CD
- AWS S3 for file storage (optional)

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Web App    │  │    Device    │  │   Mobile     │      │
│  │  (Dashboard) │  │  (POS/Kiosk) │  │     App      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          │    HTTP/tRPC     │    WebSocket     │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    tRPC Router                        │   │
│  │  - Authentication  - Orders    - Payments            │   │
│  │  - Merchants       - Products  - Devices             │   │
│  │  - Face Recognition - Wallets  - Real-time Orders    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │                                          │
          ▼                                          ▼
┌──────────────────────┐              ┌──────────────────────┐
│   Business Logic     │              │   WebSocket Service  │
│   - Order Processing │              │   - Real-time Push   │
│   - Payment Flow     │              │   - Event Broadcast  │
│   - Stock Management │              │   - Client Manager   │
│   - Face Matching    │              └──────────────────────┘
└──────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│                        Data Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    MySQL     │  │   Stripe     │  │  Blockchain  │       │
│  │   Database   │  │     API      │  │   (Web3.js)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- MySQL 8.0+
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/everest-an/SSP.git
cd SSP

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database
pnpm db:push

# Start development server
pnpm dev
```

### Environment Variables

```env
# Database
DATABASE_URL=mysql://user:password@localhost:3306/ssp

# Authentication
JWT_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Payment
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Blockchain (Optional)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR-API-KEY

# Server
PORT=3000
NODE_ENV=development
```

---

## Project Structure

```
SSP/
├── client/                 # Frontend application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility libraries
│   │   │   ├── trpc.ts   # tRPC client setup
│   │   │   └── mediapipe.ts # MediaPipe integration
│   │   ├── App.tsx        # Main app component
│   │   └── main.tsx       # Entry point
│   └── public/            # Static assets
│
├── server/                 # Backend application
│   ├── _core/             # Core server modules
│   │   ├── index.ts      # Server entry point
│   │   ├── trpc.ts       # tRPC setup
│   │   ├── auth.ts       # Authentication
│   │   ├── env.ts        # Environment config
│   │   ├── errors.ts     # Error handling
│   │   └── blockchain.ts # Blockchain integration
│   ├── routers.ts         # Main API router
│   ├── db.ts              # Database operations
│   ├── websocket.ts       # WebSocket service
│   ├── realtimeOrderRouters.ts  # Real-time order API
│   ├── faceAndWalletRouters.ts  # Face & wallet API
│   └── ...other routers
│
├── drizzle/               # Database schema & migrations
│   ├── schema.ts         # Main database schema
│   └── face-recognition-schema.ts
│
├── shared/                # Shared types & utilities
│   └── types.ts
│
├── tests/                 # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/                  # Documentation
│   ├── API.md
│   └── DEPLOYMENT.md
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Core Concepts

### 1. Face Recognition Flow

```typescript
// Step 1: Register face (client-side)
const faceEmbedding = await faceService.extractFaceEmbedding(videoElement);

// Step 2: Store in database (API call)
await trpc.faceRecognition.register.mutate({
  faceEmbedding,
  maxPaymentAmount: 5000, // $50
});

// Step 3: Verify face during payment (device)
const result = await trpc.faceRecognition.verify.mutate({
  faceEmbedding: detectedEmbedding,
  threshold: 0.6,
});

if (result.verified) {
  // User identified, proceed with payment
  const user = result.user;
  const wallet = result.wallet;
}
```

### 2. Gesture Recognition Flow

```typescript
// Detect thumbs up gesture
const gestureResult = await gestureService.recognizeGesture(videoElement);
const thumbsUp = gestureService.detectThumbsUpGesture(gestureResult);

if (thumbsUp.detected && thumbsUp.confidence > 0.75) {
  // Trigger payment
  await processPayment();
}
```

### 3. Real-time Order Creation

```typescript
// Create order with automatic payment
const order = await trpc.realtimeOrder.createRealtimeOrder.mutate({
  deviceId: 1,
  userId: user.id,
  merchantId: 1,
  items: [
    { productId: 1, quantity: 1 }
  ],
  gestureConfidence: thumbsUp.confidence
});

// Order is automatically:
// 1. Validated (device, user, products, wallet)
// 2. Created in database
// 3. Paid (wallet balance deducted)
// 4. Stock updated
// 5. WebSocket notification sent
```

### 4. WebSocket Communication

```typescript
// Client-side: Connect and listen
const { isConnected, lastMessage } = useWebSocket({
  userId: user.id,
  onOrderUpdate: (data) => {
    console.log('Order updated:', data);
  },
  onPaymentStatus: (data) => {
    if (data.status === 'success') {
      toast.success('Payment successful!');
    }
  }
});

// Server-side: Send notification
wsService.notifyOrderUpdate(
  orderId,
  { status: 'completed', totalAmount: 1000 },
  merchantId,
  userId
);
```

### 5. Wallet Types

**Custodial Wallet (Fiat):**
```typescript
// Create custodial wallet
const wallet = await trpc.wallet.create.mutate({
  walletType: 'custodial',
  currency: 'USD',
  isDefault: true
});

// Add balance
await trpc.wallet.addBalance.mutate({
  walletId: wallet.id,
  amount: 10000 // $100
});

// Payment automatically deducts from balance
```

**Non-Custodial Wallet (Crypto):**
```typescript
// Create non-custodial wallet
const wallet = await trpc.wallet.create.mutate({
  walletType: 'non_custodial',
  walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  currency: 'ETH'
});

// Payment initiates blockchain transaction
// Requires Web3 wallet connection
```

---

## API Documentation

### Authentication

All protected endpoints require JWT authentication:

```typescript
// Login with OAuth
const { token } = await trpc.auth.login.mutate({
  provider: 'google',
  code: authCode
});

// Use token in subsequent requests
const client = createTRPCClient({
  headers: {
    authorization: `Bearer ${token}`
  }
});
```

### Face Recognition API

#### Register Face
```typescript
trpc.faceRecognition.register.mutate({
  faceEmbedding: number[],      // 128-512 dimensional vector
  stripeCustomerId?: string,
  paymentMethodId?: string,
  maxPaymentAmount: number      // In cents
})
```

#### Verify Face
```typescript
trpc.faceRecognition.verify.mutate({
  faceEmbedding: number[],
  threshold: number              // 0.0-1.0, default 0.6
})

// Returns:
{
  verified: boolean,
  user: User | null,
  wallet: Wallet | null,
  similarity: number
}
```

### Real-time Order API

#### Create Real-time Order
```typescript
trpc.realtimeOrder.createRealtimeOrder.mutate({
  deviceId: number,
  userId: number,
  merchantId: number,
  items: Array<{
    productId: number,
    quantity: number
  }>,
  gestureConfidence?: number
})

// Returns:
{
  success: boolean,
  order: {
    id: number,
    orderNumber: string,
    totalAmount: number,
    status: string,
    paymentStatus: string,
    items: OrderItem[]
  }
}
```

#### Cancel Order
```typescript
trpc.realtimeOrder.cancelPendingOrder.mutate({
  orderId: number,
  reason?: string
})
```

### Wallet API

#### Create Wallet
```typescript
trpc.wallet.create.mutate({
  walletType: 'custodial' | 'non_custodial',
  walletAddress?: string,        // Required for non-custodial
  currency: string,               // 'USD', 'ETH', 'BTC', etc.
  isDefault: boolean
})
```

#### Add Balance (Custodial only)
```typescript
trpc.wallet.addBalance.mutate({
  walletId: number,
  amount: number,                 // In cents
  paymentMethodId?: string
})
```

### WebSocket Events

#### Client → Server
```typescript
// Register client
{
  type: 'register',
  userId?: number,
  deviceId?: number,
  merchantId?: number
}

// Heartbeat
{
  type: 'ping'
}
```

#### Server → Client
```typescript
// Order update
{
  type: 'order_update',
  data: {
    orderId: number,
    status: string,
    ...orderData
  },
  timestamp: number
}

// Payment status
{
  type: 'payment_status',
  data: {
    orderId: number,
    status: 'success' | 'failed' | 'pending'
  },
  timestamp: number
}

// Device status
{
  type: 'device_status',
  data: {
    deviceId: number,
    status: 'online' | 'offline' | 'error'
  },
  timestamp: number
}
```

---

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: Add your feature description"

# Push to GitHub
git push origin feature/your-feature-name

# Create pull request
```

### 2. Database Changes

```bash
# Modify schema in drizzle/schema.ts

# Generate migration
pnpm db:generate

# Apply migration
pnpm db:push

# Or use Drizzle Studio for visual editing
pnpm db:studio
```

### 3. Adding New API Endpoint

```typescript
// 1. Create router file: server/myFeatureRouters.ts
import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";

export const myFeatureRouter = router({
  myEndpoint: protectedProcedure
    .input(z.object({
      param: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Implementation
      return { success: true };
    })
});

// 2. Add to main router: server/routers.ts
import { myFeatureRouter } from "./myFeatureRouters";

export const appRouter = router({
  // ...existing routers
  myFeature: myFeatureRouter,
});

// 3. Use in client
const result = await trpc.myFeature.myEndpoint.mutate({
  param: "value"
});
```

### 4. Code Style

```typescript
// Use TypeScript strict mode
// Follow ESLint rules
// Add JSDoc comments for public APIs

/**
 * Calculate cosine similarity between two vectors
 * 
 * @param vec1 - First vector
 * @param vec2 - Second vector
 * @returns Similarity score (0-1)
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  // Implementation
}
```

---

## Testing

### Run Tests

```bash
# All tests
pnpm test

# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# With coverage
pnpm test:coverage
```

### Writing Tests

See [tests/README.md](./tests/README.md) for detailed testing guide.

---

## Deployment

### Production Build

```bash
# Build frontend and backend
pnpm build

# Start production server
pnpm start
```

### Docker Deployment

```bash
# Build Docker image
docker build -t ssp-app .

# Run container
docker run -p 3000:3000 --env-file .env ssp-app
```

### Environment-specific Configuration

```bash
# Development
NODE_ENV=development pnpm dev

# Staging
NODE_ENV=staging pnpm build && pnpm start

# Production
NODE_ENV=production pnpm build && pnpm start
```

---

## Contributing

### Code Review Checklist

- [ ] Code follows project style guide
- [ ] All tests pass
- [ ] New features have tests
- [ ] Documentation updated
- [ ] No console.log in production code
- [ ] Error handling implemented
- [ ] TypeScript types are correct
- [ ] Performance considerations addressed

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Example:**
```
feat(payments): Add blockchain payment support

- Implement Web3.js integration
- Add Ethereum and Polygon support
- Create transaction monitoring service

Closes #123
```

---

## Resources

- [tRPC Documentation](https://trpc.io/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [MediaPipe Documentation](https://google.github.io/mediapipe/)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Web3.js Documentation](https://web3js.readthedocs.io/)

---

## Support

- GitHub Issues: https://github.com/everest-an/SSP/issues
- Documentation: https://github.com/everest-an/SSP/wiki
- Email: support@ssp.example.com

---

**Last Updated:** 2025-11-08  
**Version:** 1.0.0
