/**
 * Payment Methods Management Page
 * 
 * Allows users to:
 * - Add credit/debit cards via Stripe
 * - Connect MetaMask wallet
 * - Set default payment method
 * - Remove payment methods
 * 
 * @module client/src/pages/PaymentMethods
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useMetaMask } from '@/hooks/useMetaMask';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CreditCard, Wallet, Trash2, Star, Plus, Check } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

/**
 * Add Card Form Component
 */
function AddCardForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const addCardMutation = trpc.paymentMethod.addCard.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      toast.error('Stripe not loaded');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      toast.error('Card element not found');
      return;
    }

    setIsLoading(true);

    try {
      // Create payment method
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!paymentMethod) {
        throw new Error('Failed to create payment method');
      }

      // Save to backend
      await addCardMutation.mutateAsync({
        paymentMethodId: paymentMethod.id,
        setAsDefault: false,
      });

      toast.success('Card added successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add card');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-lg">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>
      <Button type="submit" disabled={!stripe || isLoading} className="w-full">
        {isLoading ? 'Adding...' : 'Add Card'}
      </Button>
    </form>
  );
}

/**
 * Payment Methods Page Component
 */
export default function PaymentMethods() {
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAddMetaMask, setShowAddMetaMask] = useState(false);

  // Fetch payment methods
  const { data: methods, isLoading, refetch } = trpc.paymentMethod.list.useQuery();
  const setDefaultMutation = trpc.paymentMethod.setDefault.useMutation();
  const removeMutation = trpc.paymentMethod.remove.useMutation();
  const addMetaMaskMutation = trpc.paymentMethod.addMetaMaskWallet.useMutation();

  // MetaMask hook
  const metamask = useMetaMask();

  /**
   * Handle set default payment method
   */
  const handleSetDefault = async (paymentMethodId: number) => {
    try {
      await setDefaultMutation.mutateAsync({ paymentMethodId });
      toast.success('Default payment method updated');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to set default');
    }
  };

  /**
   * Handle remove payment method
   */
  const handleRemove = async (paymentMethodId: number) => {
    if (!confirm('Are you sure you want to remove this payment method?')) {
      return;
    }

    try {
      await removeMutation.mutateAsync({ paymentMethodId });
      toast.success('Payment method removed');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove payment method');
    }
  };

  /**
   * Handle add MetaMask wallet
   */
  const handleAddMetaMask = async () => {
    try {
      // Connect to MetaMask
      const account = await metamask.connect();

      // Save to backend
      await addMetaMaskMutation.mutateAsync({
        walletAddress: account,
        setAsDefault: false,
      });

      toast.success('MetaMask wallet added successfully');
      setShowAddMetaMask(false);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add MetaMask wallet');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Payment Methods</h1>
        <p className="text-muted-foreground">
          Manage your payment methods for automatic checkout
        </p>
      </div>

      {/* Payment Methods List */}
      <div className="space-y-4 mb-6">
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : methods && methods.length > 0 ? (
          methods.map((method) => (
            <Card key={method.id} className={method.isDefault ? 'border-primary' : ''}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="p-3 bg-primary/10 rounded-full">
                      {method.type === 'card' ? (
                        <CreditCard className="w-6 h-6 text-primary" />
                      ) : (
                        <Wallet className="w-6 h-6 text-primary" />
                      )}
                    </div>

                    {/* Details */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {method.type === 'card'
                            ? `${method.cardBrand?.toUpperCase()} •••• ${method.cardLast4}`
                            : 'MetaMask Wallet'}
                        </h3>
                        {method.isDefault && (
                          <Badge variant="default" className="gap-1">
                            <Star className="w-3 h-3" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {method.type === 'card'
                          ? `Expires ${method.cardExpMonth}/${method.cardExpYear}`
                          : `${method.walletAddress?.slice(0, 6)}...${method.walletAddress?.slice(-4)}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!method.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                        disabled={setDefaultMutation.isPending}
                      >
                        Set as Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(method.id)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">
                No payment methods added yet. Add one to enable automatic checkout.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Payment Method Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Add Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Credit/Debit Card
            </CardTitle>
            <CardDescription>Add a card via Stripe for automatic payments</CardDescription>
          </CardHeader>
          <CardContent>
            {showAddCard ? (
              <Elements stripe={stripePromise}>
                <AddCardForm
                  onSuccess={() => {
                    setShowAddCard(false);
                    refetch();
                  }}
                />
              </Elements>
            ) : (
              <Button onClick={() => setShowAddCard(true)} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Card
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Add MetaMask */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              MetaMask Wallet
            </CardTitle>
            <CardDescription>Connect your MetaMask for crypto payments</CardDescription>
          </CardHeader>
          <CardContent>
            {!metamask.isInstalled ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  MetaMask is not installed. Please install the MetaMask extension.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open('https://metamask.io/download/', '_blank')}
                >
                  Install MetaMask
                </Button>
              </div>
            ) : metamask.isConnected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-muted-foreground">
                    Connected: {metamask.account?.slice(0, 6)}...{metamask.account?.slice(-4)}
                  </span>
                </div>
                <Button onClick={handleAddMetaMask} className="w-full" disabled={addMetaMaskMutation.isPending}>
                  <Plus className="w-4 h-4 mr-2" />
                  {addMetaMaskMutation.isPending ? 'Adding...' : 'Add This Wallet'}
                </Button>
              </div>
            ) : (
              <Button onClick={handleAddMetaMask} className="w-full" disabled={metamask.isLoading}>
                <Wallet className="w-4 h-4 mr-2" />
                {metamask.isLoading ? 'Connecting...' : 'Connect MetaMask'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How Automatic Payments Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            1. <strong>Face Recognition:</strong> Stand in front of the device camera to identify yourself
          </p>
          <p>
            2. <strong>Select Product:</strong> Pick up the product you want to purchase
          </p>
          <p>
            3. <strong>Gesture Confirmation:</strong> Give a thumbs up 👍 to confirm the purchase
          </p>
          <p>
            4. <strong>Automatic Payment:</strong> Your default payment method will be charged automatically
          </p>
          <p className="pt-2 border-t">
            <strong>Note:</strong> For MetaMask payments, you'll need to confirm the transaction in your wallet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
