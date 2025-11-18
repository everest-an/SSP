import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '../lib/trpc';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Store, Building2, Phone, Mail, MapPin, CheckCircle2 } from 'lucide-react';

export default function MerchantApplication() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: '',
    address: '',
    phone: '',
    email: '',
    description: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const applyMutation = trpc.merchant.applyForMerchant.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        setLocation('/dashboard');
      }, 3000);
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.businessName) {
      setError('Business name is required');
      return;
    }

    applyMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (success) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <CardTitle className="text-green-900">Application Submitted!</CardTitle>
                <CardDescription className="text-green-700">
                  Your merchant application has been received
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-green-800 mb-4">
              Thank you for applying to become a merchant. An administrator will review your
              application and notify you via email once it has been processed.
            </p>
            <p className="text-sm text-green-700">
              Redirecting to dashboard in 3 seconds...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Store className="h-8 w-8" />
          Become a Merchant
        </h1>
        <p className="text-muted-foreground">
          Apply to upgrade your account and start selling with our frictionless payment system
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Merchant Application Form</CardTitle>
          <CardDescription>
            Please provide your business information. All fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="businessName" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Business Name *
              </Label>
              <Input
                id="businessName"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                placeholder="Enter your business name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type</Label>
              <Input
                id="businessType"
                name="businessType"
                value={formData.businessType}
                onChange={handleChange}
                placeholder="e.g., Convenience Store, Grocery, Cafe"
              />
              <p className="text-sm text-muted-foreground">
                What type of business do you operate?
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Business Address
              </Label>
              <Textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter your business address"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Business Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="business@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Additional Information</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell us more about your business (optional)"
                rows={4}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Your application will be reviewed by our team</li>
                <li>• You'll receive an email notification with the decision</li>
                <li>• Once approved, you can access the merchant dashboard</li>
                <li>• You'll be able to add products, manage devices, and view analytics</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={applyMutation.isLoading}
                className="flex-1"
              >
                {applyMutation.isLoading ? 'Submitting...' : 'Submit Application'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation('/dashboard')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
