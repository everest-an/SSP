import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Pricing() {
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);

  const { data: products, isLoading } = trpc.stripe.getProducts.useQuery();
  const { data: merchants } = trpc.merchants.getMyMerchants.useQuery();

  const createCheckoutMutation = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.info("Redirecting to checkout...");
        window.open(data.url, "_blank");
      }
      setLoadingProductId(null);
    },
    onError: (error) => {
      toast.error(`Failed to create checkout: ${error.message}`);
      setLoadingProductId(null);
    },
  });

  const handlePurchase = (productId: string) => {
    if (!merchants || merchants.length === 0) {
      toast.error("Please create a merchant account first");
      return;
    }

    setLoadingProductId(productId);
    createCheckoutMutation.mutate({
      productId,
      merchantId: merchants[0].id,
    });
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Group products by type
  const subscriptionPlans = products?.filter((p) => p.type === "subscription") || [];
  const oneTimeProducts = products?.filter((p) => p.type === "one_time") || [];

  return (
    <DashboardLayout>
      <div className="space-y-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">Pricing Plans</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the perfect plan for your business. All plans include our core ambient checkout technology.
          </p>
        </div>

        {/* Subscription Plans */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-6">Subscription Plans</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {subscriptionPlans.map((product) => (
              <Card
                key={product.id}
                className={`relative ${
                  product.id === "professional_plan" ? "border-primary shadow-lg scale-105" : ""
                }`}
              >
                {product.id === "professional_plan" && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 rounded-bl-lg rounded-tr-lg text-sm font-semibold">
                    Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{product.name}</CardTitle>
                  <CardDescription>{product.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">
                      {formatPrice(product.amount)}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {product.features?.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    onClick={() => handlePurchase(product.id)}
                    disabled={loadingProductId === product.id || isLoading}
                    variant={product.id === "professional_plan" ? "default" : "outline"}
                  >
                    {loadingProductId === product.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Get Started"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* One-Time Products */}
        {oneTimeProducts.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Add-Ons & Services</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {oneTimeProducts.map((product) => (
                <Card key={product.id}>
                  <CardHeader>
                    <CardTitle className="text-xl">{product.name}</CardTitle>
                    <CardDescription>{product.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-3xl font-bold text-foreground">
                        {formatPrice(product.amount)}
                      </span>
                      <span className="text-muted-foreground text-sm"> one-time</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {product.features?.map((feature, idx) => (
                        <li key={idx} className="flex items-start">
                          <Check className="h-4 w-4 text-primary mr-2 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handlePurchase(product.id)}
                      disabled={loadingProductId === product.id || isLoading}
                    >
                      {loadingProductId === product.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Purchase"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Test Payment Info */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle>Test Payment</CardTitle>
            <CardDescription>Use these test card details for testing payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p className="font-mono">
                <strong>Card Number:</strong> 4242 4242 4242 4242
              </p>
              <p>
                <strong>Expiry:</strong> Any future date
              </p>
              <p>
                <strong>CVC:</strong> Any 3 digits
              </p>
              <p>
                <strong>ZIP:</strong> Any 5 digits
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
