import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Store, Wallet, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MerchantSettings() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    id: 0,
    businessName: "",
    businessType: "",
    address: "",
    phone: "",
    email: "",
    walletAddress: "",
  });

  // Get merchant data
  const { data: merchants, isLoading } = trpc.merchants.getMyMerchants.useQuery();
  const merchant = merchants?.[0]; // Assuming user has one merchant

  // Update mutation
  const updateMerchantMutation = trpc.merchants.update.useMutation({
    onSuccess: () => {
      toast.success("Merchant settings updated successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });

  // Load merchant data when available
  useEffect(() => {
    if (merchant) {
      setFormData({
        id: merchant.id,
        businessName: merchant.businessName || "",
        businessType: merchant.businessType || "",
        address: merchant.address || "",
        phone: merchant.phone || "",
        email: merchant.email || "",
        walletAddress: merchant.walletAddress || "",
      });
    }
  }, [merchant]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.businessName.trim()) {
      toast.error("Business name is required");
      return;
    }

    // Validate Ethereum wallet address if provided
    if (formData.walletAddress && !isValidEthereumAddress(formData.walletAddress)) {
      toast.error("Invalid Ethereum wallet address. Must start with 0x and be 42 characters long.");
      return;
    }

    updateMerchantMutation.mutate(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Validate Ethereum address format
  const isValidEthereumAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="container max-w-2xl mx-auto px-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No merchant account found. Please create a merchant account first.
            </AlertDescription>
          </Alert>
          <Link href="/create-merchant">
            <Button className="mt-4">Create Merchant Account</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container max-w-2xl mx-auto px-6">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3 mb-2">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Merchant Settings</CardTitle>
                <CardDescription>
                  Manage your business profile and payment settings
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Business Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b pb-2">
                  Business Information
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="businessName">
                    Business Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="businessName"
                    placeholder="Enter your business name"
                    value={formData.businessName}
                    onChange={(e) => handleChange("businessName", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessType">Business Type</Label>
                  <select
                    id="businessType"
                    value={formData.businessType}
                    onChange={(e) => handleChange("businessType", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  >
                    <option value="">Select business type</option>
                    <option value="convenience">Convenience Store</option>
                    <option value="grocery">Grocery Store</option>
                    <option value="specialty">Specialty Shop</option>
                    <option value="cafe">Café/Restaurant</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    placeholder="Enter your business address"
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="business@example.com"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Settings Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b pb-2 flex items-center">
                  <Wallet className="h-5 w-5 mr-2" />
                  Payment Settings
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="walletAddress">
                    Ethereum Wallet Address (for MetaMask payments)
                  </Label>
                  <Input
                    id="walletAddress"
                    placeholder="0x..."
                    value={formData.walletAddress}
                    onChange={(e) => handleChange("walletAddress", e.target.value)}
                    className={
                      formData.walletAddress && !isValidEthereumAddress(formData.walletAddress)
                        ? "border-destructive"
                        : ""
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter your Ethereum wallet address to receive MetaMask payments. 
                    Must start with 0x and be 42 characters long.
                  </p>
                  {formData.walletAddress && !isValidEthereumAddress(formData.walletAddress) && (
                    <p className="text-sm text-destructive">
                      Invalid Ethereum address format
                    </p>
                  )}
                </div>

                {formData.walletAddress && isValidEthereumAddress(formData.walletAddress) && (
                  <Alert className="bg-green-500/10 border-green-500/20">
                    <Wallet className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-600">
                      Wallet address is valid. You can now accept MetaMask payments.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <Link href="/dashboard">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={updateMerchantMutation.isPending}
                >
                  {updateMerchantMutation.isPending ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 p-6 rounded-lg bg-muted/50 border border-border">
          <h3 className="font-semibold text-foreground mb-2">Payment Methods</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• <strong>Stripe:</strong> Automatically configured for card payments</li>
            <li>• <strong>MetaMask:</strong> Configure wallet address above to accept crypto payments</li>
            <li>• Customers can choose their preferred payment method at checkout</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
