/**
 * Stripe Product and Price Definitions
 * 
 * This file contains all product and price configurations for the SSP payment system.
 * Products are defined with their Stripe price IDs and metadata.
 */

export interface ProductDefinition {
  id: string;
  name: string;
  description: string;
  priceId: string; // Stripe Price ID
  amount: number; // Amount in cents
  currency: string;
  type: "one_time" | "subscription";
  features?: string[];
  metadata?: Record<string, string>;
}

/**
 * SSP Service Plans
 * These are the main service offerings for merchants
 */
export const SERVICE_PLANS: Record<string, ProductDefinition> = {
  STARTER: {
    id: "starter_plan",
    name: "Starter Plan",
    description: "Perfect for small retail stores testing ambient checkout",
    priceId: process.env.STRIPE_PRICE_STARTER || "price_starter",
    amount: 9900, // $99.00
    currency: "USD",
    type: "subscription",
    features: [
      "Up to 2 devices",
      "100 transactions/month",
      "Basic analytics",
      "Email support",
    ],
    metadata: {
      plan_tier: "starter",
      device_limit: "2",
      transaction_limit: "100",
    },
  },
  PROFESSIONAL: {
    id: "professional_plan",
    name: "Professional Plan",
    description: "For growing businesses with multiple locations",
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL || "price_professional",
    amount: 29900, // $299.00
    currency: "USD",
    type: "subscription",
    features: [
      "Up to 10 devices",
      "Unlimited transactions",
      "Advanced analytics",
      "Priority support",
      "Custom branding",
    ],
    metadata: {
      plan_tier: "professional",
      device_limit: "10",
      transaction_limit: "unlimited",
    },
  },
  ENTERPRISE: {
    id: "enterprise_plan",
    name: "Enterprise Plan",
    description: "For large retail chains with custom requirements",
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || "price_enterprise",
    amount: 99900, // $999.00
    currency: "USD",
    type: "subscription",
    features: [
      "Unlimited devices",
      "Unlimited transactions",
      "Real-time analytics",
      "24/7 dedicated support",
      "Custom integrations",
      "White-label solution",
    ],
    metadata: {
      plan_tier: "enterprise",
      device_limit: "unlimited",
      transaction_limit: "unlimited",
    },
  },
};

/**
 * One-time purchases and add-ons
 */
export const ONE_TIME_PRODUCTS: Record<string, ProductDefinition> = {
  DEVICE_SETUP: {
    id: "device_setup",
    name: "Device Setup Service",
    description: "Professional on-site device installation and configuration",
    priceId: process.env.STRIPE_PRICE_DEVICE_SETUP || "price_device_setup",
    amount: 49900, // $499.00
    currency: "USD",
    type: "one_time",
    features: [
      "On-site installation",
      "Device configuration",
      "Staff training",
      "Quality assurance testing",
    ],
    metadata: {
      service_type: "installation",
    },
  },
  ADDITIONAL_DEVICE: {
    id: "additional_device",
    name: "Additional Device License",
    description: "Add one more device to your current plan",
    priceId: process.env.STRIPE_PRICE_ADDITIONAL_DEVICE || "price_additional_device",
    amount: 9900, // $99.00
    currency: "USD",
    type: "one_time",
    features: [
      "Lifetime device license",
      "Full feature access",
      "Free software updates",
    ],
    metadata: {
      product_type: "device_license",
    },
  },
  CUSTOM_INTEGRATION: {
    id: "custom_integration",
    name: "Custom Integration Service",
    description: "Integrate SSP with your existing POS or inventory system",
    priceId: process.env.STRIPE_PRICE_CUSTOM_INTEGRATION || "price_custom_integration",
    amount: 149900, // $1,499.00
    currency: "USD",
    type: "one_time",
    features: [
      "Custom API development",
      "System integration",
      "Testing and QA",
      "Documentation",
      "3 months support",
    ],
    metadata: {
      service_type: "integration",
    },
  },
};

/**
 * Get all products as an array
 */
export function getAllProducts(): ProductDefinition[] {
  return [
    ...Object.values(SERVICE_PLANS),
    ...Object.values(ONE_TIME_PRODUCTS),
  ];
}

/**
 * Get product by ID
 */
export function getProductById(id: string): ProductDefinition | undefined {
  const allProducts = getAllProducts();
  return allProducts.find((p) => p.id === id);
}

/**
 * Get product by Stripe Price ID
 */
export function getProductByPriceId(priceId: string): ProductDefinition | undefined {
  const allProducts = getAllProducts();
  return allProducts.find((p) => p.priceId === priceId);
}

/**
 * Get subscription plans only
 */
export function getSubscriptionPlans(): ProductDefinition[] {
  return Object.values(SERVICE_PLANS);
}

/**
 * Get one-time products only
 */
export function getOneTimeProducts(): ProductDefinition[] {
  return Object.values(ONE_TIME_PRODUCTS);
}
