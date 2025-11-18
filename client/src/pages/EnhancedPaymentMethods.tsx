import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  CreditCard,
  Plus,
  Trash2,
  Check,
  Star,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function AddPaymentMethodForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const addPaymentMethodMutation = trpc.payment.addStripePaymentMethod.useMutation({
    onSuccess: () => {
      onSuccess();
    },
    onError: (error) => {
      setError(error.message);
      setProcessing(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError('');

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || 'Failed to submit payment method');
      setProcessing(false);
      return;
    }

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message || 'Failed to add payment method');
      setProcessing(false);
      return;
    }

    if (setupIntent?.payment_method) {
      addPaymentMethodMutation.mutate({
        paymentMethodId: setupIntent.payment_method as string,
        isDefault: false,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PaymentElement />

      <div className="flex gap-3">
        <Button type="submit" disabled={!stripe || processing} className="flex-1">
          {processing ? 'Adding...' : 'Add Payment Method'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function EnhancedPaymentMethods() {
  const utils = trpc.useContext();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: paymentMethods, isLoading } = trpc.payment.getMyPaymentMethods.useQuery();
  const { data: stats } = trpc.payment.getPaymentMethodStats.useQuery();
  const { data: setupIntent } = trpc.payment.createSetupIntent.useMutation().data;

  const removeMethodMutation = trpc.payment.removePaymentMethod.useMutation({
    onSuccess: () => {
      utils.payment.getMyPaymentMethods.invalidate();
      utils.payment.getPaymentMethodStats.invalidate();
      setShowDeleteDialog(false);
      setSelectedMethod(null);
    },
  });

  const setDefaultMutation = trpc.payment.setDefaultPaymentMethod.useMutation({
    onSuccess: () => {
      utils.payment.getMyPaymentMethods.invalidate();
    },
  });

  const createSetupIntentMutation = trpc.payment.createSetupIntent.useMutation();

  const handleAddPaymentMethod = () => {
    createSetupIntentMutation.mutate();
    setShowAddDialog(true);
  };

  const handleRemoveMethod = () => {
    if (selectedMethod) {
      removeMethodMutation.mutate({ paymentMethodId: selectedMethod.id });
    }
  };

  const handleSetDefault = (methodId: number) => {
    setDefaultMutation.mutate({ paymentMethodId: methodId });
  };

  const getCardBrandIcon = (brand: string) => {
    // You can add custom brand icons here
    return <CreditCard className="h-5 w-5" />;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Wallet className="h-8 w-8" />
          Payment Methods
        </h1>
        <p className="text-muted-foreground">
          Manage your payment methods for quick and secure checkout
        </p>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Credit Cards</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.stripe}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Crypto Wallets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.metamask + stats.wallet}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Methods List */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Payment Methods</CardTitle>
              <CardDescription>
                Add and manage your payment methods
              </CardDescription>
            </div>
            <Button onClick={handleAddPaymentMethod}>
              <Plus className="h-4 w-4 mr-2" />
              Add Method
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {paymentMethods && paymentMethods.length > 0 ? (
            <div className="space-y-4">
              {paymentMethods.map((method: any) => (
                <div
                  key={method.id}
                  className="border rounded-lg p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {method.methodType === 'stripe' && method.methodData?.card ? (
                        <>
                          {getCardBrandIcon(method.methodData.card.brand)}
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              <span className="capitalize">{method.methodData.card.brand}</span>
                              <span>•••• {method.methodData.card.last4}</span>
                              {method.isDefault && (
                                <Badge className="bg-blue-100 text-blue-800">
                                  <Star className="h-3 w-3 mr-1 fill-current" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Expires {method.methodData.card.expMonth}/{method.methodData.card.expYear}
                            </div>
                          </div>
                        </>
                      ) : method.methodType === 'wallet' ? (
                        <>
                          <Wallet className="h-5 w-5" />
                          <div>
                            <div className="font-medium">SSP Wallet</div>
                            <div className="text-sm text-muted-foreground">
                              Internal wallet balance
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-5 w-5" />
                          <div>
                            <div className="font-medium capitalize">{method.methodType}</div>
                            <div className="text-sm text-muted-foreground">
                              Added {new Date(method.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!method.isDefault && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetDefault(method.id)}
                          disabled={setDefaultMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Set Default
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedMethod(method);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No payment methods added yet</p>
              <p className="text-sm">Add a payment method to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Method Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Add a new credit or debit card for payments
            </DialogDescription>
          </DialogHeader>
          {createSetupIntentMutation.data?.clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: createSetupIntentMutation.data.clientSecret,
                appearance: {
                  theme: 'stripe',
                },
              }}
            >
              <AddPaymentMethodForm
                onSuccess={() => {
                  setShowAddDialog(false);
                  utils.payment.getMyPaymentMethods.invalidate();
                  utils.payment.getPaymentMethodStats.invalidate();
                }}
                onCancel={() => setShowAddDialog(false)}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Payment Method</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this payment method? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveMethod}
              disabled={removeMethodMutation.isPending}
            >
              {removeMethodMutation.isPending ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
