import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Download, Filter, Shield, TrendingUp, DollarSign, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useLocation } from "wouter";

export default function AdminTransactions() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // Check if user is admin
  if (isAuthenticated && user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <Shield className="h-16 w-16 text-muted-foreground mx-auto" />
            <div>
              <h2 className="text-2xl font-bold">Access Denied</h2>
              <p className="text-muted-foreground">You need admin privileges to access this page</p>
            </div>
            <Button onClick={() => setLocation("/dashboard")}>Go to Dashboard</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Fetch all transactions
  const { data: transactions, isLoading } = trpc.admin.transactions.list.useQuery(
    { limit: 100 },
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  // Fetch transaction stats
  const { data: stats } = trpc.admin.transactions.stats.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  // Search transactions
  const hasFilters = filterStatus !== "all" || minAmount !== "" || maxAmount !== "";
  const { data: searchResults } = trpc.admin.transactions.search.useQuery(
    {
      status: filterStatus !== "all" ? filterStatus : undefined,
      minAmount: minAmount ? parseInt(minAmount) * 100 : undefined,
      maxAmount: maxAmount ? parseInt(maxAmount) * 100 : undefined,
      limit: 100,
    },
    {
      enabled: hasFilters && isAuthenticated && user?.role === "admin",
    }
  );

  const displayTransactions = (filterStatus !== "all" || minAmount || maxAmount) ? searchResults : transactions;

  const handleExportCSV = () => {
    if (!displayTransactions) return;

    const csvContent = [
      ["Transaction ID", "Order Number", "Merchant", "Amount", "Status", "Payment Gateway", "Date"].join(","),
      ...displayTransactions.map((t) =>
        [
          t.transaction.transactionId,
          t.order?.orderNumber || "-",
          t.merchant?.businessName || "-",
          (t.transaction.amount / 100).toFixed(2),
          t.transaction.status,
          t.transaction.paymentGateway,
          new Date(t.transaction.createdAt).toISOString(),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString()}.csv`;
    a.click();
    toast.success("Transactions exported to CSV");
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading transactions...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Transaction Monitoring</h1>
            <p className="text-muted-foreground">View and analyze all payment transactions</p>
          </div>
          <Button onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTransactions}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${(stats.totalAmount / 100).toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Successful</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.successfulTransactions}</div>
                <p className="text-xs text-muted-foreground">
                  {((stats.successfulTransactions / stats.totalTransactions) * 100).toFixed(1)}% success rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.failedTransactions}</div>
                <p className="text-xs text-muted-foreground">
                  Avg: ${(stats.avgTransactionAmount / 100).toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Transactions
            </CardTitle>
            <CardDescription>Filter by status, amount range, and more</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Min Amount ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Max Amount ($)</label>
                <Input
                  type="number"
                  placeholder="1000.00"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </div>
            </div>

            {(filterStatus !== "all" || minAmount || maxAmount) && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setFilterStatus("all");
                  setMinAmount("");
                  setMaxAmount("");
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Transactions ({displayTransactions?.length || 0})</CardTitle>
            <CardDescription>Complete transaction history across all merchants</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Gateway</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayTransactions?.map((t) => (
                    <TableRow key={t.transaction.id}>
                      <TableCell className="font-mono text-sm">
                        {t.transaction.transactionId.substring(0, 16)}...
                      </TableCell>
                      <TableCell className="font-mono">
                        {t.order?.orderNumber || "-"}
                      </TableCell>
                      <TableCell>{t.merchant?.businessName || "-"}</TableCell>
                      <TableCell className="font-semibold">
                        ${(t.transaction.amount / 100).toFixed(2)} {t.transaction.currency}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            t.transaction.status === "success"
                              ? "default"
                              : t.transaction.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {t.transaction.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{t.transaction.paymentGateway}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.transaction.paymentMethod || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(t.transaction.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
