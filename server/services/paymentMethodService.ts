/**
 * Payment Method Service
 * 
 * Handles:
 * - Payment method management (credit cards, digital wallets)
 * - Payment method validation
 * - Default payment method selection
 * - Payment method deletion
 */

import { nanoid } from 'nanoid';

/**
 * Payment method types
 */
export type PaymentMethodType = 'credit_card' | 'debit_card' | 'digital_wallet' | 'bank_transfer';

/**
 * Payment method data
 */
export interface PaymentMethod {
  id: string;
  userId: number;
  type: PaymentMethodType;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  
  // Card details (masked)
  cardLast4?: string;
  cardBrand?: string;
  cardExpiry?: string;
  
  // Digital wallet details
  walletAddress?: string;
  walletType?: string;
  
  // Bank transfer details
  bankName?: string;
  accountLast4?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payment method storage (in-memory for demo, use database in production)
 */
const paymentMethods = new Map<string, PaymentMethod>();

/**
 * Create payment method
 */
export async function createPaymentMethod(
  userId: number,
  type: PaymentMethodType,
  details: Record<string, any>
): Promise<PaymentMethod> {
  try {
    const id = nanoid();
    
    const paymentMethod: PaymentMethod = {
      id,
      userId,
      type,
      name: details.name || `${type} - ${new Date().toLocaleDateString()}`,
      isDefault: details.isDefault || false,
      isActive: true,
      cardLast4: details.cardLast4,
      cardBrand: details.cardBrand,
      cardExpiry: details.cardExpiry,
      walletAddress: details.walletAddress,
      walletType: details.walletType,
      bankName: details.bankName,
      accountLast4: details.accountLast4,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    paymentMethods.set(id, paymentMethod);
    
    // If this is the default, unset others
    if (paymentMethod.isDefault) {
      for (const [, method] of paymentMethods) {
        if (method.userId === userId && method.id !== id) {
          method.isDefault = false;
        }
      }
    }
    
    return paymentMethod;
  } catch (error) {
    console.error('[PaymentMethod] Creation failed:', error);
    throw error;
  }
}

/**
 * Get payment method
 */
export async function getPaymentMethod(id: string): Promise<PaymentMethod | null> {
  try {
    return paymentMethods.get(id) || null;
  } catch (error) {
    console.error('[PaymentMethod] Failed to get method:', error);
    throw error;
  }
}

/**
 * Get user payment methods
 */
export async function getUserPaymentMethods(userId: number): Promise<PaymentMethod[]> {
  try {
    const methods: PaymentMethod[] = [];
    
    for (const [, method] of paymentMethods) {
      if (method.userId === userId) {
        methods.push(method);
      }
    }
    
    return methods.sort((a, b) => {
      // Default first
      if (a.isDefault !== b.isDefault) {
        return a.isDefault ? -1 : 1;
      }
      // Then by creation date
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  } catch (error) {
    console.error('[PaymentMethod] Failed to get user methods:', error);
    throw error;
  }
}

/**
 * Get default payment method
 */
export async function getDefaultPaymentMethod(userId: number): Promise<PaymentMethod | null> {
  try {
    const methods = await getUserPaymentMethods(userId);
    return methods.find(m => m.isDefault) || methods[0] || null;
  } catch (error) {
    console.error('[PaymentMethod] Failed to get default method:', error);
    throw error;
  }
}

/**
 * Set default payment method
 */
export async function setDefaultPaymentMethod(
  userId: number,
  methodId: string
): Promise<PaymentMethod | null> {
  try {
    const method = paymentMethods.get(methodId);
    
    if (!method || method.userId !== userId) {
      throw new Error('Payment method not found');
    }
    
    // Unset other defaults
    for (const [, m] of paymentMethods) {
      if (m.userId === userId && m.id !== methodId) {
        m.isDefault = false;
      }
    }
    
    // Set this as default
    method.isDefault = true;
    method.updatedAt = new Date();
    
    return method;
  } catch (error) {
    console.error('[PaymentMethod] Failed to set default:', error);
    throw error;
  }
}

/**
 * Update payment method
 */
export async function updatePaymentMethod(
  methodId: string,
  updates: Partial<PaymentMethod>
): Promise<PaymentMethod | null> {
  try {
    const method = paymentMethods.get(methodId);
    
    if (!method) {
      throw new Error('Payment method not found');
    }
    
    // Update allowed fields
    if (updates.name !== undefined) {
      method.name = updates.name;
    }
    
    if (updates.isActive !== undefined) {
      method.isActive = updates.isActive;
    }
    
    method.updatedAt = new Date();
    
    return method;
  } catch (error) {
    console.error('[PaymentMethod] Update failed:', error);
    throw error;
  }
}

/**
 * Delete payment method
 */
export async function deletePaymentMethod(methodId: string): Promise<boolean> {
  try {
    const method = paymentMethods.get(methodId);
    
    if (!method) {
      throw new Error('Payment method not found');
    }
    
    paymentMethods.delete(methodId);
    
    return true;
  } catch (error) {
    console.error('[PaymentMethod] Deletion failed:', error);
    throw error;
  }
}

/**
 * Validate payment method
 */
export async function validatePaymentMethod(
  methodId: string,
  userId: number
): Promise<boolean> {
  try {
    const method = paymentMethods.get(methodId);
    
    if (!method) {
      return false;
    }
    
    // Check ownership
    if (method.userId !== userId) {
      return false;
    }
    
    // Check if active
    if (!method.isActive) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[PaymentMethod] Validation failed:', error);
    return false;
  }
}

/**
 * Get payment method statistics
 */
export async function getPaymentMethodStatistics(userId: number): Promise<{
  totalMethods: number;
  cardMethods: number;
  walletMethods: number;
  bankMethods: number;
}> {
  try {
    const methods = await getUserPaymentMethods(userId);
    
    return {
      totalMethods: methods.length,
      cardMethods: methods.filter(m => m.type === 'credit_card' || m.type === 'debit_card').length,
      walletMethods: methods.filter(m => m.type === 'digital_wallet').length,
      bankMethods: methods.filter(m => m.type === 'bank_transfer').length,
    };
  } catch (error) {
    console.error('[PaymentMethod] Failed to get statistics:', error);
    throw error;
  }
}
