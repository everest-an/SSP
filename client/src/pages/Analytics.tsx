import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  Activity,
  BarChart3,
} from "lucide-react";

export default function Analytics() {
  const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y">("30d");

  const { data: merchants } = trpc.merchants.getMyMerchants.useQuery();

  useMemo(() => {
    if (merchants && merchants.length > 0 && !selectedMerchantId) {
      setSelectedMerchantId(merchants[0].id);
    }
  }, [merchants, selectedMerchantId]);

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.getStats.useQuery(
    { merchantId: selectedMerchantId! },
    { enabled: !!selectedMerchantId }
  );

  const { data: orders } = trpc.orders.getByMerchant.useQuery(
    { merchantId: selectedMerchantId!, limit: 1000 },
    { enabled: !!selectedMerchantId }
  );

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    if (!orders || orders.length === 0) {
      return {
        totalRevenue: 0,
        completedOrders: 0,
        averageOrderValue: 0,
        conversionRate: 0,
        topProducts: [],
        revenueByDay: [],
      };
    }

    const completedOrders = orders.filter((o) => o.status === "completed");
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
    const conversionRate = (completedOrders.length / orders.length) * 100;

    // Group revenue by day
    const revenueByDay: Record<string, number> = {};
    completedOrders.forEach((order) => {
      const date = new Date(order.createdAt).toLocaleDateString();
      revenueByDay[date] = (revenueByDay[date] || 0) + order.totalAmount;
    });

    const revenueByDayArray = Object.entries(revenueByDay)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30); // Last 30 days

    return {
      totalRevenue,
      completedOrders: completedOrders.length,
      averageOrderValue,
      conversionRate,
      topProducts: [],
      revenueByDay: revenueByDayArray,
    };
  }, [orders]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
            <p className="text-muted-foreground mt-1">Detailed insights and performance metrics</p>
          </div>
          <div className="flex gap-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-4 py-2 rounded-lg border border-border bg-card text-foreground"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
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

        {/* Key Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(analyticsData.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                From {analyticsData.completedOrders} completed orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(analyticsData.averageOrderValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Per completed order</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData.conversionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">Orders completed successfully</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeDevices || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Online now</p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-primary" />
              Revenue Trend
            </CardTitle>
            <CardDescription>Daily revenue over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsData.revenueByDay.length > 0 ? (
              <div className="space-y-4">
                <div className="h-64 flex items-end justify-between gap-2">
                  {analyticsData.revenueByDay.map((day, index) => {
                    const maxRevenue = Math.max(...analyticsData.revenueByDay.map((d) => d.amount));
                    const height = (day.amount / maxRevenue) * 100;
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-primary rounded-t transition-all hover:opacity-80 cursor-pointer"
                          style={{ height: `${height}%` }}
                          title={`${day.date}: ${formatCurrency(day.amount)}`}
                        ></div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{analyticsData.revenueByDay[0]?.date}</span>
                  <span>{analyticsData.revenueByDay[analyticsData.revenueByDay.length - 1]?.date}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No revenue data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Status Distribution */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Status Distribution</CardTitle>
              <CardDescription>Breakdown of orders by status</CardDescription>
            </CardHeader>
            <CardContent>
              {orders && orders.length > 0 ? (
                <div className="space-y-4">
                  {["completed", "processing", "pending", "failed", "cancelled", "refunded"].map((status) => {
                    const count = orders.filter((o) => o.status === status).length;
                    const percentage = (count / orders.length) * 100;
                    return (
                      <div key={status} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground capitalize">{status}</span>
                          <span className="text-muted-foreground">
                            {count} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No order data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
              <CardDescription>Summary of key performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Total Orders</span>
                  <span className="text-lg font-bold text-foreground">{orders?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Completed Orders</span>
                  <span className="text-lg font-bold text-foreground">{analyticsData.completedOrders}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Total Products</span>
                  <span className="text-lg font-bold text-foreground">{stats?.totalProducts || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Active Devices</span>
                  <span className="text-lg font-bold text-foreground">{stats?.activeDevices || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
