# Code Fixes Plan - Phase 2

## Date: November 14, 2025

## Objective
Fix identified issues in the real-time order creation flow before deployment.

---

## Issues to Fix

### 1. DevicePayment.tsx

#### Issue 1.1: Hardcoded Device and Merchant IDs
**Current Code** (lines 56-57):
```typescript
const [deviceId] = useState(1); // In production, get from device config
const [merchantId] = useState(1); // In production, get from device config
```

**Problem**: Hardcoded values won't work in multi-tenant environment

**Fix**: Get from URL params or config
```typescript
const [deviceId] = useState(Number(new URLSearchParams(window.location.search).get('deviceId')) || 1);
const [merchantId] = useState(Number(new URLSearchParams(window.location.search).get('merchantId')) || 1);
```

#### Issue 1.2: Face Verification Trigger
**Current Code** (lines 215-220):
```typescript
if (currentStep === "face_detection" && !detectedUser) {
  const embedding = faceService.extractFaceEmbedding(faceDetections);
  if (embedding) {
    verifyFaceMutation.mutate({ faceEmbedding: embedding });
  }
}
```

**Problem**: Triggers verification on every frame, could cause multiple API calls

**Fix**: Add debouncing or flag to prevent multiple calls
```typescript
const [faceVerificationAttempted, setFaceVerificationAttempted] = useState(false);

// In detect function:
if (currentStep === "face_detection" && !detectedUser && !faceVerificationAttempted && !verifyFaceMutation.isPending) {
  const embedding = faceService.extractFaceEmbedding(faceDetections);
  if (embedding) {
    setFaceVerificationAttempted(true);
    verifyFaceMutation.mutate({ faceEmbedding: embedding });
  }
}
```

#### Issue 1.3: Payment Method Flow
**Current Code** (lines 277-282):
```typescript
const processPayment = () => {
  if (!detectedUser || !selectedProduct) return;
  // Show payment method selector first
  setShowPaymentMethodSelector(true);
};
```

**Problem**: For wallet payments, payment method selector might be unnecessary

**Fix**: Check if user has default payment method, skip selector if using wallet
```typescript
const processPayment = () => {
  if (!detectedUser || !selectedProduct) return;
  
  // If using custodial wallet, skip payment method selector
  if (detectedUser.walletType === 'custodial') {
    // Directly show face confirmation
    setShowFacePaymentConfirm(true);
  } else {
    // Show payment method selector for other payment types
    setShowPaymentMethodSelector(true);
  }
};
```

#### Issue 1.4: Reset Face Verification Flag
**Current Code** (lines 335-343):
```typescript
const resetPayment = () => {
  setCurrentStep("idle");
  setDetectedUser(null);
  setSelectedProduct(null);
  setFaceDetected(false);
  setThumbsUpDetected(false);
  setGestureConfidence(0);
  stopCamera();
};
```

**Fix**: Add reset for face verification flag
```typescript
const resetPayment = () => {
  setCurrentStep("idle");
  setDetectedUser(null);
  setSelectedProduct(null);
  setFaceDetected(false);
  setThumbsUpDetected(false);
  setGestureConfidence(0);
  setFaceVerificationAttempted(false);
  setSelectedPaymentMethodId(null);
  setSelectedPaymentType(null);
  stopCamera();
};
```

#### Issue 1.5: Error Handling for MediaPipe Initialization
**Current Code** (lines 133-149):
```typescript
useEffect(() => {
  const initMediaPipe = async () => {
    try {
      const face = new FaceDetectionService();
      await face.initialize();
      setFaceService(face);

      const gesture = new GestureRecognitionService();
      await gesture.initialize();
      setGestureService(gesture);
      
      console.log("[DevicePayment] MediaPipe initialized");
    } catch (error) {
      console.error("[DevicePayment] Failed to initialize MediaPipe:", error);
      toast.error("Failed to initialize camera services");
    }
  };

  initMediaPipe();
  // ...
}, []);
```

**Problem**: No retry mechanism, no loading state

**Fix**: Add loading state and better error handling
```typescript
const [mediapipeLoading, setMediapipeLoading] = useState(true);
const [mediapipeError, setMediapipeError] = useState<string | null>(null);

useEffect(() => {
  const initMediaPipe = async () => {
    try {
      setMediapipeLoading(true);
      setMediapipeError(null);
      
      const face = new FaceDetectionService();
      await face.initialize();
      setFaceService(face);

      const gesture = new GestureRecognitionService();
      await gesture.initialize();
      setGestureService(gesture);
      
      console.log("[DevicePayment] MediaPipe initialized");
      setMediapipeLoading(false);
    } catch (error: any) {
      console.error("[DevicePayment] Failed to initialize MediaPipe:", error);
      setMediapipeError(error.message || "Failed to initialize camera services");
      setMediapipeLoading(false);
      toast.error("Failed to initialize camera services. Please refresh the page.");
    }
  };

  initMediaPipe();
  // ...
}, []);
```

---

### 2. realtimeOrderRouters.ts

#### Issue 2.1: Payment Method Integration
**Current Code** (lines 236-258):
The code tries to use payment method first, then falls back to wallet.

**Problem**: Logic is complex and might cause confusion

**Recommendation**: Keep as is for now, test first, then optimize if needed

---

### 3. Minor Improvements

#### Improvement 3.1: Add Loading State to Start Button
Show loading state while MediaPipe is initializing

#### Improvement 3.2: Add Better Error Messages
Provide more specific error messages for different failure scenarios

#### Improvement 3.3: Add Retry Button
Allow users to retry failed payments without restarting the entire flow

---

## Implementation Priority

### High Priority (Must Fix Before Deploy)
1. ✅ Fix face verification debouncing (Issue 1.2)
2. ✅ Add face verification flag reset (Issue 1.4)
3. ✅ Add MediaPipe loading state (Issue 1.5)

### Medium Priority (Should Fix)
4. ✅ Simplify payment method flow for wallet users (Issue 1.3)
5. ✅ Add device/merchant ID from URL params (Issue 1.1)

### Low Priority (Nice to Have)
6. ⏳ Add retry button for failed payments
7. ⏳ Add better error messages
8. ⏳ Add loading state to start button

---

## Testing Plan After Fixes

1. **Face Detection Test**
   - Verify face is detected only once
   - Verify face verification API is called only once
   - Verify user info displays correctly

2. **Payment Flow Test**
   - Verify wallet users skip payment method selector
   - Verify face confirmation modal appears
   - Verify order is created successfully

3. **Error Handling Test**
   - Test with MediaPipe initialization failure
   - Test with face verification failure
   - Test with insufficient balance
   - Verify error messages are clear

4. **WebSocket Test**
   - Verify real-time order status updates
   - Verify payment notifications

---

## Files to Modify

1. `/home/ubuntu/SSP/client/src/pages/DevicePayment.tsx`
   - Add face verification flag
   - Add MediaPipe loading state
   - Simplify payment flow
   - Add URL params support
   - Improve error handling

---

## Estimated Time

- Code fixes: 1-2 hours
- Testing: 1-2 hours
- Bug fixes: 1-2 hours
- **Total**: 3-6 hours

---

## Next Steps

1. Apply fixes to DevicePayment.tsx
2. Test locally if possible
3. Commit changes to Git
4. Deploy to AWS EC2
5. Test on production
6. Document any new issues
7. Iterate until stable
