/**
 * Payment Method Selector Component
 * 
 * Modal component for selecting payment method during checkout.
 * Allows users to choose between saved cards and MetaMask wallet.
 * 
 * Features:
 * - Display all saved payment methods
 * - Show card details (brand, last 4 digits)
 * - Show MetaMask wallet address
 * - Highlight default payment method
 * - Quick add new payment method
 * 
 * @module client/src/components/PaymentMethodSelector
 */

import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useMetaMask } from '@/hooks/useMetaMask';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CreditCard, 
  Wallet, 
  Star, 
  Check, 
  Plus,
  AlertCircle,
  Loader2,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PaymentMethodSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  currency?: string;
  onSelect: (paymentMethodId: number, paymentType: 'card' | 'metamask') => void;
  onCancel: () => void;
}

export function PaymentMethodSelector({
  open,
  onOpenChange,
  amount,
  currency = 'USD',
  onSelect,
  onCancel,
}: PaymentMethodSelectorProps) {
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch payment methods
  const { data: methods, isLoading, refetch } = trpc.paymentMethod.list.useQuery(
    undefined,
    { enabled: open }
  );

  // MetaMask hook
  const metamask = useMetaMask();

  /**
   * Handle payment method selection
   */
  const handleSelectMethod = (methodId: number, type: 'card' | 'metamask') => {
    setSelectedMethodId(methodId);
  };

  /**
   * Handle confirm selection
   */
  const handleConfirm = () => {
    if (!selectedMethodId) {
      toast.error('Please select a payment method');
      return;
    }

    const method = methods?.find(m => m.id === selectedMethodId);
    if (!method) {
      toast.error('Payment method not found');
      return;
    }

    const paymentType = method.type === 'card' ? 'card' : 'metamask';
    onSelect(selectedMethodId, paymentType);
  };

  /**
   * Format amount for display
   */
  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100);
  };

  /**
   * Handle add new payment method
   */
  const handleAddPaymentMethod = () => {
    onOpenChange(false);
    // Navigate to payment methods page
    window.location.href = '/payment-methods';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Select Payment Method
          </DialogTitle>
          <DialogDescription>
            Choose how you want to pay {formatAmount(amount, currency)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading payment methods...</span>
            </div>
          )}

          {/* No Payment Methods */}
          {!isLoading && (!methods || methods.length === 0) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No payment methods found. Please add a payment method first.
              </AlertDescription>
            </Alert>
          )}

          {/* Payment Methods List */}
          {!isLoading && methods && methods.length > 0 && (
            <div className="space-y-3">
              {methods.map((method) => {
                const isSelected = selectedMethodId === method.id;
                const isCard = method.type === 'card';
                const isMetaMask = method.type === 'metamask';

                return (
                  <Card
                    key={method.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md',
                      isSelected && 'ring-2 ring-primary',
                      method.isDefault && 'border-primary'
                    )}
                    onClick={() => handleSelectMethod(method.id, isCard ? 'card' : 'metamask')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Icon */}
                          <div className={cn(
                            'p-2 rounded-full',
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                          )}>
                            {isCard ? (
                              <CreditCard className="w-5 h-5" />
                            ) : (
                              <Wallet className="w-5 h-5" />
                            )}
                          </div>

                          {/* Details */}
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">
                                {isCard
                                  ? `${method.cardBrand?.toUpperCase()} •••• ${method.cardLast4}`
                                  : 'MetaMask Wallet'}
                              </h4>
                              {method.isDefault && (
                                <Badge variant="default" className="gap-1 text-xs">
                                  <Star className="w-3 h-3" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {isCard
                                ? `Expires ${method.cardExpMonth}/${method.cardExpYear}`
                                : `${method.walletAddress?.slice(0, 6)}...${method.walletAddress?.slice(-4)}`}
                            </p>
                          </div>
                        </div>

                        {/* Selection Indicator */}
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                          isSelected
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground'
                        )}>
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Add Payment Method Button */}
          {!isLoading && (
            <>
              <Separator />
              <Button
                variant="outline"
                className="w-full"
                onClick={handleAddPaymentMethod}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Payment Method
              </Button>
            </>
          )}

          {/* MetaMask Connection Status */}
          {selectedMethodId && methods?.find(m => m.id === selectedMethodId)?.type === 'metamask' && (
            <Alert>
              <Wallet className="h-4 w-4" />
              <AlertDescription>
                {metamask.isConnected
                  ? `Connected: ${metamask.account?.slice(0, 6)}...${metamask.account?.slice(-4)}`
                  : 'MetaMask will be prompted to confirm the transaction'}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onCancel();
              onOpenChange(false);
            }}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedMethodId || isProcessing}
          >
            {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Continue to Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
