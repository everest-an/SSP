# SSP - Wallet and Payment Infrastructure

**Version**: 1.0  
**Date**: 2025-11-17

---

This is a critical and realistic issue. While computer vision solves the "recognition" problem, the essence of payment is a "financial transaction." The financial sector has extremely high requirements for security, compliance, and account management. This part is typically not entirely open-source but relies on mature payment gateways.

You need a complete technical solution that seamlessly connects the frontend "frictionless recognition" with the backend "secure payment."

---

## 💡 Complete Technical Solution: A Three-Layer Architecture

To achieve the full flow from "frictionless recognition" to "wallet deduction," a robust three-layer architecture is required: the **Perception Layer** (POS/App), the **Application Service Layer** (Backend), and the **Financial Core Layer** (Payment Gateway/Wallet).

### First Layer: Perception Layer (iPad/Phone POS App & User-side App)

| Module | Purpose | Core Components/Technology |
| :--- | :--- | :--- |
| **A. Identity Recognition (User ID)** | To confirm who is paying. | Frontend biometric APIs: Face ID/Touch ID on the user's mobile app or facial recognition at the POS (for initial check-in). |
| **B. Payment Trigger** | To recognize the "pick up and walk away" action. | MediaPipe + YOLO/MobileNet (as described previously) + Context Analysis State Machine. |
| **C. Payment Authorization** | To obtain a short-term payment token from the user. | OAuth 2.0 / OpenID Connect: The user's mobile app authorizes a short-lived payment token (Auth_Token) to the POS app. |

### Second Layer: Application Service Layer (Merchant/Vendor Backend)

This is the core business logic and security gateway that you need to build yourself.

| Module | Purpose | Core Components/Technology |
| :--- | :--- | :--- |
| **D. API Gateway** | To receive payment requests from the POS. | Python (FastAPI/Django) or Go/Java Spring Boot + TLS/SSL encryption. |
| **E. User/Wallet Service** | To manage user IDs and linked payment account information (storing only IDs or tokens). | Open-source identity management: such as Keycloak (open-source, for authentication and authorization) or Authelia (a lightweight reverse proxy for authentication). |
| **F. Order/Transaction Service** | To record pending and completed transactions and handle concurrency. | PostgreSQL/MySQL + Redis (for caching) + a message queue (like Kafka/RabbitMQ) to handle high concurrency. |
| **G. Risk Control/Fraud Prevention** | To block abnormal transactions (such as rapid, consecutive transactions). | A custom rule engine or an open-source ML library (like Scikit-learn) for scoring abnormal behavior. |

### Third Layer: Financial Core Layer (Payment Gateway & Wallet)

This part involves the flow of funds and compliance and is usually not entirely open-source; it requires integration with mature third-party services.

| Module | Purpose | Core Components/Technology |
| :--- | :--- | :--- |
| **H. Payment Gateway Integration** | The sole channel for merchants to receive payments. | Official SDKs/APIs from Stripe, PayPal, Adyen, or domestic payment providers (like WeChat Pay/Alipay). |
| **I. Wallet/Account Management** | Account management for customer deductions and merchant collections. | Open-source payment cores: such as Hyperswitch (an open-source payment routing and vaulting system) or Kill Bill (a complex subscription/billing system). |
| **J. Tokenization** | To securely store customers' payment information. | Hyperswitch Vault or a secure token service provided by a payment gateway. |

---

## 🔎 Open-Source Components & GitHub Links (Payment Core)

While a complete, bank-grade payment system is rarely fully open-source, the following open-source projects can serve as the foundation for building your **Application Service Layer** and **Financial Core Layer**:

| Component Name | Description | Applicable Modules | GitHub/Link |
| :--- | :--- | :--- | :--- |
| **Hyperswitch** | An open-source payment switch and routing system that provides a PCI-compliant Vault (for securely storing card info tokens) and smart routing. | I, J (Payment Routing, Tokenization, Wallet) | [Hyperswitch GitHub](https://github.com/hyperswitch-io/hyperswitch) |
| **Kill Bill** | A powerful open-source subscription and billing platform, very suitable if your payments involve complex business logic like memberships or installments. | I (Accounts, Wallet) | [Kill Bill GitHub](https://github.com/killbill/killbill) |
| **BTCPay Server** | An excellent open-source, decentralized payment processor if you are considering using cryptocurrency for payments. | H, I (Payment Gateway) | [BTCPay Server GitHub](https://github.com/btcpayserver/btcpayserver) |
| **Keycloak** | A widely used open-source Identity and Access Management (IAM) solution that can be used to authenticate your customers and merchants. | E (Identity/Authentication) | [Keycloak Official Website](https://www.keycloak.org/) |

---

## 🤝 Final Technical Solution Flow

1.  **User Check-in/Authorization (POS)**: The customer's mobile app authenticates using Keycloak and authorizes a short-term payment token (`Auth_Token`) to the POS via OAuth 2.0.
2.  **Trigger Payment (POS)**: The MediaPipe + YOLO state machine recognizes the "pick up and walk away" action.
3.  **Send Request (POS -> Backend)**: The POS app sends the (`Auth_Token`, `User_ID`, `Item_ID`, `Amount`) to your Application Service Layer via a secure API.
4.  **Backend Processing (Application Service Layer)**:
    -   Risk control checks are performed.
    -   The Order Service creates a pending transaction.
    -   Hyperswitch receives the request and looks up the payment token associated with the `User_ID`.
5.  **Gateway Deduction (Financial Core Layer)**: Hyperswitch securely routes the request to the pre-configured payment gateway (e.g., Stripe/domestic bank), completes the customer's wallet deduction, and transfers the funds to the merchant's wallet.
6.  **Confirmation (Backend -> POS)**: After the transaction is successful, the backend updates the order status via a message queue and notifies the POS app of the successful payment.

This integrated solution perfectly combines your initial frictionless recognition technology (MediaPipe/YOLO) with a secure backend financial system (Hyperswitch/Keycloak) to form a complete and viable future payment system.
