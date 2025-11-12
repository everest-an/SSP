# SSP Payment Upgrade - Deployment & Testing Guide

## 📋 Pre-Deployment Checklist

### 1. Database Migration
```bash
# Connect to your production database
mysql -h your-db-host -u your-username -p your-database

# Run the migration
source drizzle/0007_add_merchant_wallet_address.sql

# Verify the migration
DESCRIBE merchants;
```

### 2. Add Merchant Wallet Addresses
```bash
# Run test data script (update with your actual wallet addresses)
source drizzle/test_data_merchant_wallet.sql
```

### 3. Environment Variables Check
Ensure these are set in your production environment:
- ✅ `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- ✅ `STRIPE_SECRET_KEY` - Stripe secret key (backend)
- ✅ `DATABASE_URL` - Database connection string

No new environment variables needed for MetaMask support.

## 🚀 Deployment Steps

### Option 1: Vercel Auto-Deploy (Recommended)
```bash
# Code is already pushed to GitHub
# Vercel will automatically deploy if connected to the repository
# Check deployment status at: https://vercel.com/your-project
```

### Option 2: Manual Vercel Deploy
```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Set Vercel token
export VERCEL_TOKEN=o6ZTKMbam099zpwWNe9umquY

# Deploy to production
cd /home/ubuntu/SSP
vercel --prod --token $VERCEL_TOKEN
```

### Option 3: Self-Hosted Deployment
```bash
# Build the project
cd /home/ubuntu/SSP
pnpm install
pnpm build

# Start the server
NODE_ENV=production node dist/index.js

# Or use PM2 for process management
pm2 start dist/index.js --name ssp-server
pm2 save
```

## 🧪 Testing Guide

### Phase 1: Basic Functionality Test

#### 1.1 Test Payment Methods Page
1. Navigate to `/payment-methods`
2. Click "Add Card"
3. Enter test card: `4242 4242 4242 4242`, Exp: `12/25`, CVC: `123`
4. Verify card appears in list
5. Click "Connect MetaMask"
6. Approve MetaMask connection
7. Verify wallet appears in list
8. Set one as default
9. Verify "Default" badge appears

#### 1.2 Test Payment Method Selector
1. Navigate to `/device-payment`
2. Start face detection
3. Select a product
4. Confirm with thumbs up gesture
5. **NEW:** Payment Method Selector modal should appear
6. Verify both Stripe card and MetaMask wallet are listed
7. Verify default method is highlighted
8. Select a payment method
9. Verify selection indicator (checkmark) appears
10. Click "Continue to Payment"
11. Face verification modal should appear

### Phase 2: Stripe Card Payment Test

#### 2.1 Complete Card Payment
1. Follow Phase 1 steps 1-8
2. Select Stripe card in payment method selector
3. Complete face verification
4. Wait for payment processing
5. Verify "Payment Successful" message
6. Check order appears in `/orders`
7. Verify payment status is "completed"

#### 2.2 Test Card Payment Failure
1. Use test card: `4000 0000 0000 0002` (decline)
2. Follow payment flow
3. Verify error message appears
4. Verify order status is "failed"

### Phase 3: MetaMask Payment Test

#### 3.1 Setup MetaMask
1. Install MetaMask browser extension
2. Create or import wallet
3. Switch to test network (Sepolia or Goerli)
4. Get test ETH from faucet:
   - Sepolia: https://sepoliafaucet.com/
   - Goerli: https://goerlifaucet.com/

#### 3.2 Complete MetaMask Payment
1. Follow Phase 1 steps 1-8
2. Select MetaMask wallet in payment method selector
3. Complete face verification
4. **NEW:** MetaMask popup should appear
5. Verify transaction details:
   - To: Merchant wallet address
   - Amount: Correct price in ETH
   - Gas fee estimate
6. Click "Confirm" in MetaMask
7. Wait for blockchain confirmation
8. Verify order status changes to "pending" or "completed"

#### 3.3 Test MetaMask Connection Issues
1. Lock MetaMask wallet
2. Try to complete payment
3. Verify error message appears
4. Unlock MetaMask
5. Retry payment
6. Verify success

#### 3.4 Test Merchant Without Wallet
1. Update merchant: `UPDATE merchants SET walletAddress = NULL WHERE id = 1;`
2. Try to complete MetaMask payment
3. Verify error: "Merchant wallet address not configured"
4. Restore wallet address

### Phase 4: Edge Cases

#### 4.1 No Payment Methods
1. Remove all payment methods
2. Try to start payment
3. Verify "No payment methods found" alert
4. Verify "Add New Payment Method" button works

#### 4.2 Payment Method Switching
1. Add both card and MetaMask
2. Set card as default
3. Start payment flow
4. Change to MetaMask in selector
5. Complete payment
6. Verify MetaMask was used

#### 4.3 Cancel Payment
1. Start payment flow
2. Open payment method selector
3. Click "Cancel"
4. Verify modal closes
5. Verify no payment processed

### Phase 5: UI/UX Verification

#### 5.1 Design Consistency
- ✅ Payment method selector matches existing modal style
- ✅ Icons are consistent (CreditCard, Wallet, Star, Check)
- ✅ Colors match theme (primary, muted, etc.)
- ✅ Hover effects work smoothly
- ✅ Selection indicator is clear
- ✅ Responsive on mobile devices

#### 5.2 Accessibility
- ✅ Modal can be closed with Escape key
- ✅ Focus management works correctly
- ✅ Screen reader compatible
- ✅ Keyboard navigation works

## 🐛 Troubleshooting

### Issue: Payment method selector doesn't appear
**Solution:**
1. Check browser console for errors
2. Verify `PaymentMethodSelector` component is imported
3. Check `showPaymentMethodSelector` state is set to `true`

### Issue: MetaMask not connecting
**Solution:**
1. Ensure MetaMask is installed
2. Check if MetaMask is locked
3. Verify network is correct
4. Check browser console for errors
5. Try refreshing page

### Issue: Merchant wallet address error
**Solution:**
1. Run: `SELECT walletAddress FROM merchants WHERE id = 1;`
2. If NULL, run: `UPDATE merchants SET walletAddress = '0x...' WHERE id = 1;`
3. Verify address format: Must start with `0x` and be 42 characters

### Issue: Transaction pending forever
**Solution:**
1. Check blockchain explorer (Etherscan)
2. Verify transaction was submitted
3. Check gas price (may be too low)
4. Wait for network congestion to clear
5. Consider implementing transaction monitoring

### Issue: Stripe payment fails
**Solution:**
1. Check Stripe dashboard for error details
2. Verify API keys are correct
3. Check card is not expired
4. Verify sufficient funds
5. Check Stripe webhook configuration

## 📊 Monitoring

### Key Metrics to Track
1. **Payment Method Selection Rate**
   - % users who select Stripe vs MetaMask
   - Time spent on payment method selector

2. **Payment Success Rate**
   - Stripe success rate (target: >95%)
   - MetaMask success rate (target: >90%)

3. **Error Rates**
   - MetaMask connection failures
   - Merchant wallet not configured errors
   - Transaction timeout rate

4. **Performance**
   - Payment method selector load time
   - Modal render time
   - API response time for processPayment

### Logging
Check these logs for issues:
```bash
# Backend logs
tail -f logs/ssp-server.log | grep -i "payment"

# Key log messages to monitor:
# - "[PaymentMethod] MetaMask payment initiated"
# - "[PaymentMethod] Card payment successful"
# - "[RealtimeOrder] Payment method failed"
```

## 🔒 Security Checklist

- ✅ Merchant wallet addresses stored securely in database
- ✅ User wallet addresses validated (Ethereum address regex)
- ✅ Payment method ownership verified (userId check)
- ✅ No private keys stored anywhere
- ✅ MetaMask transactions signed by user
- ✅ Face verification required before payment
- ✅ HTTPS enabled on production
- ✅ API rate limiting enabled

## 📝 Post-Deployment Tasks

### Immediate (Day 1)
- [ ] Run database migration
- [ ] Add merchant wallet addresses
- [ ] Test Stripe payment flow
- [ ] Test MetaMask payment flow
- [ ] Monitor error logs
- [ ] Check payment success rates

### Short-term (Week 1)
- [ ] Analyze user behavior (Stripe vs MetaMask usage)
- [ ] Collect user feedback
- [ ] Fix any critical bugs
- [ ] Optimize gas fee estimation
- [ ] Add transaction monitoring

### Long-term (Month 1)
- [ ] Implement blockchain confirmation webhook
- [ ] Add multi-currency support (USDT, USDC)
- [ ] Implement automatic network switching
- [ ] Add transaction history dashboard
- [ ] Create refund mechanism for crypto payments

## 🆘 Rollback Procedure

If critical issues occur:

### 1. Database Rollback
```sql
-- Remove walletAddress column
ALTER TABLE merchants DROP COLUMN walletAddress;
```

### 2. Code Rollback
```bash
# Revert to previous commit
cd /home/ubuntu/SSP
git revert 8c0fe6a
git push origin main

# Redeploy
vercel --prod
```

### 3. Feature Flag (Alternative)
Add to `.env`:
```
ENABLE_METAMASK_PAYMENT=false
```

Update code to check flag before showing MetaMask option.

## 📞 Support Contacts

- **Developer:** Manus AI
- **GitHub Issues:** https://github.com/everest-an/SSP/issues
- **Email:** everest9812@gmail.com

## 🎉 Success Criteria

Deployment is considered successful when:
- ✅ All tests pass
- ✅ Payment method selector works smoothly
- ✅ Stripe payments succeed >95% of time
- ✅ MetaMask payments succeed >90% of time
- ✅ No critical errors in logs
- ✅ User feedback is positive
- ✅ Performance metrics are acceptable

---

**Last Updated:** 2025-11-12  
**Version:** 1.1.0  
**Status:** Ready for Production 🚀
