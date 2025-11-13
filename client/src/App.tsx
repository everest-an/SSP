import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import CreateMerchant from "./pages/CreateMerchant";
import Products from "./pages/Products";
import Devices from "./pages/Devices";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Analytics from "./pages/Analytics";
import Transactions from "./pages/Transactions";
import Pricing from "./pages/Pricing";
import Wallets from "./pages/Wallets";
import FaceRegistration from "./pages/FaceRegistration";
import { FaceEnrollment } from "./pages/FaceEnrollment";
import { FaceLogin } from "./pages/FaceLogin";
import AdminUsers from "./pages/admin/Users";
import AdminTransactions from "./pages/admin/AdminTransactions";
import AdminMerchants from "./pages/admin/AdminMerchants";
import DevicePayment from "./pages/DevicePayment";
import PaymentMethods from "./pages/PaymentMethods";
import MerchantSettings from "./pages/MerchantSettings";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/merchants/create"} component={CreateMerchant} />
      <Route path={"/products"} component={Products} />
      <Route path={"/devices"} component={Devices} />
      <Route path={"/orders"} component={Orders} />
      <Route path={"/orders/:id"} component={OrderDetail} />
      <Route path={"/analytics"} component={Analytics} />
      <Route path={"/transactions"} component={Transactions} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/wallets"} component={Wallets} />
      <Route path={"/face-registration"} component={FaceRegistration} />
      <Route path={"/face-enrollment"} component={FaceEnrollment} />
      <Route path={"/face-login"} component={FaceLogin} />
      <Route path={"/device-payment"} component={DevicePayment} />
      <Route path={"/payment-methods"} component={PaymentMethods} />
      <Route path={"/merchant-settings"} component={MerchantSettings} />
      <Route path={"/admin/users"} component={AdminUsers} />
      <Route path={"/admin/transactions"} component={AdminTransactions} />
      <Route path={"/admin/merchants"} component={AdminMerchants} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
