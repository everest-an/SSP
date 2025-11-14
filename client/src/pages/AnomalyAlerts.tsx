/**
 * Anomaly Alerts Page
 * Monitor and manage suspicious transaction alerts
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  MapPin,
  Calendar,
  TrendingUp,
  Search,
  Filter,
  Eye,
  Ban,
  ThumbsUp,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

interface AnomalyAlert {
  id: number;
  orderId: number;
  userId: number;
  merchantId: number;
  deviceId: number;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  amount: number;
  status: "pending" | "investigating" | "resolved" | "false_positive";
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: number;
  notes?: string;
}

export default function AnomalyAlerts() {
  const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAlert, setSelectedAlert] = useState<AnomalyAlert | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const utils = trpc.useUtils();

  // Fetch merchants
  const { data: merchants } = trpc.merchants.getMyMerchants.useQuery();

  // Auto-select first merchant
  useMemo(() => {
    if (merchants && merchants.length > 0 && !selectedMerchantId) {
      setSelectedMerchantId(merchants[0].id);
    }
  }, [merchants, selectedMerchantId]);

  // Mock data for demonstration (replace with actual tRPC query)
  const mockAlerts: AnomalyAlert[] = [
    {
      id: 1,
      orderId: 1001,
      userId: 123,
      merchantId: 1,
      deviceId: 1,
      type: "high_value",
      severity: "high",
      description: "Transaction amount significantly higher than user average",
      amount: 15000,
      status: "pending",
      createdAt: new Date("2025-01-15T10:30:00"),
    },
    {
      id: 2,
      orderId: 1002,
      userId: 124,
      merchantId: 1,
      deviceId: 2,
      type: "rapid_transactions",
      severity: "medium",
      description: "Multiple transactions within short time period",
      amount: 3500,
      status: "investigating",
      createdAt: new Date("2025-01-15T11:15:00"),
    },
    {
      id: 3,
      orderId: 1003,
      userId: 125,
      merchantId: 1,
      deviceId: 1,
      type: "unusual_location",
      severity: "low",
      description: "Transaction from unusual device location",
      amount: 2500,
      status: "resolved",
      createdAt: new Date("2025-01-14T15:20:00"),
      resolvedAt: new Date("2025-01-14T16:00:00"),
    },
    {
      id: 4,
      orderId: 1004,
      userId: 126,
      merchantId: 1,
      deviceId: 3,
      type: "face_mismatch",
      severity: "critical",
      description: "Face recognition confidence below threshold",
      amount: 8000,
      status: "pending",
      createdAt: new Date("2025-01-15T12:00:00"),
    },
  ];

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    let filtered = mockAlerts;

    if (filterStatus !== "all") {
      filtered = filtered.filter((alert) => alert.status === filterStatus);
    }

    if (filterSeverity !== "all") {
      filtered = filtered.filter((alert) => alert.severity === filterSeverity);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (alert) =>
          alert.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          alert.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          alert.orderId.toString().includes(searchQuery)
      );
    }

    return filtered;
  }, [filterStatus, filterSeverity, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: mockAlerts.length,
      pending: mockAlerts.filter((a) => a.status === "pending").length,
      investigating: mockAlerts.filter((a) => a.status === "investigating").length,
      resolved: mockAlerts.filter((a) => a.status === "resolved").length,
      critical: mockAlerts.filter((a) => a.severity === "critical").length,
    };
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "investigating":
        return "bg-blue-500";
      case "resolved":
        return "bg-green-500";
      case "false_positive":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleViewDetails = (alert: AnomalyAlert) => {
    setSelectedAlert(alert);
    setIsDetailDialogOpen(true);
  };

  const handleResolve = (alertId: number, resolution: "resolved" | "false_positive") => {
    toast.success(`Alert marked as ${resolution === "resolved" ? "resolved" : "false positive"}`);
    // TODO: Call tRPC mutation to update alert status
  };

  const handleInvestigate = (alertId: number) => {
    toast.info("Alert marked as under investigation");
    // TODO: Call tRPC mutation to update alert status
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Anomaly Alerts</h1>
          <p className="text-muted-foreground">
            Monitor and manage suspicious transaction alerts
          </p>
        </div>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Investigating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.investigating}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Resolved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Critical
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Merchant</Label>
                <Select
                  value={selectedMerchantId?.toString()}
                  onValueChange={(value) => setSelectedMerchantId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants?.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id.toString()}>
                        {merchant.businessName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="false_positive">False Positive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search alerts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts List */}
        <Card>
          <CardHeader>
            <CardTitle>Alerts ({filteredAlerts.length})</CardTitle>
            <CardDescription>
              {filterStatus !== "all" || filterSeverity !== "all" || searchQuery
                ? "Filtered results"
                : "All anomaly alerts"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No alerts found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAlerts.map((alert) => (
                  <Card key={alert.id} className="border-l-4" style={{ borderLeftColor: getSeverityColor(alert.severity).replace('bg-', '#') }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge className={getSeverityColor(alert.severity)}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                            <Badge className={getStatusColor(alert.status)}>
                              {alert.status.replace("_", " ").toUpperCase()}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Alert #{alert.id}
                            </span>
                          </div>

                          <h3 className="font-semibold">{alert.description}</h3>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span>${(alert.amount / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>User #{alert.userId}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>Device #{alert.deviceId}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>{new Date(alert.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetails(alert)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Details
                          </Button>
                          {alert.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleInvestigate(alert.id)}
                              >
                                <Clock className="h-4 w-4 mr-1" />
                                Investigate
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolve(alert.id, "resolved")}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Resolve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolve(alert.id, "false_positive")}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                False Positive
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alert Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Alert Details</DialogTitle>
              <DialogDescription>
                Detailed information about this anomaly alert
              </DialogDescription>
            </DialogHeader>

            {selectedAlert && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Alert ID</Label>
                    <p className="font-medium">#{selectedAlert.id}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Order ID</Label>
                    <p className="font-medium">#{selectedAlert.orderId}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <p className="font-medium">{selectedAlert.type.replace("_", " ")}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Amount</Label>
                    <p className="font-medium">${(selectedAlert.amount / 100).toFixed(2)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Severity</Label>
                    <Badge className={getSeverityColor(selectedAlert.severity)}>
                      {selectedAlert.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className={getStatusColor(selectedAlert.status)}>
                      {selectedAlert.status.replace("_", " ").toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{selectedAlert.description}</p>
                </div>

                <div>
                  <Label className="text-muted-foreground">Created At</Label>
                  <p className="mt-1">{new Date(selectedAlert.createdAt).toLocaleString()}</p>
                </div>

                {selectedAlert.resolvedAt && (
                  <div>
                    <Label className="text-muted-foreground">Resolved At</Label>
                    <p className="mt-1">{new Date(selectedAlert.resolvedAt).toLocaleString()}</p>
                  </div>
                )}

                {selectedAlert.notes && (
                  <div>
                    <Label className="text-muted-foreground">Notes</Label>
                    <p className="mt-1">{selectedAlert.notes}</p>
                  </div>
                )}

                <Separator />

                <div className="flex gap-2">
                  <Button onClick={() => setIsDetailDialogOpen(false)}>Close</Button>
                  {selectedAlert.status === "pending" && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleInvestigate(selectedAlert.id);
                          setIsDetailDialogOpen(false);
                        }}
                      >
                        Investigate
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleResolve(selectedAlert.id, "resolved");
                          setIsDetailDialogOpen(false);
                        }}
                      >
                        Resolve
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
