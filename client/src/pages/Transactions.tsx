import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { CreditCard, Search, Filter, Download, Eye } from "lucide-react";
import { Link } from "wouter";

export default function Transactions() {
  const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: merchants } = trpc.merchants.getMyMerchants.useQuery();

  useMemo(() => {
    if (merchants && merchants.length > 0 && !selectedMerchantId) {
      setSelectedMerchantId(merchants[0].id);
    }
  }, [merchants, selectedMerchantId]);

  const { data: orders, isLoading } = trpc.orders.getByMerchant.useQuery(
    { merchantId: selectedMerchantId!, limit: 1000 },
    { enabled: !!selectedMerchantId }
  );

  // Extract all transactions from orders
  const allTransactions = useMemo(() => {
    if (!orders) return [];
    
    const transactions: Array<{
      id: number;
      transactionId: string;
      orderId: number;
      orderNumber: string;
      amount: number;
      currency: string;
      status: string;
      paymentGateway: string;
      paymentMethod: string | null;
      createdAt: Date;
    }> = [];

    // For now, create transaction records from orders
    // In a real system, you'd fetch actual transaction records
    orders.forEach((order) => {
      transactions.push({
        id: order.id,
        transactionId: `TXN-${order.orderNumber}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: order.totalAmount,
        currency: order.currency,
        status: order.paymentStatus,
        paymentGateway: "Hyperswitch",
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
      });
    });

    return transactions;
  }, [orders]);

  const filteredTransactions = allTransactions.filter((transaction) => {
    const matchesSearch =
      transaction.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.id.toString().includes(searchQuery);
    const matchesStatus = statusFilter === "all" || transaction.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      captured: "bg-green-500/10 text-green-500",
      authorized: "bg-blue-500/10 text-blue-500",
      pending: "bg-yellow-500/10 text-yellow-500",
      failed: "bg-red-500/10 text-red-500",
      refunded: "bg-orange-500/10 text-orange-500",
    };
    return colors[status] || "bg-gray-500/10 text-gray-500";
  };

  const statusOptions = [
    { value: "all", label: "All Transactions" },
    { value: "pending", label: "Pending" },
    { value: "authorized", label: "Authorized" },
    { value: "captured", label: "Captured" },
    { value: "failed", label: "Failed" },
    { value: "refunded", label: "Refunded" },
  ];

  const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
  const successfulTransactions = filteredTransactions.filter(
    (t) => t.status === "captured" || t.status === "authorized"
  );
  const successfulAmount = successfulTransactions.reduce((sum, t) => sum + t.amount, 0);

  const handleExport = () => {
    // Create CSV content
    const headers = ["Transaction ID", "Order Number", "Amount", "Currency", "Status", "Gateway", "Payment Method", "Date"];
    const rows = filteredTransactions.map((t) => [
      t.transactionId,
      t.orderNumber,
      (t.amount / 100).toFixed(2),
      t.currency,
      t.status,
      t.paymentGateway,
      t.paymentMethod || "N/A",
      formatDate(t.createdAt),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
            <p className="text-muted-foreground mt-1">View and manage payment transactions</p>
          </div>
          <Button onClick={handleExport} disabled={filteredTransactions.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Transactions</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{filteredTransactions.length}</p>
                </div>
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Volume</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalAmount)}</p>
                </div>
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Successful Amount</p>
                  <p className="text-2xl font-bold text-green-500 mt-1">{formatCurrency(successfulAmount)}</p>
                </div>
                <CreditCard className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by transaction ID, order number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-4">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 rounded-lg border border-border bg-card text-foreground appearance-none"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {merchants && merchants.length > 1 && (
              <select
                value={selectedMerchantId || ""}
                onChange={(e) => setSelectedMerchantId(Number(e.target.value))}
                className="px-4 py-2 rounded-lg border border-border bg-card text-foreground"
              >
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.businessName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTransactions.length > 0 ? (
          <div className="space-y-4">
            {filteredTransactions.map((transaction) => (
              <Card key={transaction.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <CreditCard className="h-6 w-6 text-primary" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="font-semibold text-foreground text-lg">
                            {transaction.transactionId}
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              transaction.status
                            )}`}
                          >
                            {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                          <span>Order: {transaction.orderNumber}</span>
                          <span>•</span>
                          <span>{formatDate(transaction.createdAt)}</span>
                          <span>•</span>
                          <span>Gateway: {transaction.paymentGateway}</span>
                          {transaction.paymentMethod && (
                            <>
                              <span>•</span>
                              <span>Method: {transaction.paymentMethod}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">Amount</p>
                        <p className="text-2xl font-bold text-foreground">
                          {formatCurrency(transaction.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">{transaction.currency}</p>
                      </div>

                      <Link href={`/orders/${transaction.orderId}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          View Order
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <CreditCard className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No transactions found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Transactions will appear here once payments are processed"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
