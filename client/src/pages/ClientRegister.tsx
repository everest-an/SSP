/**
 * Client Registration Page
 * New user registration with email and optional face enrollment
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

export default function ClientRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    address: "",
  });

  const [registeredUserId, setRegisteredUserId] = useState<number | null>(null);

  // Registration mutation
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      toast.success("Account created successfully!");
      setRegisteredUserId(data.user.id);
      setStep(2);
    },
    onError: (error) => {
      toast.error(error.message || "Registration failed");
    },
  });

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (!agreedToTerms) {
      toast.error("Please agree to the terms and conditions");
      return;
    }

    registerMutation.mutate({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
    });
  };

  const handleSkipFaceEnrollment = () => {
    toast.success("You can enroll your face later from your profile");
    navigate("/client/login");
  };

  const handleEnrollFace = () => {
    navigate(`/face-enrollment?userId=${registeredUserId}`);
  };

  const getPasswordStrength = () => {
    const password = formData.password;
    if (!password) return 0;
    
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 10;
    
    return Math.min(strength, 100);
  };

  const passwordStrength = getPasswordStrength();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {step === 1 ? "Create Account" : "Enroll Face ID"}
          </CardTitle>
          <CardDescription className="text-center">
            {step === 1
              ? "Sign up for a new SSP account"
              : "Optional: Add face recognition for faster login"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            // Step 1: Account Information
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10"
                    disabled={registerMutation.isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10"
                    disabled={registerMutation.isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10 pr-10"
                    disabled={registerMutation.isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {formData.password && (
                  <div className="space-y-1">
                    <Progress value={passwordStrength} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Password strength:{" "}
                      <span
                        className={
                          passwordStrength < 40
                            ? "text-red-500"
                            : passwordStrength < 70
                            ? "text-yellow-500"
                            : "text-green-500"
                        }
                      >
                        {passwordStrength < 40 ? "Weak" : passwordStrength < 70 ? "Medium" : "Strong"}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirm Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="pl-10 pr-10"
                    disabled={registerMutation.isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Passwords do not match
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="pl-10"
                    disabled={registerMutation.isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address (optional)</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="address"
                    placeholder="123 Main St, City, Country"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="pl-10"
                    disabled={registerMutation.isPending}
                  />
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                  disabled={registerMutation.isPending}
                />
                <label htmlFor="terms" className="text-sm text-muted-foreground leading-none">
                  I agree to the{" "}
                  <Button variant="link" className="h-auto p-0 text-sm">
                    Terms of Service
                  </Button>{" "}
                  and{" "}
                  <Button variant="link" className="h-auto p-0 text-sm">
                    Privacy Policy
                  </Button>
                </label>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={registerMutation.isPending || !agreedToTerms}
              >
                {registerMutation.isPending ? "Creating account..." : "Create Account"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <Separator />

              <div className="text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <Button variant="link" className="px-1" onClick={() => navigate("/client/login")}>
                  Sign in
                </Button>
              </div>
            </form>
          ) : (
            // Step 2: Face Enrollment (Optional)
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  Your account has been created successfully! You can now enroll your face for
                  faster and more secure login.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center">
                  <CheckCircle className="h-16 w-16 text-white" />
                </div>
                <p className="text-center text-muted-foreground">
                  Enroll your face to enable Face ID login
                </p>
              </div>

              <div className="space-y-2">
                <Button onClick={handleEnrollFace} className="w-full" size="lg">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Enroll Face ID Now
                </Button>
                <Button
                  onClick={handleSkipFaceEnrollment}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Skip for Now
                </Button>
              </div>

              <Separator />

              <div className="text-center text-xs text-muted-foreground">
                <p>You can always enroll your face later from your profile settings</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
