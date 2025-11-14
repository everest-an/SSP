-- SSP Test Data
-- This script creates test data for development and testing

-- Insert test user first (required for merchant)
INSERT INTO users (openId, email, role, createdAt, updatedAt)
VALUES ('test-user-001', 'testuser@example.com', 'user', NOW(), NOW())
ON DUPLICATE KEY UPDATE email='testuser@example.com';

SET @userId = (SELECT id FROM users WHERE openId='test-user-001' LIMIT 1);

-- Insert test merchant
INSERT INTO merchants (userId, businessName, businessType, address, phone, email, status, createdAt, updatedAt)
VALUES (@userId, 'Test Store', 'Retail', '123 Test St, Test City', '+1234567890', 'test@store.com', 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE businessName='Test Store';

SET @merchantId = (SELECT id FROM merchants WHERE userId=@userId LIMIT 1);

-- Insert test device
INSERT INTO devices (merchantId, deviceName, deviceType, deviceId, location, status, lastHeartbeat, createdAt, updatedAt)
VALUES (@merchantId, 'Test Device 1', 'ipad', 'DEV-TEST-001', 'Store Entrance', 'online', NOW(), NOW(), NOW())
ON DUPLICATE KEY UPDATE status='online', lastHeartbeat=NOW();

SET @deviceDbId = (SELECT id FROM devices WHERE deviceId='DEV-TEST-001' LIMIT 1);

-- Insert test products
INSERT INTO products (merchantId, name, description, price, currency, stock, category, status, createdAt, updatedAt)
VALUES 
(@merchantId, 'Coffee', 'Premium Coffee', 350, 'USD', 100, 'Beverages', 'active', NOW(), NOW()),
(@merchantId, 'Sandwich', 'Fresh Sandwich', 650, 'USD', 50, 'Food', 'active', NOW(), NOW()),
(@merchantId, 'Water', 'Bottled Water', 150, 'USD', 200, 'Beverages', 'active', NOW(), NOW()),
(@merchantId, 'Snack Bar', 'Energy Snack Bar', 250, 'USD', 75, 'Snacks', 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE stock=VALUES(stock);

-- Get product IDs
SET @product1Id = (SELECT id FROM products WHERE name='Coffee' AND merchantId=@merchantId LIMIT 1);
SET @product2Id = (SELECT id FROM products WHERE name='Sandwich' AND merchantId=@merchantId LIMIT 1);
SET @product3Id = (SELECT id FROM products WHERE name='Water' AND merchantId=@merchantId LIMIT 1);
SET @product4Id = (SELECT id FROM products WHERE name='Snack Bar' AND merchantId=@merchantId LIMIT 1);

-- Link products to device
INSERT INTO deviceProducts (deviceId, productId, createdAt)
VALUES 
(@deviceDbId, @product1Id, NOW()),
(@deviceDbId, @product2Id, NOW()),
(@deviceDbId, @product3Id, NOW()),
(@deviceDbId, @product4Id, NOW())
ON DUPLICATE KEY UPDATE deviceId=deviceId;

-- Create test wallet for user
INSERT INTO wallets (userId, walletType, balance, currency, status, createdAt, updatedAt)
VALUES (@userId, 'custodial', 10000, 'USD', 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE balance=10000, status='active';

SET @walletId = (SELECT id FROM wallets WHERE userId=@userId LIMIT 1);

-- Create test face recognition data (with dummy embedding)
INSERT INTO faceRecognition (userId, faceEmbedding, isActive, maxPaymentAmount, createdAt, updatedAt)
VALUES (@userId, 
  CONCAT('[', REPEAT('0.5,', 127), '0.5]'),  -- 128-dimensional dummy embedding
  1, 
  5000,  -- Max payment $50.00
  NOW(), 
  NOW())
ON DUPLICATE KEY UPDATE isActive=1, maxPaymentAmount=5000;

-- Display created test data
SELECT 'Test data created successfully!' as Status;
SELECT 
  'User ID' as Info, @userId as Value
UNION ALL SELECT 'Merchant ID', @merchantId
UNION ALL SELECT 'Device DB ID', @deviceDbId
UNION ALL SELECT 'Wallet ID', @walletId;

-- Show test data summary
SELECT 
  'User' as Type,
  CONCAT('ID: ', id, ' | OpenID: ', openId) as Details,
  email as Email,
  role as Role
FROM users WHERE id=@userId
UNION ALL
SELECT 
  'Merchant',
  CONCAT('ID: ', id, ' | Name: ', businessName),
  email,
  status
FROM merchants WHERE id=@merchantId
UNION ALL
SELECT 
  'Device',
  CONCAT('ID: ', id, ' | DeviceID: ', deviceId),
  location,
  status
FROM devices WHERE id=@deviceDbId
UNION ALL
SELECT 
  'Wallet',
  CONCAT('ID: ', id, ' | Balance: $', ROUND(balance/100, 2)),
  walletType,
  status
FROM wallets WHERE id=@walletId;

-- Show products
SELECT 
  id as ID,
  name as Name,
  CONCAT('$', ROUND(price/100, 2)) as Price,
  stock as Stock,
  category as Category,
  status as Status
FROM products 
WHERE merchantId=@merchantId
ORDER BY id;
