import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Package, CreditCard, MapPin, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const [, setLocation] = useLocation();
  const orderId = params?.id ? parseInt(params.id) : null;

  const utils = trpc.useUtils();
  
  const { data: orderData, isLoading } = trpc.orders.getById.useQuery(
    { id: orderId! },
    { enabled: !!orderId }
  );

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Order status updated successfully!");
      utils.orders.getById.invalidate();
      utils.orders.getByMerchant.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update order: ${error.message}`);
    },
  });

  if (!orderId) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Invalid order ID</p>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Loading order details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!orderData) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Order not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: "bg-green-500/10 text-green-500",
      processing: "bg-blue-500/10 text-blue-500",
      pending: "bg-yellow-500/10 text-yellow-500",
      failed: "bg-red-500/10 text-red-500",
      cancelled: "bg-gray-500/10 text-gray-500",
      refunded: "bg-orange-500/10 text-orange-500",
    };
    return colors[status] || "bg-gray-500/10 text-gray-500";
  };

  const handleStatusChange = (newStatus: "pending" | "processing" | "completed" | "failed" | "refunded" | "cancelled") => {
    updateStatusMutation.mutate({
      id: orderId,
      status: newStatus,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => setLocation("/orders")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Order #{orderData.orderNumber}</h1>
              <p className="text-muted-foreground mt-1">Order ID: {orderData.id}</p>
            </div>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(orderData.status)}`}>
            {orderData.status.charAt(0).toUpperCase() + orderData.status.slice(1)}
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <CreditCard className="h-5 w-5 mr-2 text-primary" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Amount:</span>
                <span className="font-semibold text-foreground">{formatCurrency(orderData.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency:</span>
                <span className="text-foreground">{orderData.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Method:</span>
                <span className="text-foreground">{orderData.paymentMethod || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Status:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(orderData.paymentStatus)}`}>
                  {orderData.paymentStatus}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Clock className="h-5 w-5 mr-2 text-primary" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span className="text-foreground text-sm">{formatDate(orderData.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated:</span>
                <span className="text-foreground text-sm">{formatDate(orderData.updatedAt)}</span>
              </div>
              {orderData.completedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed:</span>
                  <span className="text-foreground text-sm">{formatDate(orderData.completedAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-primary" />
                Device Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device ID:</span>
                <span className="text-foreground">{orderData.deviceId || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer ID:</span>
                <span className="text-foreground">{orderData.customerId || "Guest"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="h-5 w-5 mr-2 text-primary" />
              Order Items
            </CardTitle>
            <CardDescription>Products included in this order</CardDescription>
          </CardHeader>
          <CardContent>
            {orderData.items && orderData.items.length > 0 ? (
              <div className="space-y-4">
                {orderData.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Package className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{item.productName}</h3>
                        <p className="text-sm text-muted-foreground">Product ID: {item.productId}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-8">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Quantity</p>
                        <p className="font-semibold text-foreground">{item.quantity}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Unit Price</p>
                        <p className="font-semibold text-foreground">{formatCurrency(item.unitPrice)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="font-semibold text-foreground">{formatCurrency(item.totalPrice)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-foreground">Order Total:</span>
                    <span className="text-2xl font-bold text-primary">{formatCurrency(orderData.totalAmount)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No items in this order</p>
              </div>
            )}
          </CardContent>
        </Card>

        {orderData.transactions && orderData.transactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle2 className="h-5 w-5 mr-2 text-primary" />
                Transactions
              </CardTitle>
              <CardDescription>Payment transactions for this order</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orderData.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">Transaction ID: {transaction.transactionId}</p>
                      <p className="text-sm text-muted-foreground">Gateway: {transaction.paymentGateway}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{formatCurrency(transaction.amount)}</p>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Update Order Status</CardTitle>
            <CardDescription>Change the current status of this order</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {["pending", "processing", "completed", "failed", "cancelled", "refunded"].map((status) => (
                <Button
                  key={status}
                  variant={orderData.status === status ? "default" : "outline"}
                  onClick={() => handleStatusChange(status as any)}
                  disabled={updateStatusMutation.isPending}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
