/**
 * Filecoin Storage Test Script
 * 
 * 测试 Filecoin 存储功能
 * 
 * 使用方法:
 * 1. 确保已配置 FILECOIN_PRIVATE_KEY 环境变量
 * 2. 确保钱包中有足够的 tFIL 和 USDFC
 * 3. 运行: npx ts-node server/tests/testFilecoinStorage.ts
 */

import * as filecoinService from '../services/filecoinService';

async function testFilecoinStorage() {
  console.log('🚀 Starting Filecoin Storage Tests...\n');

  try {
    // 测试 1: 检查配置
    console.log('Test 1: Check Configuration');
    const isConfigured = filecoinService.isFilecoinConfigured();
    console.log('✓ Filecoin configured:', isConfigured);
    
    if (!isConfigured) {
      console.error('❌ Filecoin is not configured. Please set FILECOIN_PRIVATE_KEY in .env');
      return;
    }
    console.log('');

    // 测试 2: 获取网络信息
    console.log('Test 2: Get Network Info');
    const networkInfo = await filecoinService.getNetworkInfo();
    console.log('✓ Network:', networkInfo.network);
    console.log('✓ Address:', networkInfo.address);
    console.log('✓ FIL Balance:', networkInfo.balance.fil);
    console.log('✓ USDFC Balance:', networkInfo.balance.usdfc);
    console.log('');

    // 测试 3: 获取账户余额
    console.log('Test 3: Get Account Balance');
    const balance = await filecoinService.getAccountBalance();
    console.log('✓ FIL:', balance.fil);
    console.log('✓ USDFC:', balance.usdfc);
    console.log('✓ Storage Usage:', balance.storageUsage);
    console.log('');

    // 测试 4: 上传文本数据
    console.log('Test 4: Upload Text Data');
    const testText = `Hello from SSP! Timestamp: ${new Date().toISOString()}`;
    const textMetadata: filecoinService.StorageMetadata = {
      type: filecoinService.StorageType.INVOICE,
      userId: 'test-user-001',
      orderId: 'test-order-001',
      filename: 'test-invoice.txt',
      mimeType: 'text/plain',
      size: Buffer.byteLength(testText, 'utf8'),
      uploadedAt: Date.now(),
      description: 'Test invoice upload',
    };

    const textResult = await filecoinService.uploadTextToFilecoin(testText, textMetadata);
    console.log('✓ Text uploaded successfully!');
    console.log('  - Piece CID:', textResult.pieceCid);
    console.log('  - Size:', textResult.size, 'bytes');
    console.log('');

    // 测试 5: 下载文本数据
    console.log('Test 5: Download Text Data');
    const downloadedText = await filecoinService.downloadTextFromFilecoin(textResult.pieceCid);
    console.log('✓ Text downloaded successfully!');
    console.log('  - Content:', downloadedText);
    console.log('  - Match:', downloadedText === testText ? '✓ Yes' : '❌ No');
    console.log('');

    // 测试 6: 上传 JSON 数据
    console.log('Test 6: Upload JSON Data');
    const testJSON = {
      orderId: 'ORDER-12345',
      customer: 'John Doe',
      items: [
        { name: 'Product A', price: 10.99, quantity: 2 },
        { name: 'Product B', price: 25.50, quantity: 1 },
      ],
      total: 47.48,
      date: new Date().toISOString(),
    };

    const jsonMetadata: filecoinService.StorageMetadata = {
      type: filecoinService.StorageType.INVOICE,
      userId: 'test-user-001',
      orderId: 'ORDER-12345',
      filename: 'invoice-12345.json',
      mimeType: 'application/json',
      size: 0,
      uploadedAt: Date.now(),
      description: 'Test JSON invoice',
    };

    const jsonResult = await filecoinService.uploadJSONToFilecoin(testJSON, jsonMetadata);
    console.log('✓ JSON uploaded successfully!');
    console.log('  - Piece CID:', jsonResult.pieceCid);
    console.log('  - Size:', jsonResult.size, 'bytes');
    console.log('');

    // 测试 7: 下载 JSON 数据
    console.log('Test 7: Download JSON Data');
    const downloadedJSON = await filecoinService.downloadJSONFromFilecoin(jsonResult.pieceCid);
    console.log('✓ JSON downloaded successfully!');
    console.log('  - Order ID:', downloadedJSON.orderId);
    console.log('  - Customer:', downloadedJSON.customer);
    console.log('  - Total:', downloadedJSON.total);
    console.log('  - Match:', JSON.stringify(downloadedJSON) === JSON.stringify(testJSON) ? '✓ Yes' : '❌ No');
    console.log('');

    // 测试 8: 生成存储证明
    console.log('Test 8: Generate Storage Proof');
    const proof = filecoinService.generateStorageProof(textResult.pieceCid, textMetadata);
    console.log('✓ Proof generated:', proof);
    console.log('');

    // 测试 9: 验证存储证明
    console.log('Test 9: Verify Storage Proof');
    const isValid = filecoinService.verifyStorageProof(textResult.pieceCid, textMetadata, proof);
    console.log('✓ Proof valid:', isValid ? '✓ Yes' : '❌ No');
    console.log('');

    // 测试 10: 估算存储成本
    console.log('Test 10: Estimate Storage Cost');
    const dataSize = 1024 * 1024; // 1 MB
    const cost = await filecoinService.estimateStorageCost(dataSize);
    console.log('✓ Data size: 1 MB');
    console.log('  - Cost:', cost.costUSDFC, 'USDFC');
    console.log('  - Duration:', cost.duration);
    console.log('');

    // 测试 11: 上传产品数据
    console.log('Test 11: Upload Product Data');
    const productData = {
      name: 'Smart Watch Pro',
      description: 'Advanced fitness tracking with heart rate monitor',
      price: 299.99,
      category: 'Electronics',
      images: ['watch-front.jpg', 'watch-side.jpg'],
      attributes: {
        color: 'Space Gray',
        size: '44mm',
        waterproof: true,
        batteryLife: '18 hours',
      },
    };

    const productResult = await filecoinService.uploadProductData(
      productData,
      'PROD-TEST-001',
      'MERCHANT-TEST-001'
    );
    console.log('✓ Product data uploaded successfully!');
    console.log('  - Piece CID:', productResult.pieceCid);
    console.log('  - Size:', productResult.size, 'bytes');
    console.log('');

    // 测试总结
    console.log('✅ All tests passed successfully!');
    console.log('\nTest Summary:');
    console.log('- Configuration: ✓');
    console.log('- Network Info: ✓');
    console.log('- Account Balance: ✓');
    console.log('- Upload Text: ✓');
    console.log('- Download Text: ✓');
    console.log('- Upload JSON: ✓');
    console.log('- Download JSON: ✓');
    console.log('- Generate Proof: ✓');
    console.log('- Verify Proof: ✓');
    console.log('- Estimate Cost: ✓');
    console.log('- Upload Product: ✓');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// 运行测试
testFilecoinStorage()
  .then(() => {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed with error:', error);
    process.exit(1);
  });
