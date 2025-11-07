# SSP Testing Guide

This directory contains tests for the SSP (Smart Store Payment) application.

## Test Structure

```
tests/
├── unit/              # Unit tests for individual functions/modules
│   ├── blockchain.test.ts
│   ├── errors.test.ts
│   └── mediapipe.test.ts
├── integration/       # Integration tests for API endpoints
│   ├── auth.test.ts
│   ├── orders.test.ts
│   └── payments.test.ts
├── e2e/              # End-to-end tests for complete workflows
│   ├── payment-flow.test.ts
│   └── face-gesture-payment.test.ts
├── fixtures/         # Test data and mocks
│   ├── users.json
│   ├── products.json
│   └── mock-face-embeddings.ts
└── utils/            # Test utilities and helpers
    ├── test-db.ts
    ├── test-server.ts
    └── mock-websocket.ts
```

## Running Tests

### Prerequisites

```bash
# Install dependencies
pnpm install

# Install test dependencies
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom
pnpm add -D supertest @types/supertest
```

### Run All Tests

```bash
pnpm test
```

### Run Specific Test Suite

```bash
# Unit tests only
pnpm test:unit

# Integration tests only
pnpm test:integration

# E2E tests only
pnpm test:e2e
```

### Run Tests in Watch Mode

```bash
pnpm test:watch
```

### Generate Coverage Report

```bash
pnpm test:coverage
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../server/faceAndWalletRouters';

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const vec1 = [1, 2, 3];
    const vec2 = [1, 2, 3];
    expect(cosineSimilarity(vec1, vec2)).toBe(1);
  });

  it('should return 0 for orthogonal vectors', () => {
    const vec1 = [1, 0];
    const vec2 = [0, 1];
    expect(cosineSimilarity(vec1, vec2)).toBe(0);
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/_core/index';

describe('POST /api/orders', () => {
  let authToken: string;

  beforeAll(async () => {
    // Set up test database and get auth token
    authToken = await getTestAuthToken();
  });

  it('should create a new order', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ productId: 1, quantity: 2 }]
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('orderId');
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestDatabase();
  });
});
```

### E2E Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { setupTestEnvironment, cleanupTestEnvironment } from './utils/test-env';

describe('Face + Gesture Payment Flow', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  it('should complete payment with face recognition and thumbs up gesture', async () => {
    // 1. Register user and face
    const user = await createTestUser();
    await registerFaceRecognition(user.id, mockFaceEmbedding);

    // 2. Create wallet and add balance
    const wallet = await createWallet(user.id, 'custodial');
    await addBalance(wallet.id, 10000); // $100

    // 3. Start payment on device
    const device = await getTestDevice();
    const payment = await startPayment(device.id);

    // 4. Verify face
    const faceVerified = await verifyFace(mockFaceEmbedding);
    expect(faceVerified.verified).toBe(true);

    // 5. Detect thumbs up gesture
    const gestureDetected = await detectGesture('thumbs_up');
    expect(gestureDetected.confidence).toBeGreaterThan(0.75);

    // 6. Complete payment
    const order = await completePayment(payment.id);
    expect(order.status).toBe('completed');
    expect(order.paymentStatus).toBe('captured');
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });
});
```

## Test Configuration

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
});
```

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Use `beforeEach` and `afterEach` for setup/cleanup
- Don't rely on test execution order

### 2. Mock External Dependencies
- Mock database calls in unit tests
- Mock WebSocket connections
- Mock blockchain transactions

### 3. Use Descriptive Test Names
```typescript
// Good
it('should throw error when wallet balance is insufficient')

// Bad
it('test payment')
```

### 4. Test Edge Cases
- Empty inputs
- Invalid data types
- Boundary values
- Error conditions

### 5. Keep Tests Fast
- Use mocks for slow operations
- Run unit tests frequently
- Run integration/e2e tests before commits

## Continuous Integration

Tests are automatically run on:
- Every commit to main branch
- Every pull request
- Scheduled nightly builds

## Troubleshooting

### Database Connection Errors
```bash
# Make sure test database is running
docker-compose up -d test-db

# Run migrations
pnpm db:migrate:test
```

### Port Already in Use
```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

### Test Timeout
```typescript
// Increase timeout for slow tests
it('slow test', async () => {
  // test code
}, 30000); // 30 seconds
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Supertest](https://github.com/visionmedia/supertest)
