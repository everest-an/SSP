import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Search, User, Wallet, Eye, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useLocation } from "wouter";

export default function AdminUsers() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
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

  // Fetch users
  const { data: users, isLoading, refetch } = trpc.admin.users.list.useQuery(
    { limit: 100 },
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  // Search users
  const { data: searchResults, refetch: refetchSearch } = trpc.admin.users.search.useQuery(
    { query: searchQuery, limit: 50 },
    { enabled: searchQuery.length > 0 && isAuthenticated && user?.role === "admin" }
  );

  // Get user details
  const { data: userDetails } = trpc.admin.users.getDetails.useQuery(
    { userId: selectedUserId! },
    { enabled: selectedUserId !== null }
  );

  // Update user status
  const updateStatusMutation = trpc.admin.users.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("User status updated");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const displayUsers = searchQuery.length > 0 ? searchResults : users;

  const handleViewDetails = (userId: number) => {
    setSelectedUserId(userId);
    setDetailsDialogOpen(true);
  };

  const handleUpdateRole = (userId: number, role: "user" | "merchant" | "admin") => {
    updateStatusMutation.mutate({ userId, role });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading users...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">View and manage all registered users</p>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Search Users</CardTitle>
            <CardDescription>Search by name or email</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchQuery && (
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users ({displayUsers?.length || 0})</CardTitle>
            <CardDescription>Complete list of registered users</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Login Method</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Last Sign In</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayUsers?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-sm">{u.id}</TableCell>
                    <TableCell className="font-medium">{u.name || "-"}</TableCell>
                    <TableCell>{u.email || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(value) => handleUpdateRole(u.id, value as any)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="merchant">Merchant</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{u.loginMethod || "N/A"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(u.lastSignedIn).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(u.id)}
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

        {/* User Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
              <DialogDescription>Complete user information and activity</DialogDescription>
            </DialogHeader>
            
            {userDetails && (
              <div className="space-y-6">
                {/* Basic Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">User ID</p>
                        <p className="text-sm text-muted-foreground">{userDetails.user.id}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Name</p>
                        <p className="text-sm text-muted-foreground">{userDetails.user.name || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">{userDetails.user.email || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Role</p>
                        <Badge>{userDetails.user.role}</Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Login Method</p>
                        <p className="text-sm text-muted-foreground">{userDetails.user.loginMethod || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Open ID</p>
                        <p className="text-sm text-muted-foreground font-mono">{userDetails.user.openId}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Face Recognition */}
                {userDetails.faceRecognition && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Face Recognition</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium">Status</p>
                          <Badge variant={userDetails.faceRecognition.isActive ? "default" : "secondary"}>
                            {userDetails.faceRecognition.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Max Payment Amount</p>
                          <p className="text-sm text-muted-foreground">
                            ${(userDetails.faceRecognition.maxPaymentAmount / 100).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Stripe Customer ID</p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {userDetails.faceRecognition.stripeCustomerId || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Last Used</p>
                          <p className="text-sm text-muted-foreground">
                            {userDetails.faceRecognition.lastUsedAt
                              ? new Date(userDetails.faceRecognition.lastUsedAt).toLocaleString()
                              : "Never"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Wallets */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Wallets ({userDetails.wallets.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userDetails.wallets.length > 0 ? (
                      <div className="space-y-4">
                        {userDetails.wallets.map((wallet) => (
                          <div key={wallet.id} className="border rounded-lg p-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm font-medium">Type</p>
                                <Badge variant="outline">{wallet.walletType}</Badge>
                              </div>
                              <div>
                                <p className="text-sm font-medium">Balance</p>
                                <p className="text-lg font-bold">
                                  ${(wallet.balance / 100).toFixed(2)} {wallet.currency}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium">Status</p>
                                <Badge variant={wallet.status === "active" ? "default" : "secondary"}>
                                  {wallet.status}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-sm font-medium">Default</p>
                                <p className="text-sm text-muted-foreground">
                                  {wallet.isDefault ? "Yes" : "No"}
                                </p>
                              </div>
                              {wallet.walletAddress && (
                                <div className="col-span-2">
                                  <p className="text-sm font-medium">Wallet Address</p>
                                  <p className="text-sm text-muted-foreground font-mono">
                                    {wallet.walletAddress}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No wallets</p>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Orders */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Orders ({userDetails.recentOrders.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userDetails.recentOrders.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order #</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userDetails.recentOrders.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell className="font-mono">{order.orderNumber}</TableCell>
                              <TableCell>
                                ${(order.totalAmount / 100).toFixed(2)} {order.currency}
                              </TableCell>
                              <TableCell>
                                <Badge>{order.status}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {new Date(order.createdAt).toLocaleDateString()}
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
