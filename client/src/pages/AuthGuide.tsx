/**
 * Authentication Guide Page
 * Explains authentication options and guides users to appropriate flows
 */

import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Scan, Wallet, CreditCard, Shield, Zap, Lock, CheckCircle } from "lucide-react";

export default function AuthGuide() {
  const navigate = useNavigate();

  const authMethods = [
    {
      id: "face",
      title: "Face Recognition",
      description: "Fast and secure biometric authentication",
      icon: Scan,
      features: [
        "No password needed",
        "< 2 second authentication",
        "Liveness detection",
        "Privacy protected",
      ],
      recommended: true,
      available: true,
      setupPath: "/face-registration",
      loginPath: "/face-login",
    },
    {
      id: "wallet",
      title: "Crypto Wallet",
      description: "Connect your Web3 wallet for decentralized auth",
      icon: Wallet,
      features: [
        "MetaMask supported",
        "No personal data stored",
        "Blockchain verified",
        "Instant connection",
      ],
      recommended: false,
      available: true,
      setupPath: "/wallet-connect",
      loginPath: "/wallet-connect",
    },
    {
      id: "email",
      title: "Email & Password",
      description: "Traditional authentication method",
      icon: Lock,
      features: [
        "Familiar experience",
        "Password recovery",
        "2FA available",
        "Email verification",
      ],
      recommended: false,
      available: false, // Coming soon
      setupPath: "/client/register",
      loginPath: "/client/login",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold">Welcome to SSP</h1>
          <p className="text-xl text-muted-foreground">
            Choose your preferred authentication method
          </p>
        </div>

        {/* Authentication Methods */}
        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
          {authMethods.map((method) => {
            const Icon = method.icon;
            return (
              <Card
                key={method.id}
                className={method.recommended ? "border-blue-500 border-2" : ""}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    {method.recommended && (
                      <Badge className="bg-blue-500">Recommended</Badge>
                    )}
                    {!method.available && (
                      <Badge variant="secondary">Coming Soon</Badge>
                    )}
                  </div>
                  <CardTitle>{method.title}</CardTitle>
                  <CardDescription>{method.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {method.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Separator />

                  <div className="space-y-2">
                    {method.available ? (
                      <>
                        <Button
                          onClick={() => navigate(method.setupPath)}
                          className="w-full"
                        >
                          Get Started
                        </Button>
                        <Button
                          onClick={() => navigate(method.loginPath)}
                          variant="outline"
                          className="w-full"
                        >
                          Already Set Up? Sign In
                        </Button>
                      </>
                    ) : (
                      <Button disabled className="w-full">
                        Coming Soon
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* How It Works */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>How SSP Authentication Works</CardTitle>
            <CardDescription>
              A quick guide to getting started with SSP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                  1
                </div>
                <h3 className="font-semibold">Choose Method</h3>
                <p className="text-sm text-muted-foreground">
                  Select your preferred authentication method above
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-lg">
                  2
                </div>
                <h3 className="font-semibold">Set Up Account</h3>
                <p className="text-sm text-muted-foreground">
                  Complete the quick setup process (takes less than 2 minutes)
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-600 dark:text-green-400 font-bold text-lg">
                  3
                </div>
                <h3 className="font-semibold">Start Shopping</h3>
                <p className="text-sm text-muted-foreground">
                  Use your authentication method for instant, secure payments
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                Security & Privacy
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">End-to-End Encryption</p>
                    <p className="text-xs text-muted-foreground">
                      All your data is encrypted and secure
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">No Data Sharing</p>
                    <p className="text-xs text-muted-foreground">
                      We never share your personal information
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Biometric Privacy</p>
                    <p className="text-xs text-muted-foreground">
                      Face data stored as encrypted embeddings only
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">PCI DSS Compliant</p>
                    <p className="text-xs text-muted-foreground">
                      Payment security certified
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="max-w-4xl mx-auto mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Need help?{" "}
            <Button variant="link" className="px-1">
              Contact Support
            </Button>{" "}
            or{" "}
            <Button variant="link" className="px-1">
              View Documentation
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
}
