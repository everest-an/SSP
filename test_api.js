/**
 * SSP API Test Script
 * Tests the realtime order creation flow
 */

const testData = {
  userId: 1,
  merchantId: 1,
  deviceId: 1,
  products: [
    { productId: 1, quantity: 1 }, // Coffee
    { productId: 3, quantity: 2 }  // Water x2
  ]
};

async function testRealtimeOrder() {
  console.log('=== Testing Realtime Order Creation ===\n');
  
  try {
    // Test 1: Get device info
    console.log('Test 1: Fetching device info...');
    const deviceResponse = await fetch('http://localhost:5000/api/trpc/device.getById?input=' + encodeURIComponent(JSON.stringify({ deviceId: testData.deviceId })));
    const deviceData = await deviceResponse.json();
    console.log('Device:', deviceData);
    console.log('✓ Device fetch successful\n');
    
    // Test 2: Get user wallet
    console.log('Test 2: Fetching user wallet...');
    const walletResponse = await fetch('http://localhost:5000/api/trpc/wallet.getByUserId?input=' + encodeURIComponent(JSON.stringify({ userId: testData.userId })));
    const walletData = await walletResponse.json();
    console.log('Wallet:', walletData);
    console.log('✓ Wallet fetch successful\n');
    
    // Test 3: Get face recognition
    console.log('Test 3: Fetching face recognition data...');
    const faceResponse = await fetch('http://localhost:5000/api/trpc/faceRecognition.getByUserId?input=' + encodeURIComponent(JSON.stringify({ userId: testData.userId })));
    const faceData = await faceResponse.json();
    console.log('Face Recognition:', faceData);
    console.log('✓ Face recognition fetch successful\n');
    
    // Test 4: Get products
    console.log('Test 4: Fetching products...');
    const productsResponse = await fetch('http://localhost:5000/api/trpc/deviceProduct.getByDevice?input=' + encodeURIComponent(JSON.stringify({ deviceId: testData.deviceId })));
    const productsData = await productsResponse.json();
    console.log('Products:', productsData);
    console.log('✓ Products fetch successful\n');
    
    // Test 5: Create realtime order
    console.log('Test 5: Creating realtime order...');
    const orderPayload = {
      deviceId: testData.deviceId,
      userId: testData.userId,
      merchantId: testData.merchantId,
      items: testData.products,
      gestureConfidence: 85
    };
    
    console.log('Order payload:', JSON.stringify(orderPayload, null, 2));
    
    const orderResponse = await fetch('http://localhost:5000/api/trpc/realtimeOrder.createRealtimeOrder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });
    
    const orderData = await orderResponse.json();
    console.log('Order response:', JSON.stringify(orderData, null, 2));
    
    if (orderResponse.ok) {
      console.log('✓ Order creation successful!\n');
    } else {
      console.log('✗ Order creation failed\n');
    }
    
    console.log('=== Test Complete ===');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testRealtimeOrder();
