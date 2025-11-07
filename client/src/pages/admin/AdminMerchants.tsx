import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Store, Shield, Eye, Package, Smartphone, ShoppingCart, DollarSign } from "lucide-react";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useLocation } from "wouter";

export default function AdminMerchants() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

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

  // Fetch merchants with stats
  const { data: merchants, isLoading } = trpc.admin.merchants.listWithStats.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  // Get merchant detailed stats
  const { data: merchantDetails } = trpc.admin.merchants.getDetailedStats.useQuery(
    { merchantId: selectedMerchantId! },
    { enabled: selectedMerchantId !== null }
  );

  const handleViewDetails = (merchantId: number) => {
    setSelectedMerchantId(merchantId);
    setDetailsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading merchants...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Merchant Management</h1>
          <p className="text-muted-foreground">View and manage all registered merchants</p>
        </div>

        {/* Merchants Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              All Merchants ({merchants?.length || 0})
            </CardTitle>
            <CardDescription>Complete list of merchants with performance stats</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Orders</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Devices</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchants?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono">{m.id}</TableCell>
                    <TableCell className="font-medium">{m.businessName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.businessType || "N/A"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          m.status === "active"
                            ? "default"
                            : m.status === "suspended"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{m.stats.totalOrders}</TableCell>
                    <TableCell className="font-semibold">
                      ${((m.stats.totalRevenue || 0) / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>{m.stats.deviceCount}</TableCell>
                    <TableCell>{m.stats.productCount}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(m.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Merchant Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Merchant Details</DialogTitle>
              <DialogDescription>Complete merchant information and statistics</DialogDescription>
            </DialogHeader>

            {merchantDetails && (
              <div className="space-y-6">
                {/* Basic Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Store className="h-5 w-5" />
                      Business Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Merchant ID</p>
                        <p className="text-sm text-muted-foreground">{merchantDetails.merchant.id}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Business Name</p>
                        <p className="text-sm text-muted-foreground">{merchantDetails.merchant.businessName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Business Type</p>
                        <p className="text-sm text-muted-foreground">{merchantDetails.merchant.businessType || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Status</p>
                        <Badge>{merchantDetails.merchant.status}</Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">{merchantDetails.merchant.email || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Phone</p>
                        <p className="text-sm text-muted-foreground">{merchantDetails.merchant.phone || "-"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm font-medium">Address</p>
                        <p className="text-sm text-muted-foreground">{merchantDetails.merchant.address || "-"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                      <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{merchantDetails.stats.totalOrders}</div>
                      <p className="text-xs text-muted-foreground">
                        {merchantDetails.stats.completedOrders} completed
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${((merchantDetails.stats.totalRevenue || 0) / 100).toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Avg: ${((merchantDetails.stats.avgOrderValue || 0) / 100).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Devices</CardTitle>
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{merchantDetails.devices.length}</div>
                      <p className="text-xs text-muted-foreground">
                        {merchantDetails.devices.filter((d) => d.status === "online").length} online
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Products</CardTitle>
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{merchantDetails.products.length}</div>
                      <p className="text-xs text-muted-foreground">
                        {merchantDetails.products.filter((p) => p.status === "active").length} active
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Devices */}
                <Card>
                  <CardHeader>
                    <CardTitle>Devices ({merchantDetails.devices.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {merchantDetails.devices.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Device Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Last Heartbeat</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {merchantDetails.devices.map((device) => (
                            <TableRow key={device.id}>
                              <TableCell className="font-medium">{device.deviceName}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{device.deviceType}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    device.status === "online"
                                      ? "default"
                                      : device.status === "maintenance"
                                      ? "secondary"
                                      : "destructive"
                                  }
                                >
                                  {device.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{device.location || "-"}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {device.lastHeartbeat ? new Date(device.lastHeartbeat).toLocaleString() : "Never"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">No devices registered</p>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Orders */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Orders ({merchantDetails.recentOrders.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {merchantDetails.recentOrders.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order #</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Payment Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {merchantDetails.recentOrders.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell className="font-mono">{order.orderNumber}</TableCell>
                              <TableCell className="font-semibold">
                                ${(order.totalAmount / 100).toFixed(2)} {order.currency}
                              </TableCell>
                              <TableCell>
                                <Badge>{order.status}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{order.paymentStatus}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {new Date(order.createdAt).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">No orders yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
