# Phase 3: Dual-Role System Implementation

**Version**: 1.0  
**Date**: 2025-11-18  
**Status**: ✅ Completed

---

## Overview

This document summarizes the implementation of the dual-role system for the SSP (Smart Store Payment) platform, enabling users to operate as both personal customers and merchants with seamless role switching.

---

## Features Implemented

### 1. Backend API (Server-Side)

#### Merchant Router (`server/routers/merchantRouter.ts`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `merchant.applyForMerchant` | Mutation | Protected | Submit merchant application |
| `merchant.getMyMerchantProfile` | Query | Protected | Get current user's merchant profile |
| `merchant.getMerchantById` | Query | Protected | Get merchant details by ID |
| `merchant.updateMerchantProfile` | Mutation | Protected | Update merchant information |
| `merchant.getAllMerchants` | Query | Admin | List all merchants with filters |
| `merchant.approveMerchant` | Mutation | Admin | Approve pending merchant application |
| `merchant.rejectMerchant` | Mutation | Admin | Reject merchant application |
| `merchant.suspendMerchant` | Mutation | Admin | Suspend active merchant account |
| `merchant.getMerchantStatistics` | Query | Admin | Get merchant statistics |
| `merchant.switchRole` | Mutation | Protected | Switch between user/merchant roles |

#### Email Notifications (`server/services/emailService.ts`)

-   **sendMerchantApplicationNotification** - Notify admins of new applications
-   **sendMerchantApprovalEmail** - Notify merchant of approval
-   **sendMerchantRejectionEmail** - Notify merchant of rejection with reason
-   **sendMerchantSuspensionEmail** - Notify merchant of account suspension

### 2. Frontend Pages (Client-Side)

#### Merchant Application Page (`client/src/pages/MerchantApplication.tsx`)

-   Comprehensive application form with business information
-   Real-time validation
-   Success confirmation with auto-redirect
-   User-friendly error handling

**Form Fields:**
-   Business Name (required)
-   Business Type
-   Business Address
-   Phone Number
-   Business Email
-   Additional Information

#### Merchant Dashboard (`client/src/pages/MerchantDashboard.tsx`)

-   Status-aware dashboard (active/pending/suspended)
-   Quick statistics cards:
    -   Total Revenue
    -   Orders
    -   Products
    -   Devices
-   Quick action cards for:
    -   Manage Products
    -   Manage Devices
    -   View Orders
    -   Analytics
    -   Transactions
    -   Settings
-   Recent activity feed

#### Role Switcher Component (`client/src/components/RoleSwitcher.tsx`)

-   Dropdown menu for role selection
-   Visual indicators for current role
-   Icons for each role (User, Merchant, Admin)
-   "Become a Merchant" call-to-action for non-merchants
-   Automatic navigation after role switch

#### Admin Merchant Approvals Page (`client/src/pages/admin/MerchantApprovals.tsx`)

-   Statistics dashboard showing:
    -   Total Merchants
    -   Active Merchants
    -   Pending Applications
    -   Suspended Accounts
-   Pending applications section with:
    -   Business details display
    -   Approve/Reject actions
    -   Rejection reason input
-   Active merchants section with:
    -   Merchant information
    -   Suspend action
-   Suspended merchants section
-   Confirmation dialogs for all actions

### 3. Role-Based Access Control (RBAC)

#### Permission Levels

| Role | Access Level | Capabilities |
| :--- | :--- | :--- |
| **User** | Basic | Personal account, face enrollment, wallet, payments |
| **Merchant** | Extended | All user capabilities + merchant dashboard, product management, device management, order management, analytics |
| **Admin** | Full | All capabilities + user management, merchant approval, system configuration |

#### Middleware Procedures

```typescript
// Admin-only access
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

// Merchant or admin access
const merchantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'merchant' && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Merchant or admin access required' });
  }
  return next({ ctx });
});
```

---

## User Workflows

### Workflow 1: Becoming a Merchant

```
1. User logs in with personal account
   ↓
2. Navigates to "Become a Merchant" (via Role Switcher or direct link)
   ↓
3. Fills out merchant application form
   ↓
4. Submits application → Status: "Pending"
   ↓
5. Admin receives email notification
   ↓
6. Admin reviews application in Admin Dashboard
   ↓
7a. Admin approves → User role upgraded to "merchant"
    → User receives approval email
    → Can now switch to merchant mode
   
7b. Admin rejects → User receives rejection email with reason
    → Can reapply in the future
```

### Workflow 2: Role Switching

```
1. User with approved merchant account logs in
   ↓
2. Clicks Role Switcher dropdown in navigation
   ↓
3. Selects "Merchant Account"
   ↓
4. System updates user.role to "merchant"
   ↓
5. User redirected to Merchant Dashboard
   ↓
6. Can switch back to "Personal Account" anytime
```

### Workflow 3: Admin Merchant Management

```
1. Admin logs in
   ↓
2. Navigates to Admin > Merchant Approvals
   ↓
3. Views pending applications
   ↓
4a. Approve Application:
    - Click "Approve" button
    - Confirm in dialog
    - Merchant status → "Active"
    - User role → "Merchant"
    - Email sent to merchant
    
4b. Reject Application:
    - Click "Reject" button
    - Enter rejection reason
    - Confirm in dialog
    - Merchant status → "Suspended"
    - Email sent to merchant with reason
    
4c. Suspend Active Merchant:
    - Click "Suspend" button
    - Enter suspension reason
    - Confirm in dialog
    - Merchant status → "Suspended"
    - User role → "User"
    - Email sent to merchant
```

---

## Database Schema

### Users Table

```sql
users {
  id: INT PRIMARY KEY
  email: VARCHAR(320) UNIQUE
  name: TEXT
  role: ENUM('user', 'merchant', 'admin') DEFAULT 'user'
  ...
}
```

### Merchants Table

```sql
merchants {
  id: INT PRIMARY KEY
  userId: INT (FK to users.id)
  businessName: VARCHAR(255) NOT NULL
  businessType: VARCHAR(100)
  address: TEXT
  phone: VARCHAR(50)
  email: VARCHAR(320)
  walletAddress: VARCHAR(42)
  status: ENUM('active', 'inactive', 'suspended') DEFAULT 'active'
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}
```

---

## API Routes

### Added to Main Router

```typescript
export const appRouter = router({
  // ... existing routers
  merchant: merchantRouter,  // ← New merchant router
});
```

### Frontend Routes

```typescript
// User routes
<Route path="/merchant/apply" component={MerchantApplication} />
<Route path="/merchant/dashboard" component={MerchantDashboard} />

// Admin routes
<Route path="/admin/merchant-approvals" component={MerchantApprovals} />
```

---

## Security Considerations

### 1. Authorization Checks
-   ✅ All merchant endpoints check user authentication
-   ✅ Merchants can only access their own data (unless admin)
-   ✅ Admin-only endpoints protected with `adminProcedure`
-   ✅ Role switching validates merchant account status

### 2. Data Validation
-   ✅ Input validation with Zod schemas
-   ✅ Business name required for merchant applications
-   ✅ Email format validation
-   ✅ Status enum validation

### 3. Audit Trail
-   ✅ All merchant status changes logged
-   ✅ Email notifications sent for all actions
-   ✅ Timestamps tracked for applications and updates

---

## Testing Checklist

### Backend API
- ✅ Merchant application creation
- ✅ Merchant profile retrieval
- ✅ Merchant profile updates
- ✅ Admin approval workflow
- ✅ Admin rejection workflow
- ✅ Admin suspension workflow
- ✅ Role switching validation
- ✅ Permission checks for all endpoints

### Frontend UI
- ✅ Merchant application form submission
- ✅ Merchant dashboard rendering
- ✅ Role switcher dropdown functionality
- ✅ Admin approval page rendering
- ✅ Approval/rejection dialogs
- ✅ Status badges display
- ✅ Navigation after role switch

### Integration
- ⏳ End-to-end application workflow
- ⏳ Email delivery (requires SMTP configuration)
- ⏳ Role persistence across sessions
- ⏳ Permission enforcement on protected pages

---

## Known Limitations

1.  **Email Delivery**: Email notifications are logged to console but not sent (requires SMTP configuration)
2.  **Single Merchant Account**: Users can only have one merchant account per user ID
3.  **No Merchant Reactivation**: Suspended merchants cannot self-reactivate (admin action required)
4.  **No Application Editing**: Once submitted, applications cannot be edited (must reapply)

---

## Future Enhancements

### Phase 4 Planned Features
1.  **KYC Verification**: Identity verification for merchants
2.  **Payment Methods**: Stripe integration for merchant payouts
3.  **Cryptocurrency Wallets**: BTCPay Server integration
4.  **YOLO Product Detection**: AI-powered product recognition

### Additional Improvements
-   Multi-merchant support (one user, multiple businesses)
-   Merchant application drafts
-   Merchant onboarding wizard
-   Merchant tier system (Basic, Pro, Enterprise)
-   Merchant analytics dashboard
-   Merchant API keys for third-party integrations

---

## Configuration

### Environment Variables

```bash
# Email Configuration (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@ssp.click
ADMIN_EMAIL=admin@ssp.click

# Application URL (for email links)
APP_URL=https://yourdomain.com
```

---

## Deployment Notes

### Database Migration

No new migrations required. The `merchants` and `users` tables already exist with the correct schema.

### Code Deployment

```bash
# Backend
cd /home/ubuntu/SSP
pnpm install
pnpm run build

# Frontend routes are automatically included in the build

# Restart application
pm2 restart ssp-app
```

### Post-Deployment Verification

1.  Test merchant application submission
2.  Verify admin can see pending applications
3.  Test approval/rejection workflows
4.  Verify role switching functionality
5.  Check email notifications (if SMTP configured)

---

## Support & Documentation

-   **User Guide**: See `docs/USER_GUIDE.md` (to be created)
-   **Admin Guide**: See `docs/ADMIN_GUIDE.md` (to be created)
-   **API Documentation**: Auto-generated from tRPC schema

For questions or issues, contact the development team.
