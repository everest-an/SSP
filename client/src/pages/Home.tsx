import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { 
  ShoppingCart, 
  Smartphone, 
  Zap, 
  Shield, 
  TrendingUp, 
  Eye,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Cloud,
  CreditCard
} from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
              <span className="text-xl font-bold text-foreground">{APP_TITLE}</span>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <span className="text-sm text-muted-foreground">Welcome, {user?.name}</span>
                  <Link href="/dashboard">
                    <Button variant="default">Dashboard</Button>
                  </Link>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/face-login">
                    <Button variant="outline" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Face Login
                    </Button>
                  </Link>
                  <Button asChild variant="default">
                    <a href={getLoginUrl()}>Sign In</a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background"></div>
        <div className="container relative mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-block">
                <span className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  Next-Gen Payment Technology
                </span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Frictionless Checkout with{" "}
                <span className="text-primary">Computer Vision</span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                SSP (Statement Sensor Payment) revolutionizes retail with ambient checkout technology. 
                Customers simply pick up items and walk out—no scanning, no queues, no friction.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button asChild size="lg" className="text-base">
                  <a href={getLoginUrl()}>Get Started <ArrowRight className="ml-2 h-5 w-5" /></a>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-base">
                  <a href="https://github.com/everest-an/SSP" target="_blank" rel="noopener noreferrer">
                    View on GitHub
                  </a>
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-8 backdrop-blur-sm border border-border">
                <div className="h-full w-full flex items-center justify-center">
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <Card className="bg-card/80 backdrop-blur-sm">
                      <CardContent className="p-6 text-center">
                        <Eye className="h-12 w-12 text-primary mx-auto mb-2" />
                        <p className="text-2xl font-bold text-foreground">95%+</p>
                        <p className="text-sm text-muted-foreground">Detection Accuracy</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card/80 backdrop-blur-sm">
                      <CardContent className="p-6 text-center">
                        <Zap className="h-12 w-12 text-primary mx-auto mb-2" />
                        <p className="text-2xl font-bold text-foreground">&lt;5s</p>
                        <p className="text-sm text-muted-foreground">Checkout Time</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card/80 backdrop-blur-sm">
                      <CardContent className="p-6 text-center">
                        <Shield className="h-12 w-12 text-primary mx-auto mb-2" />
                        <p className="text-2xl font-bold text-foreground">100%</p>
                        <p className="text-sm text-muted-foreground">Privacy Protected</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card/80 backdrop-blur-sm">
                      <CardContent className="p-6 text-center">
                        <TrendingUp className="h-12 w-12 text-primary mx-auto mb-2" />
                        <p className="text-2xl font-bold text-foreground">20%+</p>
                        <p className="text-sm text-muted-foreground">Cost Reduction</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Three-layer architecture powered by edge computing, cloud services, and secure payment processing
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Perception Layer</CardTitle>
                <CardDescription className="text-base">
                  Edge devices with computer vision
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">MediaPipe hand tracking (21 keypoints)</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">YOLO real-time object detection</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">On-device processing for privacy</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Cloud className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Application Layer</CardTitle>
                <CardDescription className="text-base">
                  Cloud-based microservices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Order and inventory management</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Keycloak authentication (OAuth 2.0)</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Real-time analytics dashboard</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Financial Layer</CardTitle>
                <CardDescription className="text-base">
                  Secure payment orchestration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Hyperswitch payment routing</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">PCI-DSS compliant tokenization</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Multi-gateway support (Stripe, PayPal)</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">Open Source Technology</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built on proven, enterprise-grade open source components
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: "MediaPipe", category: "Hand Tracking" },
              { name: "YOLO", category: "Object Detection" },
              { name: "FastAPI", category: "Backend API" },
              { name: "PostgreSQL", category: "Database" },
              { name: "Redis", category: "Caching" },
              { name: "Kafka", category: "Event Streaming" },
              { name: "Hyperswitch", category: "Payment Routing" },
              { name: "Keycloak", category: "Authentication" },
            ].map((tech) => (
              <Card key={tech.name} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <Cpu className="h-10 w-10 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground mb-1">{tech.name}</h3>
                  <p className="text-sm text-muted-foreground">{tech.category}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-4xl font-bold text-foreground">
              Ready to Transform Your Retail Experience?
            </h2>
            <p className="text-xl text-muted-foreground">
              Join the future of frictionless payments. Get started with SSP today.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" className="text-base">
                <a href={getLoginUrl()}>Start Free Trial <ArrowRight className="ml-2 h-5 w-5" /></a>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base">
                <a href="https://github.com/everest-an/SSP" target="_blank" rel="noopener noreferrer">
                  Explore Documentation
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-6 w-6" />}
                <span className="font-bold text-foreground">{APP_TITLE}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Revolutionizing retail with ambient checkout technology
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link></li>
                <li><Link href="/products" className="hover:text-primary transition-colors">Products</Link></li>
                <li><Link href="/devices" className="hover:text-primary transition-colors">Devices</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/orders" className="hover:text-primary transition-colors">Orders</Link></li>
                <li><Link href="/transactions" className="hover:text-primary transition-colors">Transactions</Link></li>
                <li><Link href="/analytics" className="hover:text-primary transition-colors">Analytics</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="https://github.com/everest-an/SSP" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="https://github.com/everest-an/SSP/issues" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    Support
                  </a>
                </li>
                <li>
                  <a href="https://github.com/everest-an/SSP/discussions" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    Community
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>&copy; 2025 {APP_TITLE}. Open source under MIT License.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
