/**
 * Client Login Page
 * Unified authentication page with multiple login options
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Mail, Lock, User, Scan, AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function ClientLogin() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"email" | "face">("email");
  const [showPassword, setShowPassword] = useState(false);
  
  // Email login form
  const [emailForm, setEmailForm] = useState({
    email: "",
    password: "",
  });

  // Email login mutation
  const emailLoginMutation = trpc.auth.loginWithEmail.useMutation({
    onSuccess: async (data) => {
      toast.success("Login successful!");
      // Refresh auth state
      await utils.auth.me.invalidate();
      // Redirect based on user role
      if (data.user.role === "merchant" || data.user.role === "admin") {
        setLocation("/dashboard");
      } else {
        setLocation("/client/profile");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Login failed");
    },
  });

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!emailForm.email || !emailForm.password) {
      toast.error("Please fill in all fields");
      return;
    }

    emailLoginMutation.mutate(emailForm);
  };

  const handleFaceLogin = () => {
    setLocation("/face-login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Welcome Back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your SSP account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "email" | "face")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">
                <Mail className="mr-2 h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="face">
                <Scan className="mr-2 h-4 w-4" />
                Face ID
              </TabsTrigger>
            </TabsList>

            {/* Email Login */}
            <TabsContent value="email" className="space-y-4">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={emailForm.email}
                      onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                      className="pl-10"
                      disabled={emailLoginMutation.isPending}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-xs"
                      onClick={() => setLocation("/forgot-password")}
                    >
                      Forgot password?
                    </Button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={emailForm.password}
                      onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                      className="pl-10 pr-10"
                      disabled={emailLoginMutation.isPending}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={emailLoginMutation.isPending}
                >
                  {emailLoginMutation.isPending ? "Signing in..." : "Sign in"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>

              <Separator />

              <div className="text-center text-sm">
                <span className="text-muted-foreground">Don't have an account? </span>
                <Button
                  variant="link"
                  className="px-1"
                  onClick={() => setLocation("/client/register")}
                >
                  Sign up
                </Button>
              </div>
            </TabsContent>

            {/* Face Login */}
            <TabsContent value="face" className="space-y-4">
              <Alert>
                <Scan className="h-4 w-4" />
                <AlertDescription>
                  Use your face to securely sign in to your account. Make sure you're in a
                  well-lit area.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <Scan className="h-16 w-16 text-white" />
                  </div>
                  <p className="text-center text-muted-foreground">
                    Click below to start face recognition
                  </p>
                </div>

                <Button onClick={handleFaceLogin} className="w-full" size="lg">
                  <Scan className="mr-2 h-5 w-5" />
                  Sign in with Face ID
                </Button>
              </div>

              <Separator />

              <div className="text-center text-sm">
                <span className="text-muted-foreground">Need to register your face? </span>
                <Button
                  variant="link"
                  className="px-1"
                  onClick={() => setLocation("/face-registration")}
                >
                  Register Face ID
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Additional Options */}
          <div className="mt-6 space-y-4">
            <Separator />
            
            <div className="text-center text-xs text-muted-foreground">
              <p>By signing in, you agree to our</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <Button variant="link" className="h-auto p-0 text-xs">
                  Terms of Service
                </Button>
                <span>and</span>
                <Button variant="link" className="h-auto p-0 text-xs">
                  Privacy Policy
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
