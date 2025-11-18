# SSP (Smart Store Payment) - Functional Specifications Document (FSD)

**Version**: 1.0  
**Date**: 2025-11-17

---

## 1. Overview

This document provides a detailed description of the functional specifications for the SSP (Smart Store Payment) system. It defines the specific behavior, business rules, interface elements, and interaction flows for each function. This document serves as the primary basis for product development, testing, and acceptance.

---

## 2. System Architecture and Flow

### 2.1. Functional Architecture

The SSP system is functionally divided into three main layers: the Frontend Application Layer, the Backend Service Layer, and the Data Persistence Layer. These layers communicate with each other through well-defined APIs.

| Layer | Modules Included | Key Technologies | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Frontend Application Layer** | User Dashboard, Merchant Backend, Admin Backend | React, Vite, TailwindCSS | Provides the user interface, displays data, and initiates business requests. |
| **Backend Service Layer** | API Gateway, Auth Service, Order Service, Payment Service, AI Service | Express.js, tRPC, JWT | Handles business logic, calls the database and third-party services, and ensures data consistency and security. |
| **Data Persistence Layer** | Core Database, Facial Feature Library, Event Logs | MySQL, Drizzle ORM, AWS S3 | Stores all business data, including user information, products, orders, transactions, and AI model-related data. |

### 2.2. Core Business Flow: Frictionless Payment

Frictionless payment is the core process of the SSP system, involving the coordination of multiple modules.

**Flow Description:**
1.  **User Entry**: The user enters the store, and cameras on the edge devices begin to operate.
2.  **Product Recognition**: The user takes a product from the shelf. The edge device identifies the product using a YOLO model and sends `detectionEvents` to the backend.
3.  **Shopping Cart Update**: The backend service dynamically updates the user's virtual shopping cart based on the `detectionEvents` (picking up/putting back).
4.  **User Confirmation**: The user proceeds to the exit, where a screen displays the shopping cart contents and the total amount. The user confirms the payment with a specific gesture (e.g., a thumbs-up).
5.  **Facial Verification**: Simultaneously with the user's confirmation, the system performs facial recognition using a MediaPipe model to confirm the user's identity.
6.  **Payment Processing**: After identity confirmation, the backend calls the payment service to deduct the amount from the user's default bound payment method.
7.  **Transaction Completion**: Upon successful payment, a formal order and transaction record are generated, and an electronic receipt is sent to the user.

---

## 3. Detailed Functional Modules

### 3.1. User and Authentication Module

#### 3.1.1. User Registration
-   **Description**: New users can register via email or Cognito OAuth.
-   **UI Elements**: Registration form (Email, Password, Confirm Password), "Register with Cognito" button.
-   **Business Rules**:
    -   The password must meet certain complexity requirements (e.g., at least 8 characters, including uppercase and lowercase letters and numbers).
    -   The email address must be unique.
    -   Upon successful registration, the user role defaults to `user`.

#### 3.1.2. User Login
-   **Description**: Registered users can log in to the system.
-   **UI Elements**: Login form (Email, Password), "Login" button, "Login with Cognito" button.
-   **Business Rules**:
    -   Upon successful login, the backend generates a JWT (JSON Web Token) and returns it to the frontend via an HttpOnly Cookie.
    -   The JWT contains information such as `userId`, `role`, and `openId`, with an expiration of 24 hours.
    -   If login fails more than 5 times, the account will be temporarily locked for 15 minutes.

#### 3.1.3. Facial Information Management
-   **Description**: Users can register, view, and delete their facial recognition information in their personal center.
-   **UI Elements**: "Register Face Info" button, camera preview window, "Delete Face Info" button.
-   **Business Rules**:
    -   During facial information registration, the system will capture multiple images of the face from different angles, extract feature vectors, and store them encrypted.
    -   A user can only bind one set of facial information.
    -   Deleting facial information requires a secondary confirmation.

### 3.2. Merchant Backend Module

#### 3.2.1. Dashboard
-   **Description**: Provides merchants with an overview of their store's operational status.
-   **UI Elements**:
    -   Key metric cards: Display today's sales, order count, customer traffic, and average transaction value.
    -   Sales trend chart: A line chart showing sales changes over the last 7 or 30 days.
    -   Top-selling products list: A list showing the top 5 best-selling products.
    -   Quick links: Provide quick access to common operations like "Add Product" and "View Orders".
-   **Data Sources**: `analytics` table, `orders` table, `products` table.

#### 3.2.2. Product Management
-   **Description**: Allows merchants to manage the entire lifecycle of products in their store.
-   **UI Elements**: Product list (in a table format, showing product image, name, SKU, price, stock, status), "Add New Product" button, "Edit" and "Delete" buttons for each product row, search box, and category filter.
-   **Business Rules**:
    -   Product prices are stored in cents to avoid floating-point precision issues.
    -   Deleting a product is a soft delete, setting the `status` field to `inactive`.
    -   Product images are uploaded to AWS S3, with only the image URL stored in the database.

#### 3.2.3. Order Management
-   **Description**: Allows merchants to view and manage all historical orders.
-   **UI Elements**: Order list (in a table format, showing order number, customer info, total amount, status, creation time), order details modal.
-   **Business Rules**:
    -   Order statuses include: `pending`, `processing`, `completed`, `failed`, `refunded`.
    -   Merchants can perform refund operations on orders with a `completed` status.

### 3.3. Payment and Wallet Module

#### 3.3.1. Payment Method Management
-   **Description**: Users can bind and manage their payment methods.
-   **UI Elements**: List of payment methods (showing card type, last four digits, expiration date), "Add New Card" button, "Set as Default" button, "Delete" button.
-   **Business Rules**:
    -   Credit card information is sent directly to the Stripe server via Stripe.js. The backend only stores the `paymentMethodId` and `customerId` returned by Stripe to ensure PCI compliance.
    -   Users must set a default payment method.

#### 3.3.2. Platform Wallet
-   **Description**: Provides users with a virtual wallet within the platform for payments and receiving funds.
-   **UI Elements**: Wallet balance display, "Top-up" button, "Withdraw" button, transaction history list.
-   **Business Rules**:
    -   All wallet operations will generate a record in the `walletTransactions` table.
    -   Top-ups are completed via Stripe; withdrawals require administrator approval.

---

## 4. Specifications for Future Optimizations

### 4.1. Social Login (V1.1)
-   **Description**: Allows users to log in/register for SSP with one click using their Google or Facebook account.
-   **Interaction Flow**:
    1.  The user clicks the "Login with Google" button on the login page.
    2.  The page redirects to Google's OAuth authorization page.
    3.  After authorization, Google redirects back to SSP's callback URL with an authorization code.
    4.  The SSP backend uses the authorization code to request user information (e.g., email, name, openId) from Google.
    5.  The system checks if the `openId` exists:
        -   If it exists, the user is logged in successfully.
        -   If it does not exist, a new account is automatically created for the user, and they are logged in.
-   **Technical Dependencies**: Requires creating an OAuth application in the Google Cloud Platform and Facebook for Developers to obtain a Client ID and Client Secret.

### 4.2. Multi-Factor Authentication (MFA) (V1.1)
-   **Description**: Users can enable two-factor authentication for their accounts to enhance security.
-   **Interaction Flow**:
    1.  The user selects "Enable MFA" in the security settings.
    2.  The system generates a secret key and a QR code.
    3.  The user scans the QR code using a TOTP application like Google Authenticator.
    4.  The user enters the 6-digit dynamic code generated by the app to complete the binding.
    5.  Subsequently, each time the user logs in, they will need to enter the dynamic code after their password.
-   **Business Rules**:
    -   When enabling MFA, the system should provide recovery codes in case the user loses their TOTP device.

### 4.3. Abnormal Transaction Alerts (V1.2)
-   **Description**: The system automatically detects potentially fraudulent transactions and sends alerts to administrators.
-   **Business Rules (Examples)**:
    -   **Rule 1 (High-Frequency Trading)**: An alert is triggered if the same user initiates more than 10 payments within 5 minutes.
    -   **Rule 2 (High-Value Transaction)**: An alert is triggered for any single payment exceeding $1,000.
    -   **Rule 3 (Anomalous Location Login)**: An alert is triggered if a user logs in from two geographically distant IP addresses within a short period.
-   **Alert Methods**:
    -   Display alert information in the admin backend's alert center.
    -   Send real-time alert notifications to designated administrators via email or SMS.

---

## 5. Data Model (Data Dictionary)

Only core tables are listed here. For the complete schema, please refer to the technical documentation.

-   **users**: Stores user information; `openId` is the key association field.
-   **merchants**: Stores merchant information, linked to the `users` table via `userId`.
-   **products**: Stores product information, linked to the `merchants` table via `merchantId`.
-   **orders**: Stores order header information, including total amount and status.
-   **orderItems**: Stores order line items, recording the specific products and quantities for each order.
-   **transactions**: Stores payment transaction records, linked to the `orders` table and the payment gateway's transaction ID.
-   **detectionEvents**: Stores raw detection events (product pick-up/put-back) reported by edge devices.

---

## 6. Interface Wireframes

This section should include wireframes or links to prototypes for major pages to provide a more intuitive understanding of the functionality.

-   **Login/Registration Page**: [Link to Wireframe]
-   **Merchant Dashboard**: [Link to Wireframe]
-   **Product Management Page**: [Link to Wireframe]
